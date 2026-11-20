// Fixed scenes for screenshots: ?shot=editor shows the page with a photo
// loaded; ?shot=cover shows the cover alone, full frame.
// Query keys: layout, size, grade, title, subtitle, photos (comma list of
// sample keys, dealt across the panels in order), select (panel to highlight).
// window.__shotReady is set once the scene is painted.

import { GRADES, LAYOUTS, SAMPLES, SIZES, blankPanel } from './state.js';

/** Applies the scene's query params onto the live state. */
function applyScene(query, ctx) {
  const { state, images, selectPanel, redraw, syncControls, loadImage } = ctx;
  const layout = query.get('layout');
  if (layout && LAYOUTS[layout]) state.layout = layout;
  const size = query.get('size');
  if (size && SIZES[size]) state.size = size;
  const grade = query.get('grade');
  if (grade && GRADES[grade]) state.grade = grade;
  const title = query.get('title');
  if (title !== null) state.title = title;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;

  const photos = (query.get('photos') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const cast = photos.length ? photos : SAMPLES.map((s) => s.key);
  const count = LAYOUTS[state.layout].panels.length;
  for (let i = 0; i < count; i++) {
    const key = cast[i % cast.length];
    state.panels[i] = blankPanel(key);
  }

  // A closer crop on the leads so the cover shows the crop control — and
  // Sol's portrait is panned toward her face, which sits high in the frame
  // and would otherwise fall outside the wide grid and hero cells.
  const facePan = state.layout === 'grid' ? 0.65 : state.layout === 'hero' ? 0.5 : 0;
  state.panels.forEach((p) => {
    if (p.key === 'sol' && facePan) { p.zoom = 1.05; p.oy = facePan; }
    if (p.key === 'dario') { p.zoom = 1.1; p.oy = 0.05; }
  });

  const select = Number(query.get('select') ?? '0');
  syncControls();
  selectPanel(Number.isFinite(select) ? select : 0, true);
  return loadSamplesForScene(images, loadImage, cast);
}

/** Makes sure every sample the scene deals is loaded before painting. */
async function loadSamplesForScene(images, loadImage, keys) {
  await Promise.all(keys.map(async (key) => {
    if (images.has(key)) return;
    const sample = SAMPLES.find((s) => s.key === key);
    if (!sample) return;
    try {
      images.set(key, await loadImage(sample.file));
    } catch {
      images.set(key, null);
    }
  }));
}

/** Runs one scene, then flags the page ready for the screenshot. */
export async function runShot(shot, query, ctx) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await applyScene(query, ctx);
  ctx.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
