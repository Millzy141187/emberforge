// ============================================================
// Emberforge — boot & game loop
// ============================================================

import * as game from "./state.js";
import { initUI } from "./ui.js";
import { fx } from "./fx.js";

const state = game.boot();

fx.init(document.getElementById("fx"));
fx.start();

const ui = initUI();

// Offline catch-up from the previous session.
(function restoreOffline() {
  const away = Math.max(0, (Date.now() - (state.lastSave || Date.now())) / 1000);
  if (away >= 60) {
    const info = game.applyOffline(away);
    ui.refresh();
    if (info.gain > 1) ui.showOffline(info);
    else game.saveGame();
  } else {
    game.saveGame();
  }
})();

// ------------------------------------------------------------
// Loop: 10 logic ticks per second. Tab throttling shows up as a
// larger dt, which is credited at offline rates instead of stalling.
// ------------------------------------------------------------
let lastWall = Date.now();

window.setInterval(() => {
  const now = Date.now();
  let dt = (now - lastWall) / 1000;
  lastWall = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0.1;
  if (dt > 20) {
    game.applyOffline(dt);
    dt = 0.1;
  } else {
    dt = Math.min(dt, 5);
  }
  game.tick(dt);
  ui.refresh();
}, 100);

// Save on the way out.
window.addEventListener("beforeunload", () => game.saveGame());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.saveGame();
});
