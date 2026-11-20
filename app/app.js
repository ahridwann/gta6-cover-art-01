// Porto Solmar Cover Studio — editor UI.
// Wires the controls to the store, loads photos from the user's machine,
// and re-renders the canvas preview on every change. Photos are read
// locally with FileReader and never uploaded anywhere.

import { shotList } from "./shots.js";
import { CoverStore, LAYOUTS, EXPORT_SIZES, defaultSettings } from "./state.js";
import { renderCover } from "./cover.js";

const store = new CoverStore(defaultSettings());
const canvas = document.getElementById("coverCanvas");
const photoCache = [null, null, null];

function el(id) {
  return document.getElementById(id);
}

function loadPhotoFile(file, index) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read that image"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

async function onPhotoPicked(index, file) {
  if (!file) return;
  try {
    const img = await loadPhotoFile(file, index);
    photoCache[index] = img;
    store.setPanel(index, "photo", file.name, `photo ${index + 1}`);
    el("statusLine").textContent = `Photo loaded into panel ${index + 1}: ${file.name}`;
  } catch (err) {
    el("statusLine").textContent = `That photo did not load: ${err.message}`;
  }
}

function syncActiveButtons() {
  document.querySelectorAll(".shot-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.shot === store.settings.shot);
  });
  document.querySelectorAll(".layout-btn").forEach((b) => {
    b.classList.toggle("active", b.textContent.startsWith((LAYOUTS[store.settings.layout] || {}).label || ""));
  });
  document.querySelectorAll(".size-btn").forEach((b) => {
    b.classList.toggle("active", b.textContent === (EXPORT_SIZES[store.settings.size] || {}).label);
  });
}

function renderAll() {
  renderCover(canvas, store.settings, photoCache);
  el("undoBtn").disabled = !store.canUndo();
  el("redoBtn").disabled = !store.canRedo();
  el("historyCount").textContent = `${store.past.length} step${store.past.length === 1 ? "" : "s"} — undo available`;
  syncActiveButtons();
  syncPanelControls();
}

function syncPanelControls() {
  const count = store.settings.panels.length;
  document.querySelectorAll(".panel-card").forEach((card, i) => {
    card.style.display = i < count ? "" : "none";
    if (i >= count) return;
    const panel = store.settings.panels[i];
    card.querySelector(".zoomRange").value = panel.zoom;
    card.querySelector(".zoomValue").textContent = `${Math.round(panel.zoom * 100)}%`;
    card.querySelector(".xRange").value = panel.offsetX;
    card.querySelector(".yRange").value = panel.offsetY;
    card.querySelector(".warmRange").value = panel.warmth;
    card.querySelector(".photoName").textContent = panel.photo || "No photo yet — demo scene shown";
  });
}

function buildShotButtons() {
  const wrap = el("shotRow");
  for (const shot of shotList()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "shot-btn";
    btn.dataset.shot = shot.id;
    btn.innerHTML = `<span class="swatch" style="background:linear-gradient(135deg, ${shot.skyTop}, ${shot.skyMid} 55%, ${shot.skyLow})"></span><span class="shot-name">${shot.label}</span><span class="shot-tag">${shot.tagline}</span>`;
    btn.addEventListener("click", () => {
      store.set("shot", shot.id, `shot: ${shot.label}`);
      document.querySelectorAll(".shot-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
    wrap.appendChild(btn);
  }
  wrap.querySelector('[data-shot="skyline-dusk"]').classList.add("active");
}

function buildLayoutButtons() {
  const wrap = el("layoutRow");
  for (const layout of Object.values(LAYOUTS)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "layout-btn";
    btn.textContent = `${layout.label} — ${layout.blurb}`;
    btn.addEventListener("click", () => {
      store.setLayout(layout.id);
      document.querySelectorAll(".layout-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
    wrap.appendChild(btn);
  }
  wrap.querySelector(".layout-btn:nth-child(3)").classList.add("active");
}

function buildSizeButtons() {
  const wrap = el("sizeRow");
  for (const size of Object.values(EXPORT_SIZES)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "size-btn";
    btn.textContent = size.label;
    btn.addEventListener("click", () => {
      store.set("size", size.id, `size: ${size.label}`);
      document.querySelectorAll(".size-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
    wrap.appendChild(btn);
  }
  wrap.querySelector(".size-btn:nth-child(2)").classList.add("active");
}

function buildPanelCards() {
  const wrap = el("panelList");
  for (let i = 0; i < 3; i++) {
    const card = document.createElement("div");
    card.className = "panel-card";
    card.innerHTML = `
      <div class="panel-head"><strong>Panel ${i + 1}</strong><span class="photoName">No photo yet</span></div>
      <label class="file-btn">Choose photo
        <input type="file" accept="image/*" hidden>
      </label>
      <label>Zoom <span class="zoomValue">100%</span>
        <input type="range" class="zoomRange" min="1" max="2.5" step="0.05" value="1">
      </label>
      <label>Move left–right
        <input type="range" class="xRange" min="-1" max="1" step="0.05" value="0">
      </label>
      <label>Move up–down
        <input type="range" class="yRange" min="-1" max="1" step="0.05" value="0">
      </label>
      <label>Warmth
        <input type="range" class="warmRange" min="-1" max="1" step="0.1" value="0">
      </label>`;
    card.querySelector("input[type=file]").addEventListener("change", (e) => {
      onPhotoPicked(i, e.target.files[0]);
    });
    card.querySelector(".zoomRange").addEventListener("input", (e) => {
      store.setPanel(i, "zoom", Number(e.target.value), "zoom");
    });
    card.querySelector(".xRange").addEventListener("input", (e) => {
      store.setPanel(i, "offsetX", Number(e.target.value), "position");
    });
    card.querySelector(".yRange").addEventListener("input", (e) => {
      store.setPanel(i, "offsetY", Number(e.target.value), "position");
    });
    card.querySelector(".warmRange").addEventListener("input", (e) => {
      store.setPanel(i, "warmth", Number(e.target.value), "warmth");
    });
    wrap.appendChild(card);
  }
}

function bindTextControls() {
  el("titleInput").addEventListener("input", (e) => store.set("title", e.target.value, "title"));
  el("subtitleInput").addEventListener("input", (e) => store.set("subtitle", e.target.value, "subtitle"));
  el("captionInput").addEventListener("input", (e) => store.set("caption", e.target.value, "caption"));
  el("captionToggle").addEventListener("change", (e) => store.set("showCaption", e.target.checked, "caption bar"));
  el("skylineToggle").addEventListener("change", (e) => store.set("showSkyline", e.target.checked, "skyline"));
  el("titleSizeRange").addEventListener("input", (e) => store.set("titleSize", Number(e.target.value), "title size"));
  el("grainRange").addEventListener("input", (e) => store.set("grain", Number(e.target.value), "grain"));
  el("vignetteRange").addEventListener("input", (e) => store.set("vignette", Number(e.target.value), "vignette"));
}

function bindActions() {
  el("undoBtn").addEventListener("click", () => store.undo());
  el("redoBtn").addEventListener("click", () => store.redo());
  el("resetBtn").addEventListener("click", () => {
    photoCache[0] = photoCache[1] = photoCache[2] = null;
    store.restore(defaultSettings());
    el("titleInput").value = store.settings.title;
    el("subtitleInput").value = store.settings.subtitle;
    el("captionInput").value = store.settings.caption;
    el("statusLine").textContent = "Fresh cover — back to the Skyline Dusk defaults.";
  });
  el("exportBtn").addEventListener("click", () => {
    renderCover(canvas, store.settings, photoCache);
    const size = EXPORT_SIZES[store.settings.size];
    const a = document.createElement("a");
    a.download = `porto-solmar-${store.settings.shot}-${size.width}x${size.height}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
    el("statusLine").textContent = `Exported ${size.width} × ${size.height} PNG — share it anywhere.`;
  });
  el("copySettingsBtn").addEventListener("click", async () => {
    const text = JSON.stringify(store.snapshot(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      el("statusLine").textContent = "Cover settings copied as JSON.";
    } catch {
      el("statusLine").textContent = "Clipboard blocked — settings are still on screen.";
    }
  });
}

store.onChange(renderAll);
buildShotButtons();
buildLayoutButtons();
buildSizeButtons();
buildPanelCards();
bindTextControls();
bindActions();
renderAll();
