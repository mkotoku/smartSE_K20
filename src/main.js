(function () {
  const { loadSave, saveGame, resetSave, defaultSave } = window.StreetClashStorage;
  const { InputManager, actionLabels, codeToLabel } = window.StreetClashInput;
  const { Game } = window.StreetClashGame;

  const canvas = document.getElementById("gameCanvas");
  const screens = {
    title: document.getElementById("titleScreen"),
    result: document.getElementById("resultScreen"),
    settings: document.getElementById("settingsScreen"),
    pause: document.getElementById("pauseScreen")
  };
  const hud = document.getElementById("hud");
  const playerLife = document.getElementById("playerLife");
  const cpuLife = document.getElementById("cpuLife");
  const playerMeter = document.getElementById("playerMeter");
  const cpuMeter = document.getElementById("cpuMeter");
  const playerRounds = document.getElementById("playerRounds");
  const cpuRounds = document.getElementById("cpuRounds");
  const comboReadout = document.getElementById("comboReadout");
  const timer = document.getElementById("timer");
  const keyGrid = document.getElementById("keyGrid");
  const difficultySelect = document.getElementById("difficultySelect");
  const fighterSelect = document.getElementById("fighterSelect");
  const stageSelect = document.getElementById("stageSelect");
  const volumeSlider = document.getElementById("volumeSlider");

  let save = loadSave();
  const input = new InputManager(save.settings.keys);
  const game = new Game(canvas, {
    input,
    settings: save.settings,
    onRoundEnd: handleRoundEnd
  });

  let mode = "title";
  let previousMode = "title";
  let lastTime = performance.now();

  function setMode(nextMode) {
    mode = nextMode;
    Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
    if (screens[nextMode]) screens[nextMode].classList.add("is-active");
    hud.classList.toggle("is-active", nextMode === "play" || nextMode === "pause");
    canvas.classList.toggle("is-dimmed", nextMode !== "play" && nextMode !== "pause");
    input.clear();
    updateStats();
  }

  function startRound() {
    save.settings.keys = Object.assign({}, input.keys);
    saveGame(save);
    game.reset(save.settings);
    setMode("play");
  }

  function handleRoundEnd(result, detail) {
    detail = detail || { bestCombo: 0, rounds: "0-0" };
    const stats = save.stats;
    if (result === "win") {
      stats.wins += 1;
      stats.currentStreak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    } else if (result === "lose") {
      stats.losses += 1;
      stats.currentStreak = 0;
    } else {
      stats.currentStreak = 0;
    }
    stats.bestCombo = Math.max(stats.bestCombo || 0, detail.bestCombo || 0);
    stats.totalHits = (stats.totalHits || 0) + (detail.bestCombo || 0);
    saveGame(save);

    document.getElementById("resultLabel").textContent = result === "win" ? "Victory" : result === "lose" ? "Defeat" : "Draw";
    document.getElementById("resultTitle").textContent = result === "win" ? "Match Won" : result === "lose" ? "Match Lost" : "Time Over";
    document.getElementById("resultDetail").textContent = `Rounds ${detail.rounds} / Streak ${stats.currentStreak} / Best Combo ${stats.bestCombo}`;
    setMode("result");
  }

  function updateStats() {
    document.getElementById("statWins").textContent = save.stats.wins;
    document.getElementById("statLosses").textContent = save.stats.losses;
    document.getElementById("statBestStreak").textContent = save.stats.bestStreak;
  }

  function updateHud() {
    playerLife.style.width = `${game.player.hp}%`;
    cpuLife.style.width = `${game.cpu.hp}%`;
    playerMeter.style.width = `${game.player.meter}%`;
    cpuMeter.style.width = `${game.cpu.meter}%`;
    playerRounds.textContent = game.playerRounds;
    cpuRounds.textContent = game.cpuRounds;
    comboReadout.textContent = game.combo.timer > 0 && game.combo.hits >= 2 && game.combo.owner === game.player ? `${game.combo.hits} HIT` : "";
    timer.textContent = Math.ceil(game.roundTime);
  }

  function renderSettings() {
    difficultySelect.value = save.settings.difficulty;
    fighterSelect.value = save.settings.fighter;
    stageSelect.value = save.settings.stage;
    volumeSlider.value = save.settings.volume;
    keyGrid.innerHTML = "";
    Object.keys(actionLabels).forEach((action) => {
      const row = document.createElement("div");
      row.className = "key-row";
      const label = document.createElement("span");
      label.textContent = actionLabels[action];
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = action;
      button.textContent = codeToLabel(input.keys[action]);
      button.addEventListener("click", () => {
        button.textContent = "Press key";
        input.beginRebind(action);
      });
      row.append(label, button);
      keyGrid.append(row);
    });
  }

  input.onRebind = function () {
    save.settings.keys = Object.assign({}, input.keys);
    saveGame(save);
    renderSettings();
  };

  difficultySelect.addEventListener("change", () => {
    save.settings.difficulty = difficultySelect.value;
    saveGame(save);
  });

  fighterSelect.addEventListener("change", () => {
    save.settings.fighter = fighterSelect.value;
    saveGame(save);
  });

  stageSelect.addEventListener("change", () => {
    save.settings.stage = stageSelect.value;
    saveGame(save);
  });

  volumeSlider.addEventListener("input", () => {
    save.settings.volume = Number(volumeSlider.value);
    game.sound.setVolume(save.settings.volume);
    saveGame(save);
  });

  document.getElementById("startButton").addEventListener("click", startRound);
  document.getElementById("rematchButton").addEventListener("click", startRound);
  document.getElementById("settingsButton").addEventListener("click", () => {
    previousMode = mode;
    renderSettings();
    setMode("settings");
  });
  document.getElementById("closeSettingsButton").addEventListener("click", () => setMode(previousMode === "play" ? "pause" : "title"));
  document.getElementById("resetSettingsButton").addEventListener("click", () => {
    const stats = save.stats;
    save = resetSave();
    save.stats = stats;
    input.keys = Object.assign({}, defaultSave.settings.keys);
    save.settings.keys = Object.assign({}, input.keys);
    saveGame(save);
    renderSettings();
  });
  document.getElementById("resumeButton").addEventListener("click", () => setMode("play"));
  document.getElementById("pauseTitleButton").addEventListener("click", () => setMode("title"));
  document.getElementById("resultTitleButton").addEventListener("click", () => setMode("title"));

  function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (mode === "play" && input.consume("pause")) {
      setMode("pause");
    } else if (mode === "pause" && input.consume("pause")) {
      setMode("play");
    }

    if (mode === "play") game.update(dt);
    game.draw();
    updateHud();
    requestAnimationFrame(loop);
  }

  updateStats();
  renderSettings();
  setMode("title");
  requestAnimationFrame(loop);
})();
