# City Story PC

An offline, native Windows PC reimplementation and asset extraction pipeline for classic **City Story** (TeamLava / Storm8, 2010–2011) — **no Android emulator required**.

> **Legal / Copyright Notice:** This repository contains **zero** copyrighted game assets, APKs, or prebuilt binaries. You must supply your own legitimately obtained copy of the `City Story` APK (`com.teamlava.citystory`, tested with v1.0.8) to extract textures, UI art, and audio locally on your machine.

---

## Why?

The original Storm8 backend (`city.teamlava.com`) has been permanently shut down and the original APK targets legacy Android 2.x + 32-bit `armeabi`, making it unplayable on modern devices. However, all isometric building sprites, UI artwork, and WAV audio live directly inside the APK.

This project provides:
1. **Pure Node.js `.s8i` / `.s8h` Texture Decoder** (`scripts/s8_decoder.js`) — decodes Storm8's custom 16-bit OpenGL ES textures (`RGB565` & `RGBA4444`, bottom-up row order + alpha hitmask) directly to standard PNGs with zero npm dependencies.
2. **APK Asset Extractor & Catalog Builder** (`scripts/extract_apk.js`, `scripts/build_catalog.js`) — extracts all 630+ sprites, halos, thumbnails, UI graphics, WAV music/SFX, and generates the 275-item catalog from your APK.
3. **Offline Isometric Game Engine** (`web/`) — true 30° isometric projection (`128×74` tile grid with `0.5`-tile support), painter's depth sorting, 16-state autotiling roads & rivers, construction scaffolding & timers, factory contracts, happiness/population bonus multiplier, quests, storage, land expansions (up to 24×24), photo snapshots, speed toggle (`1x / 5x / 20x`), and optional Sandbox Mode.
4. **Native Windows Desktop Host** (`native/`) — lightweight `.NET 9 + WebView2` executable (`CityStory.exe`) with local virtual host mapping (no localhost ports) and persistent local saves at `%LocalAppData%\CityStoryPC\save.json`.

---

## Prerequisites (Windows)

- **Node.js** 18+ (zero `npm install` needed — uses only Node built-ins)
- **.NET 9 SDK** (for building the native Windows `CityStory.exe`)
- **Microsoft Edge WebView2 Runtime** (pre-installed on Windows 10/11)
- Your own **City Story APK** (`com.teamlava.citystory`, v1.0.8)

---

## Quick Start (One Command)

```powershell
.\build.ps1 -ApkPath "C:\path\to\CityStory_1.0.8.apk"
```

This extracts & decodes all assets locally, generates `web/data/catalog.js`, compiles `dist/CityStory.exe`, and assembles a portable `dist/` folder.

Then run:

```powershell
.\dist\CityStory.exe
```

### Manual Steps (or Browser-Only Mode)

```bash
# 1. Extract & decode textures, UI, and WAV audio from your APK
node scripts/extract_apk.js /path/to/CityStory.apk

# 2. Generate the building & contract catalog
node scripts/build_catalog.js

# 3. Compile native Windows app (Windows only)
dotnet build native/CityStory.csproj -c Release -o dist
```

*(On macOS/Linux, you can serve the `web/` folder with any local static server after steps 1 & 2 and play in any desktop browser.)*

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
├── build.ps1                 # End-to-end Windows build script
├── scripts/
│   ├── s8_decoder.js         # Storm8 .s8i / .s8h 16-bit texture decoder
│   ├── extract_apk.js        # Pure-Node ZIP/APK extractor & ICO builder
│   └── build_catalog.js      # Generates web/data/catalog.js from decoded assets
├── web/
│   ├── index.html            # Game HUD & modals
│   ├── css/style.css         # UI styling
│   └── js/
│       ├── audio.js          # Looping BGM & SFX manager
│       ├── engine.js         # Isometric canvas renderer & input handler
│       └── game.js           # Offline simulation, quests, saves & UI logic
└── native/
    ├── CityStory.csproj      # .NET 9 WinForms + WebView2 project
    └── Program.cs            # Native desktop wrapper & save.json bridge
```

## Disclaimer

City Story is a trademark of Storm8 / TeamLava. This is an independent, non-commercial fan preservation tool and clean-room reimplementation intended for personal offline nostalgia using assets extracted from your own APK.
