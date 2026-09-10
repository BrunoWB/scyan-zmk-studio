# Scyan ZMK Studio

A visual display editor and C header generator for ZMK keyboards (built for Corne split OLEDs, but adaptable to other SSD1306 setups).

👉 **[Try the web app](https://brunowb.github.io/scyan-zmk-studio)**

---

## What is this?

Configuring OLED displays in ZMK usually means messing with raw C byte arrays, guessing pixel offsets, and re-flashing firmware just to see if an icon moved 2 pixels to the left.

This tool gives you a visual workspace to:
- Draw icons, screensavers, and fonts in a built-in 1-bit pixel editor (with image import and dithering).
- Drag and drop widgets (battery, layer, WPM, bongo cat, etc.) onto your left and right displays for both active and idle states.
- Preview everything in an interactive OLED simulator (type on the virtual keyboard, watch WPM graphs update, simulate battery discharge and layer hops).
- Commit `config/scyan_assets.h` directly to your `zmk-config` repository to trigger a fresh firmware build via GitHub Actions.

The generated header includes embedded metadata comments, so you can load your `scyan_assets.h` back into the editor anytime to keep tweaking where you left off.

---

## How it fits together

```
[bwpx-editor] ──> [scyan-zmk-studio] ──(GitHub commit)──> [zmk-config]
  (pixel core)         (this IDE)                              │
                                                          [west build]
                                                               │
                                                      [scyan-zmk-module]
                                                       (firmware driver)
```

- **`scyan-zmk-studio`** (here): The web UI where you design layouts, edit sprites, and export the C header.
- **[`scyan-zmk-module`](https://github.com/BrunoWB/scyan-zmk-module)**: The companion ZMK module that handles 1bpp blitting, 90° rotation, and widget rendering on your microcontroller.
- **[`bwpx-editor`](https://github.com/BrunoWB/bwpx-editor)**: The upstream 1-bit pixel editor and raster core used inside this app.
- **[`zmk-config`](https://github.com/BrunoWB/zmk-config)**: Your keyboard configuration repository where GitHub Actions compiles your `.uf2` firmware.

---

## Development

```bash
git clone https://github.com/BrunoWB/scyan-zmk-studio.git
cd scyan-zmk-studio
npm install
npm run dev
```

### Scripts

- `npm run dev`: Start local Vite dev server
- `npm test`: Run test suite (Vitest)
- `npm run lint`: Run linter (Oxlint)
- `npm run build`: Type-check and build production assets

---

## License

Personal and non-commercial use only. See [LICENSE](LICENSE) for details.
