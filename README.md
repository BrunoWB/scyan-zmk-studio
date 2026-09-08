# Scyan ZMK Studio

> **Interactive 2-Atlas display layout, widget design, and sprite editor for ZMK keyboards.**

[![Live Web App](https://img.shields.io/badge/Live%20App-brunowb.github.io%2Fscyan--zmk--studio-blue?style=flat-square)](https://brunowb.github.io/scyan-zmk-studio)
[![Built with React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=flat-square&logo=vite)](https://vite.dev/)

---

## 🚀 Live App

Access the studio directly in your browser:  
👉 **[https://brunowb.github.io/scyan-zmk-studio](https://brunowb.github.io/scyan-zmk-studio)**

---

## ✨ Features

* **🎨 2-Atlas Sprite & Font Architecture**:
  * Dual-atlas canvas system (`SYMBOLS_ATLAS` and `FONT_ATLAS`) configured with dynamic strides and dimensions.
  * Direct 1bpp monochrome drawing tools: Pencil, Line, Rectangle, Fill, and Erase.
* **🔤 Font & Glyph Mapping**:
  * Visual glyph slicing with support for small and large font variants.
  * Custom character mappings linking ASCII/Unicode characters directly to atlas coordinates.
* **📱 Interactive Widget Layout Studio**:
  * Visual layout canvas supporting custom screen dimensions (e.g., Corne OLED 32×128, 128×32, Nice!View, etc.).
  * Dedicated layout blocks for Battery, Output Status (USB/BLE), Layer indicators, WPM counters & graphs, Branding, Screensavers, and custom text.
  * Independent **Active** and **Idle** screen configurations.
* **🔄 Round-Trip State Preservation**:
  * Generates zero-flash-overhead C headers (`custom_display_assets.h`) for ZMK.
  * Embeds metadata into safe C comment blocks (`ZMK_DISPLAY_STUDIO_METADATA`) allowing you to re-import existing headers without losing studio state.
* **🐙 GitHub Direct Sync**:
  * Connect your GitHub Personal Access Token (PAT) to directly pull from and commit updates to your `zmk-config` or `zmk-display-core` repository.
  * Automated firmware build triggers upon committing to your config repository.

---

## 🛠️ Local Development

### Prerequisites
* [Node.js](https://nodejs.org/) (v20+)
* npm (v10+)

### Setup
```bash
# Clone repository
git clone https://github.com/BrunoWB/scyan-zmk-studio.git
cd scyan-zmk-studio

# Install dependencies
npm install

# Start development server
npm run dev
```

### Testing & Verification
```bash
# Run unit tests
npm test

# Production build
npm run build
```

---

## 🔗 Related Repositories

* [BrunoWB/zmk-config](https://github.com/BrunoWB/zmk-config) — Custom ZMK keyboard configuration.
* [BrunoWB/zmk-display-core](https://github.com/BrunoWB/zmk-display-core) — Core display runtime module for custom ZMK widgets.
