// Small shared helpers. No DOM access at module scope (also used by the
// Node smoke test), so anything touching `document` lives in ui.js.

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n;
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

const SUFFIX = [
  "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No",
  "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc", "OcDc",
  "NoDc", "Vg", "UVg", "DVg", "TVg", "QaVg", "QiVg", "SxVg", "SpVg",
  "OcVg", "NoVg", "Tg",
];

function trimZeros(str) {
  return str.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** Compact number: 1,234 · 12.4K · 3.05M · 1.2e15 */
export function fmt(n) {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : "0";
  if (n < 0) return "-" + fmt(-n);
  if (n < 1000) {
    if (n === 0) return "0";
    if (n < 10) return trimZeros((Math.floor(n * 100) / 100).toFixed(2));
    if (n < 100) return trimZeros((Math.floor(n * 10) / 10).toFixed(1));
    return Math.floor(n).toLocaleString("en-US");
  }
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIX.length) {
    return n.toExponential(2).replace("e+", "e");
  }
  let scaled = n / Math.pow(1000, tier);
  if (scaled >= 999.5 && tier + 1 < SUFFIX.length) {
    tier += 1;
    scaled = n / Math.pow(1000, tier);
  }
  const digits = scaled < 10 ? 3 : scaled < 100 ? 2 : 1;
  return trimZeros(scaled.toFixed(digits)) + SUFFIX[tier];
}

/** Whole number with locale separators, compacted past 1M. */
export function fmtWhole(n) {
  if (!Number.isFinite(n)) return "∞";
  if (Math.abs(n) < 1e6) return Math.floor(n).toLocaleString("en-US");
  return fmt(n);
}

export function pct(n, digits = 0) {
  if (!Number.isFinite(n)) return "∞";
  return (n * 100).toFixed(digits).replace(/\.0$/, "") + "%";
}

/** 45s · 12m 30s · 3h 05m · 2d 4h */
export function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 60) {
    const rem = s % 60;
    return rem ? `${m}m ${rem}s` : `${m}m`;
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    const rem = m % 60;
    return rem ? `${h}h ${String(rem).padStart(2, "0")}m` : `${h}h`;
  }
  const d = Math.floor(h / 24);
  const rem = h % 24;
  return rem ? `${d}d ${rem}h` : `${d}d`;
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
