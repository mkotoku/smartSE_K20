(function () {
  const { Fighter, rectsOverlap } = window.StreetClashFighter;
  const THREE = window.THREE;

  const ARENA_WIDTH = 960;
  const ARENA_DEPTH = 300;
  const STAGE_LEFT = 80;
  const STAGE_RIGHT = ARENA_WIDTH - 80;
  const STAGE_FRONT = -130;
  const STAGE_BACK = 130;
  const BLAST_LEFT = -80;
  const BLAST_RIGHT = ARENA_WIDTH + 80;
  const BLAST_FRONT = -280;
  const BLAST_BACK = 280;
  const BLAST_FALL_Y = 420;

  const difficultyProfiles = {
    easy: { reaction: 0.54, aggression: 0.4, defense: 0.28, speed: 220, punish: 0.2 },
    normal: { reaction: 0.34, aggression: 0.62, defense: 0.45, speed: 258, punish: 0.38 },
    hard: { reaction: 0.22, aggression: 0.78, defense: 0.62, speed: 296, punish: 0.58 }
  };

  const fighterSkins = {
    ryu: { color: "#2f80ed", accent: "#ffd166", dark: "#111722" },
    ken: { color: "#e94f64", accent: "#ffd166", dark: "#201016" },
    chun: { color: "#56d6a6", accent: "#7df9ff", dark: "#09231f" }
  };

  const stageThemes = {
    metro: { floor: "#2e3447", back: "#11162d", fog: "#1d2441", neon: "#56d6a6", accent: "#ffd166", sky: "#6b7cff" },
    dojo: { floor: "#4a3427", back: "#2c303d", fog: "#34291f", neon: "#ffd166", accent: "#ff6b4a", sky: "#7df9ff" },
    harbor: { floor: "#263247", back: "#47235d", fog: "#172030", neon: "#7df9ff", accent: "#ff8a66", sky: "#ffd166" }
  };

  class SoundEngine {
    constructor(volume) {
      this.volume = volume;
      this.context = null;
    }

    setVolume(volume) {
      this.volume = volume;
    }

    play(kind) {
      if (this.volume <= 0) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.context) this.context = new AudioContext();
      const now = this.context.currentTime;
      const notes = {
        hitLight: [[360, 0.05]],
        hitHeavy: [[160, 0.07], [90, 0.11]],
        hitSpecial: [[110, 0.06], [440, 0.14]],
        super: [[90, 0.08], [180, 0.13], [720, 0.22]],
        block: [[540, 0.05]],
        throw: [[260, 0.11]],
        menu: [[660, 0.05]],
        round: [[330, 0.08], [660, 0.14]],
        win: [[520, 0.08], [660, 0.13], [880, 0.2]],
        lose: [[180, 0.12], [110, 0.24]]
      }[kind] || [[440, 0.08]];

      notes.forEach(([freq, length], index) => {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        const start = now + index * 0.045;
        oscillator.frequency.setValueAtTime(freq, start);
        oscillator.type = kind === "super" || kind === "hitSpecial" ? "sawtooth" : "square";
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.volume * 0.13), start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
        oscillator.connect(gain).connect(this.context.destination);
        oscillator.start(start);
        oscillator.stop(start + length + 0.02);
      });
    }
  }

  class Game {
    constructor(canvas, options) {
      if (!THREE) throw new Error("Three.js is required for 3D mode.");
      this.canvas = canvas;
      this.width = canvas.width;
      this.height = canvas.height;
      this.input = options.input;
      this.onRoundEnd = options.onRoundEnd;
      this.settings = options.settings;
      this.sound = new SoundEngine(this.settings.volume);
      this.player = new Fighter({ name: "PLAYER", x: 210, color: "#2f80ed", accent: "#ffd166", dark: "#111722" });
      this.cpu = new Fighter({ name: "CPU", x: 750, color: "#e94f64", accent: "#56d6a6", dark: "#201016", isCpu: true });
      this.projectiles = [];
      this.effects = [];
      this.combo = { owner: null, hits: 0, damage: 0, timer: 0 };
      this.bestPlayerCombo = 0;
      this.roundTime = 60;
      this.finished = false;
      this.matchFinished = false;
      this.playerRounds = 0;
      this.cpuRounds = 0;
      this.roundNumber = 1;
      this.cpuThinkTimer = 0;
      this.cpuPlan = "idle";
      this.cpuMood = "measuring";
      this.hitStop = 0;
      this.shake = 0;
      this.slowMotion = 0;
      this.banner = "";
      this.bannerTimer = 0;
      this.ringoutWinner = null;
      this.specialCinematic = null;
      this.cameraModes = ["auto", "side", "top", "orbit"];
      this.cameraModeIndex = 0;
      this.cameraMode = "auto";
      this.cameraYaw = 0;
      this.cameraHeightOffset = 0;
      this.backdropOccluders = [];
      this.lastResult = null;
      this.init3D();
    }

    init3D() {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.shadowMap.enabled = true;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
      this.camera.position.set(0, 5.4, 8.8);
      this.camera.lookAt(0, 1.1, 0);
      this.occlusionRaycaster = new THREE.Raycaster();

      this.scene.add(new THREE.HemisphereLight(0xbfd7ff, 0x1b1b22, 1.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(-4, 8, 5);
      key.castShadow = true;
      this.scene.add(key);
      this.rimLight = new THREE.PointLight(0x56d6a6, 2.2, 12);
      this.rimLight.position.set(0, 3, -3.5);
      this.scene.add(this.rimLight);
      this.stagePulseLight = new THREE.PointLight(0xffffff, 1.4, 10);
      this.stagePulseLight.position.set(0, 1.4, 1.4);
      this.scene.add(this.stagePulseLight);

      this.stageGroup = new THREE.Group();
      this.scene.add(this.stageGroup);
      this.playerRig = this.createFighterRig();
      this.cpuRig = this.createFighterRig();
      this.scene.add(this.playerRig.group, this.cpuRig.group);
      this.projectileGroup = new THREE.Group();
      this.effectGroup = new THREE.Group();
      this.scene.add(this.projectileGroup, this.effectGroup);
      this.applyStage();
    }

    applyStage() {
      const theme = stageThemes[this.settings.stage] || stageThemes.metro;
      this.scene.background = new THREE.Color(theme.back);
      this.scene.fog = new THREE.Fog(theme.fog, 8, 18);
      this.rimLight.color.set(theme.neon);
      this.stagePulseLight.color.set(theme.accent);
      this.disposeStageObjects();
      this.stageGroup.clear();
      this.backdropOccluders = [];

      const floorMaterial = new THREE.MeshStandardMaterial({
        color: theme.floor,
        roughness: 0.34,
        metalness: 0.3,
        emissive: theme.neon,
        emissiveIntensity: 0.05
      });
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry((STAGE_RIGHT - STAGE_LEFT) / 75, 0.18, (STAGE_BACK - STAGE_FRONT) / 75),
        floorMaterial
      );
      floor.receiveShadow = true;
      floor.position.y = -0.09;
      this.stageGroup.add(floor);

      const grid = new THREE.GridHelper((STAGE_RIGHT - STAGE_LEFT) / 75, 14, theme.neon, 0x4c5265);
      grid.position.y = 0.012;
      this.stageGroup.add(grid);

      const edgeMaterial = new THREE.MeshBasicMaterial({ color: theme.neon });
      const stageWidth = (STAGE_RIGHT - STAGE_LEFT) / 75;
      const stageDepth = (STAGE_BACK - STAGE_FRONT) / 75;
      const frontEdge = new THREE.Mesh(new THREE.BoxGeometry(stageWidth, 0.045, 0.045), edgeMaterial);
      const backEdge = frontEdge.clone();
      const leftEdge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, stageDepth), edgeMaterial);
      const rightEdge = leftEdge.clone();
      frontEdge.position.set(0, 0.065, STAGE_FRONT / 75);
      backEdge.position.set(0, 0.065, STAGE_BACK / 75);
      leftEdge.position.set((STAGE_LEFT - ARENA_WIDTH / 2) / 75, 0.065, 0);
      rightEdge.position.set((STAGE_RIGHT - ARENA_WIDTH / 2) / 75, 0.065, 0);
      this.stageGroup.add(frontEdge, backEdge, leftEdge, rightEdge);
      this.addStageUnderGlow(theme, stageWidth, stageDepth);

      const voidPlane = new THREE.Mesh(
        new THREE.BoxGeometry(15, 0.05, 7),
        new THREE.MeshBasicMaterial({ color: 0x05070d, transparent: true, opacity: 0.58 })
      );
      voidPlane.position.y = -0.24;
      this.stageGroup.add(voidPlane);

      this.addBackdropArchitecture(theme);
      this.addStageParticles(theme);
      this.addStageSetPieces(theme);
    }

    disposeStageObjects() {
      this.stageGroup.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value && typeof value.dispose === "function" && value.isTexture) value.dispose();
          });
          material.dispose();
        });
      });
    }

    addStageUnderGlow(theme, stageWidth, stageDepth) {
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: theme.neon,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(stageWidth * 1.08, stageDepth * 1.18), glowMaterial);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = -0.18;
      this.stageGroup.add(glow);

      for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.85 + i * 0.38, 0.01, 6, 80),
          new THREE.MeshBasicMaterial({ color: i % 2 ? theme.accent : theme.neon, transparent: true, opacity: 0.28 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.026 + i * 0.002;
        ring.userData.spin = 0.08 + i * 0.025;
        this.stageGroup.add(ring);
      }
    }

    addBackdropArchitecture(theme) {
      const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x20263a, roughness: 0.72, metalness: 0.18 });
      const glassMaterial = new THREE.MeshBasicMaterial({ color: theme.sky, transparent: true, opacity: 0.42 });
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 9; i++) {
          const height = 1.4 + ((i * 37) % 6) * 0.35;
          const width = 0.42 + (i % 3) * 0.12;
          const building = new THREE.Group();
          building.userData.backdropOccluder = true;
          building.userData.occlusionMeshes = [];
          const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.34), buildingMaterial);
          tower.position.set(0, height / 2 - 0.08, 0);
          building.add(tower);
          building.userData.occlusionMeshes.push(tower);
          for (let w = 0; w < 3; w++) {
            const windowStrip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.68, 0.035, 0.025), glassMaterial);
            windowStrip.position.set(0, 0.45 + w * 0.42, -side * 0.19);
            building.add(windowStrip);
          }
          building.position.set(-5.3 + i * 1.3, 0, side * 3.05);
          this.backdropOccluders.push(building);
          this.stageGroup.add(building);
        }
      }
    }

    addStageSetPieces(theme) {
      const pillarMaterial = new THREE.MeshStandardMaterial({
        color: theme.floor,
        emissive: theme.neon,
        emissiveIntensity: 0.12,
        roughness: 0.28,
        metalness: 0.45
      });
      const positions = [
        [-5.0, -2.0], [5.0, -2.0], [-5.0, 2.0], [5.0, 2.0]
      ];
      for (const [x, z] of positions) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.55, 18), pillarMaterial);
        pillar.position.set(x, 0.76, z);
        this.stageGroup.add(pillar);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12), new THREE.MeshBasicMaterial({ color: theme.accent }));
        cap.position.set(x, 1.58, z);
        this.stageGroup.add(cap);
      }

      for (let i = 0; i < 6; i++) {
        const banner = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.16, 0.035),
          new THREE.MeshBasicMaterial({ color: i % 2 ? theme.neon : theme.accent })
        );
        banner.position.set(-3.9 + i * 1.55, 2.45 + Math.sin(i) * 0.16, -2.48);
        banner.userData.float = i * 0.7;
        this.stageGroup.add(banner);
      }
    }

    addStageParticles(theme) {
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      for (let i = 0; i < 90; i++) {
        positions.push(
          (Math.random() - 0.5) * 11,
          0.3 + Math.random() * 3.2,
          -3.2 + Math.random() * 6.4
        );
      }
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const particles = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ color: theme.neon, size: 0.035, transparent: true, opacity: 0.52 })
      );
      particles.userData.particles = true;
      this.stageGroup.add(particles);
    }

    createFighterRig() {
      const group = new THREE.Group();
      const material = (color, emissive = 0x000000, roughness = 0.5) => new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: 0.18,
        roughness,
        metalness: 0.06
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.78, 0.34), material(0x2f80ed));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), material(0xffc58a, 0x2b1508, 0.62));
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), material(0x2f80ed));
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), material(0x2f80ed));
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.64, 0.22), material(0x24314f));
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.64, 0.22), material(0x24314f));
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.52), material(0x151117, 0x000000, 0.7));
      const hairFront = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.08), material(0x151117, 0x000000, 0.7));
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.075, 0.018), material(0x10131f));
      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.075, 0.018), material(0x10131f));
      const browL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02), material(0x151117));
      const browR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02), material(0x151117));
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.018), material(0x5a1f2a));
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.37), material(0x171923));
      const sash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.39), material(0xffd166, 0x332000));
      const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.26), material(0xffd166, 0x332000));
      const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.26), material(0xffd166, 0x332000));
      const handL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.21), material(0xffc58a));
      const handR = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.21), material(0xffc58a));
      const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.28), material(0x111722));
      const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.28), material(0x111722));
      const attack = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.34, depthWrite: false })
      );
      const attackCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 18, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })
      );
      const attackRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.035, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.78, depthWrite: false })
      );
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 256;
      labelCanvas.height = 64;
      const labelTexture = new THREE.CanvasTexture(labelCanvas);
      const attackLabel = new THREE.Sprite(new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
        depthWrite: false
      }));
      attack.visible = false;
      attackCore.visible = false;
      attackRing.visible = false;
      attackLabel.visible = false;
      attackLabel.scale.set(1.8, 0.45, 1);
      group.add(
        body, head, hair, hairFront, eyeL, eyeR, browL, browR, mouth,
        armL, armR, shoulderL, shoulderR, handL, handR,
        legL, legR, bootL, bootR, belt, sash,
        attack, attackCore, attackRing, attackLabel
      );
      [
        body, head, hair, hairFront, eyeL, eyeR, browL, browR, mouth,
        armL, armR, shoulderL, shoulderR, handL, handR, legL, legR, bootL, bootR, belt, sash
      ].forEach((part) => {
        part.castShadow = true;
        part.receiveShadow = true;
      });
      return {
        group, body, head, hair, hairFront, eyeL, eyeR, browL, browR, mouth,
        armL, armR, shoulderL, shoulderR, handL, handR, legL, legR, bootL, bootR, belt, sash,
        attack, attackCore, attackRing, attackLabel, labelCanvas, labelTexture
      };
    }

    reset(settings) {
      this.settings = settings || this.settings;
      this.sound.setVolume(this.settings.volume);
      this.applyCosmetics();
      this.applyStage();
      this.playerRounds = 0;
      this.cpuRounds = 0;
      this.roundNumber = 1;
      this.matchFinished = false;
      this.lastResult = null;
      this.bestPlayerCombo = 0;
      this.startRound();
    }

    applyCosmetics() {
      Object.assign(this.player, fighterSkins[this.settings.fighter] || fighterSkins.ryu);
    }

    startRound() {
      this.player.reset(210);
      this.cpu.reset(750);
      this.cpu.z = 0;
      this.player.z = 0;
      this.roundTime = 60;
      this.finished = false;
      this.ringoutWinner = null;
      this.cpuThinkTimer = 0;
      this.cpuPlan = "idle";
      this.cpuMood = "measuring";
      this.hitStop = 0;
      this.shake = 0;
      this.slowMotion = 0;
      this.specialCinematic = null;
      this.effects = [];
      this.projectiles = [];
      this.clearThreeGroup(this.projectileGroup);
      this.clearThreeGroup(this.effectGroup);
      this.combo = { owner: null, hits: 0, damage: 0, timer: 0 };
      this.showBanner(`ROUND ${this.roundNumber}`, 1.0);
      this.sound.play("round");
    }

    update(dt) {
      if (this.matchFinished) {
        this.updateEffects(dt);
        return;
      }
      dt = Math.min(dt, 1 / 30);
      if (this.slowMotion > 0) {
        this.slowMotion = Math.max(0, this.slowMotion - dt);
        dt *= 0.42;
      }
      this.updateSpecialCinematic(dt);
      if (this.hitStop > 0) {
        this.hitStop = Math.max(0, this.hitStop - dt);
        this.updateEffects(dt);
        return;
      }
      this.roundTime = Math.max(0, this.roundTime - dt);
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      this.shake = Math.max(0, this.shake - dt * 35);
      this.combo.timer = Math.max(0, this.combo.timer - dt);
      if (this.combo.timer <= 0) this.combo = { owner: null, hits: 0, damage: 0, timer: 0 };

      this.faceEachOther();
      this.handleCameraInput(dt);
      this.handlePlayerInput();
      this.handleCpu(dt);
      this.updateProjectiles(dt);
      this.player.update(dt, ARENA_WIDTH + 160, ARENA_DEPTH + 260, this.isOnStage(this.player));
      this.cpu.update(dt, ARENA_WIDTH + 160, ARENA_DEPTH + 260, this.isOnStage(this.cpu));
      this.handleLedgeRecovery(this.player, this.cpu, true);
      this.handleLedgeRecovery(this.cpu, this.player, false);
      this.separateFighters();
      this.resolveAttack(this.player, this.cpu);
      this.resolveAttack(this.cpu, this.player);
      this.resolveProjectiles();
      this.updateEffects(dt);
      this.checkRoundEnd();
    }

    isOnStage(fighter) {
      return fighter.x >= STAGE_LEFT && fighter.x <= STAGE_RIGHT && fighter.z >= STAGE_FRONT && fighter.z <= STAGE_BACK;
    }

    isPastBlastZone(fighter) {
      return fighter.x < BLAST_LEFT || fighter.x > BLAST_RIGHT || fighter.z < BLAST_FRONT || fighter.z > BLAST_BACK || fighter.y > BLAST_FALL_Y;
    }

    nearestStagePoint(fighter) {
      return {
        x: Math.max(STAGE_LEFT, Math.min(STAGE_RIGHT, fighter.x)),
        z: Math.max(STAGE_FRONT, Math.min(STAGE_BACK, fighter.z))
      };
    }

    wantsRecovery(fighter, opponent, isPlayer) {
      if (fighter.onGround || this.isOnStage(fighter)) return false;
      const ledge = this.nearestStagePoint(fighter);
      const dx = ledge.x - fighter.x;
      const dz = ledge.z - fighter.z;
      const nearLedge = Math.hypot(dx, dz) < 84 && fighter.y > -85 && fighter.y < 90;
      if (!nearLedge) return false;
      if (!isPlayer) return true;
      const towardX = dx < 0 ? this.input.isDown("left") : this.input.isDown("right");
      const towardZ = dz < 0 ? this.input.isDown("forward") : this.input.isDown("back");
      return towardX || towardZ || this.input.isDown("jump");
    }

    handleLedgeRecovery(fighter, opponent, isPlayer) {
      if (this.isPastBlastZone(fighter)) {
        this.ringoutWinner = fighter === this.player ? "cpu" : "player";
        this.showBanner("RING OUT", 0.9);
        return;
      }
      if (!this.wantsRecovery(fighter, opponent, isPlayer)) return;
      const ledge = this.nearestStagePoint(fighter);
      const centerX = ARENA_WIDTH / 2;
      const centerZ = 0;
      fighter.x = ledge.x;
      fighter.z = ledge.z;
      fighter.y = 0;
      fighter.vy = -520;
      fighter.vx = Math.sign(centerX - fighter.x) * 180;
      fighter.vz = Math.sign(centerZ - fighter.z) * 150;
      fighter.onGround = false;
      fighter.crouching = false;
      fighter.guard = false;
      fighter.state = "jump";
      this.spawnLedgeBurst(fighter);
      this.showBanner("LEDGE RECOVERY", 0.55);
    }

    spawnLedgeBurst(fighter) {
      const point = this.nearestStagePoint(fighter);
      for (let i = 0; i < 14; i++) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 1 })
        );
        this.effectGroup.add(mesh);
        this.effects.push({
          x: point.x,
          y: -14,
          z: point.z,
          vx: (Math.random() - 0.5) * 3,
          vy: 1.2 + Math.random() * 2,
          vz: (Math.random() - 0.5) * 3,
          life: 0.25 + Math.random() * 0.2,
          mesh
        });
      }
    }

    handlePlayerInput() {
      const p = this.player;
      p.crouching = this.input.isDown("guard") && p.onGround && !p.attack;
      p.guard = p.crouching;
      if (!p.canAct()) return;
      const speed = p.crouching ? 62 : 306;
      const depthSpeed = p.crouching ? 50 : 240;
      if (!p.attack) {
        if (this.input.isDown("left")) p.vx = -speed;
        if (this.input.isDown("right")) p.vx = speed;
        if (this.input.isDown("forward")) p.vz = -depthSpeed;
        if (this.input.isDown("back")) p.vz = depthSpeed;
        if (this.input.consume("jump") && p.onGround && !p.crouching) {
          p.vy = -680;
          p.onGround = false;
        }
      }
      if (p.crouching) {
        if (this.input.consume("light")) this.tryAttack(p, "crouchLight");
        if (this.input.consume("heavy")) this.tryAttack(p, "crouchHeavy");
        if (this.input.consume("special")) this.tryAttack(p, "throw");
      } else {
        if (this.input.consume("light")) this.tryAttack(p, "light");
        if (this.input.consume("heavy")) this.tryAttack(p, "heavy");
        if (this.input.consume("special")) this.tryAttack(p, p.meter >= 100 ? "super" : "special");
      }
    }

    handleCameraInput(dt) {
      if (this.input.consume("camera")) {
        this.cameraModeIndex = (this.cameraModeIndex + 1) % this.cameraModes.length;
        this.cameraMode = this.cameraModes[this.cameraModeIndex];
        this.showBanner(`CAMERA ${this.cameraMode.toUpperCase()}`, 0.55);
      }
      const turnSpeed = 1.55;
      const heightSpeed = 2.1;
      if (this.input.isCodeDown && this.input.isCodeDown("ArrowLeft")) this.cameraYaw -= turnSpeed * dt;
      if (this.input.isCodeDown && this.input.isCodeDown("ArrowRight")) this.cameraYaw += turnSpeed * dt;
      if (this.input.isCodeDown && this.input.isCodeDown("ArrowUp")) this.cameraHeightOffset += heightSpeed * dt;
      if (this.input.isCodeDown && this.input.isCodeDown("ArrowDown")) this.cameraHeightOffset -= heightSpeed * dt;
      this.cameraHeightOffset = Math.max(-1.4, Math.min(2.6, this.cameraHeightOffset));
    }

    handleCpu(dt) {
      const cpu = this.cpu;
      const player = this.player;
      const profile = difficultyProfiles[this.settings.difficulty] || difficultyProfiles.normal;
      cpu.guard = false;
      cpu.crouching = false;
      if (!cpu.canAct() || cpu.attack) return;
      this.cpuThinkTimer -= dt;
      const distanceX = Math.abs(player.x - cpu.x);
      const distanceZ = Math.abs(player.z - cpu.z);
      const distance = Math.hypot(distanceX, distanceZ * 1.7);
      if (this.cpuThinkTimer <= 0) {
        this.cpuThinkTimer = profile.reaction + Math.random() * 0.13;
        if (distanceZ > 38) {
          this.cpuPlan = "alignDepth";
          this.cpuMood = "sidestep";
        } else if (player.attack && distance < 140 && Math.random() < profile.defense) {
          this.cpuPlan = "guard";
          this.cpuMood = "reading";
        } else if (player.attack && distance < 120 && Math.random() < profile.punish) {
          this.cpuPlan = "punish";
          this.cpuMood = "punish";
        } else if (distanceX > 210) {
          this.cpuPlan = Math.random() < 0.18 && cpu.meter >= 35 ? "special" : "approach";
          this.cpuMood = "closing";
        } else if (distance < 66) {
          this.cpuPlan = Math.random() < 0.45 ? "throw" : Math.random() < 0.5 ? "low" : "retreat";
          this.cpuMood = "scramble";
        } else if (Math.random() < profile.aggression) {
          this.cpuPlan = cpu.meter >= 100 && Math.random() < 0.22 ? "super" : Math.random() < 0.56 ? "light" : "heavy";
          this.cpuMood = "attacking";
        } else {
          this.cpuPlan = Math.random() < 0.5 ? "guard" : "retreat";
          this.cpuMood = "measuring";
        }
      }

      if (this.cpuPlan === "alignDepth") cpu.vz = Math.sign(player.z - cpu.z) * profile.speed * 0.86;
      if (this.cpuPlan === "approach") {
        cpu.vx = Math.sign(player.x - cpu.x) * profile.speed;
        if (distanceZ > 18) cpu.vz = Math.sign(player.z - cpu.z) * profile.speed * 0.65;
      }
      if (this.cpuPlan === "retreat") {
        cpu.vx = -Math.sign(player.x - cpu.x) * profile.speed * 0.74;
        cpu.vz = (Math.random() < 0.5 ? -1 : 1) * profile.speed * 0.38;
      }
      if (this.cpuPlan === "guard") {
        cpu.guard = cpu.onGround;
        cpu.crouching = cpu.guard;
      }
      if (this.cpuPlan === "punish") {
        if (distance < 125 && distanceZ < 52) this.tryAttack(cpu, "heavy");
        else cpu.vx = Math.sign(player.x - cpu.x) * profile.speed;
      }
      if (this.cpuPlan === "low") {
        if (distance < 118 && distanceZ < 62) this.tryAttack(cpu, Math.random() < 0.6 ? "crouchLight" : "crouchHeavy");
        else {
          cpu.vx = Math.sign(player.x - cpu.x) * profile.speed;
          if (distanceZ > 20) cpu.vz = Math.sign(player.z - cpu.z) * profile.speed * 0.75;
        }
      }
      if (["light", "heavy", "special", "super", "throw"].includes(this.cpuPlan)) {
        const needRange = this.cpuPlan === "throw" ? 70 : this.cpuPlan === "special" || this.cpuPlan === "super" ? 158 : 126;
        if (distance < needRange && distanceZ < 62) this.tryAttack(cpu, this.cpuPlan);
        else {
          cpu.vx = Math.sign(player.x - cpu.x) * profile.speed;
          if (distanceZ > 20) cpu.vz = Math.sign(player.z - cpu.z) * profile.speed * 0.75;
        }
      }
    }

    tryAttack(fighter, type) {
      if (!fighter.startAttack(type)) return false;
      this.sound.play(type === "super" ? "super" : "menu");
      if (fighter === this.player) this.showBanner(fighter.attack.label.toUpperCase(), 0.32);
      if (type === "special" || type === "super") {
        this.startSpecialCinematic(fighter, type);
        this.spawnSpecialFlare(fighter, type);
        this.spawnWave(fighter, type);
        this.slowMotion = Math.max(this.slowMotion, type === "super" ? 0.42 : 0.22);
        this.shake = Math.max(this.shake, type === "super" ? 13 : 7);
      }
      return true;
    }

    startSpecialCinematic(fighter, type) {
      const length = type === "super" ? 0.52 : 0.34;
      this.specialCinematic = { fighter, type, timer: length, duration: length };
      this.stagePulseLight.intensity = type === "super" ? 3.6 : 2.5;
      this.stagePulseLight.color.set(type === "super" ? 0xffffff : 0x7df9ff);
      if (fighter === this.player) this.showBanner(type === "super" ? "METEOR RUSH" : "SURGE DRIVE", 0.48);
    }

    spawnSpecialFlare(fighter, type) {
      const color = type === "super" ? 0xfff4a8 : 0x7df9ff;
      const center = this.toWorld(fighter.x, fighter.y - 76, fighter.z);
      const ringCount = type === "super" ? 4 : 3;
      for (let i = 0; i < ringCount; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.45 + i * 0.16, 0.018, 8, 80),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })
        );
        ring.position.copy(center);
        ring.rotation.set(Math.PI / 2, 0, fighter.yaw + i * 0.7);
        this.effectGroup.add(ring);
        this.effects.push({
          x: fighter.x,
          y: fighter.y - 76,
          z: fighter.z,
          vx: fighter.forwardX * 0.08,
          vy: -0.2,
          vz: fighter.forwardZ * 0.08,
          life: 0.42 + i * 0.04,
          maxLife: 0.42 + i * 0.04,
          spin: type === "super" ? 6.2 : 4.4,
          grow: 1.8 + i * 0.25,
          mesh: ring
        });
      }
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.58, type === "super" ? 2.7 : 2.1, 32, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: type === "super" ? 0.34 : 0.24, depthWrite: false, side: THREE.DoubleSide })
      );
      pillar.position.copy(center);
      pillar.position.y += type === "super" ? 0.78 : 0.56;
      this.effectGroup.add(pillar);
      this.effects.push({
        x: fighter.x,
        y: fighter.y - 128,
        z: fighter.z,
        vx: 0,
        vy: 0,
        vz: 0,
        life: type === "super" ? 0.5 : 0.34,
        maxLife: type === "super" ? 0.5 : 0.34,
        spin: type === "super" ? -3.2 : -2.1,
        grow: 0.65,
        mesh: pillar
      });
      const slashCount = type === "super" ? 18 : 10;
      for (let i = 0; i < slashCount; i++) {
        const slash = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.018, type === "super" ? 0.95 : 0.68),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : color, transparent: true, opacity: 0.92, depthWrite: false })
        );
        slash.position.copy(center);
        slash.rotation.y = fighter.yaw + (Math.random() - 0.5) * 1.15;
        slash.rotation.z = (Math.random() - 0.5) * 1.6;
        this.effectGroup.add(slash);
        this.effects.push({
          x: fighter.x + (Math.random() - 0.5) * 20,
          y: fighter.y - 78 + (Math.random() - 0.5) * 42,
          z: fighter.z + (Math.random() - 0.5) * 20,
          vx: fighter.forwardX * (1.8 + Math.random() * 2.4),
          vy: (Math.random() - 0.2) * 2.2,
          vz: fighter.forwardZ * (1.8 + Math.random() * 2.4),
          life: 0.18 + Math.random() * 0.2,
          maxLife: 0.34,
          spin: (Math.random() - 0.5) * 10,
          grow: 1.2,
          mesh: slash
        });
      }
    }

    spawnWave(fighter, type) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(type === "super" ? 0.34 : 0.22, 24, 16),
        new THREE.MeshBasicMaterial({ color: type === "super" ? 0xffd166 : 0x7df9ff, transparent: true, opacity: 0.78 })
      );
      this.projectileGroup.add(mesh);
      this.projectiles.push({
        owner: fighter,
        x: fighter.x + fighter.forwardX * 72,
        y: fighter.y - 72,
        z: fighter.z + fighter.forwardZ * 72,
        vx: fighter.forwardX * (type === "super" ? 620 : 480),
        vz: fighter.forwardZ * (type === "super" ? 620 : 480),
        radius: type === "super" ? 34 : 22,
        damage: type === "super" ? 18 : 10,
        knockback: type === "super" ? 430 : 260,
        life: 0.8,
        super: type === "super",
        hit: false,
        mesh
      });
    }

    updateProjectiles(dt) {
      for (const projectile of this.projectiles) {
        projectile.x += projectile.vx * dt;
        projectile.z += projectile.vz * dt;
        projectile.life -= dt;
      }
      this.projectiles = this.projectiles.filter((projectile) => {
        const keep = projectile.life > 0 && projectile.x > -80 && projectile.x < ARENA_WIDTH + 80 && !projectile.hit;
        if (!keep) this.removeSceneObject(projectile.mesh);
        return keep;
      });
    }

    resolveProjectiles() {
      for (const projectile of this.projectiles) {
        const defender = projectile.owner === this.player ? this.cpu : this.player;
        const box = {
          x: projectile.x - projectile.radius,
          y: projectile.y - projectile.radius,
          z: projectile.z - projectile.radius,
          width: projectile.radius * 2,
          height: projectile.radius * 2,
          depth: projectile.radius * 2
        };
        if (!rectsOverlap(box, defender.bounds)) continue;
        const blocked = defender.guard && this.isFacing(defender, projectile.owner) && defender.onGround;
        const attack = {
          name: projectile.super ? "super" : "special",
          label: projectile.super ? "Meteor Wave" : "Surge Wave",
          damage: projectile.damage,
          knockback: projectile.knockback,
          hitStun: projectile.super ? 0.44 : 0.28,
          meterGain: 0,
          sound: projectile.super ? "super" : "hitSpecial",
          spark: projectile.super ? "#ffffff" : "#7df9ff"
        };
        this.applyHit(projectile.owner, defender, attack, blocked, projectile.x, projectile.y, projectile.z);
        projectile.hit = true;
      }
    }

    faceEachOther() {
      this.player.facing = this.player.x <= this.cpu.x ? 1 : -1;
      this.cpu.facing = this.cpu.x <= this.player.x ? 1 : -1;
      this.turnToward(this.player, this.cpu);
      this.turnToward(this.cpu, this.player);
    }

    turnToward(fighter, target) {
      if (fighter.attack && fighter.attackTimer > fighter.attack.startup) return;
      const dx = target.x - fighter.x;
      const dz = target.z - fighter.z;
      const length = Math.hypot(dx, dz) || 1;
      fighter.forwardX = dx / length;
      fighter.forwardZ = dz / length;
      fighter.yaw = Math.atan2(fighter.forwardX, fighter.forwardZ);
    }

    separateFighters() {
      const dx = this.cpu.x - this.player.x;
      const dz = this.cpu.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      const minGap = 52;
      if (dist >= minGap || dist === 0) return;
      const push = (minGap - dist) / 2;
      const nx = dx / dist;
      const nz = dz / dist;
      this.player.x -= push * nx;
      this.player.z -= push * nz;
      this.cpu.x += push * nx;
      this.cpu.z += push * nz;
    }

    resolveAttack(attacker, defender) {
      if (!attacker.attack || attacker.attackHasHit) return;
      const attackBox = attacker.attackBox();
      if (!attackBox || !rectsOverlap(attackBox, defender.bounds)) return;
      if (!attacker.attack.unblockable && !this.isFacing(attacker, defender)) return;
      if (this.attackWhiffsByHeight(attacker.attack, defender)) {
        attacker.attackHasHit = true;
        this.showBanner("WHIFF", 0.24);
        return;
      }
      const blocked = !attacker.attack.unblockable && defender.guard && this.isFacing(defender, attacker) && defender.onGround;
      const sparkX = attacker.x + attacker.forwardX * (attacker.attack.range + 20);
      const sparkY = attackBox.y + attackBox.height * 0.45;
      const sparkZ = attacker.z + attacker.forwardZ * (attacker.attack.range + 20);
      this.applyHit(attacker, defender, attacker.attack, blocked, sparkX, sparkY, sparkZ);
      attacker.attackHasHit = true;
    }

    isFacing(source, target) {
      const dx = target.x - source.x;
      const dz = target.z - source.z;
      const length = Math.hypot(dx, dz) || 1;
      return (source.forwardX * dx + source.forwardZ * dz) / length > 0.28;
    }

    attackWhiffsByHeight(attack, defender) {
      if (attack.level === "low") return !defender.onGround;
      if (attack.level === "mid") return defender.crouching && defender.onGround;
      return false;
    }

    applyHit(attacker, defender, attack, blocked, sparkX, sparkY, sparkZ) {
      const direction = Math.sign(attacker.forwardX || attacker.facing) || attacker.facing;
      const damage = defender.takeHit(attack, direction, blocked);
      attacker.gainMeter(attack.meterGain || 0);
      this.hitStop = blocked ? 0.035 : attack.name === "super" ? 0.12 : 0.065;
      this.shake = Math.max(this.shake, blocked ? 3 : attack.name === "super" ? 15 : 8);
      this.slowMotion = attack.name === "super" && !blocked ? 0.32 : this.slowMotion;
      this.sound.play(blocked ? "block" : attack.sound);
      this.spawnSpark(sparkX, sparkY, sparkZ, blocked ? "#7df9ff" : attack.spark, attack.name, blocked);
      if (!blocked) {
        const sameOwner = this.combo.owner === attacker && this.combo.timer > 0;
        this.combo.owner = attacker;
        this.combo.hits = sameOwner ? this.combo.hits + 1 : 1;
        this.combo.damage = sameOwner ? this.combo.damage + damage : damage;
        this.combo.timer = 1.05;
        if (attacker === this.player) this.bestPlayerCombo = Math.max(this.bestPlayerCombo, this.combo.hits);
        this.showBanner(this.combo.hits >= 2 ? `${this.combo.hits} HIT COMBO` : attack.label, 0.65);
      } else {
        this.showBanner("BLOCK", 0.35);
      }
    }

    spawnSpark(x, y, z, color, type, blocked) {
      const count = type === "super" ? 30 : blocked ? 9 : 18;
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(blocked ? 0.035 : 0.055, 8, 8),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
        );
        this.effectGroup.add(mesh);
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
        const speed = (blocked ? 1.2 : 2.0) + Math.random() * (type === "super" ? 3.2 : 1.8);
        this.effects.push({
          x, y, z,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vz: (Math.random() - 0.5) * speed,
          life: 0.28 + Math.random() * 0.24,
          mesh
        });
      }
    }

    updateEffects(dt) {
      for (const effect of this.effects) {
        effect.x += effect.vx * 70 * dt;
        effect.y += effect.vy * 70 * dt;
        effect.z += effect.vz * 70 * dt;
        effect.vy -= 4.2 * dt;
        effect.life -= dt;
        if (effect.spin) effect.mesh.rotation.y += effect.spin * dt;
      }
      this.effects = this.effects.filter((effect) => {
        const keep = effect.life > 0;
        if (!keep) this.removeSceneObject(effect.mesh);
        return keep;
      });
    }

    updateSpecialCinematic(dt) {
      if (!this.specialCinematic) return;
      this.specialCinematic.timer -= dt;
      if (this.specialCinematic.timer <= 0) {
        const theme = stageThemes[this.settings.stage] || stageThemes.metro;
        this.stagePulseLight.color.set(theme.accent);
        this.specialCinematic = null;
      }
    }

    showBanner(text, seconds) {
      this.banner = text;
      this.bannerTimer = seconds;
    }

    checkRoundEnd() {
      if (this.finished) return;
      let winner = null;
      if (this.ringoutWinner) winner = this.ringoutWinner;
      else if (this.player.hp <= 0 && this.cpu.hp <= 0) winner = "draw";
      else if (this.cpu.hp <= 0) winner = "player";
      else if (this.player.hp <= 0) winner = "cpu";
      else if (this.roundTime <= 0) {
        if (this.player.hp === this.cpu.hp) winner = "draw";
        else winner = this.player.hp > this.cpu.hp ? "player" : "cpu";
      }
      if (!winner) return;
      this.finished = true;
      if (winner === "player") this.playerRounds += 1;
      if (winner === "cpu") this.cpuRounds += 1;
      this.player.winPose = winner === "player";
      this.player.losePose = winner === "cpu";
      this.cpu.winPose = winner === "cpu";
      this.cpu.losePose = winner === "player";
      this.showBanner(winner === "draw" ? "DRAW" : winner === "player" ? "ROUND WIN" : "ROUND LOST", 1.2);
      this.sound.play(winner === "player" ? "win" : "lose");
      window.setTimeout(() => {
        if (this.playerRounds >= 2 || this.cpuRounds >= 2) {
          this.matchFinished = true;
          this.lastResult = this.playerRounds > this.cpuRounds ? "win" : "lose";
          if (this.onRoundEnd) {
            this.onRoundEnd(this.lastResult, {
              bestCombo: this.bestPlayerCombo,
              rounds: `${this.playerRounds}-${this.cpuRounds}`
            });
          }
          return;
        }
        this.roundNumber += 1;
        this.startRound();
      }, 1200);
    }

    draw() {
      const time = performance.now();
      this.animateStage(time);
      this.syncRig(this.playerRig, this.player, time);
      this.syncRig(this.cpuRig, this.cpu, time);
      this.syncProjectiles();
      this.syncEffects();
      this.syncCamera();
      this.updateBackdropVisibility();
      this.drawMessage3D();
      this.renderer.render(this.scene, this.camera);
    }

    animateStage(time) {
      const seconds = time / 1000;
      const cinematicBoost = this.specialCinematic ? (this.specialCinematic.type === "super" ? 2.6 : 1.4) : 0;
      this.stagePulseLight.intensity = 1.1 + Math.sin(seconds * 2.4) * 0.45 + cinematicBoost;
      for (const child of this.stageGroup.children) {
        if (child.userData.spin) child.rotation.z += child.userData.spin * 0.016;
        if (child.userData.float !== undefined) {
          child.position.y += Math.sin(seconds * 1.7 + child.userData.float) * 0.0009;
          child.rotation.y = Math.sin(seconds + child.userData.float) * 0.1;
        }
        if (child.userData.particles) {
          child.rotation.y = seconds * 0.03;
          child.material.opacity = 0.42 + Math.sin(seconds * 1.8) * 0.12;
        }
      }
    }

    syncRig(rig, fighter, time) {
      const pos = this.toWorld(fighter.x, fighter.y, fighter.z);
      rig.group.position.copy(pos);
      rig.group.rotation.y = fighter.yaw;
      rig.group.scale.setScalar(fighter.flash > 0 ? 1.08 : 1);
      const body = new THREE.Color(fighter.flash > 0 ? "#fff6b8" : fighter.color);
      const accent = new THREE.Color(fighter.accent);
      const skin = new THREE.Color(fighter.flash > 0 ? "#fff6b8" : "#ffc58a");
      const dark = new THREE.Color(fighter.dark || "#111722");
      [rig.body, rig.armL, rig.armR].forEach((part) => part.material.color.copy(body));
      [rig.shoulderL, rig.shoulderR, rig.sash].forEach((part) => part.material.color.copy(accent));
      [rig.legL, rig.legR].forEach((part) => part.material.color.copy(dark).lerp(body, 0.28));
      [rig.bootL, rig.bootR, rig.belt].forEach((part) => part.material.color.copy(dark));
      [rig.head, rig.handL, rig.handR].forEach((part) => part.material.color.copy(skin));
      [rig.hair, rig.hairFront, rig.browL, rig.browR].forEach((part) => part.material.color.copy(dark));

      const walk = fighter.state === "walk" ? Math.sin(time / 80) : 0;
      const isCrouch = fighter.crouching || fighter.state === "crouchLight" || fighter.state === "crouchHeavy";
      const crouch = isCrouch ? -0.36 : fighter.state === "guard" ? -0.12 : 0;
      rig.body.position.set(0, 0.88 + crouch, 0);
      rig.body.scale.y = isCrouch ? 0.72 : 1;
      rig.head.position.set(0, 1.46 + crouch + Math.sin(time / 260) * 0.02, 0);
      rig.head.rotation.set(0, 0, fighter.state === "hurt" ? -0.18 : 0);
      rig.hair.position.set(0, rig.head.position.y + 0.19, 0);
      rig.hairFront.position.set(0, rig.head.position.y + 0.1, 0.25);
      rig.eyeL.position.set(-0.1, rig.head.position.y + 0.02, 0.252);
      rig.eyeR.position.set(0.1, rig.head.position.y + 0.02, 0.252);
      rig.browL.position.set(-0.1, rig.head.position.y + 0.09, 0.258);
      rig.browR.position.set(0.1, rig.head.position.y + 0.09, 0.258);
      rig.browL.rotation.z = fighter.state === "hurt" ? -0.35 : -0.18;
      rig.browR.rotation.z = fighter.state === "hurt" ? 0.35 : 0.18;
      rig.mouth.position.set(0, rig.head.position.y - 0.12, 0.258);
      rig.belt.position.set(0, 0.56 + crouch * 0.35, 0);
      rig.sash.position.set(0.12, 0.56 + crouch * 0.35, 0.01);
      rig.armL.position.set(-0.34, 0.94 + crouch, 0);
      rig.armR.position.set(0.34, 0.94 + crouch, 0);
      rig.shoulderL.position.set(-0.36, 1.2 + crouch, 0);
      rig.shoulderR.position.set(0.36, 1.2 + crouch, 0);
      rig.handL.position.set(-0.34, 0.54 + crouch, 0.02);
      rig.handR.position.set(0.34, 0.54 + crouch, 0.02);
      rig.legL.position.set(-0.16, 0.32, 0.05);
      rig.legR.position.set(0.16, 0.32, -0.05);
      rig.bootL.position.set(-0.16, 0.02, 0.08);
      rig.bootR.position.set(0.16, 0.02, -0.02);
      rig.armL.rotation.z = 0.45;
      rig.armR.rotation.z = -0.45;
      rig.armL.rotation.x = 0;
      rig.armL.rotation.y = 0;
      rig.armR.rotation.x = 0;
      rig.armR.rotation.y = 0;
      rig.shoulderL.rotation.copy(rig.armL.rotation);
      rig.shoulderR.rotation.copy(rig.armR.rotation);
      rig.handL.rotation.copy(rig.armL.rotation);
      rig.handR.rotation.copy(rig.armR.rotation);
      rig.legL.rotation.z = walk * 0.35;
      rig.legR.rotation.z = -walk * 0.35;
      rig.bootL.rotation.copy(rig.legL.rotation);
      rig.bootR.rotation.copy(rig.legR.rotation);
      if (fighter.state === "light" || fighter.state === "heavy" || fighter.state === "special" || fighter.state === "super") {
        const total = fighter.attack ? fighter.attack.startup + fighter.attack.active + fighter.attack.recovery : 1;
        const progress = fighter.attack ? Math.min(1, fighter.attackTimer / total) : 1;
        const charge = Math.sin(Math.min(1, progress * 1.35) * Math.PI);
        const reachPose = fighter.state === "light" ? 0.46 : fighter.state === "heavy" ? 0.66 : fighter.state === "super" ? 0.98 : 0.84;
        rig.armR.position.set(0.18, 1.08 + crouch + charge * 0.08, reachPose + charge * (fighter.state === "super" ? 0.22 : 0.14));
        rig.armR.rotation.x = Math.PI / 2 + (fighter.state === "super" ? charge * 0.38 : 0);
        rig.armR.rotation.y = fighter.state === "heavy" ? -0.28 : fighter.state === "super" ? Math.sin(progress * Math.PI * 2) * 0.22 : 0;
        rig.armR.rotation.z = fighter.state === "super" ? -0.38 + charge * 0.28 : 0;
        rig.armL.position.set(-0.24, 1.0 + crouch + charge * 0.18, fighter.state === "super" ? 0.62 : 0.24);
        rig.armL.rotation.x = fighter.state === "super" ? Math.PI / 2 - charge * 0.36 : 0.45 + charge * 0.42;
        rig.handR.position.set(0.18, 0.74 + crouch + charge * 0.08, reachPose + 0.4 + charge * 0.16);
        rig.handR.rotation.copy(rig.armR.rotation);
        rig.handL.position.set(-0.24, 0.62 + crouch + charge * 0.18, fighter.state === "super" ? 0.94 : 0.48);
        rig.handL.rotation.copy(rig.armL.rotation);
        rig.shoulderL.position.set(-0.26, 1.18 + crouch + charge * 0.08, 0.1);
        rig.shoulderR.position.set(0.22, 1.22 + crouch + charge * 0.04, 0.18);
        rig.shoulderL.rotation.copy(rig.armL.rotation);
        rig.shoulderR.rotation.copy(rig.armR.rotation);
        if (fighter.state === "special" || fighter.state === "super") {
          rig.body.rotation.x = -0.14 - charge * (fighter.state === "super" ? 0.22 : 0.12);
          rig.head.position.y += charge * 0.1;
          rig.group.scale.setScalar(1 + charge * (fighter.state === "super" ? 0.18 : 0.1));
        }
      }
      if (fighter.state === "crouchLight" || fighter.state === "crouchHeavy") {
        const lowReach = fighter.state === "crouchHeavy" ? 0.9 : 0.58;
        rig.armR.position.set(0.16, 0.72, lowReach);
        rig.armR.rotation.x = Math.PI / 2;
        rig.armR.rotation.y = fighter.state === "crouchHeavy" ? -0.22 : 0;
        rig.handR.position.set(0.16, 0.56, lowReach + 0.42);
        rig.handR.rotation.copy(rig.armR.rotation);
        rig.legR.position.set(0.2, 0.2, 0.36);
        rig.legR.rotation.x = Math.PI / 2;
        rig.legL.position.set(-0.2, 0.22, -0.14);
        rig.legL.rotation.z = -0.45;
        rig.bootR.position.set(0.2, 0.2, 0.74);
        rig.bootR.rotation.copy(rig.legR.rotation);
        rig.bootL.position.set(-0.2, 0.02, -0.2);
      }
      if (fighter.state === "throw") {
        rig.armL.position.set(-0.38, 1.02 + crouch, 0.18);
        rig.armR.position.set(0.42, 1.02 + crouch, 0.18);
        rig.armL.rotation.z = 0.95;
        rig.armR.rotation.z = -0.95;
        rig.armR.rotation.x = 0;
        rig.armR.rotation.y = 0;
        rig.body.rotation.x = -0.18;
        rig.handL.position.set(-0.52, 0.72 + crouch, 0.34);
        rig.handR.position.set(0.56, 0.72 + crouch, 0.34);
        rig.handL.rotation.copy(rig.armL.rotation);
        rig.handR.rotation.copy(rig.armR.rotation);
      } else if (fighter.state !== "special" && fighter.state !== "super") {
        rig.body.rotation.x = 0;
      }
      if (fighter.state === "guard") {
        rig.armL.position.set(-0.12, 1.16 + crouch, 0.2);
        rig.armR.position.set(0.12, 1.16 + crouch, 0.2);
        rig.armL.rotation.z = 1.1;
        rig.armR.rotation.z = -1.1;
        rig.handL.position.set(-0.1, 0.98 + crouch, 0.38);
        rig.handR.position.set(0.1, 0.98 + crouch, 0.38);
      }
      if (fighter.state === "down") rig.group.rotation.z = fighter.facing * 1.1;
      else rig.group.rotation.z = 0;

      this.syncAttackCue(rig, fighter);
    }

    syncAttackCue(rig, fighter) {
      const attack = fighter.attack;
      const visible = Boolean(attack);
      rig.attack.visible = visible;
      rig.attackCore.visible = visible;
      rig.attackRing.visible = visible;
      rig.attackLabel.visible = visible;
      if (!visible) return;

      const total = attack.startup + attack.active + attack.recovery;
      const progress = Math.min(1, fighter.attackTimer / total);
      const activeStart = attack.startup / total;
      const activeEnd = (attack.startup + attack.active) / total;
      const isActive = progress >= activeStart && progress <= activeEnd;
      const colorMap = {
        light: 0xfef3a1,
        heavy: 0xff6b4a,
        special: 0x7df9ff,
        super: 0xffffff,
        throw: 0xcaff70,
        crouchLight: 0xcaff70,
        crouchHeavy: 0x86ff62
      };
      const color = colorMap[attack.name] || 0xffffff;
      const reach = attack.name === "throw" ? 0.42 : attack.range / 82;
      const size = attack.name === "light" || attack.name === "crouchLight" ? 0.58 : attack.name === "heavy" || attack.name === "crouchHeavy" ? 0.86 : attack.name === "super" ? 1.45 : 1.05;
      const forward = 0.48 + reach * 0.36 + Math.sin(progress * Math.PI) * 0.22;
      const lateral = attack.name === "heavy" ? Math.sin(progress * Math.PI * 2) * 0.08 : 0;

      rig.attack.scale.set(reach * size, attack.height / 92, (attack.depth || 80) / 72);
      rig.attack.position.set(lateral, attack.level === "low" ? 0.42 : 0.98, forward);
      rig.attack.material.color.set(color);
      rig.attack.material.opacity = isActive ? 0.42 : 0.18;

      rig.attackCore.position.set(lateral, (attack.level === "low" ? 0.48 : 1.08) + Math.sin(progress * Math.PI) * 0.16, forward + 0.28);
      rig.attackCore.scale.setScalar(attack.name === "super" ? 1.9 : attack.name === "special" ? 1.35 : attack.name === "heavy" ? 1.08 : 0.82);
      rig.attackCore.material.color.set(color);
      rig.attackCore.material.opacity = isActive ? 0.95 : 0.45;

      rig.attackRing.position.copy(rig.attackCore.position);
      rig.attackRing.rotation.set(Math.PI / 2, 0, progress * Math.PI * 3);
      rig.attackRing.scale.setScalar(attack.name === "super" ? 1.75 : attack.name === "heavy" ? 1.25 : 1);
      rig.attackRing.material.color.set(color);
      rig.attackRing.material.opacity = isActive ? 0.9 : 0.34;

      rig.attackLabel.position.set(0, 2.0, 0);
      this.drawAttackLabel(rig, attack.label.toUpperCase(), color, isActive);
    }

    drawAttackLabel(rig, text, color, active) {
      if (rig.lastAttackText === text && rig.lastAttackActive === active) return;
      rig.lastAttackText = text;
      rig.lastAttackActive = active;
      const ctx = rig.labelCanvas.getContext("2d");
      ctx.clearRect(0, 0, rig.labelCanvas.width, rig.labelCanvas.height);
      ctx.globalAlpha = active ? 1 : 0.62;
      ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
      ctx.fillRect(6, 10, 244, 44);
      ctx.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 12, 240, 40);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 24px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(text, 128, 40);
      rig.labelTexture.needsUpdate = true;
    }

    syncProjectiles() {
      for (const projectile of this.projectiles) {
        projectile.mesh.position.copy(this.toWorld(projectile.x, projectile.y, projectile.z));
        projectile.mesh.scale.setScalar(1 + Math.sin(performance.now() / 70) * 0.08);
      }
    }

    syncEffects() {
      for (const effect of this.effects) {
        effect.mesh.position.copy(this.toWorld(effect.x, effect.y, effect.z));
        const ratio = effect.maxLife ? Math.max(0, effect.life / effect.maxLife) : Math.max(0, effect.life * 3);
        effect.mesh.material.opacity = Math.min(1, ratio * (effect.baseOpacity || 1));
        if (effect.grow) effect.mesh.scale.setScalar(1 + (1 - ratio) * effect.grow);
      }
    }

    syncCamera() {
      if (this.specialCinematic) {
        const { fighter, type, timer, duration } = this.specialCinematic;
        const ratio = Math.max(0, timer / duration);
        const ease = Math.sin((1 - ratio) * Math.PI);
        const fighterWorld = this.toWorld(fighter.x, fighter.y - 74, fighter.z);
        const side = fighter === this.player ? -1 : 1;
        const forward = new THREE.Vector3(fighter.forwardX || fighter.facing || 1, 0, fighter.forwardZ || 0).normalize();
        const lateral = new THREE.Vector3(forward.z, 0, -forward.x).multiplyScalar(side * (type === "super" ? 1.55 : 1.25));
        const distance = type === "super" ? 2.7 : 3.25;
        const height = type === "super" ? 1.55 : 1.35;
        const shake = this.shake > 0 ? (Math.random() - 0.5) * 0.08 : 0;
        this.camera.position.copy(fighterWorld)
          .add(forward.clone().multiplyScalar(-distance + ease * 0.35))
          .add(lateral)
          .add(new THREE.Vector3(shake, height + ease * 0.22, shake));
        this.camera.lookAt(fighterWorld.clone().add(new THREE.Vector3(0, 0.38 + ease * 0.2, 0)));
        return;
      }
      const midX = ((this.player.x + this.cpu.x) / 2 - ARENA_WIDTH / 2) / 75;
      const midZ = (this.player.z + this.cpu.z) / 2 / 80;
      const spread = Math.min(2.2, Math.abs(this.player.x - this.cpu.x) / 260);
      const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.015 : 0;
      const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.015 : 0;
      const target = new THREE.Vector3(midX, 1.0, midZ);
      let distance = 8.2 + spread;
      let height = 5.1 + this.cameraHeightOffset;
      let yaw = this.cameraYaw;
      if (this.cameraMode === "side") {
        yaw += 0;
        distance = 8.6 + spread;
        height = 4.7 + this.cameraHeightOffset;
      } else if (this.cameraMode === "top") {
        yaw += 0.2;
        distance = 2.6;
        height = 10.2 + this.cameraHeightOffset;
      } else if (this.cameraMode === "orbit") {
        yaw += performance.now() * 0.00028;
        distance = 8.7 + spread;
        height = 5.4 + this.cameraHeightOffset;
      }
      this.camera.position.set(
        target.x + Math.sin(yaw) * distance + shakeX,
        height + shakeY,
        target.z + Math.cos(yaw) * distance + midZ * 0.25
      );
      this.camera.lookAt(target);
    }

    updateBackdropVisibility() {
      if (!this.backdropOccluders.length || !this.occlusionRaycaster) return;
      this.scene.updateMatrixWorld(true);
      const targets = [
        this.playerRig.group.position.clone().add(new THREE.Vector3(0, 1.15, 0)),
        this.cpuRig.group.position.clone().add(new THREE.Vector3(0, 1.15, 0))
      ];
      this.backdropOccluders.forEach((occluder) => {
        occluder.visible = true;
      });
      for (const occluder of this.backdropOccluders) {
        const meshes = occluder.userData.occlusionMeshes || [];
        occluder.visible = !targets.some((target) => this.isBackdropBlockingTarget(meshes, target));
      }
    }

    isBackdropBlockingTarget(meshes, target) {
      const toTarget = target.clone().sub(this.camera.position);
      const distance = toTarget.length();
      if (distance <= 0.25) return false;
      this.occlusionRaycaster.set(this.camera.position, toTarget.normalize());
      this.occlusionRaycaster.near = 0.1;
      this.occlusionRaycaster.far = distance - 0.25;
      return this.occlusionRaycaster.intersectObjects(meshes, false).length > 0;
    }

    drawMessage3D() {
      if (!this.bannerMesh) {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 128;
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        this.bannerMesh = new THREE.Sprite(material);
        this.bannerMesh.scale.set(4.8, 1.2, 1);
        this.bannerMesh.position.set(0, 3.4, -1.5);
        this.bannerMesh.renderOrder = 10;
        this.scene.add(this.bannerMesh);
        this.bannerCanvas = canvas;
        this.bannerTexture = texture;
      }
      const ctx = this.bannerCanvas.getContext("2d");
      ctx.clearRect(0, 0, this.bannerCanvas.width, this.bannerCanvas.height);
      this.bannerMesh.visible = this.bannerTimer > 0 && Boolean(this.banner);
      if (this.bannerMesh.visible) {
        ctx.globalAlpha = Math.min(1, this.bannerTimer * 2);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = 12;
        ctx.font = "900 54px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.strokeText(this.banner, 256, 78);
        ctx.fillText(this.banner, 256, 78);
        this.bannerTexture.needsUpdate = true;
      }
    }

    toWorld(x, y, z) {
      return new THREE.Vector3((x - ARENA_WIDTH / 2) / 75, -y / 92, z / 75);
    }

    clearThreeGroup(group) {
      while (group.children.length) this.removeSceneObject(group.children[0]);
    }

    removeSceneObject(object) {
      if (!object) return;
      if (object.parent) object.parent.remove(object);
      object.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value && value.isTexture && typeof value.dispose === "function") value.dispose();
          });
          if (typeof material.dispose === "function") material.dispose();
        });
      });
    }
  }

  window.StreetClashGame = {
    Game
  };
})();
