# Emberforge

**A cozy-dark idle smithy for the browser.** Hammer the anvil, hire the forge, shatter ore veins and rekindle the mountain's heart.

[Play Emberforge](https://emberforge-iota.vercel.app/) · [Source](https://github.com/Millzy141187/emberforge)

## The forge

- 10 generator tiers and 45 permanent upgrades
- 29 trophies, 8 ember rites and repeatable rekindles
- Combo strikes, critical hits, Molten Surge bursts and timed ore veins
- Offline progress, autosave and exportable saves
- Synthesized audio, canvas embers and a responsive mobile layout

## Controls

| Action | Input |
| --- | --- |
| Strike the anvil | Click / tap, or **Space** |
| Unleash Molten Surge | Click the surge meter, or **E** when charged |
| Choose buy amount | ×1 / ×10 / ×100 / Max |
| Close a dialog | **Esc** |

## Run locally

No build step or dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 3000
```

Then open <http://localhost:3000>.

Saves live in `localStorage` under `emberforge.save.v1`. The Embers tab can export or import a save code.

## Project layout

```
index.html      page shell, icon sprite and forge scene
css/style.css   obsidian-and-ember theme and responsive layout
js/data.js      generators, upgrades, trophies and rites
js/state.js     game rules, economy, prestige, offline and saves
js/ui.js        rendering, tabs, modals, guidance and effects glue
js/audio.js     synthesized WebAudio sound effects
js/fx.js        canvas embers, sparks and rings
js/main.js      boot, offline catch-up and game loop
```

## Deployment

The public build is hosted on Vercel from the `main` branch.
