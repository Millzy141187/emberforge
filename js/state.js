// ============================================================
// Emberforge — game engine
// Pure-ish logic: all inputs come from the state object, the only
// browser dependency is localStorage (guarded for Node).
// ============================================================

import {
  CONFIG, GENERATORS, UPGRADES, UPGRADE_BY_ID, RITES, RITE_BY_ID,
  ACHIEVEMENTS, totalGenerators,
} from "./data.js";
import { clamp, rand } from "./util.js";

const STORE = (() => {
  try {
    return typeof localStorage !== "undefined" && localStorage ? localStorage : null;
  } catch {
    return null;
  }
})();

/** Live module state. Reassigned on import/reset; importers see the new value. */
export let state = null;
let statsCache = null;

export function getStats() {
  if (!statsCache) refreshStats();
  return statsCache;
}

// ------------------------------------------------------------
// State
// ------------------------------------------------------------
export function newState() {
  const gens = {};
  for (const g of GENERATORS) gens[g.id] = 0;

  return {
    v: CONFIG.version,
    ore: 0,
    totalOre: 0,
    runOre: 0,
    embers: 0,
    embersTotal: 0,
    clicks: 0,
    clicksRun: 0,
    gens,
    upgrades: {},
    ach: {},
    prestige: {},

    combo: 0,
    comboTimer: 0,
    surgeCharge: 0,
    surgeActive: 0,
    autoTimer: 0,
    veinTimer: CONFIG.veinFirst,
    vein: null,
    veinSeq: 1,

    stats: {
      crits: 0,
      surges: 0,
      veins: 0,
      auto: 0,
      bestRate: 0,
      bestCombo: 0,
      rekindles: 0,
      playTime: 0,
    },
    runBestRate: 0,

    settings: { muted: false, buyMode: "1" },
    lastSave: Date.now(),
    saveTimer: CONFIG.autosaveSeconds,
  };
}

function num(v, fallback = 0, min = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, n);
}

function int(v, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Math.floor(clamp(num(v, fallback, min), min, max));
}

function sanitize(raw) {
  const s = newState();
  if (!raw || typeof raw !== "object") return s;

  s.ore = num(raw.ore);
  s.totalOre = num(raw.totalOre);
  s.runOre = num(raw.runOre);
  s.embers = int(raw.embers);
  s.embersTotal = int(raw.embersTotal);
  s.clicks = int(raw.clicks);
  s.clicksRun = int(raw.clicksRun);

  if (raw.gens && typeof raw.gens === "object") {
    for (const g of GENERATORS) s.gens[g.id] = int(raw.gens[g.id], 0, 0, 1e9);
  }

  if (raw.upgrades && typeof raw.upgrades === "object") {
    for (const id of Object.keys(raw.upgrades)) {
      if (raw.upgrades[id] && UPGRADE_BY_ID[id]) s.upgrades[id] = true;
    }
  }

  if (raw.ach && typeof raw.ach === "object") {
    const known = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const id of Object.keys(raw.ach)) {
      if (raw.ach[id] && known.has(id)) s.ach[id] = true;
    }
  }

  if (raw.prestige && typeof raw.prestige === "object") {
    for (const r of RITES) {
      const lvl = int(raw.prestige[r.id], 0, 0, r.max);
      if (lvl > 0) s.prestige[r.id] = lvl;
    }
  }

  if (raw.stats && typeof raw.stats === "object") {
    for (const k of Object.keys(s.stats)) {
      s.stats[k] = num(raw.stats[k], s.stats[k]);
    }
  }

  s.runBestRate = num(raw.runBestRate);
  s.settings.muted = !!(raw.settings && raw.settings.muted);
  const mode = raw.settings && raw.settings.buyMode;
  if (mode === "1" || mode === "10" || mode === "100" || mode === "max") {
    s.settings.buyMode = mode;
  }

  s.lastSave = num(raw.lastSave, Date.now(), 0);
  // Never restore a live surge or vein from a save; timers would be stale.
  s.combo = 0;
  s.comboTimer = 0;
  s.surgeActive = 0;
  s.surgeCharge = clamp(num(raw.surgeCharge), 0, CONFIG.surgeMax);
  s.autoTimer = 0;
  s.vein = null;
  s.veinTimer = Math.max(8, num(raw.veinTimer, CONFIG.veinFirst));
  s.saveTimer = CONFIG.autosaveSeconds;

  return s;
}

export function boot() {
  let raw = null;
  if (STORE) {
    try {
      const text = STORE.getItem(CONFIG.saveKey);
      if (text) raw = JSON.parse(text);
    } catch {
      raw = null;
    }
  }
  state = sanitize(raw);
  refreshStats();
  return state;
}

// ------------------------------------------------------------
// Derived stats
// ------------------------------------------------------------
export function computeStats(S) {
  const upgrades = S.upgrades || {};
  const p = S.prestige || {};
  const achCount = Object.keys(S.ach || {}).length;
  const totalGens = totalGenerators(S);

  // Base multipliers: embers earned (not held) + trophies.
  let globalMul = (1 + CONFIG.emberPerPoint * S.embersTotal) * (1 + CONFIG.achBonus * achCount);

  let clickMul = 1;
  let clickFlat = 0;
  let clickFromRate = 0;
  let critChance = CONFIG.critChanceBase;
  let critMult = CONFIG.critMultBase;
  let comboMax = CONFIG.comboMaxBase;
  let comboBonus = CONFIG.comboBonusBase;
  let surgeMul = CONFIG.surgeMulBase;
  let surgeDur = CONFIG.surgeDurBase;
  let surgeGain = 1;
  let autoPower = 0;
  let offlineRate = CONFIG.offlineBaseRate;
  let offlineHours = CONFIG.offlineBaseHours;
  let veinValue = 1;
  let veinCd = 1;
  let passiveSurge = 0;
  let startOre = 0;
  const genMult = GENERATORS.map(() => 1);

  for (const u of UPGRADES) {
    if (!upgrades[u.id]) continue;
    for (const e of u.effects) {
      switch (e.k) {
        case "global": globalMul *= e.v; break;
        case "clickMult": clickMul *= e.v; break;
        case "clickFlat": clickFlat += e.v; break;
        case "clickFromRate": clickFromRate += e.v; break;
        case "critChance": critChance += e.v; break;
        case "critMult": critMult *= e.v; break;
        case "comboMax": comboMax += e.v; break;
        case "comboBonus": comboBonus += e.v; break;
        case "surgeMul": surgeMul *= e.v; break;
        case "surgeDur": surgeDur += e.v; break;
        case "surgeGain": surgeGain *= e.v; break;
        case "autoClick": autoPower = Math.max(autoPower, e.v); break;
        case "offlineRate": offlineRate += e.v; break;
        case "offlineHours": offlineHours += e.v; break;
        case "veinValue": veinValue *= e.v; break;
        case "veinCd": veinCd *= e.v; break;
        case "genMult": genMult[e.i] *= e.v; break;
        default: break;
      }
    }
  }

  // Ember rites
  const heart = p.heart || 0;
  const fist = p.fist || 0;
  const coals = p.coals || 0;
  const bellows = p.bellows || 0;
  const cinder = p.cinder || 0;
  const seeker = p.prospector || 0;
  const eternal = p.eternal || 0;
  const vigil = p.vigil || 0;

  globalMul *= 1 + 0.2 * heart;
  clickMul *= Math.pow(1.5, fist);
  offlineRate += 0.08 * coals;
  if (bellows > 0) startOre = Math.floor(250 * Math.pow(6, bellows));
  surgeMul += 2 * cinder;
  veinValue *= 1 + 0.25 * seeker;
  veinCd *= Math.max(0.35, 1 - 0.08 * seeker);
  surgeDur += 4 * eternal;
  passiveSurge += 0.4 * vigil;

  const surgeActive = (S.surgeActive || 0) > 0;
  const genRates = GENERATORS.map((g, i) => g.baseRate * genMult[i] * globalMul);
  const genTotals = GENERATORS.map((g, i) => genRates[i] * (S.gens[g.id] || 0));
  const baseRate = genTotals.reduce((sum, r) => sum + r, 0);
  const surgeFactor = surgeActive ? surgeMul : 1;
  const rate = baseRate * surgeFactor;

  let clickPower = (CONFIG.baseClick + clickFlat) * clickMul * globalMul;
  clickPower += baseRate * clickFromRate;
  if (surgeActive) clickPower *= CONFIG.surgeClickMul;

  const autoInterval = CONFIG.autoInterval;
  const autoDps = autoPower > 0 ? (clickPower * autoPower) / autoInterval : 0;
  const totalRate = rate + autoDps;

  return {
    globalMul,
    achCount,
    emberBonusPct: CONFIG.emberPerPoint * S.embersTotal,
    totalGens,
    upgradesOwned: Object.keys(upgrades).length,

    genRates,
    genTotals,
    baseRate,
    rate,
    totalRate,
    autoDps,

    clickPower,
    clickMul,
    critChance: clamp(critChance, 0, 0.95),
    critMult,
    comboMax,
    comboBonus,

    surgeMul,
    surgeDur,
    surgeGain,
    passiveSurge,
    surgeCost: CONFIG.surgeMax,

    autoPower,
    autoInterval,
    offlineRate: clamp(offlineRate, 0, 1),
    offlineHours,
    veinValue,
    veinCd,

    startOre,
    heart, fist, coals, bellows, cinder, seeker, eternal, vigil,
  };
}

export function refreshStats() {
  if (!state) return null;
  statsCache = computeStats(state);
  return statsCache;
}

// ------------------------------------------------------------
// Economy helpers
// ------------------------------------------------------------
function gainOre(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  state.ore += amount;
  state.totalOre += amount;
  state.runOre += amount;
}

export function emberGain(runOre) {
  const amt = CONFIG.emberBase * Math.sqrt(Math.max(0, runOre) / CONFIG.emberDivisor);
  return Math.floor(amt);
}

export function generatorCost(index, count) {
  const g = GENERATORS[index];
  if (!g) return Infinity;
  const owned = state.gens[g.id] || 0;
  const growth = CONFIG.costGrowth;
  return g.baseCost * Math.pow(growth, owned) * (Math.pow(growth, count) - 1) / (growth - 1);
}

// Cost of `count` units, starting from `owned`.
function costFor(baseCost, owned, count) {
  const growth = CONFIG.costGrowth;
  return baseCost * Math.pow(growth, owned) * (Math.pow(growth, count) - 1) / (growth - 1);
}

export function maxBuyCount(index) {
  const g = GENERATORS[index];
  if (!g) return 0;
  const owned = state.gens[g.id] || 0;
  const growth = CONFIG.costGrowth;
  const first = g.baseCost * Math.pow(growth, owned);
  if (state.ore < first) return 0;
  const inner = (state.ore * (growth - 1)) / first + 1;
  let n = Math.floor(Math.log(inner) / Math.log(growth));
  if (!Number.isFinite(n) || n < 1) n = 1;
  n = Math.min(n, CONFIG.maxBulk);
  while (n > 0 && costFor(g.baseCost, owned, n) > state.ore + 1e-6) n -= 1;
  return Math.max(0, n);
}

export function buyGenerator(index, mode) {
  const g = GENERATORS[index];
  if (!g) return { ok: false };
  const owned = state.gens[g.id] || 0;
  let count;

  if (mode === "max") {
    count = maxBuyCount(index);
    if (count < 1) return { ok: false, reason: "ore" };
  } else {
    count = Math.max(1, Number(mode) || 1);
  }

  const cost = costFor(g.baseCost, owned, count);
  if (state.ore + 1e-6 < cost) return { ok: false, reason: "ore", cost, count };

  state.ore -= cost;
  state.gens[g.id] = owned + count;
  refreshStats();
  return { ok: true, count, cost, generator: g };
}

export function buyUpgrade(id) {
  const u = UPGRADE_BY_ID[id];
  if (!u || state.upgrades[id]) return { ok: false };
  if (state.ore + 1e-6 < u.cost) return { ok: false, reason: "ore" };
  state.ore -= u.cost;
  state.upgrades[id] = true;
  refreshStats();
  return { ok: true, upgrade: u };
}

export function availableUpgrades() {
  return UPGRADES.filter((u) => !state.upgrades[u.id] && u.req(state));
}

export function riteCost(rite) {
  const lvl = state.prestige[rite.id] || 0;
  return rite.cost(lvl);
}

export function buyRite(id) {
  const rite = RITE_BY_ID[id];
  if (!rite) return { ok: false };
  const lvl = state.prestige[id] || 0;
  if (lvl >= rite.max) return { ok: false, reason: "max" };
  const cost = rite.cost(lvl);
  if (state.embers < cost) return { ok: false, reason: "embers" };
  state.embers -= cost;
  state.prestige[id] = lvl + 1;
  refreshStats();
  return { ok: true, rite, level: lvl + 1, cost };
}

// ------------------------------------------------------------
// Active play
// ------------------------------------------------------------
export function strikeAnvil() {
  const st = refreshStats();
  const surging = state.surgeActive > 0;
  const crit = Math.random() < st.critChance;

  let amount = st.clickPower * (1 + state.combo * st.comboBonus);
  if (crit) amount *= st.critMult;

  gainOre(amount);
  state.clicks += 1;
  state.clicksRun += 1;
  state.combo = Math.min(st.comboMax, state.combo + 1);
  state.comboTimer = CONFIG.comboWindow;
  state.stats.bestCombo = Math.max(state.stats.bestCombo, state.combo);
  if (crit) state.stats.crits += 1;

  if (!surging) {
    const charge = (CONFIG.surgeGainBase + (crit ? CONFIG.surgeCritBonus : 0)) * st.surgeGain;
    state.surgeCharge = Math.min(CONFIG.surgeMax, state.surgeCharge + charge);
  }

  return {
    amount,
    crit,
    combo: state.combo,
    comboMult: 1 + state.combo * st.comboBonus,
    surgeReady: state.surgeCharge >= CONFIG.surgeMax,
  };
}

export function activateSurge() {
  const st = refreshStats();
  if (state.surgeActive > 0 || state.surgeCharge < CONFIG.surgeMax) return { ok: false };
  state.surgeActive = st.surgeDur;
  state.surgeCharge = CONFIG.surgeMax;
  state.stats.surges += 1;
  refreshStats();
  return { ok: true, duration: st.surgeDur, multiplier: st.surgeMul };
}

export function clickVein() {
  if (!state.vein) return null;
  const st = refreshStats();
  const base = Math.max(
    st.totalRate * CONFIG.veinOreSeconds,
    st.clickPower * CONFIG.veinClickSeconds,
    10,
  );
  const gain = base * st.veinValue;
  gainOre(gain);
  state.stats.veins += 1;
  if (state.surgeActive <= 0) {
    state.surgeCharge = Math.min(CONFIG.surgeMax, state.surgeCharge + CONFIG.veinSurge);
  }
  state.vein = null;
  return { gain, surgeCharge: state.surgeCharge };
}

function spawnVein(st) {
  state.vein = {
    id: "vein-" + state.veinSeq++,
    x: rand(15, 85),
    y: rand(22, 64),
    time: CONFIG.veinLife,
    life: CONFIG.veinLife,
  };
  state.veinTimer = rand(CONFIG.veinMin, CONFIG.veinMax) * st.veinCd;
}

// ------------------------------------------------------------
// Tick
// ------------------------------------------------------------
export function tick(dt) {
  if (!state) return;
  const step = Math.min(Math.max(dt, 0), 30);
  const st = refreshStats();

  // Passive ore
  gainOre(st.rate * step);

  // Auto hammer
  if (st.autoPower > 0) {
    state.autoTimer -= step;
    let guard = 0;
    while (state.autoTimer <= 0 && guard < 50) {
      const d = st.clickPower * st.autoPower;
      gainOre(d);
      state.stats.auto += 1;
      state.autoTimer += st.autoInterval;
      guard += 1;
    }
    if (state.autoTimer < 0) state.autoTimer = st.autoInterval;
  }

  // Combo decay
  if (state.combo > 0) {
    state.comboTimer -= step;
    if (state.comboTimer <= 0) {
      state.combo = 0;
      state.comboTimer = 0;
    }
  }

  // Surge timer / passive charge
  if (state.surgeActive > 0) {
    state.surgeActive = Math.max(0, state.surgeActive - step);
    if (state.surgeActive > 0) {
      state.surgeCharge = (state.surgeActive / st.surgeDur) * CONFIG.surgeMax;
    } else {
      state.surgeActive = 0;
      state.surgeCharge = 0;
    }
  } else if (st.passiveSurge > 0) {
    state.surgeCharge = Math.min(CONFIG.surgeMax, state.surgeCharge + st.passiveSurge * step);
  }

  // Ore veins
  if (state.vein) {
    state.vein.time -= step;
    if (state.vein.time <= 0) state.vein = null;
  }
  state.veinTimer -= step;
  if (!state.vein && state.veinTimer <= 0 && state.totalOre >= 800) {
    spawnVein(st);
  }

  // Lifetime / run records
  state.stats.playTime += step;
  const rate = st.totalRate;
  if (rate > state.stats.bestRate) state.stats.bestRate = rate;
  if (rate > state.runBestRate) state.runBestRate = rate;

  // Trophies
  if (!state.achTimer || state.achTimer <= 0) {
    state.achTimer = 0.5;
    for (const a of ACHIEVEMENTS) {
      if (!state.ach[a.id] && a.check(state)) {
        state.ach[a.id] = true;
        refreshStats();
      }
    }
  } else {
    state.achTimer -= step;
  }

  // Autosave
  state.saveTimer = (state.saveTimer || CONFIG.autosaveSeconds) - step;
  if (state.saveTimer <= 0) saveGame();
}

// ------------------------------------------------------------
// Prestige
// ------------------------------------------------------------
export function canRekindle() {
  return emberGain(state.runOre) >= CONFIG.emberMin;
}

export function rekindle() {
  const gain = emberGain(state.runOre);
  if (gain < CONFIG.emberMin) return { ok: false, gain };

  state.embers += gain;
  state.embersTotal += gain;
  state.stats.rekindles += 1;

  state.ore = 0;
  state.runOre = 0;
  state.clicksRun = 0;
  state.runBestRate = 0;
  for (const g of GENERATORS) state.gens[g.id] = 0;
  state.upgrades = {};
  state.combo = 0;
  state.comboTimer = 0;
  state.surgeActive = 0;
  state.surgeCharge = 0;
  state.autoTimer = 0;
  state.vein = null;
  state.veinTimer = CONFIG.veinFirst;
  state.achTimer = 0;

  refreshStats();
  state.ore = statsCache.startOre;

  return { ok: true, gain, startOre: statsCache.startOre };
}

// ------------------------------------------------------------
// Offline progress
// ------------------------------------------------------------
export function applyOffline(seconds) {
  const st = refreshStats();
  const capped = Math.min(Math.max(0, seconds), st.offlineHours * 3600);
  const gain = st.totalRate * capped * st.offlineRate;
  gainOre(gain);
  state.lastSave = Date.now();
  refreshStats();
  return {
    seconds: capped,
    fullSeconds: Math.max(0, seconds),
    gain,
    rate: st.totalRate * st.offlineRate,
    efficiency: st.offlineRate,
  };
}

// ------------------------------------------------------------
// Persistence
// ------------------------------------------------------------
export function saveGame() {
  if (!state) return;
  state.lastSave = Date.now();
  state.saveTimer = CONFIG.autosaveSeconds;
  if (!STORE) return;
  try {
    STORE.setItem(CONFIG.saveKey, JSON.stringify(state));
  } catch {
    // Out of quota / private mode — keep playing regardless.
  }
}

export function exportSave() {
  if (!state) return "";
  state.lastSave = Date.now();
  try {
    return btoa(JSON.stringify(state));
  } catch {
    return "";
  }
}

export function importSave(text) {
  if (!text || !text.trim()) return { ok: false, error: "Paste a save code first." };
  let raw;
  const trimmed = text.trim();
  try {
    raw = JSON.parse(trimmed);
  } catch {
    try {
      raw = JSON.parse(atob(trimmed));
    } catch {
      return { ok: false, error: "That doesn't look like an Emberforge save." };
    }
  }
  if (!raw || typeof raw !== "object" || raw.v === undefined) {
    return { ok: false, error: "That doesn't look like an Emberforge save." };
  }
  state = sanitize(raw);
  state.lastSave = Date.now();
  refreshStats();
  saveGame();
  return { ok: true };
}

export function resetGame(keepSettings = true) {
  const settings = state ? { ...state.settings } : null;
  state = newState();
  if (keepSettings && settings) state.settings = settings;
  refreshStats();
  saveGame();
  return state;
}

export function setBuyMode(mode) {
  if (!state) return;
  if (mode === "1" || mode === "10" || mode === "100" || mode === "max") {
    state.settings.buyMode = mode;
  }
}

export function setMuted(muted) {
  if (!state) return;
  state.settings.muted = !!muted;
}

export function toggleMuted() {
  if (!state) return false;
  state.settings.muted = !state.settings.muted;
  return state.settings.muted;
}
