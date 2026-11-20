// Porto Solmar Cover Studio: the cover renderer.
// Draws a multi-panel GTA-style poster onto any canvas: photos cover-fit per
// panel with a colour grade, inked gutters, halftone title lettering in Anton
// with a Pacifico subtitle, then grain and a vignette. Pure 2D canvas, no libs.

import { GRADES, LAYOUTS, SIZES } from './state.js';

let noiseCanvas = null;

/** A small tile of random grey noise, reused as the grain pattern. */
function grainTile() {
  if (noiseCanvas) return noiseCanvas;
  noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 160;
  noiseCanvas.height = 160;
  const ctx = noiseCanvas.getContext('2d');
  const data = ctx.createImageData(160, 160);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 64);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return noiseCanvas;
}

/** Halftone dots across a rect, denser toward its centre. */
function halftone(ctx, x, y, w, h, scale) {
  const step = 15 * scale;
  ctx.save();
  ctx.fillStyle = 'rgba(20, 5, 40, 0.16)';
  for (let yy = y + step / 2; yy < y + h; yy += step) {
    for (let xx = x + step / 2; xx < x + w; xx += step) {
      const dx = (xx - (x + w / 2)) / (w / 2);
      const dy = (yy - (y + h / 2)) / (h / 2);
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const r = (1.6 + 2.2 * (1 - d)) * scale;
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Draws one photo cover-fit into a rect, honouring its zoom and pan. */
function drawPhotoPanel(ctx, img, panel, rectPx, grade) {
  const { x, y, w, h } = rectPx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) {
    const base = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const s = base * panel.zoom;
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    const dx = x + (w - dw) / 2 + panel.ox * w;
    const dy = y + (h - dh) / 2 + panel.oy * h;
    ctx.filter = grade.filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = '#3a1c4d';
    ctx.fillRect(x, y, w, h);
  }
  const wash = ctx.createLinearGradient(x, y, x, y + h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade.tint;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  // Inked edge, comic-book style.
  ctx.save();
  ctx.strokeStyle = '#160a24';
  ctx.lineWidth = Math.max(2, w * 0.006);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

/** The biggest Anton size that fits `text` inside `maxWidth`. */
function fitTitle(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

/** The sunset-gradient title with a dark ink outline, centred in a rect. */
function drawTitleText(ctx, text, cx, cy, maxWidth, startSize, scale) {
  const size = fitTitle(ctx, text, maxWidth, startSize);
  const grad = ctx.createLinearGradient(0, cy - size * 0.62, 0, cy + size * 0.28);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, '#ffd23f');
  grad.addColorStop(1, '#ff7a3d');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#160a24';
  ctx.lineWidth = Math.max(2, size * 0.085);
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, cy);
  ctx.restore();
  return size;
}

/** The Pacifico subtitle in white with a neon-pink glow. */
function drawSubtitleText(ctx, text, cx, cy, maxWidth, startSize, scale) {
  if (!text.trim()) return 0;
  let size = startSize;
  ctx.font = `${size}px Pacifico, cursive`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${size}px Pacifico, cursive`;
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = size * 0.45;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, cy);
  ctx.restore();
  return size;
}

/** The title block: sunset gradient, halftone, title and subtitle stacked. */
function drawTitleBlock(ctx, layout, state, frame, scale) {
  const t = layout.title;
  const x = frame.x + t.x * frame.w;
  const y = frame.y + t.y * frame.h;
  const w = t.w * frame.w;
  const h = t.h * frame.h;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#ff9a3d');
  grad.addColorStop(0.5, '#ff5e62');
  grad.addColorStop(1, '#c22a7a');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  halftone(ctx, x, y, w, h, scale);
  ctx.save();
  ctx.strokeStyle = '#160a24';
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
  const titleSize = drawTitleText(ctx, state.title.toUpperCase(), x + w / 2, y + h * 0.42, w * 0.92, h * 0.34, scale);
  drawSubtitleText(ctx, state.subtitle, x + w / 2, y + h * 0.42 + titleSize * 0.72, w * 0.86, h * 0.16, scale);
}

/** The title band: dark ink band with the sunset-gradient title and script subtitle. */
function drawTitleBand(ctx, layout, state, frame, scale) {
  const t = layout.title;
  const x = frame.x + t.x * frame.w;
  const y = frame.y + t.y * frame.h;
  const w = t.w * frame.w;
  const h = t.h * frame.h;
  ctx.fillStyle = '#160a24';
  ctx.fillRect(x, y, w, h);
  const sun = ctx.createLinearGradient(x, y, x + w, y);
  sun.addColorStop(0, 'rgba(255, 122, 61, 0.55)');
  sun.addColorStop(0.5, 'rgba(255, 46, 136, 0.35)');
  sun.addColorStop(1, 'rgba(0, 229, 204, 0.35)');
  ctx.fillStyle = sun;
  ctx.fillRect(x, y, w, h * 0.06);
  const titleSize = drawTitleText(ctx, state.title.toUpperCase(), x + w / 2, y + h * 0.44, w * 0.94, h * 0.52, scale);
  drawSubtitleText(ctx, state.subtitle, x + w / 2, y + h * 0.44 + titleSize * 0.68, w * 0.8, h * 0.2, scale);
}

/** The top title: big lettering floating over the full-bleed photo, with a soft shadow. */
function drawTitleTop(ctx, layout, state, frame, scale) {
  const t = layout.title;
  const x = frame.x + t.x * frame.w;
  const y = frame.y + t.y * frame.h;
  const w = t.w * frame.w;
  const h = t.h * frame.h;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.02);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.shadowColor = 'rgba(10, 2, 24, 0.65)';
  ctx.shadowBlur = 18 * scale;
  ctx.shadowOffsetY = 6 * scale;
  const titleSize = drawTitleText(ctx, state.title.toUpperCase(), x + w / 2, y + h * 0.42, w * 0.96, h * 0.5, scale);
  ctx.restore();
  drawSubtitleText(ctx, state.subtitle, x + w / 2, y + h * 0.42 + titleSize * 0.72, w * 0.8, h * 0.22, scale);
}

/**
 * Draws the whole cover onto `canvas` at its own pixel size.
 * `images` maps a panel key to an HTMLImageElement (or null while loading).
 * `gutter` is the white gap between panels, as a fraction of the short side.
 */
export function drawCover(canvas, state, images, gutter = 0.012) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const scale = Math.min(w, h) / 1080;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.grid;

  // Cream paper, then the white frame the panels sit inside.
  ctx.fillStyle = '#fff6e8';
  ctx.fillRect(0, 0, w, h);
  const f = Math.round(Math.min(w, h) * 0.016);
  const frame = { x: f, y: f, w: w - 2 * f, h: h - 2 * f };
  const g = Math.round(Math.min(w, h) * gutter);

  // Panels, in order; tilted snapshots rotate around their own centre.
  layout.panels.forEach((p, i) => {
    const px = frame.x + p.x * frame.w + g / 2;
    const py = frame.y + p.y * frame.h + g / 2;
    const pw = p.w * frame.w - g;
    const ph = p.h * frame.h - g;
    const panel = state.panels[i] ?? { key: null, zoom: 1, ox: 0, oy: 0 };
    const img = panel.key ? images.get(panel.key) ?? null : null;
    ctx.save();
    if (p.rot) {
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.translate(-(px + pw / 2), -(py + ph / 2));
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - g * 0.45, py - g * 0.45, pw + g * 0.9, ph + g * 0.9);
    drawPhotoPanel(ctx, img, panel, { x: px, y: py, w: pw, h: ph }, grade);
    ctx.restore();
  });

  // Lettering, per layout.
  if (layout.title.mode === 'block') drawTitleBlock(ctx, layout, state, frame, scale);
  if (layout.title.mode === 'band') drawTitleBand(ctx, layout, state, frame, scale);
  if (layout.title.mode === 'top') drawTitleTop(ctx, layout, state, frame, scale);

  // Grain, then a vignette to pull the eye to the middle.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(20, 5, 30, 0)');
  vig.addColorStop(1, 'rgba(20, 5, 30, 0.26)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Thin ink frame around the whole poster.
  ctx.save();
  ctx.strokeStyle = '#160a24';
  ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.strokeRect(f / 2, f / 2, w - f, h - f);
  ctx.restore();
}

/** Renders the cover at one of the post sizes and returns the fresh canvas. */
export function renderCover(state, images, sizeId) {
  const size = SIZES[sizeId] ?? SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state, images);
  return canvas;
}
