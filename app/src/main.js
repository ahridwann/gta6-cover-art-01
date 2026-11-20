// Porto Solmar Cover Studio: wires the editor page.
// Pick a layout, a post size and a grade, type the title, click a panel to
// choose its photo, drag it to crop, scroll to zoom, then export a PNG.
// A `?shot=` query sets up a fixed scene for a screenshot (./shots.js).

import { drawCover, renderCover } from './cover.js';
import {
  GRADES, LAYOUTS, SAMPLES, SIZES,
  blankPanel, defaultState, fillPanelsFromSamples, layoutPanels, snapshotState,
} from './state.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('coverCanvas');
const statusLine = document.getElementById('statusLine');
const titleInput = document.getElementById('titleInput');
const subtitleInput = document.getElementById('subtitleInput');
const panelList = document.getElementById('panelList');
const sampleRow = document.getElementById('sampleRow');
const zoomRange = document.getElementById('zoomRange');
const zoomValue = document.getElementById('zoomValue');
const panelName = document.getElementById('panelName');

const state = defaultState();
const images = new Map(); // panel key -> HTMLImageElement
const uploads = new Map(); // upload key -> HTMLImageElement
let selectedPanel = 0;
let uploadCount = 0;

// ---- history (undo / redo) -----------------------------------------------

const history = [snapshotState(state)];
let historyIndex = 0;

function pushHistory() {
  history.splice(historyIndex + 1);
  history.push(snapshotState(state));
  if (history.length > 60) history.shift();
  historyIndex = history.length - 1;
  syncUndoRedo();
}

function restoreHistory(index) {
  historyIndex = index;
  const snap = history[historyIndex];
  Object.assign(state, JSON.parse(JSON.stringify(snap)));
  selectedPanel = Math.min(selectedPanel, layoutPanels(state).length - 1);
  syncControls();
  redraw();
  syncUndoRedo();
}

function syncUndoRedo() {
  document.getElementById('undoBtn').disabled = historyIndex <= 0;
  document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
}

// ---- images ----------------------------------------------------------------

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSamples() {
  await Promise.all(SAMPLES.map(async (s) => {
    try {
      images.set(s.key, await loadImage(s.file));
    } catch {
      images.set(s.key, null);
    }
  }));
}

// ---- drawing ----------------------------------------------------------------

function redraw() {
  const size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawCover(canvas, state, images);
  highlightSelectedPanel();
}

/** Outlines the selected panel on the preview, so the editor shows what is active. */
function highlightSelectedPanel() {
  // The outline is drawn by the overlay canvas sitting over the preview.
  const overlay = document.getElementById('selectOverlay');
  const ctx = overlay.getContext('2d');
  const size = SIZES[state.size];
  overlay.width = size.w;
  overlay.height = size.h;
  ctx.clearRect(0, 0, size.w, size.h);
  const rects = coverPanelRects();
  const r = rects[selectedPanel];
  if (!r) return;
  ctx.save();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = Math.max(3, size.w * 0.004);
  ctx.setLineDash([18, 10]);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Pixel rects of the current layout's panels on the preview canvas. */
function coverPanelRects() {
  const size = SIZES[state.size];
  const f = Math.round(Math.min(size.w, size.h) * 0.016);
  const g = Math.round(Math.min(size.w, size.h) * 0.012);
  const frame = { x: f, y: f, w: size.w - 2 * f, h: size.h - 2 * f };
  return layoutPanels(state).map((p) => ({
    x: frame.x + p.x * frame.w + g / 2,
    y: frame.y + p.y * frame.h + g / 2,
    w: p.w * frame.w - g,
    h: p.h * frame.h - g,
    rot: p.rot,
  }));
}

/** Which panel, if any, sits under a point on the preview canvas. */
function hitPanel(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * canvas.width;
  const y = ((clientY - box.top) / box.height) * canvas.height;
  const rects = coverPanelRects();
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

// ---- panel editing -----------------------------------------------------------

function selectPanel(index, silent = false) {
  selectedPanel = Math.max(0, Math.min(index, layoutPanels(state).length - 1));
  syncPanelEditor();
  highlightSelectedPanel();
  if (!silent) statusLine.textContent = `Panel ${selectedPanel + 1} selected — drag to move the photo, scroll to zoom.`;
}

function assignPhotoToSelected(key) {
  state.panels[selectedPanel] = { ...state.panels[selectedPanel], key, zoom: 1, ox: 0, oy: 0 };
  pushHistory();
  syncPanelEditor();
  redraw();
}

function syncPanelEditor() {
  const panels = layoutPanels(state);
  const panel = state.panels[selectedPanel] ?? blankPanel(null);
  const label = panel.key ? (SAMPLES.find((s) => s.key === panel.key)?.label ?? 'Your photo') : 'Empty';
  panelName.textContent = `Panel ${selectedPanel + 1} of ${panels.length} — ${label}`;
  zoomRange.value = String(panel.zoom);
  zoomValue.textContent = `${panel.zoom.toFixed(2)}×`;
  panelList.querySelectorAll('button').forEach((b, i) => {
    b.classList.toggle('active', i === selectedPanel);
    b.setAttribute('aria-pressed', String(i === selectedPanel));
  });
  sampleRow.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.key === panel.key);
  });
}

function buildPanelList() {
  panelList.innerHTML = '';
  layoutPanels(state).forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = `Panel ${i + 1}`;
    b.addEventListener('click', () => selectPanel(i));
    panelList.appendChild(b);
  });
}

function buildSampleRow() {
  sampleRow.innerHTML = '';
  SAMPLES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sample';
    b.dataset.key = s.key;
    b.title = s.label;
    const img = document.createElement('img');
    img.src = s.file;
    img.alt = s.label;
    img.loading = 'lazy';
    b.appendChild(img);
    b.addEventListener('click', () => assignPhotoToSelected(s.key));
    sampleRow.appendChild(b);
  });
}

// ---- option rows (layout / size / grade) --------------------------------------

function buildOptionRow(rowId, entries, current, onPick) {
  const row = document.getElementById(rowId);
  row.innerHTML = '';
  Object.entries(entries).forEach(([id, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = def.label;
    b.dataset.id = id;
    b.setAttribute('aria-pressed', String(id === current));
    if (def.blurb) b.title = def.blurb;
    b.addEventListener('click', () => {
      onPick(id);
      row.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.id === id)));
    });
    row.appendChild(b);
  });
}

function syncControls() {
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  buildOptionRow('layoutRow', LAYOUTS, state.layout, (id) => {
    state.layout = id;
    pushHistory();
    buildPanelList();
    selectPanel(Math.min(selectedPanel, layoutPanels(state).length - 1), true);
    redraw();
  });
  buildOptionRow('sizeRow', SIZES, state.size, (id) => {
    state.size = id;
    pushHistory();
    redraw();
  });
  buildOptionRow('gradeRow', GRADES, state.grade, (id) => {
    state.grade = id;
    pushHistory();
    redraw();
  });
  buildPanelList();
  syncPanelEditor();
}

// ---- pointer: drag to pan, wheel to zoom ---------------------------------------

let drag = null;

canvas.addEventListener('pointerdown', (e) => {
  const hit = hitPanel(e.clientX, e.clientY);
  if (hit < 0) return;
  selectPanel(hit, true);
  drag = { x: e.clientX, y: e.clientY, moved: false, before: snapshotState(state) };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const box = canvas.getBoundingClientRect();
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  const dx = ((e.clientX - drag.x) / box.width) * (canvas.width / coverPanelRects()[selectedPanel].w);
  const dy = ((e.clientY - drag.y) / box.height) * (canvas.height / coverPanelRects()[selectedPanel].h);
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 2) drag.moved = true;
  panel.ox = clampPan(panel.ox + dx * 0.5, panel.zoom);
  panel.oy = clampPan(panel.oy + dy * 0.5, panel.zoom);
  drag.x = e.clientX;
  drag.y = e.clientY;
  redraw();
});

canvas.addEventListener('pointerup', () => {
  if (drag?.moved) pushHistory();
  drag = null;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const hit = hitPanel(e.clientX, e.clientY);
  if (hit >= 0) selectPanel(hit, true);
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.zoom = Math.min(3, Math.max(1, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  panel.ox = clampPan(panel.ox, panel.zoom);
  panel.oy = clampPan(panel.oy, panel.zoom);
  zoomRange.value = String(panel.zoom);
  zoomValue.textContent = `${panel.zoom.toFixed(2)}×`;
  redraw();
}, { passive: false });

function clampPan(v, zoom) {
  const limit = 0.3 + (zoom - 1) * 0.5;
  return Math.max(-limit, Math.min(limit, v));
}

// ---- static controls -----------------------------------------------------------

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
titleInput.addEventListener('change', pushHistory);
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
subtitleInput.addEventListener('change', pushHistory);

zoomRange.addEventListener('input', () => {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.zoom = Number(zoomRange.value);
  panel.ox = clampPan(panel.ox, panel.zoom);
  panel.oy = clampPan(panel.oy, panel.zoom);
  zoomValue.textContent = `${panel.zoom.toFixed(2)}×`;
  redraw();
});
zoomRange.addEventListener('change', pushHistory);

document.getElementById('uploadInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const key = `upload${++uploadCount}`;
  const img = await loadImage(URL.createObjectURL(file));
  uploads.set(key, img);
  images.set(key, img);
  assignPhotoToSelected(key);
  statusLine.textContent = `Loaded ${file.name} into panel ${selectedPanel + 1}.`;
  e.target.value = '';
});

document.getElementById('fillAllBtn').addEventListener('click', () => {
  fillPanelsFromSamples(state);
  pushHistory();
  syncPanelEditor();
  redraw();
  statusLine.textContent = 'Filled every panel from the Porto Solmar cast.';
});

document.getElementById('undoBtn').addEventListener('click', () => {
  if (historyIndex > 0) restoreHistory(historyIndex - 1);
});
document.getElementById('redoBtn').addEventListener('click', () => {
  if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1);
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  await document.fonts.ready;
  const size = SIZES[state.size];
  const out = renderCover(state, images, state.size);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `porto-solmar-cover-${size.w}x${size.h}.png`;
    a.click();
    statusLine.textContent = `Saved porto-solmar-cover-${size.w}x${size.h}.png — share it anywhere.`;
  }, 'image/png');
});

// ---- screenshot hooks (used by the maker's headless captures) -------------------

/** Renders the cover at a post size and returns its PNG as a data URL. */
window.__exportCover = async function exportCoverDataUrl(sizeId) {
  await document.fonts.ready;
  const out = renderCover(state, images, sizeId ?? state.size);
  return out.toDataURL('image/png');
};

/** Renders the cover, scales it to fit inside maxW × maxH, returns a JPEG data URL. */
window.__shotExport = async function shotExport(sizeId, maxW, maxH) {
  await document.fonts.ready;
  const out = renderCover(state, images, sizeId ?? state.size);
  const scale = Math.min(maxW / out.width, maxH / out.height, 1);
  const small = document.createElement('canvas');
  small.width = Math.round(out.width * scale);
  small.height = Math.round(out.height * scale);
  small.getContext('2d').drawImage(out, 0, 0, small.width, small.height);
  return { dataUrl: small.toDataURL('image/jpeg', 0.68), w: small.width, h: small.height };
};

// ---- boot -----------------------------------------------------------------------

async function boot() {
  buildSampleRow();
  syncControls();
  syncUndoRedo();
  await loadSamples();
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('60px Pacifico'),
    ]);
  } catch {
    // The fallback sans still draws; the fonts are local files, so this is rare.
  }
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      state, images, selectPanel, redraw, syncControls, loadImage,
    });
  } else {
    redraw();
  }
}

boot();
