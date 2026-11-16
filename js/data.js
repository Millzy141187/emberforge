// ============================================================
// Emberforge — content and tuning
// ============================================================

export const CONFIG = {
  version: 1,
  saveKey: "emberforge.save.v1",

  tickSeconds: 0.1,
  autosaveSeconds: 6,
  costGrowth: 1.15,

  baseClick: 1,
  comboWindow: 1.2,
  comboMaxBase: 40,
  comboBonusBase: 0.06,
  critChanceBase: 0.04,
  critMultBase: 6,

  surgeMax: 100,
  surgeGainBase: 2.2,
  surgeCritBonus: 4,
  surgeMulBase: 12,
  surgeDurBase: 18,
  surgeClickMul: 3,

  veinFirst: 26,
  veinMin: 50,
  veinMax: 82,
  veinLife: 9,
  veinOreSeconds: 40,
  veinClickSeconds: 26,
  veinSurge: 25,

  offlineBaseRate: 0.5,
  offlineBaseHours: 8,

  emberDivisor: 1e6,
  emberBase: 6,
  emberPerPoint: 0.04,
  emberMin: 5,

  achBonus: 0.01,
  autoInterval: 2,
  offlineMinSeconds: 60,
  offlineModalSeconds: 90,

  maxBulk: 1000,
};

// ------------------------------------------------------------
// Generators
// ------------------------------------------------------------
export const GENERATORS = [
  {
    id: "hand", name: "Forge Hand", icon: "i-hand", tone: "#f2b45c",
    baseCost: 15, baseRate: 0.3,
    blurb: "A stout apprentice keeping the coals honest.",
  },
  {
    id: "tender", name: "Coal Tender", icon: "i-coal", tone: "#ff9d63",
    baseCost: 120, baseRate: 1.6,
    blurb: "Feeds the fire so you don't have to.",
  },
  {
    id: "bellows", name: "Great Bellows", icon: "i-bellows", tone: "#ffb37a",
    baseCost: 900, baseRate: 9,
    blurb: "Breathes like a sleeping mountain.",
  },
  {
    id: "cart", name: "Ore Cart", icon: "i-cart", tone: "#d6a06a",
    baseCost: 6000, baseRate: 48,
    blurb: "Rolls ore in from the deep seams.",
  },
  {
    id: "smelter", name: "Smelter", icon: "i-smelter", tone: "#ff8a4a",
    baseCost: 40000, baseRate: 260,
    blurb: "Turns raw rock into rivers of metal.",
  },
  {
    id: "golem", name: "Forge Golem", icon: "i-golem", tone: "#b79cff",
    baseCost: 280000, baseRate: 1500,
    blurb: "Stone hands. Endless patience.",
  },
  {
    id: "magma", name: "Magma Tap", icon: "i-magma", tone: "#ff6f3c",
    baseCost: 2e6, baseRate: 9000,
    blurb: "A pipe sunk into the world's blood.",
  },
  {
    id: "rune", name: "Rune Engine", icon: "i-rune", tone: "#7fe0d0",
    baseCost: 1.5e7, baseRate: 55000,
    blurb: "Old words doing the work of twenty smiths.",
  },
  {
    id: "dragon", name: "Dragonforge", icon: "i-dragon", tone: "#ffce6b",
    baseCost: 1.1e8, baseRate: 340000,
    blurb: "A wyrm's breath, borrowed and banked.",
  },
  {
    id: "void", name: "Void Anvil", icon: "i-void", tone: "#b79cff",
    baseCost: 8e8, baseRate: 2100000,
    blurb: "Hammers ore that hasn't been mined yet.",
  },
];

export function totalGenerators(S) {
  let n = 0;
  for (const g of GENERATORS) n += S.gens[g.id] || 0;
  return n;
}

// ------------------------------------------------------------
// Upgrades — bought once, kept through rekindles
// ------------------------------------------------------------
export const UPGRADES = [];

function upgrade(def) {
  UPGRADES.push(def);
}

// --- click line ---
upgrade({
  id: "honed-edge", name: "Honed Edge", icon: "i-hammer", cost: 30,
  req: (S) => S.clicks >= 8,
  desc: "Hammer strikes are twice as strong.",
  effects: [{ k: "clickMult", v: 2 }],
});
upgrade({
  id: "iron-grip", name: "Iron Grip", icon: "i-hammer", cost: 420,
  req: (S) => S.clicks >= 30,
  desc: "Hammer power ×2.",
  effects: [{ k: "clickMult", v: 2 }],
});
upgrade({
  id: "fracture-sense", name: "Fracture Sense", icon: "i-crit", cost: 1100,
  req: (S) => S.clicks >= 50,
  desc: "Critical strike chance +8%.",
  effects: [{ k: "critChance", v: 0.08 }],
});
upgrade({
  id: "forge-rhythm", name: "Rhythm of the Forge", icon: "i-ember", cost: 2400,
  req: (S) => S.clicks >= 90,
  desc: "Combo cap +25. Each combo step gives +2% more power.",
  effects: [{ k: "comboMax", v: 25 }, { k: "comboBonus", v: 0.02 }],
});
upgrade({
  id: "runic-hammer", name: "Runic Hammer", icon: "i-rune", cost: 11000,
  req: (S) => S.clicks >= 140,
  desc: "Clicks also gain 1.5% of your ore per second.",
  effects: [{ k: "clickFromRate", v: 0.015 }],
});
upgrade({
  id: "vein-sight", name: "Vein Sight", icon: "i-crit", cost: 38000,
  req: (S) => !!S.upgrades["fracture-sense"],
  desc: "Critical strike chance +9%.",
  effects: [{ k: "critChance", v: 0.09 }],
});
upgrade({
  id: "deep-fracture", name: "Deep Fracture", icon: "i-crit", cost: 180000,
  req: (S) => !!S.upgrades["vein-sight"],
  desc: "Critical strikes deal ×2 more damage.",
  effects: [{ k: "critMult", v: 2 }],
});
upgrade({
  id: "ancestral-hammer", name: "Ancestral Hammer", icon: "i-hammer", cost: 360000,
  req: (S) => S.clicks >= 260,
  desc: "An unseen smith strikes for 50% power every 2s.",
  effects: [{ k: "autoClick", v: 0.5 }],
});
upgrade({
  id: "deep-hammer", name: "Hammer of the Deep", icon: "i-hammer", cost: 3.8e6,
  req: (S) => !!S.upgrades["ancestral-hammer"],
  desc: "Hammer power ×3.",
  effects: [{ k: "clickMult", v: 3 }],
});
upgrade({
  id: "ember-wrath", name: "Wrath of Embers", icon: "i-ember", cost: 9e7,
  req: (S) => !!S.upgrades["deep-hammer"],
  desc: "Hammer power ×2 and crit chance +5%.",
  effects: [{ k: "clickMult", v: 2 }, { k: "critChance", v: 0.05 }],
});

// --- per-generator upgrades ---
const GEN_UP_A = [
  "Tempered Knuckles", "Fattened Coffers", "Deeper Draught", "Greased Axles",
  "Lined Crucible", "Runic Sinews", "Wider Vent", "Inscribed Rings",
  "Scale Bellows", "Empty Geometry",
];
const GEN_UP_B = [
  "Apprentice Guild", "Black Coal Pact", "Storm Lungs", "Mountain Rail",
  "White-Hot Heart", "Golem Choir", "Magma Flood", "Runeword Engine",
  "Wyrmfire", "Nothing At All",
];

GENERATORS.forEach((g, i) => {
  upgrade({
    id: `${g.id}-a`, name: GEN_UP_A[i], icon: g.icon, cost: Math.round(g.baseCost * 12),
    req: (S) => (S.gens[g.id] || 0) >= 8,
    desc: `${g.name} production ×2.`,
    effects: [{ k: "genMult", i, v: 2 }],
  });
  upgrade({
    id: `${g.id}-b`, name: GEN_UP_B[i], icon: g.icon, cost: Math.round(g.baseCost * 260),
    req: (S) => (S.gens[g.id] || 0) >= 30,
    desc: `${g.name} production ×3.`,
    effects: [{ k: "genMult", i, v: 3 }],
  });
});

// --- global line ---
upgrade({
  id: "forge-mastery", name: "Forge Mastery", icon: "i-anvil", cost: 90000,
  req: (S) => totalGenerators(S) >= 25,
  desc: "All production ×1.5.",
  effects: [{ k: "global", v: 1.5 }],
});
upgrade({
  id: "volcanic-draft", name: "Volcanic Draft", icon: "i-magma", cost: 3.2e6,
  req: (S) => totalGenerators(S) >= 60,
  desc: "All production ×1.6.",
  effects: [{ k: "global", v: 1.6 }],
});
upgrade({
  id: "heart-mountain", name: "Heart of the Mountain", icon: "i-ember", cost: 2.5e8,
  req: (S) => totalGenerators(S) >= 120,
  desc: "All production ×2.",
  effects: [{ k: "global", v: 2 }],
});
upgrade({
  id: "titan-bellows", name: "Titan's Bellows", icon: "i-bellows", cost: 6e9,
  req: (S) => totalGenerators(S) >= 220,
  desc: "All production ×2.5.",
  effects: [{ k: "global", v: 2.5 }],
});

// --- surge line ---
upgrade({
  id: "pressure-vessel", name: "Pressure Vessel", icon: "i-ember", cost: 14000,
  req: (S) => S.stats.surges >= 1,
  desc: "Molten Surge is ×1.5 stronger.",
  effects: [{ k: "surgeMul", v: 1.5 }],
});
upgrade({
  id: "kindling", name: "Kindling", icon: "i-coal", cost: 50000,
  req: (S) => S.stats.surges >= 3,
  desc: "Strikes charge the surge ×1.6 faster.",
  effects: [{ k: "surgeGain", v: 1.6 }],
});
upgrade({
  id: "long-burn", name: "Long Burn", icon: "i-ember", cost: 350000,
  req: (S) => S.stats.surges >= 8,
  desc: "Molten Surge lasts +10s.",
  effects: [{ k: "surgeDur", v: 10 }],
});
upgrade({
  id: "molten-core", name: "Molten Core", icon: "i-magma", cost: 1.4e7,
  req: (S) => !!S.upgrades["long-burn"],
  desc: "Molten Surge is ×2 stronger.",
  effects: [{ k: "surgeMul", v: 2 }],
});
upgrade({
  id: "unbroken-chain", name: "Unbroken Chain", icon: "i-rune", cost: 2.2e9,
  req: (S) => !!S.upgrades["molten-core"],
  desc: "Surge lasts +12s and charges ×1.5 faster.",
  effects: [{ k: "surgeDur", v: 12 }, { k: "surgeGain", v: 1.5 }],
});

// --- utility ---
upgrade({
  id: "night-shift", name: "Night Shift", icon: "i-coal", cost: 70000,
  req: (S) => totalGenerators(S) >= 20,
  desc: "Offline production +25% (up to 75%).",
  effects: [{ k: "offlineRate", v: 0.25 }],
});
upgrade({
  id: "deep-sleep", name: "Deep Sleep", icon: "i-ember", cost: 950000,
  req: (S) => !!S.upgrades["night-shift"],
  desc: "Offline production cap +16 hours.",
  effects: [{ k: "offlineHours", v: 16 }],
});
upgrade({
  id: "prospector", name: "Prospector's Eye", icon: "i-vein", cost: 18000,
  req: (S) => S.stats.veins >= 1,
  desc: "Ore veins are worth ×1.6 more and appear 25% more often.",
  effects: [{ k: "veinValue", v: 1.6 }, { k: "veinCd", v: 0.75 }],
});
upgrade({
  id: "lodestone", name: "Lodestone", icon: "i-vein", cost: 800000,
  req: (S) => !!S.upgrades["prospector"],
  desc: "Ore veins are worth ×2 more.",
  effects: [{ k: "veinValue", v: 2 }],
});
upgrade({
  id: "ore-sense", name: "Ore Sense", icon: "i-ore", cost: 240000,
  req: (S) => S.totalOre >= 5e6,
  desc: "All production ×1.1.",
  effects: [{ k: "global", v: 1.1 }],
});
upgrade({
  id: "rune-etching", name: "Rune Etching", icon: "i-rune", cost: 6e6,
  req: (S) => Object.keys(S.upgrades).length >= 15,
  desc: "All production ×1.25 and hammer power ×1.5.",
  effects: [{ k: "global", v: 1.25 }, { k: "clickMult", v: 1.5 }],
});

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// ------------------------------------------------------------
// Ember rites — permanent prestige upgrades
// ------------------------------------------------------------
export const RITES = [
  {
    id: "heart", name: "Ember Heart", icon: "i-ember", max: 25,
    cost: (lvl) => Math.ceil(3 * Math.pow(1.6, lvl)),
    desc: "+20% to all production per level.",
    value: (lvl) => `×${(1 + 0.2 * lvl).toFixed(2)} production`,
  },
  {
    id: "fist", name: "Molten Fist", icon: "i-hammer", max: 15,
    cost: (lvl) => Math.ceil(5 * Math.pow(1.9, lvl)),
    desc: "Hammer power ×1.5 per level.",
    value: (lvl) => `×${Math.pow(1.5, lvl).toFixed(1)} hammer`,
  },
  {
    id: "coals", name: "Deep Coals", icon: "i-coal", max: 6,
    cost: (lvl) => Math.ceil(6 * Math.pow(1.9, lvl)),
    desc: "+8% offline production rate per level.",
    value: (lvl) => `+${8 * lvl}% offline`,
  },
  {
    id: "bellows", name: "Eternal Bellows", icon: "i-bellows", max: 6,
    cost: (lvl) => Math.ceil(8 * Math.pow(2.6, lvl)),
    desc: "Begin every new run with a pile of ore.",
    value: (lvl) => (lvl ? `start with ${Math.floor(250 * Math.pow(6, lvl)).toLocaleString("en-US")} ore` : "start with 0 ore"),
  },
  {
    id: "cinder", name: "Cinder Trail", icon: "i-magma", max: 10,
    cost: (lvl) => Math.ceil(5 * Math.pow(2.1, lvl)),
    desc: "Molten Surge multiplier +2 per level.",
    value: (lvl) => `+${2 * lvl} surge power`,
  },
  {
    id: "prospector", name: "Vein Seeker", icon: "i-vein", max: 6,
    cost: (lvl) => Math.ceil(10 * Math.pow(2.3, lvl)),
    desc: "Ore veins are richer and appear sooner.",
    value: (lvl) => `+${25 * lvl}% vein ore`,
  },
  {
    id: "eternal", name: "Forge Eternal", icon: "i-anvil", max: 6,
    cost: (lvl) => Math.ceil(8 * Math.pow(2.2, lvl)),
    desc: "Molten Surge lasts +4s per level.",
    value: (lvl) => `+${4 * lvl}s surge`,
  },
  {
    id: "vigil", name: "Vigil of Embers", icon: "i-star", max: 6,
    cost: (lvl) => Math.ceil(12 * Math.pow(2.7, lvl)),
    desc: "The forge charges your surge even while idle.",
    value: (lvl) => `+${(0.4 * lvl).toFixed(1)}%/s passive charge`,
  },
];

export const RITE_BY_ID = Object.fromEntries(RITES.map((r) => [r.id, r]));

// ------------------------------------------------------------
// Achievements — each gives +1% global production
// ------------------------------------------------------------
export const ACHIEVEMENTS = [];

function trophy(id, name, desc, check, extra = {}) {
  ACHIEVEMENTS.push({ id, name, desc, check, ...extra });
}

function counted(id, name, desc, getter, target, fmtFn) {
  ACHIEVEMENTS.push({
    id, name, desc,
    check: (S) => getter(S) >= target,
    target,
    get: getter,
    fmtFn: fmtFn || ((v) => Math.floor(v).toLocaleString("en-US")),
  });
}

const bestOwned = (S) => GENERATORS.reduce((m, g) => Math.max(m, S.gens[g.id] || 0), 0);
const allTiers = (S) => GENERATORS.every((g) => (S.gens[g.id] || 0) > 0);
const stats = (S) => S.stats;

counted("first-spark", "First Spark", "Strike the anvil once.", (S) => S.clicks, 1);
counted("hammerhand", "Hammerhand", "Strike the anvil 100 times.", (S) => S.clicks, 100);
counted("blistered", "Blistered Palms", "Strike the anvil 500 times.", (S) => S.clicks, 500);
counted("anvil-chorus", "Anvil Chorus", "Strike the anvil 2,500 times.", (S) => S.clicks, 2500);
counted("kindling", "Kindling", "Earn 1,000 ore in total.", (S) => S.totalOre, 1e3);
counted("mountains-yield", "Mountain's Yield", "Earn 100,000 ore in total.", (S) => S.totalOre, 1e5);
counted("seam-splitter", "Seam Splitter", "Earn 10 million ore in total.", (S) => S.totalOre, 1e7);
counted("ore-baron", "Ore Baron", "Earn 1 billion ore in total.", (S) => S.totalOre, 1e9);
counted("worldwright", "Worldwright", "Earn 100 billion ore in total.", (S) => S.totalOre, 1e11);
counted("first-hires", "First Hires", "Own 10 generators in total.", totalGenerators, 10);
counted("full-crew", "Full Crew", "Own 75 generators in total.", totalGenerators, 75);
counted("industrial", "Industrial", "Own 200 generators in total.", totalGenerators, 200);
counted("forge-city", "Forge City", "Own 400 generators in total.", totalGenerators, 400);
counted("foreman", "Foreman", "Own 25 of a single generator.", bestOwned, 25);
trophy("all-stations", "All Stations", "Own at least one of every generator.", allTiers, { get: () => 0 });
counted("tinkerer", "Tinkerer", "Buy 5 upgrades.", (S) => Object.keys(S.upgrades).length, 5);
counted("artificer", "Artificer", "Buy 15 upgrades.", (S) => Object.keys(S.upgrades).length, 15);
counted("runemaster", "Runemaster", "Buy 30 upgrades.", (S) => Object.keys(S.upgrades).length, 30);
counted("overheat", "Overheat", "Unleash your first Molten Surge.", (S) => stats(S).surges, 1);
counted("furnace-heart", "Furnace Heart", "Unleash 15 Molten Surges.", (S) => stats(S).surges, 15);
counted("prospector-t", "Prospector", "Shatter an ore vein.", (S) => stats(S).veins, 1);
counted("veinbreaker", "Veinbreaker", "Shatter 20 ore veins.", (S) => stats(S).veins, 20);
counted("chain-reaction", "Chain Reaction", "Reach a 40-strike combo.", (S) => stats(S).bestCombo, 40);
counted("reborn", "Reborn", "Rekindle the forge once.", (S) => stats(S).rekindles, 1);
counted("cycle", "Cycle of Embers", "Rekindle the forge 5 times.", (S) => stats(S).rekindles, 5);
counted("eternal-smith", "Eternal Smith", "Rekindle the forge 20 times.", (S) => stats(S).rekindles, 20);
counted("busy-forge", "Busy Forge", "Reach 1,000 ore per second.", (S) => stats(S).bestRate, 1e3);
counted("molten-river", "Molten River", "Reach 1 million ore per second.", (S) => stats(S).bestRate, 1e6);
counted("legend", "Legend of the Deep", "Reach 100 million ore per second.", (S) => stats(S).bestRate, 1e8);
