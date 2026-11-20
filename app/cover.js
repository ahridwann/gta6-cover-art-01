// Porto Solmar cover renderer.
// Draws a complete GTA-style poster cover onto a canvas: a painted sky,
// a low sun, a procedural skyline, photo panels, bold title lettering and
// a sunset colour grade. Every pixel is drawn here — no game artwork.

import { shotById } from "./shots.js";
import { LAYOUTS, EXPORT_SIZES } from "./state.js";

// Small deterministic hash so the skyline looks the same every render.
function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t * 1664525 + 1013904223) >>> 0;
    return t / 4294967296;
  };
}

// "#rrggbb" plus an alpha, as an rgba() string, for gradient stops.
function hexWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function panelRects(layoutId, width, height, gap) {
  const margin = Math.round(width * 0.045);
  const innerW = width - margin * 2;
  const innerH = height - margin * 2;
  if (layoutId === "hero") {
    return [{ x: margin, y: margin, w: innerW, h: innerH }];
  }
  if (layoutId === "duo") {
    const w = (innerW - gap) / 2;
    return [
      { x: margin, y: margin, w, h: innerH },
      { x: margin + w + gap, y: margin, w, h: innerH },
    ];
  }
  if (layoutId === "split") {
    const topH = innerH * 0.58;
    const botH = innerH - topH - gap;
    const w = (innerW - gap) / 2;
    return [
      { x: margin, y: margin, w: innerW, h: topH },
      { x: margin, y: margin + topH + gap, w, h: botH },
      { x: margin + w + gap, y: margin + topH + gap, w, h: botH },
    ];
  }
  // trio: three vertical strips
  const w = (innerW - gap * 2) / 3;
  return [0, 1, 2].map((i) => ({
    x: margin + i * (w + gap),
    y: margin,
    w,
    h: innerH,
  }));
}

function drawSky(ctx, shot, width, height) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, shot.skyTop);
  g.addColorStop(0.55, shot.skyMid);
  g.addColorStop(1, shot.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // Stars, only for the night looks.
  if (shot.stars > 0) {
    const rnd = seeded(20261120);
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < shot.stars; i++) {
      const x = rnd() * width;
      const y = rnd() * height * 0.4;
      const r = rnd() * 1.8 + 0.6;
      ctx.globalAlpha = 0.35 + rnd() * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Sun (or moon) with a soft halo.
  const sunX = width * 0.68;
  const sunY = height * shot.sunY;
  const sunR = Math.min(width, height) * shot.sunRadius;
  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.2);
  halo.addColorStop(0, shot.sunColor);
  halo.addColorStop(0.35, hexWithAlpha(shot.sunColor, 0.45));
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - sunR * 3.2, sunY - sunR * 3.2, sunR * 6.4, sunR * 6.4);
  ctx.globalAlpha = 1;
  ctx.fillStyle = shot.sunColor;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
}

function drawSkyline(ctx, shot, width, height, color, baseline, scale, seed, density) {
  const rnd = seeded(seed);
  const horizon = height * baseline;
  let x = -10;
  ctx.fillStyle = color;
  while (x < width + 10) {
    const bw = (0.03 + rnd() * 0.07) * width;
    const bh = (0.08 + rnd() * 0.30) * height * scale;
    const by = horizon - bh;
    ctx.fillRect(x, by, bw, bh);
    // A rooftop antenna on some towers.
    if (rnd() > 0.72) {
      ctx.fillRect(x + bw / 2 - 2, by - bh * 0.22, 4, bh * 0.22);
      ctx.beginPath();
      ctx.arc(x + bw / 2, by - bh * 0.22, 4, 0, Math.PI * 2);
      ctx.fillStyle = shot.accent;
      ctx.fill();
      ctx.fillStyle = color;
    }
    // Lit windows.
    if (density > 0) {
      ctx.fillStyle = shot.windowColor;
      const cols = Math.max(1, Math.floor(bw / 22));
      const rows = Math.max(1, Math.floor(bh / 30));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rnd() < density) {
            ctx.globalAlpha = 0.35 + rnd() * 0.6;
            ctx.fillRect(x + 5 + c * 22, by + 8 + r * 30, 9, 12);
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
    }
    x += bw + rnd() * 14;
  }
}

function drawSea(ctx, shot, width, height) {
  const top = height * 0.74;
  const g = ctx.createLinearGradient(0, top, 0, height);
  g.addColorStop(0, shot.skyLow);
  g.addColorStop(1, shot.skyTop);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, width, height - top);
  // Sun glitter on the water.
  const rnd = seeded(77);
  ctx.fillStyle = shot.sunColor;
  for (let i = 0; i < 90; i++) {
    const y = top + rnd() * (height - top);
    const w = 20 + rnd() * 120;
    ctx.globalAlpha = 0.10 + rnd() * 0.35;
    ctx.fillRect(width * 0.68 - w / 2 + (rnd() - 0.5) * 60, y, w, 3);
  }
  ctx.globalAlpha = 1;
}

function drawNeonSigns(ctx, shot, width, height) {
  const rnd = seeded(4242);
  const signs = ["SOLMAR", "HOTEL", "BAR", "24H", "TACOS"];
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 5; i++) {
    const x = width * (0.12 + i * 0.19);
    const y = height * (0.30 + rnd() * 0.25);
    const word = signs[i];
    ctx.font = `bold ${Math.round(width * 0.028)}px Anton, sans-serif`;
    ctx.shadowColor = i % 2 ? shot.accent : "#ff4fd8";
    ctx.shadowBlur = 26;
    ctx.fillStyle = i % 2 ? "#37f2e2" : "#ff8ae8";
    ctx.fillText(word, x, y);
  }
  ctx.shadowBlur = 0;
}

function drawPhotoInto(ctx, image, rect, panel) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const zoom = panel.zoom || 1;
  const scale = Math.max(rect.w / image.width, rect.h / image.height) * zoom;
  const dw = image.width * scale;
  const dh = image.height * scale;
  const dx = rect.x + (rect.w - dw) / 2 + (panel.offsetX || 0) * rect.w * 0.3;
  const dy = rect.y + (rect.h - dh) / 2 + (panel.offsetY || 0) * rect.h * 0.3;
  // Warmth: a warm wash over the photo.
  ctx.drawImage(image, dx, dy, dw, dh);
  if (panel.warmth) {
    ctx.fillStyle = `rgba(255, 122, 26, ${Math.abs(panel.warmth) * 0.18})`;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

function drawDemoScene(ctx, rect, seed) {
  // A procedural stand-in photo: a palm-lined boulevard at dusk, drawn
  // with shapes so the app works with no file at all.
  const rnd = seeded(seed);
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  g.addColorStop(0, "#ff9a3d");
  g.addColorStop(0.6, "#b83a5e");
  g.addColorStop(1, "#2b1a4e");
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(rect.x + rect.w * 0.6, rect.y + rect.h * 0.3, rect.w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // Palms.
  ctx.strokeStyle = "#1d1030";
  ctx.lineWidth = Math.max(3, rect.w * 0.012);
  for (let i = 0; i < 4; i++) {
    const px = rect.x + rect.w * (0.15 + i * 0.24);
    const py = rect.y + rect.h * 0.95;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + (rnd() - 0.5) * 30, py - rect.h * 0.35, px + (rnd() - 0.5) * 60, py - rect.h * 0.55);
    ctx.stroke();
    for (let f = 0; f < 5; f++) {
      const a = Math.PI * (0.15 + f * 0.18);
      ctx.beginPath();
      ctx.moveTo(px + (rnd() - 0.5) * 60, py - rect.h * 0.55);
      ctx.lineTo(px + Math.cos(a) * rect.w * 0.14, py - rect.h * 0.55 + Math.sin(a) * rect.h * 0.08);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#1d1030";
  ctx.fillRect(rect.x, rect.y + rect.h * 0.92, rect.w, rect.h * 0.08);
}

function drawTitle(ctx, shot, settings, width, height) {
  const size = Math.round(width * 0.115 * (settings.titleSize || 1));
  const y = height * 0.86;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${size}px Anton, sans-serif`;
  const title = (settings.title || "PORTO SOLMAR").toUpperCase();
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, size * 0.10);
  ctx.strokeStyle = shot.titleOutline;
  ctx.strokeText(title, width / 2, y);
  ctx.fillStyle = shot.titleColor;
  ctx.fillText(title, width / 2, y);
  // Script subtitle tucked under the title.
  if (settings.subtitle) {
    ctx.font = `${Math.round(size * 0.42)}px Pacifico, cursive`;
    ctx.fillStyle = shot.subtitleColor;
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 12;
    ctx.fillText(settings.subtitle, width / 2, y + size * 0.52);
    ctx.shadowBlur = 0;
  }
}

function drawCaptionBar(ctx, shot, settings, width, height) {
  if (!settings.showCaption || !settings.caption) return;
  const barH = height * 0.075;
  const y = height - barH;
  ctx.fillStyle = "rgba(10, 6, 20, 0.72)";
  ctx.fillRect(0, y, width, barH);
  ctx.fillStyle = shot.accent;
  ctx.fillRect(0, y, width, 4);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(width * 0.026)}px Anton, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = settings.caption;
  const maxW = width * 0.9;
  ctx.fillText(fitText(ctx, text, maxW), width / 2, y + barH / 2 + 2, maxW);
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 4 && ctx.measureText(out + "…").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "…";
}

function drawGrain(ctx, width, height, amount) {
  if (amount <= 0) return;
  const rnd = seeded(999);
  ctx.fillStyle = "#ffffff";
  const count = Math.round(2600 * amount);
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = rnd() * 0.16 * amount;
    ctx.fillRect(rnd() * width, rnd() * height, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function drawVignette(ctx, width, height, amount) {
  if (amount <= 0) return;
  const g = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.42,
    width / 2, height / 2, Math.max(width, height) * 0.75,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${0.55 * amount})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

// Render a full cover. `photos` is an array of HTMLImageElement (or null)
// aligned with settings.panels. Returns nothing; draws into `canvas`.
export function renderCover(canvas, settings, photos) {
  const size = EXPORT_SIZES[settings.size] || EXPORT_SIZES.portrait;
  const width = size.width;
  const height = size.height;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const shot = shotById(settings.shot);

  drawSky(ctx, shot, width, height);
  if (shot.sea) drawSea(ctx, shot, width, height);
  if (settings.showSkyline) {
    drawSkyline(ctx, shot, width, height, shot.skylineFar, 0.72, 0.7, 11, shot.windowDensity * 0.5);
    drawSkyline(ctx, shot, width, height, shot.skylineNear, 0.78, 1.0, 23, shot.windowDensity);
  }
  if (shot.neon) drawNeonSigns(ctx, shot, width, height);

  // Photo panels sit over the painted city.
  const gap = Math.round(width * 0.012) + shot.panelGap;
  const rects = panelRects(settings.layout, width, height * 0.78, gap);
  rects.forEach((rect, i) => {
    const panel = settings.panels[i] || { photo: null, zoom: 1, offsetX: 0, offsetY: 0, warmth: 0 };
    const photo = photos && photos[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (photo) {
      drawPhotoInto(ctx, photo, rect, panel);
    } else {
      drawDemoScene(ctx, rect, 100 + i * 17);
      ctx.fillStyle = "rgba(10, 6, 20, 0.55)";
      ctx.fillRect(rect.x, rect.y + rect.h - 44, rect.w, 44);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(rect.w * 0.045)}px Anton, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`PANEL ${i + 1} · ADD YOUR PHOTO`, rect.x + rect.w / 2, rect.y + rect.h - 22);
    }
    ctx.restore();
    // Panel frame.
    ctx.strokeStyle = shot.borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
  });

  drawTitle(ctx, shot, settings, width, height);
  drawCaptionBar(ctx, shot, settings, width, height);

  // Sunset grade + grain + vignette finish the poster look.
  ctx.fillStyle = shot.grade;
  ctx.fillRect(0, 0, width, height);
  const shadow = ctx.createLinearGradient(0, height * 0.6, 0, height);
  shadow.addColorStop(0, "rgba(0,0,0,0)");
  shadow.addColorStop(1, shot.gradeShadow);
  ctx.fillStyle = shadow;
  ctx.fillRect(0, height * 0.6, width, height * 0.4);
  drawGrain(ctx, width, height, settings.grain ?? 0.5);
  drawVignette(ctx, width, height, settings.vignette ?? 0.55);
}

export function layoutPanelCount(layoutId) {
  return (LAYOUTS[layoutId] || LAYOUTS.trio).panels;
}
