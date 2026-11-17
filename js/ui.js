// ============================================================
// Emberforge — interface
// ============================================================

import {
  CONFIG, GENERATORS, UPGRADE_BY_ID, RITES, ACHIEVEMENTS,
} from "./data.js";
import * as game from "./state.js";
import { fmt, fmtWhole, pct, fmtTime, clamp, rand } from "./util.js";
import { sfx } from "./audio.js";
import { fx } from "./fx.js";

const $ = (sel, root = document) => root.querySelector(sel);

let els = {};
const refs = {
  gens: new Map(),
  upgrades: new Map(),
  rites: new Map(),
  achs: new Map(),
};

let lastGenSig = "";
let lastUpSig = "";
let lastOwnedCount = -1;
let knownAch = new Set();
let ownedOpen = false;
let veinEl = null;
let veinId = null;
let strikeTimer = 0;
let surgeWasReady = false;
let lastSurgeActive = false;
let closeOnBackdrop = true;
let lastErrorToast = 0;
let lastTyping = 0;
let lastHint = "";
let comboMilestone = 0;
let titleSecond = -1;

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
export function initUI() {
  els = {
    app: $("#app"),
    scene: $("#scene"),
    anvil: $("#anvil-hit"),
    hint: $("#hint"),
    ore: $("#ore"),
    rate: $("#rate"),
    embers: $("#embers"),
    bestRate: $("#best-rate"),
    combo: $("#combo"),
    comboValue: $("#combo-value"),
    comboFill: $("#combo-fill"),
    surgeBtn: $("#surge-btn"),
    surgeFill: $("#surge-fill"),
    surgeState: $("#surge-state"),
    surgeHint: $("#surge-hint"),
    statClick: $("#stat-click"),
    statCrit: $("#stat-crit"),
    statAuto: $("#stat-auto"),
    tabButtons: Array.from(document.querySelectorAll(".tab")),
    panels: Array.from(document.querySelectorAll(".tabpanel")),
    panelScroll: $("#panel-scroll"),
    genList: $("#gen-list"),
    upgradeGrid: $("#upgrade-grid"),
    upgradeEmpty: $("#upgrade-empty"),
    ownedBtn: $("#btn-owned"),
    ownedList: $("#owned-list"),
    ownedCount: $("#owned-count"),
    badgeUpgrades: $("#badge-upgrades"),
    modeButtons: Array.from(document.querySelectorAll(".mode")),
    emberCount: $("#ember-count"),
    emberBonus: $("#ember-bonus"),
    emberGain: $("#ember-gain"),
    runOre: $("#run-ore"),
    bestRun: $("#best-run"),
    btnRekindle: $("#btn-rekindle"),
    rekindleHint: $("#rekindle-hint"),
    rites: $("#rites"),
    achGrid: $("#ach-grid"),
    achCount: $("#ach-count"),
    floatLayer: $("#float-layer"),
    veinLayer: $("#vein-layer"),
    btnSound: $("#btn-sound"),
    btnHelp: $("#btn-help"),
    btnStats: $("#btn-stats"),
    btnExport: $("#btn-export"),
    btnImport: $("#btn-import"),
    btnReset: $("#btn-reset"),
    toasts: $("#toasts"),
    modal: $("#modal"),
    modalCard: $("#modal-card"),
  };

  knownAch = new Set(Object.keys(game.state.ach));
  applySoundUI();
  setBuyModeUI(game.state.settings.buyMode);

  bindEvents();
  renderGenerators(true);
  renderUpgrades(true);
  renderOwned(true);
  renderRites();
  renderTrophies();
  refresh();

  return { refresh, showOffline, toast };
}

function bindEvents() {
  els.anvil.addEventListener("click", onStrike);
  els.surgeBtn.addEventListener("click", onSurge);
  els.genList.addEventListener("click", onGeneratorClick);
  els.upgradeGrid.addEventListener("click", onUpgradeClick);
  els.ownedBtn.addEventListener("click", toggleOwned);
  els.rites.addEventListener("click", onRiteClick);

  for (const btn of els.tabButtons) {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  }
  for (const btn of els.modeButtons) {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      game.setBuyMode(mode);
      setBuyModeUI(mode);
      refresh();
      sfx.unlock();
    });
  }

  els.btnSound.addEventListener("click", () => {
    const muted = game.toggleMuted();
    applySoundUI();
    game.saveGame();
    if (!muted) sfx.ready();
  });
  els.btnHelp.addEventListener("click", openHelp);

  els.btnStats.addEventListener("click", openStats);
  els.btnExport.addEventListener("click", openExport);
  els.btnImport.addEventListener("click", openImport);
  els.btnReset.addEventListener("click", openReset);
  els.btnRekindle.addEventListener("click", openRekindle);

  els.modal.addEventListener("click", (e) => {
    if (closeOnBackdrop && e.target.classList.contains("modal-backdrop")) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!els.modal.hidden) closeModal();
      return;
    }
    if (!els.modal.hidden) return;
    if (isTyping(e.target)) return;
    if (e.repeat) return;
    if (e.key === "e" || e.key === "E") {
      e.preventDefault();
      onSurge();
      return;
    }
    if (e.code !== "Space" && e.key !== " ") return;
    e.preventDefault();
    onStrike();
  });

  document.addEventListener("pointerdown", () => {
    sfx.setMuted(game.state.settings.muted);
    sfx.unlock();
  }, { passive: true });
}

// ------------------------------------------------------------
// Active play
// ------------------------------------------------------------
function onStrike() {
  if (!game.state) return;
  const res = game.strikeAnvil();
  if (!res) return;

  animateStrike();
  const point = anvilPoint();
  fx.strike(point.x, point.y, res.crit);
  floatAt(
    point.x + rand(-26, 26),
    point.y - 6 + rand(-10, 10),
    (res.crit ? "CRIT +" : "+") + fmt(res.amount),
    res.crit ? "crit" : "",
  );
  sfx.hit(res.crit);

  if (res.surgeReady && !surgeWasReady) {
    toast("Molten Surge is ready — unleash it!", "good");
    sfx.ready();
  }
  surgeWasReady = res.surgeReady;

  if (res.combo > comboMilestone) {
    if (res.combo >= 40 && comboMilestone < 40) {
      comboMilestone = 40;
      toast("40-strike combo — the anvil is white-hot!", "good");
    } else if (res.combo >= 25 && comboMilestone < 25) {
      comboMilestone = 25;
      toast("25-strike combo — flawless rhythm!", "good");
    } else if (res.combo >= 10 && comboMilestone < 10) {
      comboMilestone = 10;
      toast("10-strike combo — keep it ringing!", "good");
    }
  }

  refresh();
}

function onSurge() {
  const res = game.activateSurge();
  if (res.ok) {
    sfx.surge();
    surgeWasReady = false;
    lastSurgeActive = true;
    toast(`Molten Surge! ×${fmt(res.multiplier)} ore for ${Math.round(res.duration)}s`, "good");
    game.saveGame();
    refresh();
  } else if (game.state.surgeActive <= 0) {
    sfx.error();
  }
}

function onGeneratorClick(e) {
  const row = e.target.closest(".gen-row");
  if (!row) return;
  const index = Number(row.dataset.index);
  const mode = game.state.settings.buyMode;
  const res = game.buyGenerator(index, mode);

  if (res.ok) {
    sfx.buy();
    row.classList.remove("is-bought");
    void row.offsetWidth;
    row.classList.add("is-bought");
    setTimeout(() => row.classList.remove("is-bought"), 380);
    game.saveGame();
    refresh();
  } else {
    sfx.error();
    row.classList.remove("nudge");
    void row.offsetWidth;
    row.classList.add("nudge");
    setTimeout(() => row.classList.remove("nudge"), 280);
    const now = Date.now();
    if (now - lastErrorToast > 1200) {
      lastErrorToast = now;
      const need = res.cost && res.cost > game.state.ore
        ? `Need ${fmt(res.cost)} ore for ×${res.count}.`
        : "Not enough ore yet — keep striking.";
      toast(need, "warn");
    }
  }
}

function onUpgradeClick(e) {
  const card = e.target.closest(".up-card");
  if (!card) return;
  const id = card.dataset.id;
  const res = game.buyUpgrade(id);
  if (res.ok) {
    sfx.ach();
    toast(`Upgrade forged: ${res.upgrade.name}`, "good");
    renderUpgrades(true);
    game.saveGame();
    refresh();
  } else {
    sfx.error();
    card.classList.remove("nudge");
    void card.offsetWidth;
    card.classList.add("nudge");
    setTimeout(() => card.classList.remove("nudge"), 280);
    const now = Date.now();
    if (now - lastErrorToast > 1200) {
      lastErrorToast = now;
      toast("Not enough ore for that upgrade yet.", "warn");
    }
  }
}

function onRiteClick(e) {
  const btn = e.target.closest(".rite-buy");
  if (!btn) return;
  const row = btn.closest(".rite");
  if (!row) return;
  const res = game.buyRite(row.dataset.id);
  if (res.ok) {
    sfx.prestige();
    toast(`Rite deepened: ${res.rite.name} — level ${res.level}`, "good");
    game.saveGame();
    refresh();
  } else if (res.reason !== "max") {
    sfx.error();
    toast("Not enough embers for that rite.", "warn");
  }
}

function activateTab(name) {
  if (!name) return;
  for (const btn of els.tabButtons) {
    const on = btn.dataset.tab === name;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", String(on));
  }
  for (const panel of els.panels) {
    panel.classList.toggle("is-active", panel.dataset.panel === name);
  }
  els.panelScroll.scrollTop = 0;
  if (name === "upgrades") renderUpgrades(true);
  refresh();
}

function setBuyModeUI(mode) {
  for (const btn of els.modeButtons) {
    btn.classList.toggle("is-active", btn.dataset.mode === mode);
  }
}

function applySoundUI() {
  const muted = game.state.settings.muted;
  els.app.classList.toggle("is-muted", muted);
  els.btnSound.setAttribute("aria-pressed", String(!muted));
  els.btnSound.setAttribute("title", muted ? "Sound off" : "Sound on");
  sfx.setMuted(muted);
}

// ------------------------------------------------------------
// Render — generators
// ------------------------------------------------------------
function visibleGeneratorIndices() {
  const S = game.state;
  const out = [];
  GENERATORS.forEach((g, i) => {
    if (i === 0 || (S.gens[g.id] || 0) > 0 || S.totalOre >= g.baseCost * 0.22) out.push(i);
  });
  return out;
}

function renderGenerators(force = false) {
  const list = visibleGeneratorIndices();
  const sig = list.join(",");
  if (!force && sig === lastGenSig) return;
  lastGenSig = sig;

  els.genList.innerHTML = "";
  refs.gens.clear();

  for (const index of list) {
    const g = GENERATORS[index];
    const row = document.createElement("button");
    row.type = "button";
    row.className = "gen-row";
    row.dataset.index = String(index);
    row.style.setProperty("--tone", g.tone);
    row.innerHTML = `
      <span class="gen-icon"><svg><use href="#${g.icon}"/></svg></span>
      <span class="gen-info">
        <span class="gen-top"><span class="gen-name">${g.name}</span><span class="gen-count">×0</span></span>
        <span class="gen-desc">${g.blurb}</span>
        <span class="gen-output"><b>0</b> /sec</span>
      </span>
      <span class="gen-buy">
        <span class="gen-cost"><small>×1</small><span class="gen-cost-num">0</span></span>
        <span class="gen-unit">+0/sec</span>
      </span>`;
    els.genList.appendChild(row);

    refs.gens.set(index, {
      row,
      count: $(".gen-count", row),
      outputB: $(".gen-output b", row),
      costNum: $(".gen-cost-num", row),
      costSmall: $(".gen-cost small", row),
      unit: $(".gen-unit", row),
    });
  }
}

function refreshGenerators(st) {
  const S = game.state;
  const mode = S.settings.buyMode;

  for (const [index, r] of refs.gens) {
    const g = GENERATORS[index];
    const owned = S.gens[g.id] || 0;
    let count = 1;
    if (mode === "max") {
      const max = game.maxBuyCount(index);
      count = max > 0 ? max : 1;
    } else {
      count = Number(mode) || 1;
    }
    const cost = game.generatorCost(index, count);
    const affordable = S.ore + 1e-6 >= cost && !(mode === "max" && game.maxBuyCount(index) < 1);

    r.count.textContent = "×" + fmtWhole(owned);
    r.outputB.textContent = fmt(st.genRates[index] * owned);
    r.costSmall.textContent = "×" + fmtWhole(count);
    r.costNum.textContent = fmt(cost);
    r.costNum.classList.toggle("is-short", !affordable);
    r.unit.textContent = "+" + fmt(st.genRates[index] * count) + "/sec";
    r.row.classList.toggle("is-affordable", affordable);
    r.row.title = `${g.name} — ${fmt(st.genRates[index])} ore/sec each. Owned: ${fmtWhole(owned)}.`;
    r.row.setAttribute(
      "aria-label",
      `Buy ${count} ${g.name} for ${fmt(cost)} ore. You own ${owned}.`,
    );
  }
}

// ------------------------------------------------------------
// Render — upgrades
// ------------------------------------------------------------
function renderUpgrades(force = false) {
  const available = game.availableUpgrades();
  const sig = available.map((u) => u.id).join("|");
  if (!force && sig === lastUpSig) return;
  lastUpSig = sig;

  els.upgradeGrid.innerHTML = "";
  refs.upgrades.clear();

  for (const u of available) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "up-card";
    card.dataset.id = u.id;
    card.innerHTML = `
      <span class="up-icon"><svg><use href="#${u.icon}"/></svg></span>
      <span class="up-name">${u.name}</span>
      <span class="up-desc">${u.desc}</span>
      <span class="up-cost"><svg><use href="#i-ore"/></svg><span>${fmt(u.cost)}</span></span>`;
    els.upgradeGrid.appendChild(card);
    refs.upgrades.set(u.id, { card });
  }

  els.upgradeEmpty.hidden = available.length > 0;
  refreshUpgrades();
}

function refreshUpgrades() {
  const S = game.state;
  for (const [id, r] of refs.upgrades) {
    const u = UPGRADE_BY_ID[id];
    if (!u) continue;
    r.card.classList.toggle("is-affordable", S.ore + 1e-6 >= u.cost);
  }
}

function toggleOwned() {
  ownedOpen = !ownedOpen;
  els.ownedList.hidden = !ownedOpen;
  els.ownedBtn.classList.toggle("is-open", ownedOpen);
  if (ownedOpen) renderOwned(true);
}

function renderOwned(force = false) {
  const ids = Object.keys(game.state.upgrades);
  els.ownedCount.textContent = String(ids.length);
  if (!ownedOpen) {
    lastOwnedCount = ids.length;
    return;
  }
  if (!force && ids.length === lastOwnedCount) return;
  lastOwnedCount = ids.length;

  els.ownedList.innerHTML = "";
  if (!ids.length) {
    const empty = document.createElement("span");
    empty.className = "owned-chip";
    empty.textContent = "Nothing forged yet";
    els.ownedList.appendChild(empty);
    return;
  }
  for (const id of ids) {
    const u = UPGRADE_BY_ID[id];
    if (!u) continue;
    const chip = document.createElement("span");
    chip.className = "owned-chip";
    chip.innerHTML = `<svg><use href="#${u.icon}"/></svg>`;
    chip.appendChild(document.createTextNode(u.name));
    els.ownedList.appendChild(chip);
  }
}

// ------------------------------------------------------------
// Render — ember rites
// ------------------------------------------------------------
function renderRites() {
  els.rites.innerHTML = "";
  refs.rites.clear();

  for (const rite of RITES) {
    const row = document.createElement("div");
    row.className = "rite";
    row.dataset.id = rite.id;
    row.innerHTML = `
      <span class="rite-icon"><svg><use href="#${rite.icon}"/></svg></span>
      <div class="rite-info">
        <div class="rite-top"><span class="rite-name">${rite.name}</span><span class="rite-lv">Lv 0 / ${rite.max}</span></div>
        <div class="rite-desc">${rite.desc}</div>
        <span class="rite-meter"><i></i></span>
      </div>
      <button class="rite-buy" type="button">
        <span class="rite-cost">0</span>
        <small>embers</small>
      </button>`;
    els.rites.appendChild(row);

    refs.rites.set(rite.id, {
      row,
      lv: $(".rite-lv", row),
      meter: $(".rite-meter i", row),
      buy: $(".rite-buy", row),
      cost: $(".rite-cost", row),
      small: $(".rite-buy small", row),
    });
  }
}

function refreshRites() {
  const S = game.state;
  for (const rite of RITES) {
    const r = refs.rites.get(rite.id);
    if (!r) continue;
    const lvl = S.prestige[rite.id] || 0;
    const maxed = lvl >= rite.max;
    const cost = maxed ? 0 : rite.cost(lvl);

    r.lv.textContent = `Lv ${lvl} / ${rite.max}`;
    r.meter.style.width = `${(lvl / rite.max) * 100}%`;
    r.row.classList.toggle("is-maxed", maxed);
    r.buy.classList.toggle("is-maxed", maxed);
    r.buy.classList.toggle("is-affordable", !maxed && S.embers >= cost);
    r.cost.textContent = maxed ? "MAXED" : fmt(cost);
    r.small.textContent = maxed ? "complete" : "embers";
    r.buy.title = `${rite.name} — ${rite.value(lvl)}${maxed ? " (maxed)" : ` · next: ${rite.value(Math.min(rite.max, lvl + 1))}`}`;
  }
}

// ------------------------------------------------------------
// Render — trophies
// ------------------------------------------------------------
function renderTrophies() {
  els.achGrid.innerHTML = "";
  refs.achs.clear();

  for (const a of ACHIEVEMENTS) {
    const card = document.createElement("div");
    card.className = "ach";
    card.dataset.id = a.id;

    const mark = document.createElement("span");
    mark.className = "ach-mark";
    mark.innerHTML = '<svg><use href="#i-star"/></svg>';

    const name = document.createElement("span");
    name.className = "ach-name";
    name.textContent = a.name;

    const desc = document.createElement("span");
    desc.className = "ach-desc";
    desc.textContent = a.desc;

    card.append(mark, name, desc);

    let progFill = null;
    let progLabel = null;
    if (a.target) {
      const progress = document.createElement("span");
      progress.className = "ach-progress";
      progLabel = document.createElement("span");
      progFill = document.createElement("i");
      progress.append(progLabel, progFill);
      card.appendChild(progress);
    }

    els.achGrid.appendChild(card);
    refs.achs.set(a.id, {
      card,
      on: false,
      progFill,
      progLabel,
      lastKey: "",
    });
  }
}

function refreshTrophies() {
  const S = game.state;
  let onCount = 0;

  for (const a of ACHIEVEMENTS) {
    const r = refs.achs.get(a.id);
    if (!r) continue;
    const on = !!S.ach[a.id];
    if (r.on !== on) {
      r.card.classList.toggle("is-on", on);
      r.on = on;
    }
    if (on) onCount += 1;

    if (a.target && a.get) {
      const value = Math.max(0, Number(a.get(S)) || 0);
      const ratio = clamp(value / a.target, 0, 1);
      const key = on ? "done" : `${Math.floor(ratio * 100)}:${fmtWhole(value)}`;
      if (r.lastKey !== key) {
        r.lastKey = key;
        if (r.progFill) r.progFill.style.setProperty("--p", `${(ratio * 100).toFixed(1)}%`);
        if (r.progLabel) r.progLabel.textContent = on ? "Earned · +1% production" : `${fmtWhole(value)} / ${fmtWhole(a.target)}`;
      }
    }
  }

  els.achCount.textContent = `${onCount} / ${ACHIEVEMENTS.length}`;
}

// ------------------------------------------------------------
// Refresh everything
// ------------------------------------------------------------
export function refresh() {
  const S = game.state;
  if (!S) return;
  const st = game.getStats();

  els.ore.textContent = fmt(S.ore);
  els.rate.textContent = fmt(st.totalRate);
  els.embers.textContent = fmtWhole(S.embers);
  els.bestRate.textContent = fmt(S.stats.bestRate);

  els.statClick.textContent = fmt(st.clickPower);
  els.statClick.title = `${fmt(st.clickPower)} base strike · ${pct(st.comboBonus, 0)} per combo stack`;
  els.statCrit.textContent = `${Math.round(st.critChance * 100)}%`;
  els.statCrit.title = `Crit chance ${pct(st.critChance, 1)} · crit multiplier ×${fmt(st.critMult)}`;
  els.statAuto.textContent = st.autoPower > 0
    ? `${Math.round(st.autoPower * 100)}% / ${st.autoInterval}s`
    : "—";
  els.statAuto.title = st.autoPower > 0
    ? "Ancestral Hammer strikes automatically while you idle."
    : "Buy the Ancestral Hammer upgrade to strike while idle.";

  renderGenerators();
  renderUpgrades();
  refreshGenerators(st);
  refreshUpgrades();
  refreshRites();
  refreshEmbers(st);
  refreshSurge(st);
  refreshCombo(st);
  refreshVein();
  refreshTrophies();
  checkNewTrophies();
  renderOwned();
  refreshBadges();
  refreshHint();
  refreshTitle(S);
}

function refreshHint() {
  const S = game.state;
  const hasGen = Object.values(S.gens).some((n) => n > 0);
  const hasUpgrade = Object.keys(S.upgrades).length > 0;
  const canBuyFirst = S.ore + 1e-6 >= GENERATORS[0].baseCost;
  const affordableUpgrade = game.availableUpgrades().some((u) => S.ore + 1e-6 >= u.cost);
  const next = GENERATORS.find((g, i) => i > 0 && (S.gens[g.id] || 0) === 0 && S.totalOre < g.baseCost * 0.22);
  const surgeReady = S.surgeActive <= 0 && S.surgeCharge >= CONFIG.surgeMax;

  let html = "";
  let done = false;

  if (S.clicks < 1) {
    html = 'Strike the anvil — or press <kbd>Space</kbd>';
  } else if (!hasGen && canBuyFirst) {
    html = "Hire your first <b>Forge Hand</b> in the Forge list";
  } else if (!hasGen) {
    html = `Keep striking — <b>${fmt(Math.max(0, GENERATORS[0].baseCost - S.ore))}</b> ore to hire a Forge Hand`;
  } else if (surgeReady) {
    html = "<b>Molten Surge is ready</b> — unleash it below";
  } else if (affordableUpgrade && (!hasUpgrade || S.clicks < 30)) {
    html = "An <b>upgrade</b> is ready — open the Upgrades tab";
  } else if (next) {
    html = `Next: <b>${next.name}</b> at ${fmt(next.baseCost * 0.22)} lifetime ore`;
  } else if (S.clicks < 14) {
    html = "Rapid strikes build a <b>combo</b>";
  } else {
    done = true;
  }

  els.hint.classList.toggle("is-gone", done);
  if (html !== lastHint) {
    lastHint = html;
    els.hint.innerHTML = html;
  }
}

function refreshTitle(S) {
  const sec = Math.floor(Date.now() / 1000);
  if (sec === titleSecond) return;
  titleSecond = sec;
  const label = `Emberforge — ${fmt(S.ore)} ore`;
  if (document.title !== label) document.title = label;
}

function refreshEmbers(st) {
  const S = game.state;
  const gain = game.emberGain(S.runOre);
  const ready = gain >= CONFIG.emberMin;

  els.emberCount.textContent = fmtWhole(S.embers);
  els.emberBonus.textContent = `+${Math.round(st.emberBonusPct * 100)}%`;
  els.emberBonus.title = `${fmtWhole(S.embersTotal)} embers earned in total · +4% production each`;
  els.emberGain.textContent = fmtWhole(gain);
  els.runOre.textContent = fmt(S.runOre);
  els.bestRun.textContent = fmt(S.runBestRate);

  els.btnRekindle.disabled = !ready;
  els.btnRekindle.textContent = ready ? `Rekindle · +${fmtWhole(gain)} embers` : "Rekindle";
  if (ready) {
    els.rekindleHint.textContent = "Ore, generators and upgrades reset. Embers, rites and trophies are kept.";
  } else {
    const target = Math.pow(CONFIG.emberMin / CONFIG.emberBase, 2) * CONFIG.emberDivisor;
    els.rekindleHint.textContent = `${fmt(S.runOre)} / ${fmt(target)} run ore until the first rekindle.`;
  }

  const nextEmber = Math.pow((gain + 1) / CONFIG.emberBase, 2) * CONFIG.emberDivisor;
  els.emberGain.title = ready
    ? `${fmtWhole(gain)} embers waiting — rekindle to claim them.`
    : `Next ember at ${fmt(nextEmber)} run ore.`;
}

function refreshSurge(st) {
  const S = game.state;
  const active = S.surgeActive > 0;
  const charge = clamp(S.surgeCharge, 0, CONFIG.surgeMax);
  const ready = !active && charge >= CONFIG.surgeMax;

  els.surgeFill.style.width = `${(charge / CONFIG.surgeMax) * 100}%`;
  els.surgeBtn.classList.toggle("is-active", active);
  els.surgeBtn.classList.toggle("is-ready", ready);
  els.app.classList.toggle("is-surging", active);
  els.surgeBtn.setAttribute(
    "aria-label",
    active
      ? `Molten Surge active, ${Math.ceil(S.surgeActive)} seconds left`
      : ready
        ? "Molten Surge ready — activate"
        : `Molten Surge, ${Math.floor(charge)} percent charged`,
  );

  if (active) {
    els.surgeState.textContent = `${Math.ceil(S.surgeActive)}s`;
    els.surgeHint.textContent = `×${fmt(st.surgeMul)} ore · hammer ×${CONFIG.surgeClickMul}`;
  } else if (ready) {
    els.surgeState.textContent = "READY";
    els.surgeHint.textContent = "Click to unleash the mountain";
  } else {
    els.surgeState.textContent = `${Math.floor(charge)}%`;
    els.surgeHint.textContent = "Strike the anvil to charge";
  }

  if (lastSurgeActive && !active) sfx.surgeEnd();
  lastSurgeActive = active;
  surgeWasReady = charge >= CONFIG.surgeMax;
}

function refreshCombo(st) {
  const S = game.state;
  const show = S.combo > 0;
  els.combo.hidden = !show;
  if (!show) {
    comboMilestone = 0;
    return;
  }
  const bonus = 1 + S.combo * st.comboBonus;
  els.comboValue.textContent = `×${bonus.toFixed(2)}`;
  els.comboFill.style.width = `${clamp(S.comboTimer / CONFIG.comboWindow, 0, 1) * 100}%`;
}

function refreshBadges() {
  const S = game.state;
  const count = game.availableUpgrades().filter((u) => S.ore + 1e-6 >= u.cost).length;
  els.badgeUpgrades.hidden = count === 0;
  els.badgeUpgrades.textContent = String(count);
}

function refreshVein() {
  const S = game.state;
  const v = S.vein;

  if (!v) {
    if (veinEl) {
      veinEl.remove();
      veinEl = null;
      veinId = null;
    }
    return;
  }

  if (!veinEl || veinId !== v.id) {
    if (veinEl) veinEl.remove();
    veinEl = document.createElement("button");
    veinEl.type = "button";
    veinEl.className = "vein";
    veinEl.style.left = `${v.x}%`;
    veinEl.style.top = `${v.y}%`;
    veinEl.setAttribute("aria-label", "Shatter the ore vein");
    veinEl.innerHTML = '<svg viewBox="0 0 24 24"><use href="#i-vein"/></svg><span class="vein-life"><i></i></span>';
    veinEl.addEventListener("click", onVeinClick);
    els.veinLayer.appendChild(veinEl);
    veinId = v.id;
    sfx.ready();
  }

  const bar = veinEl.querySelector(".vein-life i");
  if (bar) bar.style.width = `${clamp(v.time / v.life, 0, 1) * 100}%`;
}

function onVeinClick(e) {
  e.stopPropagation();
  const res = game.clickVein();
  if (!res) return;

  if (veinEl) {
    const vr = veinEl.getBoundingClientRect();
    const sr = els.scene.getBoundingClientRect();
    const x = vr.left - sr.left + vr.width / 2;
    const y = vr.top - sr.top + vr.height / 2;
    fx.burst(x, y, "#7fe0d0", 34);
    floatAt(x, y - 12, "+" + fmt(res.gain), "vein");
  }
  sfx.vein();
  game.saveGame();
  toast(`Ore vein shattered — +${fmt(res.gain)} ore`, "good");

  if (veinEl) {
    veinEl.remove();
    veinEl = null;
    veinId = null;
  }
  refresh();
}

// ------------------------------------------------------------
// Effects helpers
// ------------------------------------------------------------
function anvilPoint() {
  const ar = els.anvil.getBoundingClientRect();
  const sr = els.scene.getBoundingClientRect();
  return {
    x: ar.left - sr.left + ar.width * 0.5,
    y: ar.top - sr.top + ar.height * 0.37,
  };
}

function animateStrike() {
  els.anvil.classList.remove("is-striking");
  void els.anvil.offsetWidth;
  els.anvil.classList.add("is-striking");
  clearTimeout(strikeTimer);
  strikeTimer = window.setTimeout(() => els.anvil.classList.remove("is-striking"), 240);
}

function floatAt(x, y, text, kind) {
  const node = document.createElement("span");
  node.className = "float" + (kind ? " " + kind : "");
  node.textContent = text;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  els.floatLayer.appendChild(node);
  while (els.floatLayer.children.length > 16) {
    els.floatLayer.firstElementChild.remove();
  }
  window.setTimeout(() => node.remove(), 1100);
}

// ------------------------------------------------------------
// Toasts
// ------------------------------------------------------------
export function toast(message, kind = "info") {
  if (!els.toasts) return;
  const node = document.createElement("div");
  node.className = "toast" + (kind !== "info" ? ` ${kind}` : "");
  const icon = kind === "good" ? "i-star" : kind === "warn" ? "i-ember" : "i-ember";
  node.innerHTML = `<svg><use href="#${icon}"/></svg><span></span>`;
  node.querySelector("span").textContent = message;
  els.toasts.appendChild(node);
  while (els.toasts.children.length > 3) els.toasts.firstElementChild.remove();
  window.setTimeout(() => {
    node.classList.add("out");
    window.setTimeout(() => node.remove(), 220);
  }, 3400);
}

function checkNewTrophies() {
  const ids = Object.keys(game.state.ach);
  if (ids.length === knownAch.size) return;

  const fresh = ids.filter((id) => !knownAch.has(id));
  knownAch = new Set(ids);
  if (!fresh.length) return;

  for (const id of fresh.slice(0, 3)) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) toast(`Trophy earned — ${a.name} · +1% production`, "good");
  }
  sfx.ach();
}

// ------------------------------------------------------------
// Modals
// ------------------------------------------------------------
function openModal({ title, body, actions = [], dismissible = true }) {
  lastTyping = Date.now();
  closeOnBackdrop = dismissible;

  let actionsHtml = "";
  if (actions.length) {
    actionsHtml = `<div class="modal-actions">${actions.map((a, i) => (
      `<button type="button" class="btn ${a.kind === "primary" ? "btn-primary" : ""}" data-action="${i}">${a.label}</button>`
    )).join("")}</div>`;
  }

  els.modalCard.innerHTML = `
    <button type="button" class="modal-close" aria-label="Close">
      <svg><use href="#i-close"/></svg>
    </button>
    <h2 id="modal-title">${title}</h2>
    <div class="modal-body">${body}</div>
    ${actionsHtml}`;

  els.modal.hidden = false;
  els.modalCard.scrollTop = 0;

  const closeBtn = els.modalCard.querySelector(".modal-close");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  actions.forEach((a, i) => {
    const btn = els.modalCard.querySelector(`[data-action="${i}"]`);
    if (btn) btn.addEventListener("click", () => (a.onClick ? a.onClick(closeModal) : closeModal()));
  });

  window.requestAnimationFrame(() => {
    const focusable = els.modalCard.querySelector(".modal-close");
    if (focusable) focusable.focus();
  });
}

function closeModal() {
  els.modal.hidden = true;
  els.modalCard.innerHTML = "";
  closeOnBackdrop = true;
}

function isTyping(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

function openHelp() {
  openModal({
    title: "How to forge",
    body: `
      <p><b>Hammer the anvil</b> to earn ore. Fast strikes build a <b>combo</b>; lucky strikes <b>crit</b> for a big burst.</p>
      <ul>
        <li>Buy <b>generators</b> in the Forge list — they produce ore even while you rest.</li>
        <li><b>Upgrades</b> multiply your forge. You keep them until you rekindle.</li>
        <li>Click glowing <b>ore veins</b>: they pay a burst of ore and charge your surge.</li>
        <li>Fill the <b>Molten Surge</b> meter with strikes, then unleash it for a huge temporary multiplier.</li>
        <li><b>Rekindle</b> when a run is worth 5+ embers. Embers and rites make every future run faster.</li>
        <li>The forge keeps working <b>offline</b>, up to 8 hours (more with upgrades and rites).</li>
      </ul>
      <p><b>Space</b> hammers too, and <b>E</b> unleashes a charged surge. Your progress saves automatically in this browser — use Export for a backup.</p>`,
    actions: [{ label: "Back to the anvil", kind: "primary" }],
  });
}

function openStats() {
  const S = game.state;
  const st = game.getStats();
  const rows = [
    ["Ore in the vault", fmt(S.ore)],
    ["Ore per second", fmt(st.totalRate)],
    ["Lifetime ore", fmt(S.totalOre)],
    ["Peak ore per second", fmt(S.stats.bestRate)],
    ["Manual strikes", fmtWhole(S.clicks)],
    ["Critical hits", fmtWhole(S.stats.crits)],
    ["Auto strikes", fmtWhole(S.stats.auto)],
    ["Best combo", fmtWhole(S.stats.bestCombo)],
    ["Surges unleashed", fmtWhole(S.stats.surges)],
    ["Veins shattered", fmtWhole(S.stats.veins)],
    ["Rekindles", fmtWhole(S.stats.rekindles)],
    ["Embers earned", fmtWhole(S.embersTotal)],
    ["Trophies", `${Object.keys(S.ach).length} / ${ACHIEVEMENTS.length}`],
    ["Time at the forge", fmtTime(S.stats.playTime)],
  ];

  openModal({
    title: "Forge records",
    body: `<div class="stat-table">${rows.map(([k, v]) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`).join("")}</div>`,
    actions: [{ label: "Close", kind: "primary" }],
  });
}

function openExport() {
  const code = game.exportSave();
  openModal({
    title: "Export save",
    body: `
      <p>Copy this code and store it somewhere safe. Load it with <b>Import</b> on any browser.</p>
      <textarea class="save-area" readonly id="save-code" spellcheck="false">${code}</textarea>
      <p class="modal-note" id="copy-note">Autosaves every few seconds in this browser.</p>`,
    actions: [
      {
        label: "Copy code",
        kind: "primary",
        onClick: async () => {
          const note = els.modalCard.querySelector("#copy-note");
          const area = els.modalCard.querySelector("#save-code");
          let ok = false;
          try {
            await navigator.clipboard.writeText(code);
            ok = true;
          } catch {
            try {
              if (area) {
                area.focus();
                area.select();
                ok = document.execCommand("copy");
              }
            } catch {
              ok = false;
            }
          }
          if (note) {
            note.textContent = ok ? "Save code copied." : "Select the code and copy it manually.";
            note.className = "modal-note " + (ok ? "ok" : "bad");
          }
        },
      },
      { label: "Done", onClick: (close) => close() },
    ],
  });
}

function openImport() {
  openModal({
    title: "Import save",
    body: `
      <p>This replaces your current forge with the imported save.</p>
      <textarea class="save-area" id="import-code" spellcheck="false" placeholder="Paste your Emberforge save code…"></textarea>
      <p class="modal-note" id="import-note"></p>`,
    actions: [
      {
        label: "Load save",
        kind: "primary",
        onClick: (close) => {
          const area = els.modalCard.querySelector("#import-code");
          const note = els.modalCard.querySelector("#import-note");
          const res = game.importSave(area ? area.value : "");
          if (res.ok) {
            close();
            resetUIAfterStateChange();
            toast("Save loaded — welcome back, smith.", "good");
          } else if (note) {
            note.textContent = res.error;
            note.className = "modal-note bad";
          }
        },
      },
      { label: "Cancel", onClick: (close) => close() },
    ],
  });
}

function openReset() {
  openModal({
    title: "Erase this forge?",
    body: `
      <p>This deletes your ore, embers, rites, trophies and every record in this browser.</p>
      <p><b>This cannot be undone.</b> Export a save first if you might want it back.</p>`,
    actions: [
      { label: "Keep my forge", kind: "primary", onClick: (close) => close() },
      {
        label: "Erase everything",
        onClick: (close) => {
          game.resetGame(true);
          close();
          sfx.error();
          resetUIAfterStateChange();
          toast("The forge is cold and empty. A fresh start.", "warn");
        },
      },
    ],
  });
}

function openRekindle() {
  const S = game.state;
  const gain = game.emberGain(S.runOre);
  if (gain < CONFIG.emberMin) {
    toast(`You need at least ${CONFIG.emberMin} embers to rekindle.`, "warn");
    return;
  }

  openModal({
    title: "Rekindle the forge?",
    body: `
      <p>You will gain <b>${fmtWhole(gain)} embers</b>, worth <b>+${(gain * CONFIG.emberPerPoint * 100).toFixed(0)}%</b> production forever.</p>
      <ul>
        <li><b>Lost:</b> ore, generators and upgrades from this run.</li>
        <li><b>Kept:</b> embers, rites, trophies and lifetime records.</li>
      </ul>
      <p>Your current run is worth ${fmt(S.runOre)} ore at ${fmt(S.runBestRate)} ore/sec peak.</p>`,
    actions: [
      { label: "Not yet", onClick: (close) => close() },
      {
        label: `Rekindle · +${fmtWhole(gain)} embers`,
        kind: "primary",
        onClick: (close) => {
          const res = game.rekindle();
          close();
          if (!res.ok) {
            toast("The coals aren't ready yet.", "warn");
            return;
          }
          sfx.prestige();
          game.saveGame();
          const center = anvilPoint();
          fx.burst(center.x, center.y, "#ffc46a", 60);
          resetUIAfterStateChange();
          toast(`The forge is reborn — +${fmtWhole(res.gain)} embers.`, "good");
          activateTab("embers");
        },
      },
    ],
  });
}

function resetUIAfterStateChange() {
  knownAch = new Set(Object.keys(game.state.ach));
  lastGenSig = "";
  lastUpSig = "";
  lastOwnedCount = -1;
  ownedOpen = false;
  els.ownedList.hidden = true;
  els.ownedBtn.classList.remove("is-open");
  surgeWasReady = false;
  lastSurgeActive = false;
  if (veinEl) {
    veinEl.remove();
    veinEl = null;
    veinId = null;
  }
  applySoundUI();
  setBuyModeUI(game.state.settings.buyMode);
  renderGenerators(true);
  renderUpgrades(true);
  renderOwned(true);
  renderRites();
  renderTrophies();
  refresh();
}

// ------------------------------------------------------------
// Offline modal
// ------------------------------------------------------------
export function showOffline(info) {
  if (!info || info.gain <= 0) return;
  const capped = info.fullSeconds > info.seconds + 5;
  openModal({
    title: "The forge kept burning",
    body: `
      <div class="offline-gain">
        <span class="big">+${fmt(info.gain)}</span>
        <span class="sub">ore gathered while you were away</span>
      </div>
      <div class="stat-table">
        <div class="stat-row"><span>Away for</span><b>${fmtTime(info.seconds)}</b></div>
        <div class="stat-row"><span>Offline rate</span><b>${Math.round(info.efficiency * 100)}%</b></div>
        <div class="stat-row"><span>Effective rate</span><b>${fmt(info.rate)} ore/sec</b></div>
      </div>
      <p>${capped ? "Your offline cap was reached — more upgrades and rites extend it." : "The apprentices kept the coals alive."}</p>`,
    actions: [{ label: "Back to the anvil", kind: "primary" }],
  });
}
