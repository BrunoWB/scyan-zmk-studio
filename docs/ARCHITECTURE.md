# Scyan ZMK Ecosystem: System Architecture Deep Dive

Persistent architectural reference for the Scyan ZMK Ecosystem: Visual 2-Atlas display IDE, native Zephyr Devicetree layout compiler, and embedded 1bpp display engine.

---

## 1. Repository Directory Mapping

| Repository | Local Path (Host: `/var/home/Scyan/` == `/home/Scyan/`) | Stack | Role |
| :--- | :--- | :--- | :--- |
| **`hello-web`** (`brunowb.github.io`) | `Projects/Web/hello-web/` | HTML5, CSS3, i18next | Public web gateway linking to live tools. |
| **`scyan-pixel`** | `Projects/Web/scyan-pixel/` | React 19, TS 6, Vite, Tailwind | Standalone 1-bit monochrome canvas pixel editor & raster engine (`BwpxGrid`). |
| **`scyan-zmk-studio`** *(This Repo)* | `Projects/Web/scyan-zmk-studio/` | React 19, TS 6, Vite, Octokit | Visual 2-Atlas display IDE, layout designer, and Devicetree compiler. |
| **`scyan-zmk-module`** | `Projects/Firmware/scyan-zmk-module/` | Zephyr / ZMK C Module, CMake | Runtime 1bpp blitter, transform engine (90°/270° rotation), and widget engine. |
| **`zmk-config`** | `Projects/Firmware/zmk-config/` | West Manifest, Kconfig, GitHub Actions | Corne split keyboard firmware config, module consumer, and CI/CD hub. |

---

## 2. End-to-End Data Pipeline

```
[ scyan-pixel ]
      │ (Pixel algorithms & BwpxGrid core)
      ▼
[ scyan-zmk-studio ]
      │ (Visual 2-Atlas & Devicetree layout compiler)
      │ Commits atomically via Octokit API:
      │   • config/scyan_assets.h      (1bpp bitmaps, font tables, JSON metadata)
      │   • config/scyan_symbols.dtsi  (#define SYMBOL_* integer macros)
      │   • config/scyan_layouts.dtsi  (Zephyr Devicetree layout & widget nodes)
      │   • config/<shield>.overlay    (/chosen { scyan,display-layout = &...; };)
      ▼
┌─────────────────────────────────────────────────────────────┐
│ zmk-config (Corne Split Config & CI)                        │
│ • config/west.yml: Imports scyan-zmk-module (nightly / main)│
│ • config/corne.conf: Display & power timing flags           │
│ • config/scyan_*.dtsi: Devicetree layouts & symbols         │
└───────────────────────────────┬─────────────────────────────┘
                                │ West build (GitHub Actions)
                                ▼
┌─────────────────────────────────────────────────────────────┐
│ Flashable Firmware: corne_left.uf2 / corne_right.uf2        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The Core Contracts

### 3.1 Display Geometry & 1bpp Bitwise Logic
- **Virtual Geometry**: Always $32 \times 128$ (portrait). Stride is strictly $\lceil \text{width} / 8 \rceil = 4$ bytes.
- **Physical Output**: SSD1306 OLED $128 \times 32$ (landscape). `transform.c` performs hardware page rotation ($90^\circ$ or $270^\circ$).
- **Bit Polarity**: Strictly 1 bit per pixel (`0` = dark, `1` = light). Byte order is MSB-first.

### 3.2 2-Atlas Bitmap Architecture (`config/scyan_assets.h`)
- **`SYMBOLS_ATLAS`**: Single contiguous 1bpp bitmap packed with all icons, status indicators, and animation frames.
- **`FONT_ATLAS`**: Contiguous 1bpp bitmap containing variable-width typographic glyphs (`FONT_GLYPHS_ALL`).
- **Preprocessor Safety Guard**: All C structs (`sprite_slice`, `font_glyph`, arrays) are guarded with:
  ```c
  #if !defined(_ASMLANGUAGE) && !defined(__DTS__)
  // C structs and static const arrays
  #endif
  ```
  This ensures freestanding Devicetree preprocessors (`gcc -nostdinc -D_ASMLANGUAGE`) never fail on C standard headers.

### 3.3 Devicetree Preprocessor Symbols (`config/scyan_symbols.dtsi`)
- Pure `#define SYMBOL_<NAME> <integer>` definitions.
- Preprocessor evaluation allows integer cell expansion inside Devicetree properties (e.g. `symbols = <SYMBOL_USB SYMBOL_BLE>;`).
- **Contiguous Sorting Contract**: Multi-frame animation slices belonging to the same `groupId` are sorted strictly by ascending `groupOrder` before numeric ID assignment. This guarantees runtime indexing via `(symbol_id + idx)` is continuous in memory.

### 3.4 Declarative Devicetree Layouts (`config/scyan_layouts.dtsi`)
- Declares the layout tree under `/scyan_layouts`:
  ```dts
  / {
      scyan_layouts {
          compatible = "scyan,layouts";

          display_1_active: layout_display_1_active {
              compatible = "scyan,display-layout";
              width = <32>;
              height = <128>;
              rotation = <90>;
              idle-timeout-ms = <30000>;
              idle-layout = <&display_1_idle>;

              display_1_active_widget_output_0: widget_0 {
                  compatible = "scyan,widget-output";
                  x = <0>;
                  y = <0>;
                  width = <32>;
                  height = <16>;
                  symbols = <SYMBOL_USB SYMBOL_BLE>;
              };
          };
      };
  };
  ```

### 3.5 Target Shield Binding (`config/<shield>.overlay`)
- Individual keyboard halves or unibody units bind to their active screen layout via an isolated delimited marker block:
  ```dts
  /* === SCYAN-STUDIO:BEGIN (DO NOT EDIT) === */
  #include "scyan_layouts.dtsi"

  / {
      chosen {
          scyan,display-layout = &display_1_active;
      };
  };
  /* === SCYAN-STUDIO:END === */
  ```
- This completely replaces legacy Kconfig slot multiplexing (`CONFIG_SCYAN_DISPLAY_SLOT_*`). Any number of physical units (left, right, dongle, macropad) can bind independently to any layout without disturbing existing user nodes (e.g. kscan, nice!view).

### 3.6 Lossless Round-Trip Metadata Block
- Embedded trailing JSON comment in `scyan_assets.h`:
  ```c
  /* ZMK_DISPLAY_STUDIO_METADATA
  {
    "version": 2,
    "shieldId": "corne",
    "displayAssignments": { "corne_left": "display-1", "corne_right": "display-2" },
    "displays": { ... },
    "widgetInstances": { ... }
  }
  */
  ```
- Guarantees 100% loss-free re-import into the studio UI when reloading the repository.

---

## 4. Subsystem Responsibilities & Separation of Concerns

### `scyan-zmk-studio` (Web UI & Compiler Layer)
- **Atlas Editor**: 1bpp drawing tools, bounding box slicing, variable-width font glyph mapping, and GIF import.
- **Layout & Widget Designer**: Drag-and-drop block positioning, constraint enforcement, and alignment rules.
  - **Symbol Centering Contract**: Icons/symbols auto-center within their block bounding box.
  - **Text Alignment Contract**: Text auto-centers vertically with configurable horizontal alignment (`left`, `center`, `right`).
- **Compiler (`cHeaderParser.ts`)**: Emits `scyan_assets.h`, `scyan_symbols.dtsi`, and `scyan_layouts.dtsi` atomically. Auto-sorts animation frames via `sortSymbolSlices()`.
- **Channel-Aware Deployment (`githubService.ts`)**:
  - Nightly Studio installs/updates `west.yml` with `revision: nightly`.
  - Production Studio installs/updates `west.yml` with `revision: main` (or tagged release).
- **Corne Simulator (`OledPreviewTab`)**: High-fidelity client-side emulation of the MCU display engine.

### `scyan-zmk-module` (Firmware Runtime Layer)
- **Engine Core (`engine.c`)**:
  - Instantiates layout blocks from `DT_CHOSEN(scyan_display_layout)` using Zephyr Devicetree unrolling macros (`DT_FOREACH_CHILD_SEP`).
  - Computes block count via sentinel array patterns without runtime dynamic memory allocation.
  - Evaluates idle transitions and switches between active and idle layout trees.
- **Widget Dispatch (`widgets/dispatch.c`, `widgets/*.c`)**:
  - Cleanly decoupled discrete widget engines: `output`, `battery`, `layer`, `wpm`, `wpm_chart`, `branding`, `split`, `screensaver`, `caps`, `bongo`, `loop`, `typewriter`, `keypress`.
  - Compile-time conditional gating via `$(dt_compat_enabled,...)` — unused widget code is completely omitted from flash.
- **Transform Engine (`transform.c`)**: Rotates virtual 32×128 memory to physical SSD1306 128×32 pages.
- **Blitter Core (`canvas.c`)**: Fast bitwise copy of 1bpp sprites with sub-byte coordinate alignment.
- **Event Bus (`events.c`)**: Subscribes to ZMK state updates and queues debounced screen updates on a dedicated work thread.

### `zmk-config` (Deployment & Firmware Build Layer)
- End-user configuration repository containing keymaps (`corne.keymap`), shield configuration (`corne.conf`), and west manifest (`config/west.yml`).
- GitHub Actions CI workflow compiles `.uf2` binaries automatically upon any asset or layout push.

---

## 5. Non-Negotiable Invariants for Development

1. **Maintain Strict Contract Sync with `scyan-zmk-module/include/scyan/types.h`**:
   Never alter struct definitions or reorder `enum display_widget_type` in `src/services/cHeaderParser.ts`.
2. **Preserve Metadata Round-Trip Fidelity**:
   Always keep the trailing JSON metadata block intact in `scyan_assets.h`.
3. **1bpp Bitwise Logic Integrity**:
   Display memory is strictly 1 bit per pixel (`0` = dark, `1` = light). Stride is $\lceil \text{width} / 8 \rceil$.
4. **Channel Alignment**:
   `scyan-zmk-studio` and `scyan-zmk-module` channels (`nightly` vs `main`) must remain aligned to avoid contract mismatch.
5. **Targeted Cross-Repo Routing**:
   Route UI/compiler changes $\rightarrow$ `scyan-zmk-studio`; Canvas primitives $\rightarrow$ `scyan-pixel`; MCU blitting & event handlers $\rightarrow$ `scyan-zmk-module`; Kconfig/keymap $\rightarrow$ `zmk-config`.
