// Porto Solmar cover state: one settings object, a history stack for
// undo/redo, and a tiny pub/sub so the preview re-renders on every change.

export const LAYOUTS = {
  hero: { id: "hero", label: "Hero", panels: 1, blurb: "One big photo" },
  duo: { id: "duo", label: "Duo", panels: 2, blurb: "Two side by side" },
  trio: { id: "trio", label: "Trio", panels: 3, blurb: "Comic-strip three" },
  split: { id: "split", label: "Split", panels: 3, blurb: "Big top, two below" },
};

export const EXPORT_SIZES = {
  square: { id: "square", label: "Square · 1080 × 1080", width: 1080, height: 1080 },
  portrait: { id: "portrait", label: "Portrait · 1080 × 1350", width: 1080, height: 1350 },
  wide: { id: "wide", label: "Wide · 1920 × 1080", width: 1920, height: 1080 },
};

export function blankPanel() {
  return { photo: null, zoom: 1, offsetX: 0, offsetY: 0, warmth: 0 };
}

export function defaultSettings() {
  return {
    shot: "skyline-dusk",
    layout: "trio",
    size: "portrait",
    title: "PORTO SOLMAR",
    subtitle: "where the sun never clocks out",
    caption: "Golden hour over the marina — my city, my rules.",
    showCaption: true,
    showSkyline: true,
    grain: 0.5,
    vignette: 0.55,
    titleSize: 1.0,
    panels: [blankPanel(), blankPanel(), blankPanel()],
  };
}

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings, (key, value) => {
    // Photos are data URLs and can be long; keep them, they are the state.
    return value;
  }));
}

export class CoverStore {
  constructor(initial) {
    this.settings = initial || defaultSettings();
    this.past = [];
    this.future = [];
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.settings);
  }

  // Record the current settings, then apply a change.
  update(mutator, label) {
    this.past.push({ settings: cloneSettings(this.settings), label: label || "change" });
    if (this.past.length > 60) this.past.shift();
    this.future = [];
    mutator(this.settings);
    this.emit();
  }

  // Change one top-level field.
  set(key, value, label) {
    this.update((s) => { s[key] = value; }, label || key);
  }

  // Change one field of one panel.
  setPanel(index, key, value, label) {
    this.update((s) => {
      if (s.panels[index]) s.panels[index][key] = value;
    }, label || `panel ${index + 1}`);
  }

  // Switch layout, growing or trimming the panel list to match.
  setLayout(layoutId) {
    this.update((s) => {
      const wanted = LAYOUTS[layoutId].panels;
      s.layout = layoutId;
      while (s.panels.length < wanted) s.panels.push(blankPanel());
      s.panels = s.panels.slice(0, wanted);
    }, "layout");
  }

  undo() {
    const step = this.past.pop();
    if (!step) return false;
    this.future.push({ settings: cloneSettings(this.settings), label: "redo" });
    this.settings = step.settings;
    this.emit();
    return true;
  }

  redo() {
    const step = this.future.pop();
    if (!step) return false;
    this.past.push({ settings: cloneSettings(this.settings), label: "undo" });
    this.settings = step.settings;
    this.emit();
    return true;
  }

  canUndo() { return this.past.length > 0; }
  canRedo() { return this.future.length > 0; }

  historyLabels() {
    return this.past.map((s) => s.label);
  }

  snapshot() {
    return cloneSettings(this.settings);
  }

  restore(snapshot) {
    this.past.push({ settings: cloneSettings(this.settings), label: "restore" });
    this.future = [];
    this.settings = cloneSettings(snapshot);
    this.emit();
  }
}
