# Antigravity Operating Guide: Scyan ZMK Ecosystem

Persistent architectural reference for Antigravity pair programming in `scyan-zmk-studio`.

---

## 1. Ecosystem Directory & Role Map

| Repository | Local Path (Host: `/var/home/Scyan/` == `/home/Scyan/`) | Stack | Role |
| :--- | :--- | :--- | :--- |
| **`hello-web`** | `Projects/Web/hello-web/` | HTML/CSS | Public developer landing page & project portal. |
| **`scyan-pixel`** | `Projects/Web/scyan-pixel/` | React 19 / Vite | Upstream 1bpp pixel editor & raster algorithm core (`BwpxGrid`). |
| **`scyan-zmk-studio`** *(Here)* | `Projects/Web/scyan-zmk-studio/` | React 19 / TS 6 / Vite | Visual 2-Atlas IDE & layout compiler to C header. |
| **`scyan-zmk-module`** | `Projects/Firmware/scyan-zmk-module/` | Embedded C / Zephyr | Runtime 1bpp blitter, transform (90° rot), and widget engine. |
| **`zmk-config`** | `Projects/Firmware/zmk-config/` | West / Kconfig / CI | Corne split keyboard config; CI builds `.uf2` on asset push. |

---

## 2. Unidirectional Data Pipeline

```
[scyan-pixel] ──(core algorithms)──> [scyan-zmk-studio] ──(GitHub PAT push)──> [zmk-config]
                                                                                   │
                                  [Firmware .uf2] <──(west build)── [scyan-zmk-module]
```

* **Detailed Architecture Reference**: [`docs/ARCHITECTURE.md`](file:///home/Scyan/Projects/Web/scyan-zmk-studio/docs/ARCHITECTURE.md)
* **Hardware & Driver References**: [`Projects/References/zmk/`](file:///home/Scyan/Projects/References/zmk/) (offline ZMK docs in `zmk-doc/` — no web fetch needed)

---

## 3. The Core Contracts: Assets & Devicetree

The files committed to `zmk-config` are the single source of truth between web and firmware:
* **Geometry**: Virtual `32x128` (vertical) transformed at runtime to physical `128x32` SSD1306 OLED pages.
* **2 Atlases (1bpp Bitmaps)**: `SYMBOLS_ATLAS` (icons, bongo, animations) and `FONT_ATLAS` (variable-width font) in `config/scyan_assets.h`.
* **Preprocessor Symbols (`config/scyan_symbols.dtsi`)**: `#define SYMBOL_* <int>` macros. Multi-frame animations are strictly auto-sorted by `groupOrder`.
* **Declarative Layouts (`config/scyan_layouts.dtsi`)**: Native Zephyr Devicetree nodes (`scyan,layouts`, `scyan,display-layout`, and `scyan,widget-*`).
* **Shield Overlays (`config/<shield>.overlay`)**: Delimited marker block (`/* === SCYAN-STUDIO:BEGIN ... === */`) binding `/chosen { scyan,display-layout = &display_1_active; };` selects active layout per hardware unit.
* **Round-Trip Metadata**: Embedded ASCII comment block (`/* ZMK_DISPLAY_STUDIO_METADATA { ... } */`) in `scyan_assets.h` enables 100% lossless layout re-import into the studio.

---

## 4. Non-Negotiable Invariants for Antigravity

1. **Maintain Strict Contract Sync with `scyan-zmk-module/include/scyan/types.h`**:
   Never alter struct definitions or reorder `enum display_widget_type` in `src/services/cHeaderParser.ts`. The exact enum sequence is:
   `1: OUTPUT_STATUS`, `2: BATTERY`, `3: LAYER`, `4: WPM`, `5: WPM_CHART`, `6: BRANDING`, `7: SPLIT`, `8: SCREENSAVER`, `9: CAPS_LOCK`, `10: BONGO`, `11: LOOP`, `12: TYPEWRITER`, `13: KEYPRESS`.
2. **Preserve Metadata Round-Trip Fidelity**:
   When parsing or generating C headers in `cHeaderParser.ts`, always keep the trailing JSON metadata block intact and provide graceful fallbacks for raw C structs.
3. **1bpp Bitwise Logic Integrity**:
   Display memory is strictly 1 bit per pixel (`0` = dark, `1` = light). Stride is `Math.ceil(width / 8)`. Avoid assuming byte-aligned boundaries.
4. **Channel Alignment**:
   `scyan-zmk-studio` and `scyan-zmk-module` channels (`nightly` vs `main`) must stay in sync. Studio installs `scyan-zmk-module` revision matching its own channel.
5. **Targeted Cross-Repo Routing**:
   Always route changes to the proper layer: UI layout & serialization ➔ `scyan-zmk-studio`; Canvas primitives ➔ `scyan-pixel`; MCU blitting & event handlers ➔ `scyan-zmk-module`; Kconfig/keymap ➔ `zmk-config`.
