(function () {
  const STORAGE_KEY = "street-clash-save-v1";

  const defaultSave = {
    stats: {
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalHits: 0,
      bestCombo: 0
    },
    settings: {
      difficulty: "normal",
      fighter: "ryu",
      cpuFighter: "ken",
      stage: "metro",
      volume: 0.5,
      keys: {
        left: "KeyA",
        right: "KeyD",
        jump: "KeyW",
        forward: "KeyQ",
        back: "KeyE",
        guard: "KeyS",
        light: "KeyJ",
        heavy: "KeyK",
        uppercut: "KeyU",
        tornado: "KeyI",
        special: "KeyL",
        camera: "KeyC",
        pause: "Escape"
      }
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeSave(raw) {
    const base = clone(defaultSave);
    if (!raw || typeof raw !== "object") return base;
    return {
      stats: Object.assign(base.stats, raw.stats || {}),
      settings: {
        difficulty: raw.settings?.difficulty || base.settings.difficulty,
        fighter: raw.settings?.fighter || base.settings.fighter,
        cpuFighter: raw.settings?.cpuFighter || base.settings.cpuFighter,
        stage: raw.settings?.stage || base.settings.stage,
        volume: Number.isFinite(raw.settings?.volume) ? raw.settings.volume : base.settings.volume,
        keys: Object.assign(base.settings.keys, raw.settings?.keys || {})
      }
    };
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return mergeSave(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.warn("Could not load save data", error);
      return clone(defaultSave);
    }
  }

  function saveGame(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeSave(data)));
    } catch (error) {
      console.warn("Could not save data", error);
    }
  }

  function resetSave() {
    const data = clone(defaultSave);
    saveGame(data);
    return data;
  }

  window.StreetClashStorage = {
    defaultSave,
    loadSave,
    saveGame,
    resetSave
  };
})();
