// Authentic City Story Audio Engine (uses extracted original WAVs from APK)
class SoundEngine {
  constructor() {
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.started = false;
    this.bgm = new Audio("assets/audio/farm_2r1.wav");
    this.bgm.loop = true;
    this.bgm.volume = 0.28;

    this.sfxFiles = {
      cash: "assets/audio/cash.wav",
      found_cash: "assets/audio/found_cash.wav",
      construction: "assets/audio/construction.wav",
      plant: "assets/audio/plant_decoration.wav",
      delete: "assets/audio/delete_item.wav",
      contract: "assets/audio/sign_contract.wav",
      level_up: "assets/audio/level_up.wav",
      menu_in: "assets/audio/main_menu_slide_in.wav",
      menu_out: "assets/audio/main_menu_slide_out.wav",
      tab: "assets/audio/market_category_change.wav",
      flip: "assets/audio/main_menu_flip.wav",
      snap: "assets/audio/camera_snap.wav",
      plow: "assets/audio/plow_land.wav",
      water: "assets/audio/water_crop.wav",
      boost: "assets/audio/fertilize_all.wav",
      action: "assets/audio/action_menu_slide_in.wav"
    };
    this.pool = {};
  }

  startMusic() {
    this.started = true;
    if (this.musicEnabled) {
      this.bgm.play().catch(() => {});
    }
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = !!enabled;
    if (this.musicEnabled && this.started) {
      this.bgm.play().catch(() => {});
    } else {
      this.bgm.pause();
    }
  }

  setSfxEnabled(enabled) {
    this.sfxEnabled = !!enabled;
  }

  play(key) {
    if (!this.sfxEnabled) return;
    const src = this.sfxFiles[key];
    if (!src) return;
    try {
      const a = new Audio(src);
      a.volume = key === "cash" || key === "level_up" ? 0.55 : 0.45;
      a.play().catch(() => {});
    } catch (_) {}
  }
}

window.Sound = new SoundEngine();
