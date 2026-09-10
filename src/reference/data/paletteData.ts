export interface PaletteToken {
  name: string;
  variable: string;
  hex: string;
  rgb: string;
  desc: string;
}

export interface PaletteCategory {
  id: string;
  name: string;
  description: string;
  tokens: PaletteToken[];
}

export const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    id: 'surfaces',
    name: 'Surface Elevations',
    description: 'Foundation layers establishing z-index depth, recessed wells, and elevated cards.',
    tokens: [
      { name: 'Canvas (Level 0)', variable: '--surface-canvas-0', hex: '#0B0D13', rgb: '11, 13, 19', desc: 'Application backdrop / lowest viewport root' },
      { name: 'Panel (Level 1)', variable: '--surface-panel-1', hex: '#131722', rgb: '19, 23, 34', desc: 'Navigation headers, sidebars, container wrappers' },
      { name: 'Element (Level 2)', variable: '--surface-element-2', hex: '#19202F', rgb: '25, 32, 47', desc: 'Content modules, telemetry cards, interactive items' },
      { name: 'Popover (Level 3)', variable: '--surface-popover-3', hex: '#232C3F', rgb: '35, 44, 63', desc: 'Overlays, dropdowns, floating menus, modals' },
      { name: 'Panel Inset / Well', variable: '--surface-inset', hex: '#0E1118', rgb: '14, 17, 24', desc: 'Recessed inputs, code boxes, sunken panels' },
      { name: 'Panel Stroke / Border', variable: '--border-subtle', hex: '#1E2538', rgb: '30, 37, 56', desc: 'Subtle boundary dividers between surfaces' },
    ]
  },
  {
    id: 'primary',
    name: 'Primary Accent (Electric Cyan)',
    description: 'Focal points, active connections, positive confirmations, and primary actions.',
    tokens: [
      { name: 'Primary Accent Base', variable: '--accent-cyan-base', hex: '#00F0FF', rgb: '0, 240, 255', desc: 'Main brand highlight, confirm buttons, active links' },
      { name: 'Accent Hover', variable: '--accent-cyan-hover', hex: '#38F2FD', rgb: '56, 242, 253', desc: 'Lightened interaction state for primary triggers' },
      { name: 'Accent Active / Solid', variable: '--accent-cyan-active', hex: '#01B4D7', rgb: '1, 180, 215', desc: 'Pressed / solid active state for primary action' },
      { name: 'Accent In-State (Dim)', variable: '--accent-cyan-dim', hex: '#00F0FF1F', rgb: 'rgba(0, 240, 255, 0.12)', desc: 'Translucent backdrops for cyan pills and chips' },
      { name: 'Hardware Glow (Cyan)', variable: '--accent-cyan-glow', hex: '#02F0FE', rgb: '2, 240, 254', desc: 'Ambient box-shadow glow for hardware connections' },
    ]
  },
  {
    id: 'secondary',
    name: 'Secondary Accent (Vibrant Violet)',
    description: 'Transformations, layout compilations, secondary workflows, and developer tools.',
    tokens: [
      { name: 'Secondary Accent Base', variable: '--accent-purple-base', hex: '#A953F6', rgb: '169, 83, 246', desc: 'Workflow triggers, compilation buttons, layer indicators' },
      { name: 'Secondary Hover', variable: '--accent-purple-hover', hex: '#BF84FD', rgb: '191, 132, 253', desc: 'Brightened interaction state for secondary triggers' },
      { name: 'Secondary Active', variable: '--accent-purple-active', hex: '#7F21CD', rgb: '127, 33, 205', desc: 'Deep solid pressed state for purple controls' },
      { name: 'Secondary In-State (Dim)', variable: '--accent-purple-dim', hex: '#A953F61F', rgb: 'rgba(169, 83, 246, 0.12)', desc: 'Translucent purple tint for layer tags and callouts' },
      { name: 'Soft Lavender', variable: '--accent-purple-soft', hex: '#BD86F8', rgb: '189, 134, 248', desc: 'Monospace token & auxiliary status highlights' },
    ]
  },
  {
    id: 'warning',
    name: 'Warning & Tertiary (Vivid Orange)',
    description: 'Attention flags, flash memory updates, reset controls, and hardware state shifts.',
    tokens: [
      { name: 'Warning Base (Orange)', variable: '--accent-orange-base', hex: '#F2741D', rgb: '242, 116, 29', desc: 'Notice badges, caution alerts, destructive resets' },
      { name: 'Warning Hover', variable: '--accent-orange-hover', hex: '#F59442', rgb: '245, 148, 66', desc: 'Lightened orange for interactive hover states' },
      { name: 'Warning Active', variable: '--accent-orange-active', hex: '#BD4214', rgb: '189, 66, 20', desc: 'Solid deep press for critical operations' },
      { name: 'Warning In-State (Dim)', variable: '--accent-orange-dim', hex: '#F2741D1F', rgb: 'rgba(242, 116, 29, 0.12)', desc: 'Recessed warning callout background' },
      { name: 'Danger Orange / High Alert', variable: '--accent-orange-danger', hex: '#E35913', rgb: '227, 89, 19', desc: 'Over-voltage, flash reset, memory clear indicators' },
    ]
  },
  {
    id: 'typography',
    name: 'Typography & Contrasts',
    description: 'High readability foreground hierarchy balanced against the dark canvas tiers.',
    tokens: [
      { name: 'Main Text (High Contrast)', variable: '--text-primary', hex: '#F1F5F9', rgb: '241, 245, 249', desc: 'Primary headings, titles, active button text' },
      { name: 'Muted Text (Slate)', variable: '--text-muted', hex: '#94A3B8', rgb: '148, 163, 184', desc: 'Body paragraphs, subheadings, descriptive captions' },
      { name: 'Disabled Text (Subtle)', variable: '--text-disabled', hex: '#555E6E', rgb: '85, 94, 110', desc: 'Disabled states, inactive shortcuts, placeholder text' },
      { name: 'OLED Pure Pixel', variable: '--oled-pure', hex: '#FFFFFF', rgb: '255, 255, 255', desc: '1-bit monochrome graphic rendering on OLED viewports' },
    ]
  }
];

export const MOCK_DEVICE = {
  name: 'Scyan Corne V4 ZMK',
  status: 'Connected',
  battery: 92,
  activeLayer: 'L2 - Navigation',
  layoutGeometry: '128x32 OLED Dual',
  firmware: 'zmk-2026.09-rc2',
  tokensUsed: 5,
  tokensMax: 8
};
