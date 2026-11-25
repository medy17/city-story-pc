// City Story PC — Full Offline Game Controller & Persistence
const SAVE_KEY = "city_story_pc_save_v1";

class CityStoryGame {
  constructor() {
    this.catalog = window.CITY_CATALOG;
    this.itemMap = new Map(this.catalog.items.map((it) => [it.id, it]));
    this.contractMap = new Map(this.catalog.contracts.map((c) => [c.id, c]));

    this.mode = "home"; // home | place | unstore | move | rotate | sell | store
    this.placementItemId = null;
    this.placementRotated = false;
    this.movingCell = null;
    this.activeFactoryCell = null;
    this.activeMarketCat = "residence";
    this.photoMode = false;
    this.speedMult = 1; // 1x, 5x, 20x
    this.simTimeOffset = 0; // accumulated accelerated seconds
    this.lastRealMs = performance.now();
    this.toastTimer = null;

    this.state = this.loadState();
    this.recalcStats();

    this.engine = new window.CityEngine(document.getElementById("game-canvas"), this);
    this.bindUI();
    this.updateHUD();

    // Native WebView2 host save integration (if running in CityStory.exe)
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.addEventListener("message", (ev) => {
        const msg = ev.data;
        if (msg && msg.type === "loadSave" && msg.json) {
          try {
            const parsed = JSON.parse(msg.json);
            if (parsed && Array.isArray(parsed.cells)) {
              this.state = this.normalizeState(parsed);
              this.recalcStats();
              this.engine.centerOnBoard();
              this.updateHUD();
              this.setSaveStatus("Loaded from CityStory save file");
            }
          } catch (_) {}
        }
      });
      window.chrome.webview.postMessage({ type: "requestSave" });
    }

    // Main loop
    const loop = (ts) => {
      const dt = Math.min(0.25, (ts - this.lastRealMs) / 1000);
      this.lastRealMs = ts;
      this.simTimeOffset += dt * (this.speedMult - 1);
      this.engine.render(ts);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    // Periodic HUD + quest + auto-save tick
    setInterval(() => {
      this.updateHUD();
      this.refreshInspectModalIfOpen();
    }, 1000);
    setInterval(() => this.saveState(), 12000);
  }

  now() {
    return Date.now() / 1000 + this.simTimeOffset;
  }

  createStarterState() {
    const t = Date.now() / 1000;
    let uid = 1;
    const makeCell = (x, z, itemId, extra = {}) => ({
      uid: uid++,
      x,
      z,
      itemId,
      rotated: false,
      placedAt: t - 999,
      builtAt: t - 999,
      lastHarvest: t - 120,
      contractId: null,
      contractStart: 0,
      ...extra
    });

    // Iconic welcoming starter neighborhood!
    const cells = [
      // Main street road (z = 5, x = 2..9) + cross street (x = 5, z = 2..9)
      makeCell(2, 5, 4001), makeCell(3, 5, 4001), makeCell(4, 5, 4001),
      makeCell(5, 5, 4001), makeCell(6, 5, 4001), makeCell(7, 5, 4001), makeCell(8, 5, 4001),
      makeCell(5, 3, 4001), makeCell(5, 4, 4001), makeCell(5, 6, 4001), makeCell(5, 7, 4001), makeCell(5, 8, 4001),

      // Town Hall & Starter Businesses
      makeCell(4, 4, 2001), // Town Hall (ready to collect!)
      makeCell(6, 4, 2003), // Coffee Shop (ready to collect!)
      makeCell(7, 4, 2006), // Corner Store

      // Starter Residences
      makeCell(3, 4, 1001), // Suburban House
      makeCell(4, 6, 1002), // Cottage
      makeCell(3, 6, 1001, { rotated: true }),

      // Starter Factory (idle & ready for first contract!)
      makeCell(7, 6, 3001),

      // Parks & Trees
      makeCell(6, 6, 4006), // Marble Fountain
      makeCell(4, 3, 4008), // Oak Grove
      makeCell(6, 3, 4003), // Park Bench
      makeCell(2, 4, 4084)  // I Love City Story Sign!
    ];

    return {
      version: 1,
      cityName: "Dream City",
      coins: 2500,
      cash: 25,
      xp: 0,
      level: 1,
      boardSize: 12,
      nextUid: uid + 1,
      cells,
      storage: {}, // itemId -> count
      questsClaimed: [],
      contractsCompleted: 0,
      settings: {
        music: true,
        sfx: true,
        showGrid: false,
        sandbox: false
      }
    };
  }

  normalizeState(s) {
    const def = this.createStarterState();
    return {
      ...def,
      ...s,
      settings: { ...def.settings, ...(s.settings || {}) },
      storage: s.storage || {},
      questsClaimed: Array.isArray(s.questsClaimed) ? s.questsClaimed : []
    };
  }

  loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.cells)) {
          return this.normalizeState(parsed);
        }
      }
    } catch (_) {}
    return this.createStarterState();
  }

  saveState() {
    const json = JSON.stringify(this.state);
    try {
      localStorage.setItem(SAVE_KEY, json);
    } catch (_) {}
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage({ type: "save", json });
    }
    this.setSaveStatus(`Saved at ${new Date().toLocaleTimeString()}`);
  }

  setSaveStatus(txt) {
    const el = document.getElementById("save-status");
    if (el) el.textContent = txt;
  }

  recalcStats() {
    let pop = 0;
    let happy = 0;
    let factories = 0;
    for (const c of this.state.cells) {
      const it = this.itemMap.get(c.itemId);
      if (!it) continue;
      pop += it.population || 0;
      happy += it.happiness || 0;
      if (it.isFactory) factories++;
    }
    this.population = pop;
    this.happiness = Math.max(0, happy);
    this.factoryCount = factories;
    this.recalcLevel(false);
  }

  recalcLevel(notify = true) {
    const oldLevel = this.state.level || 1;
    const sched = this.catalog.levelXp;
    let lvl = 1;
    for (let i = 1; i < sched.length; i++) {
      if (this.state.xp >= sched[i]) lvl = i + 1;
      else break;
    }
    this.state.level = lvl;
    if (notify && lvl > oldLevel) {
      const bonusCoins = lvl * 350;
      const bonusCash = 3;
      this.state.coins += bonusCoins;
      this.state.cash += bonusCash;
      window.Sound.play("level_up");
      this.showLevelUpModal(lvl, bonusCoins, bonusCash);
      this.saveState();
    }
  }

  getHappinessRatio() {
    if (this.population <= 0) return 1.6;
    return this.happiness / this.population;
  }

  getIncomeMultiplier() {
    const r = this.getHappinessRatio();
    if (r >= 1.5) return 1.25;
    if (r >= 1.0) return 1.0;
    if (r >= 0.7) return 0.85;
    return 0.65;
  }

  getMaxFactories() {
    if (this.state.settings.sandbox) return 99;
    let max = 2;
    for (const f of this.catalog.factoryLimits) {
      if (this.state.level >= f.level) max = f.max;
    }
    return max;
  }

  getFactoryState(cell) {
    if (!cell.contractId) return "idle";
    const contract = this.contractMap.get(cell.contractId);
    if (!contract) return "idle";
    const elapsed = this.now() - cell.contractStart;
    if (elapsed < contract.duration) return "active";
    if (elapsed < contract.duration + contract.expireAfter) return "ready";
    return "expired";
  }

  canHarvestCell(cell) {
    const item = this.itemMap.get(cell.itemId);
    if (!item || item.isFactory || !item.income || !item.maturity) return false;
    const now = this.now();
    if (item.showsConstruction && cell.builtAt && now < cell.builtAt) return false;
    return now - (cell.lastHarvest || cell.builtAt || 0) >= item.maturity;
  }

  getChainMask(x, z, type) {
    // Bit 0 (1): z+1, Bit 1 (2): x+1, Bit 2 (4): z-1, Bit 3 (8): x-1
    let mask = 0;
    for (const c of this.state.cells) {
      const it = this.itemMap.get(c.itemId);
      if (!it) continue;
      if (type === "road" && !it.isRoad) continue;
      if (type === "river" && !it.isRiver) continue;
      if (c.x === x && c.z === z + 1) mask |= 1;
      if (c.x === x + 1 && c.z === z) mask |= 2;
      if (c.x === x && c.z === z - 1) mask |= 4;
      if (c.x === x - 1 && c.z === z) mask |= 8;
    }
    return mask;
  }

  snapCoords(wx, wz, size) {
    const step = size < 1 ? 0.5 : 1;
    const x = Math.floor((wx - size / 2 + step / 2) / step) * step;
    const z = Math.floor((wz - size / 2 + step / 2) / step) * step;
    return { x, z };
  }

  canPlaceAt(x, z, size, ignoreUid = null) {
    const s = this.state.boardSize;
    if (x < 0 || z < 0 || x + size > s + 0.001 || z + size > s + 0.001) return false;
    const eps = 0.01;
    for (const c of this.state.cells) {
      if (ignoreUid && c.uid === ignoreUid) continue;
      const it = this.itemMap.get(c.itemId);
      if (!it) continue;
      const overlapX = x + eps < c.x + it.size && x + size - eps > c.x;
      const overlapZ = z + eps < c.z + it.size && z + size - eps > c.z;
      if (overlapX && overlapZ) return false;
    }
    return true;
  }

  getActivePlacementItem() {
    if (this.mode === "move" && this.movingCell) {
      return this.itemMap.get(this.movingCell.itemId);
    }
    if ((this.mode === "place" || this.mode === "unstore") && this.placementItemId) {
      return this.itemMap.get(this.placementItemId);
    }
    return null;
  }

  // === BOARD INTERACTIONS ===
  onRightClick() {
    if (this.mode === "place" || this.mode === "unstore" || (this.mode === "move" && this.movingCell)) {
      this.togglePlacementRotate();
    } else if (this.mode !== "home") {
      this.setMode("home");
    }
  }

  togglePlacementRotate() {
    const it = this.getActivePlacementItem();
    if (!it || !it.rotSprite) {
      this.showToast("This building doesn't have an alternate rotation");
      return;
    }
    this.placementRotated = !this.placementRotated;
    window.Sound.play("flip");
  }

  onBoardClick(world, pickedCell) {
    const now = this.now();

    // 1. Placing new building from Market
    if (this.mode === "place" && this.placementItemId) {
      const item = this.itemMap.get(this.placementItemId);
      if (!item) return;
      const snap = this.snapCoords(world.x, world.z, item.size);
      if (!this.canPlaceAt(snap.x, snap.z, item.size)) {
        this.showToast("Can't place there — space is occupied or out of bounds!");
        return;
      }
      const sandbox = this.state.settings.sandbox;
      if (!sandbox) {
        if (item.isFactory && this.factoryCount >= this.getMaxFactories()) {
          this.showToast(`Max factories (${this.getMaxFactories()}) reached for Level ${this.state.level}!`);
          this.setMode("home");
          return;
        }
        if (item.cost > 0 && this.state.coins < item.cost) {
          this.showToast("Not enough Coins!");
          return;
        }
        if (item.cashCost > 0 && this.state.cash < item.cashCost) {
          this.showToast("Not enough City Cash!");
          return;
        }
        this.state.coins -= item.cost;
        this.state.cash -= item.cashCost;
      }

      const buildSecs = sandbox ? 0 : (item.buildTime || 0);
      const newCell = {
        uid: this.state.nextUid++,
        x: snap.x,
        z: snap.z,
        itemId: item.id,
        rotated: this.placementRotated && !!item.rotSprite,
        placedAt: now,
        builtAt: now + buildSecs,
        lastHarvest: now + buildSecs,
        contractId: null,
        contractStart: 0
      };
      this.state.cells.push(newCell);
      this.state.xp += item.xp || 0;
      this.recalcStats();
      this.recalcLevel(true);

      window.Sound.play(item.showsConstruction ? "construction" : "plant");
      if (item.xp > 0) this.engine.spawnFloat(snap.x + item.size / 2, snap.z + item.size / 2, `+${item.xp} XP`, "#82f5ff");
      if (!sandbox && item.cost > 0) this.engine.spawnFloat(snap.x + item.size / 2, snap.z + item.size / 2 + 0.3, `-${item.cost} Coins`, "#ff9680");

      this.saveState();
      this.updateHUD();
      // Keep placing roads/rivers/decorations continuously; exit for big unique buildings if out of money
      if (!sandbox && ((item.cost > 0 && this.state.coins < item.cost) || (item.cashCost > 0 && this.state.cash < item.cashCost))) {
        this.setMode("home");
      }
      return;
    }

    // 2. Unstoring from Inventory
    if (this.mode === "unstore" && this.placementItemId) {
      const item = this.itemMap.get(this.placementItemId);
      const count = this.state.storage[item.id] || 0;
      if (count <= 0) { this.setMode("home"); return; }
      const snap = this.snapCoords(world.x, world.z, item.size);
      if (!this.canPlaceAt(snap.x, snap.z, item.size)) {
        this.showToast("Choose an empty spot on your city plot!");
        return;
      }
      this.state.storage[item.id] = count - 1;
      if (this.state.storage[item.id] <= 0) delete this.state.storage[item.id];
      this.state.cells.push({
        uid: this.state.nextUid++,
        x: snap.x,
        z: snap.z,
        itemId: item.id,
        rotated: this.placementRotated && !!item.rotSprite,
        placedAt: now - 100,
        builtAt: now - 100,
        lastHarvest: now,
        contractId: null,
        contractStart: 0
      });
      window.Sound.play("plant");
      this.recalcStats();
      this.saveState();
      this.updateHUD();
      if (!this.state.storage[item.id]) this.setMode("home");
      return;
    }

    // 3. Move Tool
    if (this.mode === "move") {
      if (!this.movingCell) {
        if (pickedCell) {
          this.movingCell = pickedCell;
          this.placementRotated = !!pickedCell.rotated;
          window.Sound.play("action");
          this.updateModeBar();
        }
      } else {
        const item = this.itemMap.get(this.movingCell.itemId);
        const snap = this.snapCoords(world.x, world.z, item.size);
        if (!this.canPlaceAt(snap.x, snap.z, item.size, this.movingCell.uid)) {
          this.showToast("Can't move there — space is blocked!");
          return;
        }
        this.movingCell.x = snap.x;
        this.movingCell.z = snap.z;
        this.movingCell.rotated = this.placementRotated && !!item.rotSprite;
        this.movingCell = null;
        window.Sound.play("plant");
        this.saveState();
        this.updateModeBar();
      }
      return;
    }

    // 4. Rotate Tool
    if (this.mode === "rotate") {
      if (!pickedCell) return;
      const item = this.itemMap.get(pickedCell.itemId);
      if (!item || !item.rotSprite) {
        this.showToast(`${item ? item.name : "Item"} cannot be rotated`);
        return;
      }
      pickedCell.rotated = !pickedCell.rotated;
      window.Sound.play("flip");
      this.saveState();
      return;
    }

    // 5. Store Tool
    if (this.mode === "store") {
      if (!pickedCell) return;
      const item = this.itemMap.get(pickedCell.itemId);
      this.state.cells = this.state.cells.filter((c) => c.uid !== pickedCell.uid);
      this.state.storage[item.id] = (this.state.storage[item.id] || 0) + 1;
      window.Sound.play("menu_out");
      this.showToast(`Stored ${item.name} in Inventory`);
      this.recalcStats();
      this.saveState();
      this.updateHUD();
      return;
    }

    // 6. Sell Tool
    if (this.mode === "sell") {
      if (!pickedCell) return;
      const item = this.itemMap.get(pickedCell.itemId);
      this.state.cells = this.state.cells.filter((c) => c.uid !== pickedCell.uid);
      this.state.coins += item.sellValue;
      window.Sound.play("delete");
      this.engine.spawnFloat(pickedCell.x + item.size / 2, pickedCell.z + item.size / 2, `+${item.sellValue} Coins`, "#ffe85c");
      this.recalcStats();
      this.saveState();
      this.updateHUD();
      return;
    }

    // 7. Home Mode Interaction!
    if (!pickedCell) return;
    const item = this.itemMap.get(pickedCell.itemId);
    if (!item) return;

    // Under construction? Open inspect modal (allow rushing!)
    if (item.showsConstruction && pickedCell.builtAt && now < pickedCell.builtAt) {
      this.openInspectModal(pickedCell);
      return;
    }

    // Factory click
    if (item.isFactory) {
      const fState = this.getFactoryState(pickedCell);
      if (fState === "idle") {
        this.openContractsModal(pickedCell);
      } else if (fState === "ready") {
        this.collectFactoryContract(pickedCell);
      } else {
        this.openInspectModal(pickedCell);
      }
      return;
    }

    // Harvestable Residence / Business
    if (this.canHarvestCell(pickedCell)) {
      this.harvestCell(pickedCell);
      return;
    }

    // Otherwise open building details modal
    this.openInspectModal(pickedCell);
  }

  harvestCell(cell, silent = false) {
    const item = this.itemMap.get(cell.itemId);
    if (!item) return 0;
    const earned = Math.round(item.income * this.getIncomeMultiplier());
    const xpGain = Math.max(2, Math.round((item.xp || 4) * 0.35));
    this.state.coins += earned;
    this.state.xp += xpGain;
    cell.lastHarvest = this.now();
    if (!silent) window.Sound.play("cash");
    this.engine.spawnFloat(cell.x + item.size / 2, cell.z + item.size / 2, `+${earned} Coins`, "#ffe85c");
    this.engine.spawnFloat(cell.x + item.size / 2, cell.z + item.size / 2 + 0.35, `+${xpGain} XP`, "#82f5ff");
    this.recalcLevel(true);
    this.updateHUD();
    this.saveState();
    return earned;
  }

  collectFactoryContract(cell, silent = false) {
    const contract = this.contractMap.get(cell.contractId);
    if (!contract) return 0;
    const item = this.itemMap.get(cell.itemId);
    const earned = Math.round(contract.reward * this.getIncomeMultiplier());
    this.state.coins += earned;
    this.state.xp += contract.xp;
    this.state.contractsCompleted = (this.state.contractsCompleted || 0) + 1;
    cell.contractId = null;
    cell.contractStart = 0;
    if (!silent) window.Sound.play("found_cash");
    this.engine.spawnFloat(cell.x + item.size / 2, cell.z + item.size / 2, `+${earned} Coins`, "#9dff57");
    this.engine.spawnFloat(cell.x + item.size / 2, cell.z + item.size / 2 + 0.4, `+${contract.xp} XP`, "#82f5ff");
    this.recalcLevel(true);
    this.updateHUD();
    this.saveState();
    return earned;
  }

  collectAllReady() {
    let count = 0;
    let totalCoins = 0;
    for (const c of this.state.cells) {
      const it = this.itemMap.get(c.itemId);
      if (!it) continue;
      if (it.isFactory && this.getFactoryState(c) === "ready") {
        totalCoins += this.collectFactoryContract(c, true);
        count++;
      } else if (this.canHarvestCell(c)) {
        totalCoins += this.harvestCell(c, true);
        count++;
      }
    }
    if (count > 0) {
      window.Sound.play("found_cash");
      this.showToast(`Collected ${totalCoins.toLocaleString()} Coins from ${count} building${count > 1 ? "s" : ""}!`);
    } else {
      this.showToast("Nothing is ready to collect yet!");
    }
  }

  // === MODES & UI ===
  setMode(newMode, itemId = null) {
    this.mode = newMode;
    this.placementItemId = itemId;
    this.placementRotated = false;
    this.movingCell = null;

    const canvas = document.getElementById("game-canvas");
    canvas.classList.toggle("mode-place", newMode === "place" || newMode === "unstore");
    canvas.classList.toggle("mode-edit", ["move", "rotate", "sell", "store"].includes(newMode));

    const isEditDock = ["move", "rotate", "sell", "store"].includes(newMode);
    document.getElementById("hud-dock-home").classList.toggle("hidden", isEditDock);
    document.getElementById("hud-dock-edit").classList.toggle("hidden", !isEditDock);

    for (const t of ["move", "rotate", "store", "sell"]) {
      document.getElementById(`btn-tool-${t}`).classList.toggle("active-tool", newMode === t);
    }
    this.updateModeBar();
  }

  updateModeBar() {
    const bar = document.getElementById("mode-bar");
    const thumb = document.getElementById("mode-thumb");
    const title = document.getElementById("mode-title");
    const sub = document.getElementById("mode-subtitle");
    const rotBtn = document.getElementById("btn-mode-rotate");

    if (this.mode === "home") {
      bar.classList.add("hidden");
      return;
    }
    bar.classList.remove("hidden");

    if (this.mode === "place" || this.mode === "unstore") {
      const it = this.itemMap.get(this.placementItemId);
      thumb.src = it.thumb;
      thumb.classList.remove("hidden");
      title.textContent = (this.mode === "unstore" ? "Placing from Storage: " : "Building: ") + it.name;
      sub.textContent = "Click empty green tiles to place" + (it.rotSprite ? " • R or Right-Click to rotate" : "");
      rotBtn.classList.toggle("hidden", !it.rotSprite);
    } else if (this.mode === "move") {
      if (this.movingCell) {
        const it = this.itemMap.get(this.movingCell.itemId);
        thumb.src = it.thumb;
        thumb.classList.remove("hidden");
        title.textContent = `Moving: ${it.name}`;
        sub.textContent = "Click a new green spot to place it down";
        rotBtn.classList.toggle("hidden", !it.rotSprite);
      } else {
        thumb.classList.add("hidden");
        title.textContent = "Move Mode";
        sub.textContent = "Click any building to pick it up and move it";
        rotBtn.classList.add("hidden");
      }
    } else if (this.mode === "rotate") {
      thumb.classList.add("hidden");
      title.textContent = "Rotate Mode";
      sub.textContent = "Click any building to flip its facing direction";
      rotBtn.classList.add("hidden");
    } else if (this.mode === "store") {
      thumb.classList.add("hidden");
      title.textContent = "Store Mode";
      sub.textContent = "Click any building to move it into your Inventory";
      rotBtn.classList.add("hidden");
    } else if (this.mode === "sell") {
      thumb.classList.add("hidden");
      title.textContent = "Sell Mode";
      sub.textContent = "Click any building to sell it for Coins";
      rotBtn.classList.add("hidden");
    }
  }

  updateHUD() {
    const s = this.state;
    const sched = this.catalog.levelXp;
    const curBase = sched[s.level - 1] || 0;
    const nextReq = sched[s.level] || (curBase + 20000);
    const pct = Math.max(0, Math.min(100, ((s.xp - curBase) / Math.max(1, nextReq - curBase)) * 100));

    document.getElementById("hud-level").textContent = s.level;
    document.getElementById("hud-city-name").textContent = s.cityName;
    document.getElementById("hud-xp-fill").style.width = pct + "%";
    document.getElementById("hud-xp-text").textContent = `${s.xp.toLocaleString()} / ${nextReq.toLocaleString()} XP`;
    document.getElementById("hud-pop").textContent = this.population.toLocaleString();
    document.getElementById("hud-happy").textContent = this.happiness.toLocaleString();
    document.getElementById("hud-coins").textContent = Math.floor(s.coins).toLocaleString();
    document.getElementById("hud-cash").textContent = Math.floor(s.cash).toLocaleString();

    const r = this.getHappinessRatio();
    const happyIcon = r >= 1.5 ? 4 : r >= 1.0 ? 3 : r >= 0.7 ? 2 : 1;
    document.getElementById("hud-happy-icon").src = `assets/ui/happiness_icon_${happyIcon}.png`;

    // Storage count badge
    const totalStored = Object.values(s.storage).reduce((a, b) => a + b, 0);
    const sb = document.getElementById("storage-badge");
    sb.textContent = totalStored;
    sb.classList.toggle("hidden", totalStored === 0);

    // Claimable quest badge
    const claimable = this.catalog.quests.filter((q) => !s.questsClaimed.includes(q.id) && this.isQuestComplete(q)).length;
    const qb = document.getElementById("quest-badge");
    qb.textContent = claimable > 0 ? claimable : "!";
    qb.classList.toggle("hidden", claimable === 0);
  }

  updateTooltip(cell, mx, my) {
    const tt = document.getElementById("building-tooltip");
    if (!cell || this.mode === "place" || !document.getElementById("modal-backdrop").classList.contains("hidden")) {
      tt.classList.add("hidden");
      return;
    }
    const it = this.itemMap.get(cell.itemId);
    if (!it) { tt.classList.add("hidden"); return; }

    const now = this.now();
    let lines = [`<div class="tt-title">${it.name}</div>`];
    if (it.showsConstruction && cell.builtAt && now < cell.builtAt) {
      lines.push(`Under construction: <b>${this.formatDuration(cell.builtAt - now)}</b>`);
      lines.push(`Click to inspect or rush`);
    } else if (it.isFactory) {
      const fState = this.getFactoryState(cell);
      if (fState === "idle") lines.push(`<span class="tt-ready">Idle — Click to sign a Contract!</span>`);
      else if (fState === "ready") {
        const c = this.contractMap.get(cell.contractId);
        lines.push(`<span class="tt-ready">${c.name} Ready! Click to collect +${Math.round(c.reward * this.getIncomeMultiplier())} Coins</span>`);
      } else if (fState === "active") {
        const c = this.contractMap.get(cell.contractId);
        lines.push(`Producing ${c.name}: <b>${this.formatDuration(cell.contractStart + c.duration - now)}</b>`);
      } else {
        lines.push(`<span style="color:#ff7b72;font-weight:800">Contract expired — click to clean</span>`);
      }
    } else {
      const stats = [];
      if (it.population) stats.push(`+${it.population} Pop`);
      if (it.happiness) stats.push(`+${it.happiness} Happy`);
      if (stats.length) lines.push(stats.join(" • "));
      if (it.income > 0 && it.maturity > 0) {
        if (this.canHarvestCell(cell)) {
          lines.push(`<span class="tt-ready">Ready! Click to collect +${Math.round(it.income * this.getIncomeMultiplier())} Coins</span>`);
        } else {
          const left = Math.max(0, (cell.lastHarvest || 0) + it.maturity - now);
          lines.push(`Next payout (+${Math.round(it.income * this.getIncomeMultiplier())}): <b>${this.formatDuration(left)}</b>`);
        }
      }
    }

    tt.innerHTML = lines.join("<br>");
    tt.style.left = Math.min(window.innerWidth - 255, mx + 16) + "px";
    tt.style.top = Math.min(window.innerHeight - 120, my + 16) + "px";
    tt.classList.remove("hidden");
  }

  formatDuration(sec) {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) {
      const m = Math.floor(sec / 60), s = sec % 60;
      return s ? `${m}m ${s}s` : `${m}m`;
    }
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  showToast(msg) {
    const el = document.getElementById("toast-banner");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add("hidden"), 2800);
  }

  // === MODALS ===
  openModal(id) {
    document.getElementById("modal-backdrop").classList.remove("hidden");
    document.querySelectorAll(".modal-window").forEach((m) => m.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");
    document.getElementById("building-tooltip").classList.add("hidden");
  }

  closeAllModals() {
    document.getElementById("modal-backdrop").classList.add("hidden");
    document.querySelectorAll(".modal-window").forEach((m) => m.classList.add("hidden"));
    this.inspectedCell = null;
  }

  openMarket(cat = this.activeMarketCat) {
    this.activeMarketCat = cat;
    window.Sound.play("menu_in");
    this.openModal("modal-market");
    this.renderMarket();
  }

  renderMarket() {
    const tabs = document.querySelectorAll("#market-tabs .tab-btn");
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.cat === this.activeMarketCat));
    const grid = document.getElementById("market-grid");
    const q = (document.getElementById("market-search").value || "").trim().toLowerCase();
    grid.innerHTML = "";

    // Special tab: Expand Land
    if (this.activeMarketCat === "expand") {
      for (const exp of this.catalog.expansions) {
        const owned = this.state.boardSize >= exp.size;
        const canLevel = this.state.settings.sandbox || (this.state.level >= exp.minLevel && this.population >= exp.minPop);
        const card = document.createElement("div");
        card.className = "item-card" + (!canLevel && !owned ? " locked" : "");
        card.innerHTML = `
          <span class="item-size-tag">${exp.size}x${exp.size}</span>
          <img class="item-thumb" src="assets/thumbs/thumb11001.png" alt="${exp.name}" />
          <div class="item-name">${exp.name}</div>
          <div class="item-stats">
            <span class="stat-chip">Lvl ${exp.minLevel}</span>
            <span class="stat-chip">${exp.minPop} Pop</span>
          </div>
          ${owned
            ? `<button class="glossy-btn green small item-buy-btn" disabled>Unlocked!</button>`
            : `<button class="glossy-btn gold small item-buy-btn" ${!canLevel ? "disabled" : ""}>
                 <img src="assets/ui/coins_xsmall.png" /> ${this.state.settings.sandbox ? "FREE" : exp.cost.toLocaleString()}
               </button>`}
        `;
        if (!owned && canLevel) {
          card.querySelector("button").addEventListener("click", () => {
            if (!this.state.settings.sandbox && this.state.coins < exp.cost) {
              this.showToast("Not enough Coins to expand yet!");
              return;
            }
            if (!this.state.settings.sandbox) this.state.coins -= exp.cost;
            this.state.boardSize = exp.size;
            window.Sound.play("level_up");
            this.showToast(`City expanded to ${exp.size}x${exp.size}!`);
            this.saveState();
            this.updateHUD();
            this.renderMarket();
          });
        }
        grid.appendChild(card);
      }
      return;
    }

    const sandbox = this.state.settings.sandbox;
    let list = this.catalog.items.filter((it) => {
      if (q) return it.name.toLowerCase().includes(q);
      return it.category === this.activeMarketCat;
    });
    list.sort((a, b) => a.minLevel - b.minLevel || (a.cost || a.cashCost * 500) - (b.cost || b.cashCost * 500));

    for (const it of list) {
      const unlocked = sandbox || this.state.level >= it.minLevel;
      const card = document.createElement("div");
      card.className = "item-card" + (!unlocked ? " locked" : "");
      const stats = [];
      if (it.population) stats.push(`<span class="stat-chip"><img src="assets/ui/population_xsmall.png" />+${it.population}</span>`);
      if (it.happiness) stats.push(`<span class="stat-chip"><img src="assets/ui/happiness_xsmall.png" />${it.happiness > 0 ? "+" : ""}${it.happiness}</span>`);
      if (it.income) stats.push(`<span class="stat-chip"><img src="assets/ui/coins_xsmall.png" />${it.income}/${this.formatDuration(it.maturity)}</span>`);
      if (it.isFactory) stats.push(`<span class="stat-chip">Limit: ${this.factoryCount}/${this.getMaxFactories()}</span>`);

      const priceHtml = sandbox
        ? "FREE"
        : (it.cashCost > 0
            ? `<img src="assets/ui/gem_xsmall.png" /> ${it.cashCost}`
            : `<img src="assets/ui/coins_xsmall.png" /> ${it.cost.toLocaleString()}`);

      card.innerHTML = `
        <span class="item-size-tag">${it.size}x${it.size}</span>
        <img class="item-thumb" src="${it.thumb}" loading="lazy" alt="${it.name}" />
        <div class="item-name">${it.name}</div>
        <div class="item-stats">${stats.join("")}</div>
        ${unlocked
          ? `<button class="glossy-btn ${it.cashCost > 0 && !sandbox ? "blue" : "green"} small item-buy-btn">${priceHtml}</button>`
          : `<button class="glossy-btn small item-buy-btn" disabled>Unlocks Lvl ${it.minLevel}</button>`}
      `;
      if (unlocked) {
        card.querySelector("button").addEventListener("click", () => {
          if (!sandbox) {
            if (it.isFactory && this.factoryCount >= this.getMaxFactories()) {
              this.showToast(`Factory limit (${this.getMaxFactories()}) reached! Level up to unlock more.`);
              return;
            }
            if (it.cost > 0 && this.state.coins < it.cost) { this.showToast("Not enough Coins!"); return; }
            if (it.cashCost > 0 && this.state.cash < it.cashCost) { this.showToast("Not enough City Cash!"); return; }
          }
          this.closeAllModals();
          this.setMode("place", it.id);
          window.Sound.play("action");
        });
      }
      grid.appendChild(card);
    }
  }

  openContractsModal(factoryCell) {
    this.activeFactoryCell = factoryCell;
    window.Sound.play("menu_in");
    this.openModal("modal-contracts");
    const grid = document.getElementById("contracts-grid");
    grid.innerHTML = "";

    for (const c of this.catalog.contracts) {
      const unlocked = this.state.settings.sandbox || this.state.level >= c.minLevel;
      const card = document.createElement("div");
      card.className = "contract-card" + (!unlocked ? " locked" : "");
      card.innerHTML = `
        <img class="c-thumb" src="${c.thumb}" alt="${c.name}" />
        <div class="item-name">${c.name}</div>
        <div class="contract-desc">${c.desc}</div>
        <div class="item-stats">
          <span class="stat-chip"><img src="assets/ui/coins_xsmall.png" /> +${c.reward}</span>
          <span class="stat-chip"><img src="assets/ui/exp_xsmall.png" /> +${c.xp} XP</span>
          <span class="stat-chip">&#9201; ${this.formatDuration(c.duration)}</span>
        </div>
        ${unlocked
          ? `<button class="glossy-btn green small item-buy-btn"><img src="assets/ui/coins_xsmall.png" /> Sign (${this.state.settings.sandbox ? "FREE" : c.cost})</button>`
          : `<button class="glossy-btn small item-buy-btn" disabled>Unlocks Lvl ${c.minLevel}</button>`}
      `;
      if (unlocked) {
        card.querySelector("button").addEventListener("click", () => {
          if (!this.state.settings.sandbox && this.state.coins < c.cost) {
            this.showToast("Not enough Coins to sign this contract!");
            return;
          }
          if (!this.state.settings.sandbox) this.state.coins -= c.cost;
          factoryCell.contractId = c.id;
          factoryCell.contractStart = this.now();
          window.Sound.play("contract");
          this.closeAllModals();
          this.showToast(`Signed ${c.name} contract!`);
          this.saveState();
          this.updateHUD();
        });
      }
      grid.appendChild(card);
    }
  }

  openInspectModal(cell) {
    this.inspectedCell = cell;
    this.openModal("modal-inspect");
    this.renderInspectModal();
  }

  refreshInspectModalIfOpen() {
    if (this.inspectedCell && !document.getElementById("modal-inspect").classList.contains("hidden")) {
      this.renderInspectModal();
    }
  }

  renderInspectModal() {
    const cell = this.inspectedCell;
    if (!cell) return;
    const it = this.itemMap.get(cell.itemId);
    const now = this.now();
    document.getElementById("inspect-title").textContent = it.name;
    const body = document.getElementById("inspect-body");

    let statusHtml = "";
    let extraBtns = "";

    if (it.showsConstruction && cell.builtAt && now < cell.builtAt) {
      const left = cell.builtAt - now;
      const pct = Math.min(100, Math.max(0, ((now - cell.placedAt) / Math.max(1, cell.builtAt - cell.placedAt)) * 100));
      statusHtml = `
        <div><b>Under Construction</b> — ${this.formatDuration(left)} remaining</div>
        <div class="inspect-progress-wrap"><div class="inspect-progress-fill" style="width:${pct}%"></div></div>
      `;
      extraBtns += `<button id="btn-rush-build" class="glossy-btn gold small">Finish Now (${this.state.settings.sandbox ? "FREE" : "1 Cash"})</button>`;
    } else if (it.isFactory) {
      const fState = this.getFactoryState(cell);
      if (fState === "active") {
        const c = this.contractMap.get(cell.contractId);
        const left = cell.contractStart + c.duration - now;
        const pct = Math.min(100, Math.max(0, ((now - cell.contractStart) / c.duration) * 100));
        statusHtml = `
          <div><b>${c.name}</b> — ${this.formatDuration(left)} remaining</div>
          <div class="inspect-progress-wrap"><div class="inspect-progress-fill" style="width:${pct}%"></div></div>
        `;
        extraBtns += `<button id="btn-rush-contract" class="glossy-btn gold small">Rush Contract (${this.state.settings.sandbox ? "FREE" : "1 Cash"})</button>`;
        extraBtns += `<button id="btn-cancel-contract" class="glossy-btn red small">Cancel Contract</button>`;
      } else if (fState === "expired") {
        statusHtml = `<div style="color:#c92a2a;font-weight:900">Contract expired! Clean up or revive it.</div>`;
        extraBtns += `<button id="btn-clean-factory" class="glossy-btn blue small">Clean Up</button>`;
        extraBtns += `<button id="btn-revive-factory" class="glossy-btn gold small">Revive (${this.state.settings.sandbox ? "FREE" : "1 Cash"})</button>`;
      }
    } else if (it.income > 0 && it.maturity > 0) {
      const left = Math.max(0, (cell.lastHarvest || 0) + it.maturity - now);
      const pct = Math.min(100, Math.max(0, (1 - left / it.maturity) * 100));
      statusHtml = `
        <div>Earns <b>${Math.round(it.income * this.getIncomeMultiplier())} Coins</b> every ${this.formatDuration(it.maturity)} (${this.formatDuration(left)} left)</div>
        <div class="inspect-progress-wrap"><div class="inspect-progress-fill" style="width:${pct}%"></div></div>
      `;
    }

    body.innerHTML = `
      <img class="inspect-img" src="${it.thumb}" alt="${it.name}" />
      <div class="item-stats">
        ${it.population ? `<span class="stat-chip"><img src="assets/ui/population_xsmall.png" /> +${it.population} Pop</span>` : ""}
        ${it.happiness ? `<span class="stat-chip"><img src="assets/ui/happiness_xsmall.png" /> ${it.happiness > 0 ? "+" : ""}${it.happiness} Happy</span>` : ""}
        <span class="stat-chip">${it.size}x${it.size} Tiles</span>
      </div>
      ${statusHtml}
      <div class="inspect-actions">
        ${extraBtns}
        ${it.rotSprite ? `<button id="btn-insp-rot" class="glossy-btn blue small">Rotate</button>` : ""}
        <button id="btn-insp-move" class="glossy-btn blue small">Move</button>
        <button id="btn-insp-store" class="glossy-btn blue small">Store</button>
        <button id="btn-insp-sell" class="glossy-btn red small">Sell (+${it.sellValue})</button>
      </div>
    `;

    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    bind("btn-rush-build", () => {
      if (!this.state.settings.sandbox) {
        if (this.state.cash < 1) { this.showToast("Need 1 City Cash!"); return; }
        this.state.cash -= 1;
      }
      cell.builtAt = now - 1;
      cell.lastHarvest = now - 1;
      window.Sound.play("boost");
      this.closeAllModals();
      this.saveState();
      this.updateHUD();
    });
    bind("btn-rush-contract", () => {
      if (!this.state.settings.sandbox) {
        if (this.state.cash < 1) { this.showToast("Need 1 City Cash!"); return; }
        this.state.cash -= 1;
      }
      const c = this.contractMap.get(cell.contractId);
      cell.contractStart = now - c.duration - 1;
      window.Sound.play("boost");
      this.closeAllModals();
      this.collectFactoryContract(cell);
    });
    bind("btn-cancel-contract", () => {
      cell.contractId = null;
      cell.contractStart = 0;
      window.Sound.play("delete");
      this.closeAllModals();
      this.saveState();
    });
    bind("btn-clean-factory", () => {
      cell.contractId = null;
      cell.contractStart = 0;
      window.Sound.play("water");
      this.closeAllModals();
      this.saveState();
    });
    bind("btn-revive-factory", () => {
      if (!this.state.settings.sandbox) {
        if (this.state.cash < 1) { this.showToast("Need 1 City Cash!"); return; }
        this.state.cash -= 1;
      }
      const c = this.contractMap.get(cell.contractId);
      cell.contractStart = now - c.duration - 1;
      window.Sound.play("boost");
      this.closeAllModals();
      this.collectFactoryContract(cell);
    });
    bind("btn-insp-rot", () => {
      cell.rotated = !cell.rotated;
      window.Sound.play("flip");
      this.saveState();
    });
    bind("btn-insp-move", () => {
      this.closeAllModals();
      this.setMode("move");
      this.movingCell = cell;
      this.placementRotated = !!cell.rotated;
      this.updateModeBar();
    });
    bind("btn-insp-store", () => {
      this.state.cells = this.state.cells.filter((c) => c.uid !== cell.uid);
      this.state.storage[it.id] = (this.state.storage[it.id] || 0) + 1;
      window.Sound.play("menu_out");
      this.recalcStats();
      this.closeAllModals();
      this.saveState();
      this.updateHUD();
    });
    bind("btn-insp-sell", () => {
      this.state.cells = this.state.cells.filter((c) => c.uid !== cell.uid);
      this.state.coins += it.sellValue;
      window.Sound.play("delete");
      this.recalcStats();
      this.closeAllModals();
      this.saveState();
      this.updateHUD();
    });
  }

  openStorageModal() {
    window.Sound.play("menu_in");
    this.openModal("modal-storage");
    const grid = document.getElementById("storage-grid");
    grid.innerHTML = "";
    const entries = Object.entries(this.state.storage).filter(([, n]) => n > 0);
    if (!entries.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;font-weight:800;color:#4a6b8a;">Your storage is empty.<br>Use Design &rarr; Store to pack away buildings!</div>`;
      return;
    }
    for (const [idStr, count] of entries) {
      const it = this.itemMap.get(Number(idStr));
      if (!it) continue;
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <span class="item-size-tag">x${count}</span>
        <img class="item-thumb" src="${it.thumb}" alt="${it.name}" />
        <div class="item-name">${it.name}</div>
        <button class="glossy-btn green small item-buy-btn">Place</button>
      `;
      card.querySelector("button").addEventListener("click", () => {
        this.closeAllModals();
        this.setMode("unstore", it.id);
      });
      grid.appendChild(card);
    }
  }

  isQuestComplete(q) {
    const g = q.goal;
    if (g.type === "build_cat") {
      const res = this.state.cells.filter((c) => this.itemMap.get(c.itemId)?.category === "residence").length;
      const biz = this.state.cells.filter((c) => this.itemMap.get(c.itemId)?.category === "business").length;
      return res >= g.residence && biz >= g.business;
    }
    if (g.type === "count_id") {
      return this.state.cells.filter((c) => c.itemId === g.itemId).length >= g.target;
    }
    if (g.type === "count_cat") {
      return this.state.cells.filter((c) => this.itemMap.get(c.itemId)?.category === g.category).length >= g.target;
    }
    if (g.type === "contracts") {
      return (this.state.contractsCompleted || 0) >= g.target;
    }
    if (g.type === "stats") {
      return this.population >= g.pop && this.happiness >= g.happy;
    }
    return false;
  }

  getQuestProgressText(q) {
    const g = q.goal;
    if (g.type === "build_cat") {
      const res = this.state.cells.filter((c) => this.itemMap.get(c.itemId)?.category === "residence").length;
      const biz = this.state.cells.filter((c) => this.itemMap.get(c.itemId)?.category === "business").length;
      return `Residences: ${res}/${g.residence} • Businesses: ${biz}/${g.business}`;
    }
    if (g.type === "count_id") {
      const cur = this.state.cells.filter((c) => c.itemId === g.itemId).length;
      return `Progress: ${cur}/${g.target}`;
    }
    if (g.type === "count_cat") {
      const cur = this.state.cells.filter((c) => this.itemMap.get(c.itemId)?.category === g.category).length;
      return `Progress: ${cur}/${g.target}`;
    }
    if (g.type === "contracts") {
      return `Contracts Completed: ${this.state.contractsCompleted || 0}/${g.target}`;
    }
    if (g.type === "stats") {
      return `Population: ${this.population}/${g.pop} • Happiness: ${this.happiness}/${g.happy}`;
    }
    return "";
  }

  openQuestsModal() {
    window.Sound.play("menu_in");
    this.openModal("modal-quests");
    const list = document.getElementById("quests-list");
    list.innerHTML = "";
    for (const q of this.catalog.quests) {
      const claimed = this.state.questsClaimed.includes(q.id);
      const done = !claimed && this.isQuestComplete(q);
      const row = document.createElement("div");
      row.className = "quest-row" + (done ? " done" : "") + (claimed ? " claimed" : "");
      row.innerHTML = `
        <div class="quest-info">
          <h4>${q.title}</h4>
          <p>${q.desc}</p>
          <div class="quest-prog">${claimed ? "Completed!" : this.getQuestProgressText(q)}</div>
          <div class="item-stats" style="justify-content:flex-start;margin-top:6px;">
            <span class="stat-chip"><img src="assets/ui/coins_xsmall.png" /> +${q.rewardCoins}</span>
            <span class="stat-chip"><img src="assets/ui/exp_xsmall.png" /> +${q.rewardXp} XP</span>
            <span class="stat-chip"><img src="assets/ui/gem_xsmall.png" /> +${q.rewardCash} Cash</span>
          </div>
        </div>
        <div>
          ${claimed
            ? `<button class="glossy-btn green small" disabled>Claimed</button>`
            : done
              ? `<button class="glossy-btn gold small">Claim!</button>`
              : `<button class="glossy-btn blue small" disabled>In Progress</button>`}
        </div>
      `;
      if (done) {
        row.querySelector("button").addEventListener("click", () => {
          this.state.questsClaimed.push(q.id);
          this.state.coins += q.rewardCoins;
          this.state.xp += q.rewardXp;
          this.state.cash += q.rewardCash;
          window.Sound.play("found_cash");
          this.recalcLevel(true);
          this.saveState();
          this.updateHUD();
          this.openQuestsModal();
        });
      }
      list.appendChild(row);
    }
  }

  showLevelUpModal(lvl, coins, cash) {
    const unlocks = this.catalog.items.filter((it) => it.minLevel === lvl).slice(0, 6).map((it) => it.name);
    document.getElementById("levelup-num").textContent = `Welcome to Level ${lvl}!`;
    document.getElementById("levelup-rewards").textContent = `+${coins.toLocaleString()} Coins  •  +${cash} City Cash`;
    document.getElementById("levelup-unlocks").textContent = unlocks.length
      ? `Newly unlocked in Market: ${unlocks.join(", ")}...`
      : "Keep growing your dream metropolis!";
    this.openModal("modal-levelup");
  }

  openSettingsModal() {
    window.Sound.play("menu_in");
    document.getElementById("input-city-name").value = this.state.cityName;
    document.getElementById("chk-music").checked = this.state.settings.music;
    document.getElementById("chk-sfx").checked = this.state.settings.sfx;
    document.getElementById("chk-grid").checked = this.state.settings.showGrid;
    document.getElementById("chk-sandbox").checked = this.state.settings.sandbox;
    this.openModal("modal-settings");
  }

  takePhoto() {
    window.Sound.play("snap");
    this.photoMode = true;
    this.engine.render(performance.now());
    const dataUrl = document.getElementById("game-canvas").toDataURL("image/png");
    this.photoMode = false;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${this.state.cityName.replace(/[^a-z0-9]/gi, "_")}_snapshot.png`;
    a.click();
    this.showToast("City snapshot saved!");
  }

  bindUI() {
    // Splash Play button
    document.getElementById("btn-play").addEventListener("click", () => {
      document.getElementById("splash-screen").classList.add("hidden");
      document.querySelectorAll(".hud").forEach((el) => el.classList.remove("hidden"));
      document.getElementById("hud-dock-edit").classList.add("hidden");
      this.engine.centerOnBoard();
      window.Sound.setMusicEnabled(this.state.settings.music);
      window.Sound.setSfxEnabled(this.state.settings.sfx);
      window.Sound.startMusic();
      window.Sound.play("menu_in");
      this.showToast(`Welcome back to ${this.state.cityName}! Click coins to collect!`);
    });

    // Bottom Docks
    document.getElementById("btn-market").addEventListener("click", () => this.openMarket());
    document.getElementById("btn-collect-all").addEventListener("click", () => this.collectAllReady());
    document.getElementById("btn-edit-mode").addEventListener("click", () => { window.Sound.play("action"); this.setMode("move"); });
    document.getElementById("btn-exit-edit").addEventListener("click", () => { window.Sound.play("menu_out"); this.setMode("home"); });
    for (const t of ["move", "rotate", "store", "sell"]) {
      document.getElementById(`btn-tool-${t}`).addEventListener("click", () => { window.Sound.play("tab"); this.setMode(t); });
    }

    // Mode bar buttons
    document.getElementById("btn-mode-rotate").addEventListener("click", () => this.togglePlacementRotate());
    document.getElementById("btn-mode-cancel").addEventListener("click", () => this.setMode("home"));

    // Left FABs
    document.getElementById("btn-quests").addEventListener("click", () => this.openQuestsModal());
    document.getElementById("btn-storage").addEventListener("click", () => this.openStorageModal());

    // Top Right controls
    document.getElementById("btn-speed").addEventListener("click", (e) => {
      const speeds = [1, 5, 20];
      this.speedMult = speeds[(speeds.indexOf(this.speedMult) + 1) % speeds.length];
      e.target.textContent = this.speedMult + "x";
      e.target.classList.toggle("speed-fast", this.speedMult > 1);
      window.Sound.play("tab");
      this.showToast(`Simulation Speed: ${this.speedMult}x`);
    });

    document.getElementById("btn-sound").addEventListener("click", () => {
      const next = !(this.state.settings.music || this.state.settings.sfx);
      this.state.settings.music = next;
      this.state.settings.sfx = next;
      window.Sound.setMusicEnabled(next);
      window.Sound.setSfxEnabled(next);
      document.getElementById("img-sound").src = next ? "assets/ui/sound_button.png" : "assets/ui/sound_disabled.png";
      this.saveState();
    });

    document.getElementById("btn-camera").addEventListener("click", () => this.takePhoto());
    document.getElementById("btn-settings").addEventListener("click", () => this.openSettingsModal());
    document.getElementById("btn-city-info").addEventListener("click", () => this.openSettingsModal());
    document.getElementById("btn-happiness-info").addEventListener("click", () => {
      const mult = Math.round(this.getIncomeMultiplier() * 100);
      this.showToast(`Happiness ${this.happiness} vs Population ${this.population} → ${mult}% Coin Earnings!`);
    });

    // Zoom
    document.getElementById("btn-zoom-in").addEventListener("click", () => this.engine.zoomBy(1.22));
    document.getElementById("btn-zoom-out").addEventListener("click", () => this.engine.zoomBy(1 / 1.22));
    document.getElementById("btn-zoom-reset").addEventListener("click", () => this.engine.centerOnBoard());

    // Market tabs & search
    document.querySelectorAll("#market-tabs .tab-btn").forEach((b) => {
      b.addEventListener("click", () => {
        this.activeMarketCat = b.dataset.cat;
        document.getElementById("market-search").value = "";
        window.Sound.play("tab");
        this.renderMarket();
      });
    });
    document.getElementById("market-search").addEventListener("input", () => this.renderMarket());

    // Settings inputs
    document.getElementById("input-city-name").addEventListener("input", (e) => {
      this.state.cityName = e.target.value.trim() || "My City";
      this.updateHUD();
      this.saveState();
    });
    document.getElementById("chk-music").addEventListener("change", (e) => {
      this.state.settings.music = e.target.checked;
      window.Sound.setMusicEnabled(e.target.checked);
      this.saveState();
    });
    document.getElementById("chk-sfx").addEventListener("change", (e) => {
      this.state.settings.sfx = e.target.checked;
      window.Sound.setSfxEnabled(e.target.checked);
      this.saveState();
    });
    document.getElementById("chk-grid").addEventListener("change", (e) => {
      this.state.settings.showGrid = e.target.checked;
      this.saveState();
    });
    document.getElementById("chk-sandbox").addEventListener("change", (e) => {
      this.state.settings.sandbox = e.target.checked;
      this.showToast(e.target.checked ? "Sandbox Mode ON — All 275 items unlocked & free!" : "Classic Progression Mode ON");
      this.saveState();
    });
    document.getElementById("btn-export-save").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "city_story_save.json";
      a.click();
      URL.revokeObjectURL(url);
    });
    document.getElementById("btn-import-save").addEventListener("click", () => document.getElementById("file-import-save").click());
    document.getElementById("file-import-save").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          this.state = this.normalizeState(parsed);
          this.recalcStats();
          this.engine.centerOnBoard();
          this.saveState();
          this.updateHUD();
          this.closeAllModals();
          this.showToast("City save imported!");
        } catch (_) {
          this.showToast("Invalid save file!");
        }
      };
      reader.readAsText(file);
    });
    document.getElementById("btn-reset-city").addEventListener("click", () => {
      if (!confirm("Reset your city back to the starter layout?")) return;
      this.state = this.createStarterState();
      this.recalcStats();
      this.engine.centerOnBoard();
      this.saveState();
      this.updateHUD();
      this.closeAllModals();
      this.showToast("City reset to starter layout!");
    });

    // Modal close buttons
    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => { window.Sound.play("menu_out"); this.closeAllModals(); });
    });
    document.getElementById("modal-backdrop").addEventListener("click", (e) => {
      if (e.target.id === "modal-backdrop") { window.Sound.play("menu_out"); this.closeAllModals(); }
    });

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "Escape") {
        if (!document.getElementById("modal-backdrop").classList.contains("hidden")) this.closeAllModals();
        else if (this.mode !== "home") this.setMode("home");
      } else if (e.key === "r" || e.key === "R") {
        this.togglePlacementRotate();
      } else if (e.key === "m" || e.key === "M") {
        if (document.getElementById("splash-screen").classList.contains("hidden")) this.openMarket();
      } else if (e.key === "+" || e.key === "=") {
        this.engine.zoomBy(1.18);
      } else if (e.key === "-" || e.key === "_") {
        this.engine.zoomBy(1 / 1.18);
      }
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.Game = new CityStoryGame();
});
