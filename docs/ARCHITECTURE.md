# Scyan ZMK Ecosystem: System Architecture Deep Dive

This document provides a detailed architectural breakdown of the 5 repositories in the Scyan ZMK ecosystem, their internal subsystems, and runtime execution models.

---

## 1. Repository Directory Mapping

| Repository | Local Path | Type / Stack | Purpose |
| :--- | :--- | :--- | :--- |
| **`brunowb.github.io`** (`hello-web`) | `/home/Scyan/Projects/Web/hello-web/` | HTML5, CSS3, i18next | Public web gateway linking to live tools. |
| **`bwpx-editor`** | `/home/Scyan/Projects/Web/bwpx-editor/` | React 19, TS 6, Vite, Tailwind | Standalone 1-bit monochrome canvas pixel editor & raster engine. |
| **`scyan-zmk-studio`** *(This Repo)* | `/home/Scyan/Projects/Web/scyan-zmk-studio/` | React 19, TS 6, Vite, Octokit | Visual display layout designer, 2-Atlas editor, and C compiler. |
| **`scyan-zmk-module`** | `/home/Scyan/Projects/Firmware/scyan-zmk-module/` | Zephyr / ZMK C Module, CMake | Out-of-tree runtime display engine running on keyboard MCU. |
| **`zmk-config`** | `/home/Scyan/Projects/Firmware/zmk-config/` | West Manifest, Kconfig, GitHub Actions | Corne split keyboard firmware config, module consumer, and CI/CD hub. |

---

## 2. End-to-End Data Pipeline

```
[ bwpx-editor ]
      │ (Pixel algorithms & BwpxGrid core)
      ▼
[ scyan-zmk-studio ]
      │ (Visual 2-Atlas & layout authoring)
      │ Pushes via Octokit API: config/scyan_assets.h
      ▼
┌─────────────────────────────────────────────────────────┐
│ zmk-config (Corne Split Config & CI)                    │
│ • config/west.yml: Imports scyan-zmk-module             │
│ • config/scyan_assets.h: 1bpp byte arrays & blocks      │
│ • config/corne.conf: Display, power & timing flags      │
└───────────────────────────┬─────────────────────────────┘
                            │ West build (GitHub Actions)
                            ▼
┌─────────────────────────────────────────────────────────┐
│ Flashable Firmware: corne_left.uf2 / corne_right.uf2    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Responsibilities & Separation of Concerns

### `scyan-zmk-studio` (Web UI Layer)
- **Role**: High-level visual editor and compiler for display assets.
- **Components**:
  - **Atlas Editor (`BwpxGrid`, `BwpxEditor`)**: 1bpp drawing tools, slicing, and font glyph mapping.
  - **Layout & Widget Designer (`BlocksTab`, `WidgetsTab`)**: Drag-and-drop block positioning, configuration, and dimension constraints.
  - **Corne Simulator (`OledPreviewTab`)**: Client-side emulation of the MCU rendering pipeline, displaying real-time dual-OLED visuals.
  - **State Compiler (`cHeaderParser.ts`)**: Produces `scyan_assets.h` with embedded JSON metadata for lossless round-trips.
  - **GitHub Service (`githubService.ts`)**: Manages PAT authentication, branch verification, and direct-to-repository commits.

### `scyan-zmk-module` (Firmware Runtime Layer)
- **Role**: Embedded blitter, transform engine, and event coordinator running on Zephyr RTOS.
- **Components**:
  - **Blitter Core (`canvas.c`)**: Direct bitwise blitting of `SYMBOLS_ATLAS` and `FONT_ATLAS` bytes into a 32×128 virtual page buffer.
  - **Transform Engine (`transform.c`)**: Rotates virtual 32×128 buffer by 90° or 270° into physical 128×32 SSD1306 OLED pages.
  - **Font Engine (`font_renderer.c`)**: Variable-width glyph lookup and UTF-8 string rendering.
  - **Widget Engine (`widgets/*.c`)**: Evaluates layout block parameters (`param1`, `param2`, `param3`) and renders dynamic widgets (Battery, BLE/USB, Layer, WPM, Screensaver).
  - **Event Bus (`events.c`)**: Subscribes to ZMK state updates and queues debounced screen updates on a dedicated work thread.

### `zmk-config` (Deployment Layer)
- **Role**: End-user configuration and build target.
- **Components**:
  - Contains hardware keymaps (`corne.keymap`), shield configuration (`corne.conf`), and west manifest (`config/west.yml`).
  - Compiles `.uf2` artifacts automatically upon pushes to `config/scyan_assets.h`.

---

## 4. Hardware & Firmware References (`Projects/References/zmk/`)

Offline technical references and driver documentation located at `/home/Scyan/Projects/References/zmk/`:

* **SSD1306 & Zephyr Display**: [`Projects/References/zmk/zephyr_display_ssd1306.md`](file:///home/Scyan/Projects/References/zmk/zephyr_display_ssd1306.md)
  * SSD1306 4-page memory layout (1 column byte, D0-D7).
  * Virtual 32×128 portrait to physical 128×32 landscape 90° rotation math.
  * Zephyr `display_write` API and non-blocking ZMK dedicated work queue rules.
* **Corne & nice!nano v2**: [`Projects/References/zmk/corne_nicenano_hardware.md`](file:///home/Scyan/Projects/References/zmk/corne_nicenano_hardware.md)
  * nRF52840 SoC pin mapping, I2C bus (SDA: P0.17, SCL: P0.20), and ADC battery monitoring.
  * Split central/peripheral BLE topology, eager debounce, and BLE polling intervals.
* **Upstream ZMK Source Code**: [`Projects/Firmware/zmk-config/.zmk/zmk/`](file:///home/Scyan/Projects/Firmware/zmk-config/.zmk/zmk/)
  * Complete upstream ZMK codebase including headers (`app/include/zmk/`) and behaviors.
* **Official ZMK Documentation (Offline)**: [`Projects/References/zmk/zmk-doc/`](file:///home/Scyan/Projects/References/zmk/zmk-doc/)
  * Complete offline manual from `zmk.dev` in Markdown/MDX (keycodes, behaviors, display settings, debouncing, BLE, and split setups).
  * **No external web fetch needed**: Query these local files directly for any ZMK feature or syntax reference.
