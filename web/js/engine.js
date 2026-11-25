// City Story PC Isometric Rendering Engine
// Faithfully replicates DriveScene, Camera, LandDriveStar, BuildingDriveStar, and FactoryDriveStar
const TILE_W = 128;
const TILE_H = 74;
const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

class CityEngine {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.game = game;

    this.cam = {
      x: 0,
      y: 0,
      zoom: 0.92,
      targetZoom: 0.92,
      minZoom: 0.32,
      maxZoom: 2.0
    };

    this.images = new Map();
    this.floats = []; // Floating +coins / +XP animations
    this.hoverWorld = null;
    this.hoverCell = null;
    this.drag = { active: false, moved: false, startX: 0, startY: 0, camX: 0, camY: 0 };
    this.lastFrame = performance.now();

    // Preload core textures
    this.preloadCore();
    this.bindEvents();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  preloadCore() {
    const core = [
      "assets/sprites/grassloop.png",
      "assets/sprites/groundloop.png",
      "assets/sprites/statusHarvest.png",
      "assets/sprites/factoryReady.png",
      "assets/sprites/coins_small.png",
      "assets/sprites/exp_small.png",
      "assets/sprites/item997-0.png",
      "assets/sprites/item997-1.png",
      "assets/sprites/item997-2.png",
      "assets/sprites/item998-0.png",
      "assets/sprites/item998-1.png",
      "assets/sprites/item998-2.png",
      "assets/sprites/item999-1.png",
      "assets/sprites/item999-2.png",
      "assets/sprites/item3001.png",
      "assets/sprites/item3001-1.png",
      "assets/sprites/item3001-2.png",
      "assets/sprites/item3001-3.png",
      "assets/sprites/item3002.png",
      "assets/sprites/item3002-1.png",
      "assets/sprites/item3002-2.png",
      "assets/sprites/item3002-3.png"
    ];
    for (let i = 0; i < 16; i++) {
      core.push(`assets/sprites/item4001-${i}.png`);
      core.push(`assets/sprites/item4012-${i}.png`);
    }
    for (const src of core) this.getImage(src);
  }

  getImage(src) {
    if (!src) return null;
    let img = this.images.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      this.images.set(src, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.dpr = dpr;
    this.viewW = w;
    this.viewH = h;
  }

  centerOnBoard() {
    const s = this.game.state.boardSize;
    const c = this.worldToIso(s / 2, s / 2);
    this.cam.x = c.ix;
    this.cam.y = c.iy - 20;
    this.cam.zoom = Math.min(1.05, Math.max(0.55, (this.viewW / (s * TILE_W)) * 1.15));
    this.cam.targetZoom = this.cam.zoom;
  }

  worldToIso(x, z) {
    return {
      ix: (x - z) * HALF_W,
      iy: (x + z) * HALF_H
    };
  }

  isoToScreen(ix, iy) {
    return {
      sx: (ix - this.cam.x) * this.cam.zoom + this.viewW / 2,
      sy: (iy - this.cam.y) * this.cam.zoom + this.viewH / 2
    };
  }

  screenToWorld(sx, sy) {
    const ix = (sx - this.viewW / 2) / this.cam.zoom + this.cam.x;
    const iy = (sy - this.viewH / 2) / this.cam.zoom + this.cam.y;
    const x = (ix / HALF_W + iy / HALF_H) / 2;
    const z = (iy / HALF_H - ix / HALF_W) / 2;
    return { x, z, ix, iy };
  }

  clampCamera() {
    const s = this.game.state.boardSize;
    const c = this.worldToIso(s / 2, s / 2);
    const maxSpanX = s * HALF_W + 420;
    const maxSpanY = s * HALF_H + 340;
    this.cam.x = Math.max(c.ix - maxSpanX, Math.min(c.ix + maxSpanX, this.cam.x));
    this.cam.y = Math.max(c.iy - maxSpanY, Math.min(c.iy + maxSpanY, this.cam.y));
  }

  zoomBy(factor, anchorX = this.viewW / 2, anchorY = this.viewH / 2) {
    const before = this.screenToWorld(anchorX, anchorY);
    this.cam.targetZoom = Math.max(this.cam.minZoom, Math.min(this.cam.maxZoom, this.cam.targetZoom * factor));
    this.cam.zoom = this.cam.targetZoom;
    const after = this.screenToWorld(anchorX, anchorY);
    const bIso = this.worldToIso(before.x, before.z);
    const aIso = this.worldToIso(after.x, after.z);
    this.cam.x += bIso.ix - aIso.ix;
    this.cam.y += bIso.iy - aIso.iy;
    this.clampCamera();
  }

  spawnFloat(worldX, worldZ, text, color = "#ffe85c", iconSrc = null) {
    const iso = this.worldToIso(worldX, worldZ);
    this.floats.push({
      ix: iso.ix,
      iy: iso.iy - 45,
      text,
      color,
      iconSrc,
      life: 0,
      maxLife: 1.5
    });
  }

  bindEvents() {
    const c = this.canvas;
    c.addEventListener("mousedown", (e) => {
      if (e.button === 2) {
        this.game.onRightClick();
        return;
      }
      if (e.button !== 0) return;
      this.drag.active = true;
      this.drag.moved = false;
      this.drag.startX = e.clientX;
      this.drag.startY = e.clientY;
      this.drag.camX = this.cam.x;
      this.drag.camY = this.cam.y;
    });

    window.addEventListener("mousemove", (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.mouseX = sx;
      this.mouseY = sy;

      if (this.drag.active) {
        const dx = e.clientX - this.drag.startX;
        const dy = e.clientY - this.drag.startY;
        if (Math.hypot(dx, dy) > 6) this.drag.moved = true;
        if (this.drag.moved) {
          this.cam.x = this.drag.camX - dx / this.cam.zoom;
          this.cam.y = this.drag.camY - dy / this.cam.zoom;
          this.clampCamera();
        }
      }

      const w = this.screenToWorld(sx, sy);
      this.hoverWorld = w;
      this.hoverCell = this.pickCellAt(sx, sy, w);
      this.game.updateTooltip(this.hoverCell, e.clientX, e.clientY);
    });

    window.addEventListener("mouseup", (e) => {
      if (!this.drag.active) return;
      const wasDrag = this.drag.moved;
      this.drag.active = false;
      if (!wasDrag && e.target === c) {
        const rect = c.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const w = this.screenToWorld(sx, sy);
        const picked = this.pickCellAt(sx, sy, w);
        this.game.onBoardClick(w, picked);
      }
    });

    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const rect = c.getBoundingClientRect();
      this.zoomBy(factor, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    c.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // Pick topmost building under cursor (checks sprite visual bounds first, then tile footprint)
  pickCellAt(sx, sy, world) {
    const ix = (sx - this.viewW / 2) / this.cam.zoom + this.cam.x;
    const iy = (sy - this.viewH / 2) / this.cam.zoom + this.cam.y;
    const sorted = this.getSortedCells();
    // Reverse order (frontmost first) for visual hit test on tall buildings
    for (let i = sorted.length - 1; i >= 0; i--) {
      const cell = sorted[i];
      const item = this.game.itemMap.get(cell.itemId);
      if (!item) continue;
      if (this.isFlatItem(item)) continue;
      const draw = this.getCellDrawRect(cell, item);
      if (ix >= draw.x + draw.w * 0.12 && ix <= draw.x + draw.w * 0.88 && iy >= draw.y + draw.h * 0.08 && iy <= draw.y + draw.h) {
        return cell;
      }
    }
    // Fallback to exact grid footprint (catches roads, rivers, flat tiles)
    for (let i = sorted.length - 1; i >= 0; i--) {
      const cell = sorted[i];
      const item = this.game.itemMap.get(cell.itemId);
      if (!item) continue;
      if (world.x >= cell.x && world.x < cell.x + item.size && world.z >= cell.z && world.z < cell.z + item.size) {
        return cell;
      }
    }
    return null;
  }

  isFlatItem(item) {
    if (item.isRoad || item.isRiver) return true;
    return [4013, 4025, 4026, 4033, 4034, 4035, 4036, 4037, 4038, 4039, 4040, 4041, 4078, 4079].includes(item.id);
  }

  getCellDrawRect(cell, item) {
    const s = item.size;
    const bottom = this.worldToIso(cell.x + s, cell.z + s);
    let drawW = item.texW;
    let drawH = item.texH;
    // Special case: Roller Coaster 2049 is 512x512 texture on a 3x3 base (bw=415)
    if (item.id === 2049) {
      const scale = (3 * TILE_W) / 415;
      drawW = item.texW * scale;
      drawH = item.texH * scale;
    }
    return {
      x: bottom.ix - drawW / 2,
      y: bottom.iy - drawH,
      w: drawW,
      h: drawH,
      bx: bottom.ix,
      by: bottom.iy
    };
  }

  getSortedCells() {
    const cells = this.game.state.cells;
    const flat = [];
    const standing = [];
    for (const cell of cells) {
      const item = this.game.itemMap.get(cell.itemId);
      if (!item) continue;
      if (this.isFlatItem(item)) flat.push(cell);
      else standing.push(cell);
    }
    const sortFn = (a, b) => {
      const ia = this.game.itemMap.get(a.itemId);
      const ib = this.game.itemMap.get(b.itemId);
      const sa = ia ? ia.size : 1;
      const sb = ib ? ib.size : 1;
      // Strict front/back check for non-overlapping multi-tile footprints
      if (a.x + sa <= b.x && a.z + sa <= b.z) return -1;
      if (b.x + sb <= a.x && b.z + sb <= a.z) return 1;
      if (a.x + sa <= b.x && a.z < b.z + sb && b.z < a.z + sa) return -1;
      if (b.x + sb <= a.x && a.z < b.z + sb && b.z < a.z + sa) return 1;
      if (a.z + sa <= b.z && a.x < b.x + sb && b.x < a.x + sa) return -1;
      if (b.z + sb <= a.z && a.x < b.x + sb && b.x < a.x + sa) return 1;
      const da = (a.x + sa * 0.5) + (a.z + sa * 0.5);
      const db = (b.x + sb * 0.5) + (b.z + sb * 0.5);
      if (Math.abs(da - db) > 0.001) return da - db;
      return a.x - b.x;
    };
    flat.sort(sortFn);
    standing.sort(sortFn);
    return [...flat, ...standing];
  }

  getSpritePathForCell(cell, item) {
    // 1. Roads / Rivers 16-state autotiling
    if (item.isRoad) {
      const mask = this.game.getChainMask(cell.x, cell.z, "road");
      return `assets/sprites/item4001-${mask}.png`;
    }
    if (item.isRiver) {
      const mask = this.game.getChainMask(cell.x, cell.z, "river");
      return `assets/sprites/item4012-${mask}.png`;
    }

    // 2. Construction scaffolding
    const now = this.game.now();
    if (item.showsConstruction && cell.builtAt && now < cell.builtAt) {
      const total = Math.max(1, cell.builtAt - cell.placedAt);
      const pct = Math.max(0, Math.min(1, (now - cell.placedAt) / total));
      const stage = pct < 0.35 ? 0 : pct < 0.75 ? 1 : 2;
      if (item.size >= 2) return `assets/sprites/item997-${stage}.png`;
      return `assets/sprites/item998-${stage}.png`;
    }

    // 3. Factories 4 visual states (idle, active, ready, expired)
    if (item.isFactory) {
      const base = `assets/sprites/item${item.id}`;
      const fState = this.game.getFactoryState(cell);
      if (fState === "active") return `${base}-1.png`;
      if (fState === "ready") return `${base}-2.png`;
      if (fState === "expired") return `${base}-3.png`;
      return `${base}.png`;
    }

    // 4. Normal or Rotated building
    if (cell.rotated && item.rotSprite) {
      return item.rotSprite;
    }
    return item.sprite;
  }

  drawIsoDiamond(ctx, x, z, sw, sh, fill, stroke, lineWidth = 1.5) {
    const p0 = this.worldToIso(x, z);
    const p1 = this.worldToIso(x + sw, z);
    const p2 = this.worldToIso(x + sw, z + sh);
    const p3 = this.worldToIso(x, z + sh);
    ctx.beginPath();
    ctx.moveTo(p0.ix, p0.iy);
    ctx.lineTo(p1.ix, p1.iy);
    ctx.lineTo(p2.ix, p2.iy);
    ctx.lineTo(p3.ix, p3.iy);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  drawGround(ctx, s) {
    // 1. Exterior grass field using authentic grassloop.png projected onto the isometric ground plane!
    const grassImg = this.getImage("assets/sprites/grassloop.png");
    const groundImg = this.getImage("assets/sprites/groundloop.png");

    // Map world unit square (1x1 tile) -> isometric diamond using a single 2D affine matrix:
    // (wx, wz) -> ((wx - wz) * HALF_W, (wx + wz) * HALF_H)
    ctx.save();
    ctx.transform(HALF_W, HALF_H, -HALF_W, HALF_H, 0, 0);

    if (grassImg) {
      const pat = ctx.createPattern(grassImg, "repeat");
      if (pat) {
        const m = new DOMMatrix().scale(1 / 64, 1 / 64);
        pat.setTransform(m);
        ctx.fillStyle = pat;
        ctx.fillRect(-16, -16, s + 32, s + 32);
      }
    }

    // Subtle darker grass rim outside city boundary
    ctx.fillStyle = "rgba(62, 102, 22, 0.22)";
    ctx.fillRect(-16, -16, s + 32, 16);
    ctx.fillRect(-16, s, s + 32, 16);
    ctx.fillRect(-16, 0, 16, s);
    ctx.fillRect(s, 0, 16, s);

    // 2. Buildable City Plot using authentic groundloop.png!
    if (groundImg) {
      const pat2 = ctx.createPattern(groundImg, "repeat");
      if (pat2) {
        const m2 = new DOMMatrix().scale(1 / 64, 1 / 64);
        pat2.setTransform(m2);
        ctx.fillStyle = pat2;
        ctx.fillRect(0, 0, s, s);
      }
    } else {
      ctx.fillStyle = "#8dc23c";
      ctx.fillRect(0, 0, s, s);
    }

    // 3. Plot border (exact DriveScene green border!)
    ctx.strokeStyle = "#4c7d1a";
    ctx.lineWidth = 0.14;
    ctx.strokeRect(-0.07, -0.07, s + 0.14, s + 0.14);

    // 4. Gridlines (shown in placement/edit mode or if always-grid enabled)
    const showGrid = this.game.state.settings.showGrid || this.game.mode !== "home";
    if (showGrid) {
      ctx.strokeStyle = this.game.mode !== "home" ? "rgba(255, 255, 255, 0.34)" : "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      for (let i = 0; i <= s; i++) {
        ctx.moveTo(i, 0); ctx.lineTo(i, s);
        ctx.moveTo(0, i); ctx.lineTo(s, i);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  render(nowMs) {
    const dt = Math.min(0.1, (nowMs - this.lastFrame) / 1000);
    this.lastFrame = nowMs;

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Clear with exact LandDriveStar color (158, 188, 88)
    ctx.fillStyle = "rgb(158, 188, 88)";
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // Apply Camera transform
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    const s = this.game.state.boardSize;
    this.drawGround(ctx, s);

    // Draw all placed cells in depth order
    const sorted = this.getSortedCells();
    const nowSec = this.game.now();
    const tSec = nowMs / 1000;

    for (const cell of sorted) {
      const item = this.game.itemMap.get(cell.itemId);
      if (!item) continue;
      // Hide cell currently being moved
      if (this.game.movingCell && this.game.movingCell.uid === cell.uid) continue;

      const spritePath = this.getSpritePathForCell(cell, item);
      const img = this.getImage(spritePath);
      const draw = this.getCellDrawRect(cell, item);

      // Selection / Hover highlight halo in edit/home mode
      const isHovered = this.hoverCell && this.hoverCell.uid === cell.uid;
      if (isHovered && this.game.mode !== "place") {
        let tint = "rgba(255, 240, 120, 0.35)";
        let stroke = "#ffe754";
        if (this.game.mode === "sell") { tint = "rgba(255, 70, 60, 0.42)"; stroke = "#ff3b30"; }
        else if (this.game.mode === "move") { tint = "rgba(70, 190, 255, 0.4)"; stroke = "#44c2ff"; }
        else if (this.game.mode === "rotate") { tint = "rgba(190, 110, 255, 0.4)"; stroke = "#d07dff"; }
        else if (this.game.mode === "store") { tint = "rgba(255, 185, 60, 0.4)"; stroke = "#ffae2b"; }
        this.drawIsoDiamond(ctx, cell.x, cell.z, item.size, item.size, tint, stroke, 2.5);
      }

      if (img) {
        // When constructing, fit construction sprite cleanly to building size
        const isConstructing = item.showsConstruction && cell.builtAt && nowSec < cell.builtAt;
        if (isConstructing) {
          const cW = item.size >= 2 ? item.size * TILE_W : TILE_W;
          const cH = (img.naturalHeight / img.naturalWidth) * cW;
          ctx.drawImage(img, draw.bx - cW / 2, draw.by - cH, cW, cH);
          // Construction progress bar
          const pct = Math.max(0, Math.min(1, (nowSec - cell.placedAt) / Math.max(1, cell.builtAt - cell.placedAt)));
          this.drawMiniBar(ctx, draw.bx, draw.by - cH * 0.72, pct, "#54e034");
        } else {
          ctx.drawImage(img, draw.x, draw.y, draw.w, draw.h);
        }
      }

      // Status icons (bouncing coin stack / factory ready / contract progress)
      if (!this.game.photoMode && this.game.mode === "home") {
        const isConstructing = item.showsConstruction && cell.builtAt && nowSec < cell.builtAt;
        if (!isConstructing) {
          const bounce = Math.sin(tSec * 4.5 + cell.x * 0.7 + cell.z * 0.9) * 5;
          const topY = draw.y + Math.min(28, draw.h * 0.22);

          if (item.isFactory) {
            const fState = this.game.getFactoryState(cell);
            if (fState === "idle") {
              const icon = this.getImage("assets/sprites/factoryReady.png");
              if (icon) ctx.drawImage(icon, draw.bx - 28, topY - 40 + bounce, 56, 56);
            } else if (fState === "ready") {
              const icon = this.getImage("assets/sprites/statusHarvest.png");
              if (icon) ctx.drawImage(icon, draw.bx - 30, topY - 44 + bounce, 60, 60);
            } else if (fState === "active") {
              const contract = this.game.contractMap.get(cell.contractId);
              if (contract) {
                const pct = Math.max(0, Math.min(1, (nowSec - cell.contractStart) / contract.duration));
                this.drawMiniBar(ctx, draw.bx, topY - 8, pct, "#42c8ff");
              }
            } else if (fState === "expired") {
              ctx.save();
              ctx.font = "800 18px 'Gotham Rounded', 'Poppins', sans-serif";
              ctx.textAlign = "center";
              ctx.fillStyle = "#ff453a";
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 4;
              ctx.strokeText("EXPIRED!", draw.bx, topY - 12 + bounce);
              ctx.fillText("EXPIRED!", draw.bx, topY - 12 + bounce);
              ctx.restore();
            }
          } else if (this.game.canHarvestCell(cell)) {
            const icon = this.getImage("assets/sprites/statusHarvest.png");
            if (icon) ctx.drawImage(icon, draw.bx - 28, topY - 42 + bounce, 56, 56);
          }
        }
      }
    }

    // Placement / Move Phantom Preview Cursor
    if ((this.game.mode === "place" || this.game.mode === "unstore" || (this.game.mode === "move" && this.game.movingCell)) && this.hoverWorld) {
      const item = this.game.getActivePlacementItem();
      if (item) {
        const snap = this.game.snapCoords(this.hoverWorld.x, this.hoverWorld.z, item.size);
        const valid = this.game.canPlaceAt(snap.x, snap.z, item.size, this.game.movingCell ? this.game.movingCell.uid : null);
        this.drawIsoDiamond(
          ctx, snap.x, snap.z, item.size, item.size,
          valid ? "rgba(96, 255, 80, 0.38)" : "rgba(255, 65, 55, 0.45)",
          valid ? "#70ff4d" : "#ff3b30",
          3
        );
        const previewPath = (this.game.placementRotated && item.rotSprite) ? item.rotSprite : item.sprite;
        const pImg = this.getImage(previewPath);
        if (pImg) {
          const fakeCell = { x: snap.x, z: snap.z, itemId: item.id };
          const draw = this.getCellDrawRect(fakeCell, item);
          ctx.save();
          ctx.globalAlpha = valid ? 0.85 : 0.55;
          ctx.drawImage(pImg, draw.x, draw.y, draw.w, draw.h);
          ctx.restore();
        }
      }
    }

    // Floating +Coins / +XP animations
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life += dt;
      if (f.life >= f.maxLife) {
        this.floats.splice(i, 1);
        continue;
      }
      const p = f.life / f.maxLife;
      const y = f.iy - p * 68;
      const alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "800 21px 'Gotham Rounded', 'Poppins', sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(18, 28, 10, 0.9)";
      ctx.strokeText(f.text, f.ix, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.ix, y);
      ctx.restore();
    }

    ctx.restore();
  }

  drawMiniBar(ctx, cx, cy, pct, fillColor) {
    const w = 68, h = 10;
    ctx.save();
    ctx.fillStyle = "rgba(12, 24, 38, 0.82)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 + 2, cy - h / 2 + 2, Math.max(0, (w - 4) * pct), h - 4, 3);
    ctx.fill();
    ctx.restore();
  }
}

window.CityEngine = CityEngine;
