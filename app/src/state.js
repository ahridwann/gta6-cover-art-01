// Porto Solmar Cover Studio: the cover's state model.
// Layouts, post sizes, colour grades and the default cover. Every rect is a
// fraction of the framed cover area, so one layout works at every post size.

/** The three post sizes the app exports, keyed by id. */
export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080 · Post' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350 · Story' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080 · Wide' },
};

/** The sample cast: original comic-art photos made for this app, plus the kit's two. */
export const SAMPLES = [
  { key: 'dario', label: 'Dario — boulevard', file: 'samples/dario.jpg' },
  { key: 'sol', label: 'Sol — convertible', file: 'samples/sol.jpg' },
  { key: 'skyline', label: 'Porto Solmar skyline', file: 'samples/skyline.jpg' },
  { key: 'neon', label: 'Neon diner night', file: 'samples/neon.jpg' },
  { key: 'boulevard', label: 'Boulevard dusk', file: 'samples/boulevard.jpg' },
  { key: 'pier', label: 'Pier morning', file: 'samples/pier.jpg' },
];

/** Colour grades: a canvas filter for the photo plus two overlay washes. */
export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.32) contrast(1.07) brightness(1.03)',
    wash: ['rgba(255, 170, 60, 0.16)', 'rgba(214, 40, 120, 0.30)'],
    tint: 'rgba(255, 90, 40, 0.10)',
  },
  neon: {
    label: 'Neon Vice',
    filter: 'saturate(1.55) contrast(1.10) brightness(1.0)',
    wash: ['rgba(0, 229, 204, 0.18)', 'rgba(255, 46, 136, 0.32)'],
    tint: 'rgba(255, 46, 136, 0.08)',
  },
  dusk: {
    label: 'Dusk',
    filter: 'saturate(1.12) contrast(1.06) brightness(0.92)',
    wash: ['rgba(64, 40, 160, 0.22)', 'rgba(120, 40, 180, 0.30)'],
    tint: 'rgba(40, 20, 120, 0.10)',
  },
  heat: {
    label: 'Heat',
    filter: 'saturate(1.22) contrast(1.18) brightness(1.05)',
    wash: ['rgba(255, 200, 40, 0.14)', 'rgba(255, 80, 20, 0.26)'],
    tint: 'rgba(255, 120, 0, 0.08)',
  },
};

// A panel rect: x, y, w, h as fractions of the framed area, plus an optional tilt in degrees.
function rect(x, y, w, h, rot = 0) {
  return { x, y, w, h, rot };
}

/** The four cover layouts. `panels` are image cells, `title` is where the lettering goes. */
export const LAYOUTS = {
  grid: {
    label: 'Nine-Panel Grid',
    blurb: 'The classic poster grid, title in the middle',
    title: { mode: 'block', ...rect(1 / 3, 1 / 3, 1 / 3, 1 / 3) },
    panels: [
      rect(0, 0, 1 / 3, 1 / 3), rect(1 / 3, 0, 1 / 3, 1 / 3), rect(2 / 3, 0, 1 / 3, 1 / 3),
      rect(0, 1 / 3, 1 / 3, 1 / 3), rect(2 / 3, 1 / 3, 1 / 3, 1 / 3),
      rect(0, 2 / 3, 1 / 3, 1 / 3), rect(1 / 3, 2 / 3, 1 / 3, 1 / 3), rect(2 / 3, 2 / 3, 1 / 3, 1 / 3),
    ],
  },
  hero: {
    label: 'Hero + Three',
    blurb: 'One big face, three moments, title band below',
    title: { mode: 'band', ...rect(0, 0.76, 1, 0.24) },
    panels: [
      rect(0, 0, 0.6, 0.76),
      rect(0.6, 0, 0.4, 0.2533), rect(0.6, 0.2533, 0.4, 0.2533), rect(0.6, 0.5067, 0.4, 0.2533),
    ],
  },
  strip: {
    label: 'Tilted Snapshots',
    blurb: 'Full-bleed city, three tilted snapshots, title on top',
    title: { mode: 'top', ...rect(0, 0.05, 1, 0.2) },
    panels: [
      rect(0, 0, 1, 1),
      rect(-0.02, 0.44, 0.37, 0.36, -4), rect(0.315, 0.5, 0.37, 0.36, 2), rect(0.65, 0.44, 0.37, 0.36, -2),
    ],
  },
  duo: {
    label: 'Duo',
    blurb: 'Two leads side by side, wide title band',
    title: { mode: 'band', ...rect(0, 0.74, 1, 0.26) },
    panels: [rect(0, 0, 0.5, 0.74), rect(0.5, 0, 0.5, 0.74)],
  },
};

/** One panel's photo: which image, how far zoomed, how far panned. */
export function blankPanel(key) {
  return { key, zoom: 1, ox: 0, oy: 0 };
}

/** The cover a fresh visitor sees: the Porto Solmar cast, grid layout, sunset grade. */
export function defaultState() {
  return {
    layout: 'grid',
    size: 'square',
    grade: 'sunset',
    title: 'PORTO SOLMAR',
    subtitle: 'Sunset Heist',
    panels: [
      blankPanel('dario'), blankPanel('sol'), blankPanel('skyline'), blankPanel('neon'),
      blankPanel('boulevard'), blankPanel('pier'), blankPanel('dario'), blankPanel('sol'),
    ],
  };
}

/** Panels the current layout actually shows, in draw order. */
export function layoutPanels(state) {
  return LAYOUTS[state.layout].panels;
}

/** A plain-JSON copy of the state (for undo history). */
export function snapshotState(state) {
  return JSON.parse(JSON.stringify(state));
}

/** Fill every panel of the current layout from the sample cast, in order. */
export function fillPanelsFromSamples(state) {
  const count = LAYOUTS[state.layout].panels.length;
  for (let i = 0; i < count; i++) {
    state.panels[i] = blankPanel(SAMPLES[i % SAMPLES.length].key);
  }
}
