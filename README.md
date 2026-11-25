# City Story PC

A **cross-platform** (Windows, macOS, Linux) offline desktop reimplementation and asset extractor for classic **City Story** (TeamLava / Storm8, 2010–2011) — built with **Electron**, **no Android emulator required**, and **zero terminal setup** for players.

> **Legal / Copyright Notice:** This repository contains **zero** copyrighted game assets, APKs, or prebuilt binaries. On first launch, the app asks you to drop in your own legitimately obtained copy of the `City Story` APK (`com.teamlava.citystory`, tested with v1.0.8) and decodes all textures, UI art, and audio locally on your machine.

---

## Why?

The original Storm8 backend (`city.teamlava.com`) has been permanently shut down and the original APK targets legacy Android 2.x + 32-bit `armeabi`, making it unplayable on modern devices. However, all isometric building sprites, UI artwork, and WAV audio live directly inside the APK.

This project provides:
1. **First-Run APK Importer (`web/setup.html`)** — drop your City Story `.apk` onto the window once; the app decodes everything into your local OS app-data folder and launches straight into the game.
2. **Pure Node.js `.s8i` / `.s8h` Texture Decoder (`scripts/s8_decoder.js`)** — decodes Storm8's custom 16-bit OpenGL ES textures (`RGB565` & `RGBA4444`, bottom-up row order + alpha hitmask) directly to PNG with zero native/C++ dependencies.
3. **Offline Isometric Game Engine (`web/`)** — true 30° isometric projection (`128×74` tile grid with `0.5`-tile support), painter's depth sorting, 16-state autotiling roads & rivers, construction scaffolding & timers, factory contracts, happiness/population bonus multiplier, quests, storage, land expansions (up to 24×24), photo snapshots, speed toggle (`1x / 5x / 20x`), and optional Sandbox Mode.
4. **Cross-Platform Electron Shell (`electron/`)** — identical Chromium Canvas rendering and WAV playback on Windows, macOS, and Linux, with local `citystory://` asset serving and persistent `save.json` storage in your OS user-data directory.

---

## Quick Start (Windows / macOS / Linux)

Only **Node.js 18+** is required:

```bash
npm install
npm start
```

On first launch, drop your **City Story APK** (`com.teamlava.citystory`, v1.0.8) into the window. Extraction takes ~3 seconds, and every future launch opens directly into your city!

### Building Standalone Packages (Asset-Free)

You can package clean, asset-free desktop executables for distribution (players drop their own APK on first launch):

```bash
npm run dist:win     # Portable Windows .exe
npm run dist:mac     # macOS .dmg
npm run dist:linux   # Linux .AppImage
```

### Optional CLI Extraction (Browser-Only Mode)

If you prefer running the extractor manually and serving `web/` in any browser:

```bash
node scripts/extract_apk.js /path/to/CityStory.apk
node scripts/build_catalog.js
```

---

## Controls & Shortcuts

| Input | Action |
|---|---|
| **Left-click & drag** | Pan camera |
| **Mouse wheel** / `+` `-` | Zoom in / out |
| **Left-click** | Collect coins, open factory contracts, place/edit buildings |
| **Right-click** or `R` | Rotate building while placing/moving |
| `M` | Open Build Market |
| `Esc` | Cancel placement / close modal |
| `F11` | Toggle fullscreen |

---

## Repository Structure

```text
├── electron/
│   ├── main.js               # Cross-platform Electron window, citystory:// protocol & IPC
│   └── preload.js            # Context-isolated bridge for saves & APK import
├── scripts/
│   ├── s8_decoder.js         # Storm8 .s8i / .s8h 16-bit texture decoder (zero deps)
│   ├── extract_apk.js        # Pure-Node ZIP/APK extractor
│   └── build_catalog.js      # Generates catalog.js from decoded sprite metadata
└── web/
    ├── setup.html            # First-run drag-and-drop APK importer UI
    ├── index.html            # Game HUD & modals
    ├── css/style.css         # UI styling
    └── js/
        ├── audio.js          # Looping BGM & SFX manager
        ├── engine.js         # Isometric canvas renderer & input handler
        └── game.js           # Offline simulation, quests, saves & UI logic
```

## Disclaimer

City Story is a trademark of Storm8 / TeamLava. This is an independent, non-commercial fan preservation tool and clean-room reimplementation intended for personal offline nostalgia using assets extracted from your own APK.
