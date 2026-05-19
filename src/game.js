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
    ryu: { color: "#2f80ed", accent: "#ffd166", dark: "#111722", style: "striker" },
    ken: { color: "#e94f64", accent: "#ffd166", dark: "#201016", style: "striker" },
    chun: { color: "#56d6a6", accent: "#7df9ff", dark: "#09231f", style: "striker" },
    cloud: { color: "#4d5b73", accent: "#d8f2ff", dark: "#151a22", style: "sword" }
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

    ensureContext() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      if (!this.context) this.context = new AudioContext();
      return this.context;
    }

    play(kind) {
      if (this.volume <= 0) return;
      if (kind === "applause") {
        this.playApplause();
        return;
      }
      if (kind === "crowd") {
        this.playCrowd();
        return;
      }
      if (!this.ensureContext()) return;
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

    playNoiseBurst(start, length, frequency, amount) {
      const context = this.ensureContext();
      if (!context) return;
      const buffer = context.createBuffer(1, Math.max(1, context.sampleRate * length), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * amount;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(frequency, start);
      filter.Q.setValueAtTime(1.7, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.volume * 0.2), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start(start);
      source.stop(start + length + 0.02);
    }

    playApplause() {
      const context = this.ensureContext();
      if (!context) return;
      const now = context.currentTime;
      for (let i = 0; i < 18; i++) {
        this.playNoiseBurst(now + i * 0.045 + Math.random() * 0.025, 0.035 + Math.random() * 0.025, 1500 + Math.random() * 1800, 0.7);
      }
    }

    playCrowd() {
      const context = this.ensureContext();
      if (!context) return;
      const now = context.currentTime;
      this.playNoiseBurst(now, 0.9, 420 + Math.random() * 120, 0.35);
      [[440, 0.18], [554, 0.18], [659, 0.24], [880, 0.28]].forEach(([freq, length], index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + index * 0.075;
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.volume * 0.08), start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + length + 0.03);
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
      this.victoryCinematic = null;
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
          building.userData.side = side;
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
      const sword = new THREE.Group();
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 1.88, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xd8f2ff, emissive: 0x4b8fb8, emissiveIntensity: 0.24, roughness: 0.28, metalness: 0.55 })
      );
      const bladeTip = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.34, 4),
        new THREE.MeshStandardMaterial({ color: 0xf4fbff, emissive: 0x4b8fb8, emissiveIntensity: 0.28, roughness: 0.24, metalness: 0.58 })
      );
      const bladeSpine = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.72, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x7fa4b8, emissive: 0x1e4f65, emissiveIntensity: 0.18, roughness: 0.32, metalness: 0.48 })
      );
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.1, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x202838, emissive: 0x0c1422, roughness: 0.38, metalness: 0.4 })
      );
      const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.42, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x151a22, roughness: 0.55, metalness: 0.22 })
      );
      blade.position.y = 0.72;
      bladeTip.position.y = 1.83;
      bladeTip.rotation.y = Math.PI / 4;
      bladeSpine.position.set(-0.13, 0.68, 0.012);
      grip.position.y = -0.42;
      sword.add(blade, bladeTip, bladeSpine, guard, grip);
      sword.visible = false;
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
        sword, attack, attackCore, attackRing, attackLabel
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
        sword, blade, bladeTip, bladeSpine, guard, grip, attack, attackCore, attackRing, attackLabel, labelCanvas, labelTexture
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
      this.victoryCinematic = null;
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
      if (this.finished) {
        this.updateVictoryCinematic(dt);
        this.player.update(dt, ARENA_WIDTH + 160, ARENA_DEPTH + 260, this.isOnStage(this.player));
        this.cpu.update(dt, ARENA_WIDTH + 160, ARENA_DEPTH + 260, this.isOnStage(this.cpu));
        this.updateEffects(dt);
        return;
      }
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
        if (this.input.consume("light")) this.tryAttack(p, this.getLightType(p));
        if (this.input.consume("heavy")) this.tryAttack(p, this.getHeavyType(p));
        if (this.input.consume("uppercut")) this.tryAttack(p, this.getUppercutType(p));
        if (this.input.consume("tornado")) this.tryAttack(p, "tornado");
        if (this.input.consume("special")) this.tryAttack(p, this.getSpecialType(p));
      }
    }

    getLightType(fighter) {
      return fighter.style === "sword" ? "bladeLight" : "light";
    }

    getHeavyType(fighter) {
      return fighter.style === "sword" ? "bladeHeavy" : "heavy";
    }

    getUppercutType(fighter) {
      if (fighter.style === "sword") return "bladeDive";
      const chain = fighter.comboChain.join(",");
      return chain.endsWith("shoryuken") ? "dragonDance" : "shoryuken";
    }

    getSpecialType(fighter) {
      if (fighter.style === "sword") return "bladeWave";
      return fighter.meter >= 100 ? "super" : "special";
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
          this.cpuPlan = Math.random() < 0.18 && cpu.meter >= 35 ? this.getSpecialType(cpu) : cpu.meter >= 25 && Math.random() < 0.22 ? "tornado" : "approach";
          this.cpuMood = "closing";
        } else if (distance < 66) {
          this.cpuPlan = Math.random() < 0.45 ? "throw" : Math.random() < 0.5 ? "low" : "retreat";
          this.cpuMood = "scramble";
        } else if (Math.random() < profile.aggression) {
          this.cpuPlan = cpu.meter >= 100 && Math.random() < 0.22 ? "super" : cpu.meter >= 25 && Math.random() < 0.2 ? "tornado" : Math.random() < 0.18 ? this.getUppercutType(cpu) : Math.random() < 0.56 ? this.getLightType(cpu) : this.getHeavyType(cpu);
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
      if (["light", "heavy", "bladeLight", "bladeHeavy", "special", "bladeWave", "bladeDive", "shoryuken", "dragonDance", "tornado", "super", "throw"].includes(this.cpuPlan)) {
        const needRange = this.cpuPlan === "throw" ? 70 : this.cpuPlan === "special" || this.cpuPlan === "bladeWave" || this.cpuPlan === "bladeDive" || this.cpuPlan === "shoryuken" || this.cpuPlan === "dragonDance" || this.cpuPlan === "tornado" || this.cpuPlan === "super" ? 158 : 142;
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
      if (type === "special" || type === "bladeWave" || type === "bladeDive" || type === "shoryuken" || type === "dragonDance" || type === "tornado" || type === "super") {
        this.startSpecialCinematic(fighter, type);
        if (type === "bladeWave") this.spawnBladeWaveFlare(fighter);
        else this.spawnSpecialFlare(fighter, type);
        if (type === "bladeDive") this.spawnBladeDiveFlare(fighter);
        if (type !== "tornado" && type !== "bladeDive" && type !== "shoryuken" && type !== "dragonDance") this.spawnWave(fighter, type);
        this.slowMotion = Math.max(this.slowMotion, type === "super" ? 0.42 : 0.22);
        this.shake = Math.max(this.shake, type === "super" ? 13 : 7);
      }
      return true;
    }

    startSpecialCinematic(fighter, type) {
      const length = type === "super" ? 0.52 : type === "bladeDive" ? 0.5 : type === "dragonDance" ? 0.42 : type === "tornado" ? 0.28 : 0.34;
      this.specialCinematic = { fighter, type, timer: length, duration: length };
      this.stagePulseLight.intensity = type === "super" ? 3.6 : type === "bladeDive" || type === "dragonDance" ? 3.2 : 2.5;
      this.stagePulseLight.color.set(type === "super" ? 0xffffff : type === "tornado" ? 0xffd166 : type === "bladeWave" || type === "bladeDive" ? 0xd8f2ff : type === "shoryuken" || type === "dragonDance" ? 0xff8a2a : 0x7df9ff);
      if (fighter === this.player) this.showBanner(type === "super" ? "METEOR RUSH" : type === "tornado" ? "TORNADO KICK" : type === "bladeWave" ? "LIMIT WAVE" : type === "bladeDive" ? "SKY CLEAVER" : type === "dragonDance" ? "DRAGON DANCE" : type === "shoryuken" ? "RISING DRAGON" : "SURGE DRIVE", 0.48);
    }

    spawnSpecialFlare(fighter, type) {
      const color = type === "super" ? 0xfff4a8 : type === "tornado" ? 0xffd166 : type === "bladeWave" || type === "bladeDive" ? 0xd8f2ff : type === "shoryuken" || type === "dragonDance" ? 0xff8a2a : 0x7df9ff;
      const center = this.toWorld(fighter.x, fighter.y - 76, fighter.z);
      const ringCount = type === "super" ? 4 : type === "dragonDance" ? 6 : type === "tornado" ? 5 : type === "bladeDive" ? 5 : 3;
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
          spin: type === "super" ? 6.2 : type === "dragonDance" ? 10.5 : type === "tornado" || type === "bladeDive" ? 8.4 : 4.4,
          grow: 1.8 + i * 0.25,
          mesh: ring
        });
      }
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(type === "dragonDance" ? 0.72 : 0.38, type === "dragonDance" ? 0.34 : 0.58, type === "super" ? 2.7 : type === "shoryuken" || type === "dragonDance" ? 3.1 : 2.1, 32, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: type === "super" ? 0.34 : type === "shoryuken" || type === "dragonDance" ? 0.42 : 0.24, depthWrite: false, side: THREE.DoubleSide })
      );
      pillar.position.copy(center);
      pillar.position.y += type === "super" ? 0.78 : type === "shoryuken" || type === "dragonDance" ? 1.1 : 0.56;
      this.effectGroup.add(pillar);
      this.effects.push({
        x: fighter.x,
        y: fighter.y - (type === "shoryuken" || type === "dragonDance" ? 176 : 128),
        z: fighter.z,
        vx: 0,
        vy: 0,
        vz: 0,
        life: type === "super" ? 0.5 : type === "dragonDance" ? 0.62 : 0.34,
        maxLife: type === "super" ? 0.5 : type === "dragonDance" ? 0.62 : 0.34,
        spin: type === "super" ? -3.2 : type === "dragonDance" ? -6.4 : -2.1,
        grow: type === "dragonDance" ? 1.1 : 0.65,
        mesh: pillar
      });
      const slashCount = type === "super" ? 18 : type === "bladeDive" ? 22 : type === "dragonDance" ? 24 : type === "tornado" ? 16 : type === "shoryuken" ? 16 : type === "bladeWave" ? 14 : 10;
      for (let i = 0; i < slashCount; i++) {
        const slash = new THREE.Mesh(
          new THREE.BoxGeometry(type === "bladeDive" || type === "bladeWave" ? 0.045 : 0.035, 0.018, type === "super" || type === "dragonDance" || type === "bladeDive" ? 0.95 : 0.68),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : color, transparent: true, opacity: 0.92, depthWrite: false })
        );
        slash.position.copy(center);
        slash.rotation.y = fighter.yaw + (type === "dragonDance" ? i * 0.52 : 0) + (Math.random() - 0.5) * 1.15;
        slash.rotation.z = (type === "bladeDive" ? -0.8 : type === "shoryuken" || type === "dragonDance" ? 0.7 : 0) + (Math.random() - 0.5) * 1.6;
        this.effectGroup.add(slash);
        this.effects.push({
          x: fighter.x + (Math.random() - 0.5) * 20,
          y: fighter.y - (type === "bladeDive" ? 132 : type === "shoryuken" || type === "dragonDance" ? 106 : 78) + (Math.random() - 0.5) * 42,
          z: fighter.z + (Math.random() - 0.5) * 20,
          vx: fighter.forwardX * (1.8 + Math.random() * 2.4),
          vy: (type === "bladeDive" ? 1.6 : type === "shoryuken" || type === "dragonDance" ? -1.4 : -0.2) + Math.random() * 2.2,
          vz: fighter.forwardZ * (1.8 + Math.random() * 2.4),
          life: 0.18 + Math.random() * 0.2,
          maxLife: 0.34,
          spin: (Math.random() - 0.5) * 10,
          grow: 1.2,
          mesh: slash
        });
      }
    }

    spawnBladeWaveFlare(fighter) {
      const originX = fighter.x + fighter.forwardX * 54;
      const originZ = fighter.z + fighter.forwardZ * 54;
      const color = 0xd8f2ff;
      for (let i = 0; i < 7; i++) {
        const wave = new THREE.Mesh(
          new THREE.BoxGeometry(0.08 + i * 0.018, 0.72 + i * 0.08, 0.035),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false })
        );
        wave.rotation.y = fighter.yaw;
        wave.rotation.z = -0.24 + i * 0.08;
        this.effectGroup.add(wave);
        this.effects.push({
          x: originX + fighter.forwardX * i * 18,
          y: fighter.y - 76,
          z: originZ + fighter.forwardZ * i * 18,
          vx: fighter.forwardX * (4.8 + i * 0.3),
          vy: 0,
          vz: fighter.forwardZ * (4.8 + i * 0.3),
          life: 0.18 + i * 0.025,
          maxLife: 0.34,
          grow: 0.7,
          mesh: wave
        });
      }
      for (let i = 0; i < 10; i++) {
        const spark = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.025, 0.36),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : color, transparent: true, opacity: 0.9, depthWrite: false })
        );
        spark.rotation.y = fighter.yaw + (Math.random() - 0.5) * 0.42;
        spark.rotation.z = (Math.random() - 0.5) * 0.5;
        this.effectGroup.add(spark);
        this.effects.push({
          x: originX + (Math.random() - 0.5) * 12,
          y: fighter.y - 72 + (Math.random() - 0.5) * 28,
          z: originZ + (Math.random() - 0.5) * 12,
          vx: fighter.forwardX * (3.2 + Math.random() * 2.4),
          vy: (Math.random() - 0.5) * 1.2,
          vz: fighter.forwardZ * (3.2 + Math.random() * 2.4),
          life: 0.18 + Math.random() * 0.18,
          maxLife: 0.3,
          mesh: spark
        });
      }
    }

    spawnBladeDiveFlare(fighter) {
      const color = 0xd8f2ff;
      const baseX = fighter.x + fighter.forwardX * 42;
      const baseZ = fighter.z + fighter.forwardZ * 42;
      for (let i = 0; i < 8; i++) {
        const trail = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.035, 0.92 + i * 0.08),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : color, transparent: true, opacity: 0.86, depthWrite: false })
        );
        trail.rotation.y = fighter.yaw;
        trail.rotation.x = -0.65 + i * 0.1;
        trail.rotation.z = -0.42 + i * 0.12;
        this.effectGroup.add(trail);
        this.effects.push({
          x: baseX + fighter.forwardX * (i * 8),
          y: fighter.y - 158 + i * 14,
          z: baseZ + fighter.forwardZ * (i * 8),
          vx: fighter.forwardX * 1.6,
          vy: 3.5 + i * 0.16,
          vz: fighter.forwardZ * 1.6,
          life: 0.2 + i * 0.025,
          maxLife: 0.38,
          grow: 0.9,
          mesh: trail
        });
      }
      for (let i = 0; i < 3; i++) {
        const crescent = new THREE.Mesh(
          new THREE.TorusGeometry(0.42 + i * 0.18, 0.018, 6, 52, Math.PI * 1.18),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false })
        );
        crescent.rotation.set(Math.PI / 2, 0, fighter.yaw + Math.PI / 2);
        this.effectGroup.add(crescent);
        this.effects.push({
          x: baseX + fighter.forwardX * 58,
          y: fighter.y - 12,
          z: baseZ + fighter.forwardZ * 58,
          vx: fighter.forwardX * 1.8,
          vy: -0.1,
          vz: fighter.forwardZ * 1.8,
          life: 0.28 + i * 0.05,
          maxLife: 0.38,
          grow: 1.1,
          mesh: crescent
        });
      }
    }

    spawnWave(fighter, type) {
      const mesh = new THREE.Mesh(
        type === "bladeWave" ? new THREE.BoxGeometry(0.18, 0.72, 0.04) : new THREE.SphereGeometry(type === "super" ? 0.34 : 0.22, 24, 16),
        new THREE.MeshBasicMaterial({ color: type === "super" ? 0xffd166 : type === "bladeWave" ? 0xd8f2ff : 0x7df9ff, transparent: true, opacity: 0.78 })
      );
      mesh.rotation.y = fighter.yaw;
      this.projectileGroup.add(mesh);
      this.projectiles.push({
        owner: fighter,
        x: fighter.x + fighter.forwardX * 72,
        y: fighter.y - 72,
        z: fighter.z + fighter.forwardZ * 72,
        vx: fighter.forwardX * (type === "super" ? 620 : type === "bladeWave" ? 560 : 480),
        vz: fighter.forwardZ * (type === "super" ? 620 : type === "bladeWave" ? 560 : 480),
        radius: type === "super" ? 34 : type === "bladeWave" ? 30 : 22,
        damage: type === "super" ? 18 : type === "bladeWave" ? 14 : 10,
        knockback: type === "super" ? 430 : type === "bladeWave" ? 360 : 260,
        life: 0.8,
        type,
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
          name: projectile.super ? "super" : projectile.type === "bladeWave" ? "bladeWave" : "special",
          label: projectile.super ? "Meteor Wave" : projectile.type === "bladeWave" ? "Limit Wave" : "Surge Wave",
          damage: projectile.damage,
          knockback: projectile.knockback,
          hitStun: projectile.super ? 0.44 : 0.28,
          meterGain: 0,
          sound: projectile.super ? "super" : "hitSpecial",
          spark: projectile.super ? "#ffffff" : projectile.type === "bladeWave" ? "#d8f2ff" : "#7df9ff"
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
      if (!attacker.attack) return;
      if (attacker.attack.multiHit) {
        if (attacker.attackHitCount >= attacker.attack.maxHits || attacker.attackHitCooldown > 0) return;
      } else if (attacker.attackHasHit) {
        return;
      }
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
      if (attacker.attack.multiHit) {
        attacker.attackHitCount += 1;
        attacker.attackHitCooldown = attacker.attack.hitInterval || 0.16;
        attacker.attackHasHit = attacker.attackHitCount >= attacker.attack.maxHits;
      } else {
        attacker.attackHasHit = true;
      }
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

    startVictoryCinematic(winner) {
      const winnerFighter = winner === "player" ? this.player : winner === "cpu" ? this.cpu : null;
      const loserFighter = winner === "player" ? this.cpu : winner === "cpu" ? this.player : null;
      if (winnerFighter && loserFighter) this.arrangeMatchVictoryScene(winnerFighter, loserFighter);
      this.victoryCinematic = {
        winner,
        winnerFighter,
        loserFighter,
        timer: 3.2,
        duration: 3.2,
        confettiTimer: 0,
        applauseTimer: 0.18,
        crowdTimer: 0.45
      };
      this.shake = Math.max(this.shake, winner === "draw" ? 2 : 4);
      if (winner === "player") {
        this.sound.play("crowd");
        this.sound.play("applause");
      } else if (winner === "cpu") {
        this.sound.play("applause");
      }
      this.spawnConfetti(winnerFighter || this.player, winner === "draw" ? 30 : 52);
    }

    arrangeMatchVictoryScene(winnerFighter, loserFighter) {
      const centerX = ARENA_WIDTH / 2;
      winnerFighter.x = centerX;
      winnerFighter.y = 0;
      winnerFighter.z = -28;
      winnerFighter.vx = 0;
      winnerFighter.vy = 0;
      winnerFighter.vz = 0;
      winnerFighter.onGround = true;
      winnerFighter.forwardX = 0;
      winnerFighter.forwardZ = -1;
      winnerFighter.facing = 1;
      winnerFighter.yaw = Math.PI;
      winnerFighter.attack = null;
      winnerFighter.hitStun = 0;
      winnerFighter.crouching = false;
      winnerFighter.guard = false;

      loserFighter.x = centerX + 118;
      loserFighter.y = 0;
      loserFighter.z = 78;
      loserFighter.vx = 0;
      loserFighter.vy = 0;
      loserFighter.vz = 0;
      loserFighter.onGround = true;
      loserFighter.forwardX = 0;
      loserFighter.forwardZ = -1;
      loserFighter.facing = 1;
      loserFighter.yaw = Math.PI;
      loserFighter.attack = null;
      loserFighter.hitStun = 0;
      loserFighter.crouching = false;
      loserFighter.guard = false;
    }

    updateVictoryCinematic(dt) {
      if (!this.victoryCinematic) return;
      const cinematic = this.victoryCinematic;
      cinematic.timer = Math.max(0, cinematic.timer - dt);
      cinematic.confettiTimer -= dt;
      cinematic.applauseTimer -= dt;
      cinematic.crowdTimer -= dt;
      if (cinematic.confettiTimer <= 0) {
        cinematic.confettiTimer = 0.18;
        this.spawnConfetti(cinematic.winnerFighter || this.player, cinematic.winner === "draw" ? 8 : 14);
      }
      if (cinematic.applauseTimer <= 0) {
        cinematic.applauseTimer = 0.72;
        this.sound.play("applause");
      }
      if (cinematic.winner === "player" && cinematic.crowdTimer <= 0) {
        cinematic.crowdTimer = 1.15;
        this.sound.play("crowd");
      }
    }

    spawnConfetti(fighter, count) {
      const colors = [0xffd166, 0x7df9ff, 0xff6b4a, 0xffffff, 0x56d6a6];
      const originX = fighter ? fighter.x : ARENA_WIDTH / 2;
      const originZ = fighter ? fighter.z : 0;
      for (let i = 0; i < count; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const life = 1.4 + Math.random() * 1.2;
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.045 + Math.random() * 0.035, 0.095 + Math.random() * 0.045),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
        );
        this.effectGroup.add(mesh);
        this.effects.push({
          x: originX + (Math.random() - 0.5) * 360,
          y: -210 - Math.random() * 80,
          z: originZ + (Math.random() - 0.5) * 210,
          vx: (Math.random() - 0.5) * 1.7,
          vy: 0.65 + Math.random() * 0.8,
          vz: (Math.random() - 0.5) * 1.7,
          life,
          maxLife: life,
          spin: (Math.random() - 0.5) * 12,
          baseOpacity: 0.95,
          mesh
        });
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
      const matchWon = this.playerRounds >= 2 || this.cpuRounds >= 2;
      this.player.winPose = winner === "player";
      this.player.losePose = winner === "cpu";
      this.cpu.winPose = winner === "cpu";
      this.cpu.losePose = winner === "player";
      this.showBanner(winner === "draw" ? "DRAW" : winner === "player" ? matchWon ? "MATCH WIN" : "ROUND WIN" : matchWon ? "MATCH LOST" : "ROUND LOST", 1.2);
      this.sound.play(winner === "player" ? "win" : "lose");
      if (matchWon) this.startVictoryCinematic(winner);
      window.setTimeout(() => {
        if (matchWon) {
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
      }, matchWon ? 3200 : 1200);
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
      rig.sword.visible = fighter.style === "sword";
      if (rig.sword.visible) {
        rig.blade.material.color.copy(new THREE.Color(fighter.flash > 0 ? "#ffffff" : fighter.accent));
        rig.bladeTip.material.color.copy(new THREE.Color(fighter.flash > 0 ? "#ffffff" : "#f4fbff"));
        rig.bladeSpine.material.color.copy(new THREE.Color(fighter.flash > 0 ? "#ffffff" : "#7fa4b8"));
        rig.guard.material.color.copy(dark);
        rig.grip.material.color.copy(dark);
      }

      const walk = fighter.state === "walk" ? Math.sin(time / 80) : 0;
      const isCrouch = fighter.crouching || fighter.state === "crouchLight" || fighter.state === "crouchHeavy";
      const crouch = isCrouch ? -0.36 : fighter.state === "guard" ? -0.12 : 0;
      [rig.armL, rig.armR, rig.handL, rig.handR, rig.legL, rig.legR, rig.bootL, rig.bootR].forEach((part) => part.scale.set(1, 1, 1));
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
      rig.shoulderL.position.set(-0.36, 1.2 + crouch, 0);
      rig.shoulderR.position.set(0.36, 1.2 + crouch, 0);
      const armSwing = walk * 0.08;
      this.setVoxelLimb(rig.armL, { x: -0.38, y: 1.12 + crouch, z: 0 }, { x: -0.42, y: 0.68 + crouch - armSwing, z: 0.02 }, 0.66);
      this.setVoxelLimb(rig.armR, { x: 0.38, y: 1.12 + crouch, z: 0 }, { x: 0.42, y: 0.68 + crouch + armSwing, z: 0.02 }, 0.66);
      rig.handL.position.set(-0.42, 0.58 + crouch - armSwing, 0.02);
      rig.handR.position.set(0.42, 0.58 + crouch + armSwing, 0.02);
      this.setVoxelLimb(rig.legL, { x: -0.17, y: 0.54 + crouch * 0.2, z: 0.04 }, { x: -0.2, y: 0.14, z: 0.07 }, 0.64);
      this.setVoxelLimb(rig.legR, { x: 0.17, y: 0.54 + crouch * 0.2, z: -0.04 }, { x: 0.2, y: 0.14, z: -0.02 }, 0.64);
      rig.bootL.position.set(-0.2, 0.03, 0.1);
      rig.bootR.position.set(0.2, 0.03, 0.01);
      rig.shoulderL.rotation.copy(rig.armL.rotation);
      rig.shoulderR.rotation.copy(rig.armR.rotation);
      rig.handL.rotation.copy(rig.armL.rotation);
      rig.handR.rotation.copy(rig.armR.rotation);
      rig.bootL.rotation.copy(rig.legL.rotation);
      rig.bootR.rotation.copy(rig.legR.rotation);
      if (fighter.state === "light" || fighter.state === "heavy" || fighter.state === "bladeLight" || fighter.state === "bladeHeavy" || fighter.state === "special" || fighter.state === "bladeWave" || fighter.state === "bladeDive" || fighter.state === "shoryuken" || fighter.state === "dragonDance" || fighter.state === "tornado" || fighter.state === "super") {
        const total = fighter.attack ? fighter.attack.startup + fighter.attack.active + fighter.attack.recovery : 1;
        const progress = fighter.attack ? Math.min(1, fighter.attackTimer / total) : 1;
        const charge = Math.sin(Math.min(1, progress * 1.35) * Math.PI);
        const reachPose = fighter.state === "light" ? 0.46 : fighter.state === "heavy" || fighter.state === "bladeHeavy" ? 0.66 : fighter.state === "bladeLight" ? 0.58 : fighter.state === "bladeWave" || fighter.state === "bladeDive" ? 0.76 : fighter.state === "shoryuken" || fighter.state === "dragonDance" ? 0.42 : fighter.state === "tornado" ? 0.72 : fighter.state === "super" ? 0.98 : 0.84;
        rig.armR.position.set(0.18, 1.08 + crouch + charge * 0.08, reachPose + charge * (fighter.state === "super" ? 0.22 : 0.14));
        rig.armR.rotation.x = fighter.state === "bladeDive" ? 0.72 - charge * 1.35 : fighter.state === "shoryuken" || fighter.state === "dragonDance" ? -0.16 : Math.PI / 2 + (fighter.state === "super" ? charge * 0.38 : 0);
        rig.armR.rotation.y = fighter.state === "heavy" || fighter.state === "bladeHeavy" ? -0.28 : fighter.state === "bladeLight" || fighter.state === "bladeWave" ? Math.sin(progress * Math.PI * 2) * 0.44 : fighter.state === "tornado" ? Math.sin(progress * Math.PI * 8) * 0.55 : fighter.state === "dragonDance" ? Math.sin(progress * Math.PI * 10) * 0.42 : fighter.state === "super" ? Math.sin(progress * Math.PI * 2) * 0.22 : 0;
        rig.armR.rotation.z = fighter.state === "bladeLight" || fighter.state === "bladeHeavy" || fighter.state === "bladeWave" ? -0.72 + charge * 0.62 : fighter.state === "shoryuken" || fighter.state === "dragonDance" ? -0.18 : fighter.state === "tornado" ? Math.sin(progress * Math.PI * 8) * 0.7 : fighter.state === "super" ? -0.38 + charge * 0.28 : 0;
        rig.armL.position.set(-0.24, 1.0 + crouch + charge * 0.18, fighter.state === "super" ? 0.62 : 0.24);
        rig.armL.rotation.x = fighter.state === "shoryuken" || fighter.state === "dragonDance" ? 1.04 : fighter.state === "super" ? Math.PI / 2 - charge * 0.36 : 0.45 + charge * 0.42;
        rig.handR.position.set(0.18, 0.74 + crouch + charge * 0.08, reachPose + 0.4 + charge * 0.16);
        rig.handR.rotation.copy(rig.armR.rotation);
        rig.handL.position.set(-0.24, 0.62 + crouch + charge * 0.18, fighter.state === "super" ? 0.94 : 0.48);
        rig.handL.rotation.copy(rig.armL.rotation);
        rig.shoulderL.position.set(-0.26, 1.18 + crouch + charge * 0.08, 0.1);
        rig.shoulderR.position.set(0.22, 1.22 + crouch + charge * 0.04, 0.18);
        rig.shoulderL.rotation.copy(rig.armL.rotation);
        rig.shoulderR.rotation.copy(rig.armR.rotation);
        if (fighter.state === "special" || fighter.state === "bladeWave" || fighter.state === "bladeDive" || fighter.state === "shoryuken" || fighter.state === "dragonDance" || fighter.state === "tornado" || fighter.state === "super") {
          rig.body.rotation.x = -0.14 - charge * (fighter.state === "super" ? 0.22 : 0.12);
          rig.head.position.y += charge * 0.1;
          rig.group.scale.setScalar(1 + charge * (fighter.state === "super" ? 0.18 : 0.1));
          if (fighter.state === "shoryuken" || fighter.state === "dragonDance") {
            const spin = progress * Math.PI * (fighter.state === "dragonDance" ? 7 : 3.2);
            rig.group.rotation.y += spin;
            rig.body.rotation.z = -0.08 + charge * 0.16;
            rig.handR.position.set(0.14, 1.64 + charge * 0.2, 0.28);
            rig.handR.rotation.copy(rig.armR.rotation);
            rig.legL.rotation.x = -0.28 - charge * 0.35;
            rig.legR.rotation.x = 0.48 + charge * 0.28;
          }
          if (fighter.state === "bladeDive") {
            const windup = Math.min(1, progress / 0.34);
            const chop = Math.max(0, Math.min(1, (progress - 0.34) / 0.34));
            rig.group.rotation.y += Math.sin(progress * Math.PI) * 0.58;
            rig.body.rotation.x = -0.36 - windup * 0.36 + chop * 0.92;
            rig.head.position.y += windup * 0.12;
            rig.handR.position.set(0.08, 1.72 - chop * 0.74, 0.62 + chop * 0.34);
            rig.handL.position.set(-0.1, 1.58 - chop * 0.58, 0.54 + chop * 0.3);
            rig.legL.rotation.x = -0.42 - windup * 0.3;
            rig.legR.rotation.x = 0.58 + chop * 0.36;
          }
          if (fighter.state === "tornado") {
            const spin = progress * Math.PI * 8;
            rig.body.rotation.y = spin;
            rig.legL.rotation.x = Math.PI / 2 + Math.sin(spin) * 0.4;
            rig.legR.rotation.x = Math.PI / 2 + Math.cos(spin) * 0.4;
            rig.bootL.position.set(-0.18, 0.48 + Math.cos(spin) * 0.08, 0.68);
            rig.bootR.position.set(0.18, 0.48 + Math.sin(spin) * 0.08, 0.68);
            rig.bootL.rotation.copy(rig.legL.rotation);
            rig.bootR.rotation.copy(rig.legR.rotation);
          }
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
      } else if (fighter.state !== "special" && fighter.state !== "bladeWave" && fighter.state !== "bladeDive" && fighter.state !== "shoryuken" && fighter.state !== "dragonDance" && fighter.state !== "tornado" && fighter.state !== "super") {
        rig.body.rotation.x = 0;
        rig.body.rotation.y = 0;
      }
      this.syncSwordPose(rig, fighter, time);
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

      this.syncVictoryPose(rig, fighter, time);
      this.syncAttackCue(rig, fighter);
    }

    syncSwordPose(rig, fighter, time) {
      if (!rig.sword.visible) return;
      const total = fighter.attack ? fighter.attack.startup + fighter.attack.active + fighter.attack.recovery : 1;
      const progress = fighter.attack ? Math.min(1, fighter.attackTimer / total) : 0;
      const swing = Math.sin(progress * Math.PI);
      rig.sword.position.set(0.44, 0.9, 0.05);
      rig.sword.rotation.set(-0.82, 0.24, -0.72);
      rig.sword.scale.set(1.05, 1.08, 1.05);
      if (fighter.state === "walk") {
        rig.sword.rotation.z += Math.sin(time / 80) * 0.08;
      }
      if (fighter.state === "bladeLight") {
        rig.sword.position.set(0.6, 1.08, 0.66 + swing * 0.24);
        rig.sword.rotation.set(1.18 - swing * 1.48, -0.35 + swing * 1.24, -1.12 + swing * 2.24);
      } else if (fighter.state === "bladeHeavy") {
        rig.sword.position.set(0.5, 1.24, 0.62 + swing * 0.38);
        rig.sword.rotation.set(1.66 - swing * 2.28, -0.72 + swing * 1.7, -1.85 + swing * 3.35);
        rig.sword.scale.set(1.14, 1.2, 1.08);
      } else if (fighter.state === "bladeWave") {
        rig.sword.position.set(0.4, 1.2 + swing * 0.06, 0.72 + swing * 0.34);
        rig.sword.rotation.set(Math.PI / 2 - swing * 0.8, 0.08, -0.28 + swing * 0.72);
        rig.sword.scale.set(1.12, 1.22, 1.08);
      } else if (fighter.state === "bladeDive") {
        const windup = Math.min(1, progress / 0.34);
        const chop = Math.max(0, Math.min(1, (progress - 0.34) / 0.3));
        const follow = Math.max(0, Math.min(1, (progress - 0.64) / 0.28));
        const anticipation = Math.sin(windup * Math.PI / 2);
        const slam = 1 - Math.pow(1 - chop, 3);
        rig.sword.position.set(
          0.18 + anticipation * 0.08 - slam * 0.2,
          1.36 + anticipation * 0.74 - slam * 1.02 + follow * 0.24,
          0.32 + anticipation * 0.2 + slam * 0.88
        );
        rig.sword.rotation.set(
          -1.02 + anticipation * 2.75 + slam * 2.95 - follow * 0.52,
          0.08 + anticipation * 0.12 - slam * 0.08,
          -0.18 - anticipation * 0.38 + slam * 0.18
        );
        rig.sword.scale.set(1.22 + slam * 0.16, 1.38 + slam * 0.22, 1.14);
      } else if (fighter.state === "super") {
        rig.sword.position.set(0.5, 1.18, 0.58 + swing * 0.28);
        rig.sword.rotation.set(Math.PI / 2, 0.2, -0.62 + swing);
      }
    }

    syncVictoryPose(rig, fighter, time) {
      const cinematic = this.victoryCinematic;
      if (!cinematic) return;
      const pulse = Math.sin(time / 160);
      if (fighter === cinematic.winnerFighter) {
        rig.group.rotation.z = pulse * 0.04;
        rig.group.scale.setScalar(1.12 + Math.max(0, pulse) * 0.03);
        rig.body.rotation.x = -0.08;
        rig.head.position.y += 0.08;
        this.setVoxelLimb(rig.armL, { x: -0.38, y: 1.24, z: 0.1 }, { x: -0.68, y: 1.72 + pulse * 0.04, z: 0.12 }, 0.66);
        this.setVoxelLimb(rig.armR, { x: 0.38, y: 1.24, z: 0.1 }, { x: 0.68, y: 1.72 + pulse * 0.04, z: 0.12 }, 0.66);
        rig.shoulderL.position.set(-0.38, 1.24, 0.08);
        rig.shoulderR.position.set(0.38, 1.24, 0.08);
        rig.shoulderL.rotation.copy(rig.armL.rotation);
        rig.shoulderR.rotation.copy(rig.armR.rotation);
        rig.handL.position.set(-0.68, 1.74 + pulse * 0.04, 0.12);
        rig.handR.position.set(0.68, 1.74 + pulse * 0.04, 0.12);
        rig.handL.rotation.copy(rig.armL.rotation);
        rig.handR.rotation.copy(rig.armR.rotation);
        return;
      }
      if (fighter !== cinematic.loserFighter) return;
      rig.group.rotation.z = 0;
      rig.group.scale.setScalar(0.98);
      const clap = Math.abs(Math.sin(time / 95));
      rig.body.rotation.x = 0.12;
      rig.head.position.y -= 0.08;
      this.setVoxelLimb(rig.armL, { x: -0.36, y: 1.12, z: 0.08 }, { x: -0.06 - clap * 0.09, y: 0.94, z: 0.58 }, 0.66);
      this.setVoxelLimb(rig.armR, { x: 0.36, y: 1.12, z: 0.08 }, { x: 0.06 + clap * 0.09, y: 0.94, z: 0.58 }, 0.66);
      rig.shoulderL.position.set(-0.36, 1.12, 0.08);
      rig.shoulderR.position.set(0.36, 1.12, 0.08);
      rig.shoulderL.rotation.copy(rig.armL.rotation);
      rig.shoulderR.rotation.copy(rig.armR.rotation);
      rig.handL.position.set(-0.05 - clap * 0.12, 0.92, 0.69);
      rig.handR.position.set(0.05 + clap * 0.12, 0.92, 0.69);
      rig.handL.rotation.copy(rig.armL.rotation);
      rig.handR.rotation.copy(rig.armR.rotation);
    }

    setVoxelLimb(part, start, end, baseLength) {
      const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
      const length = Math.max(0.001, direction.length());
      part.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
      direction.normalize();
      part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      part.scale.set(1, length / baseLength, 1);
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
        bladeLight: 0xd8f2ff,
        bladeHeavy: 0xb9e7ff,
        special: 0x7df9ff,
        bladeWave: 0xd8f2ff,
        bladeDive: 0xffffff,
        shoryuken: 0xff8a2a,
        dragonDance: 0xffb347,
        tornado: 0xffd166,
        super: 0xffffff,
        throw: 0xcaff70,
        crouchLight: 0xcaff70,
        crouchHeavy: 0x86ff62
      };
      const color = colorMap[attack.name] || 0xffffff;
      const reach = attack.name === "throw" ? 0.42 : attack.range / 82;
      const size = attack.name === "light" || attack.name === "crouchLight" ? 0.58 : attack.name === "bladeLight" ? 1.0 : attack.name === "heavy" || attack.name === "crouchHeavy" ? 0.86 : attack.name === "bladeHeavy" || attack.name === "bladeWave" ? 1.32 : attack.name === "bladeDive" ? 1.46 : attack.name === "shoryuken" ? 1.25 : attack.name === "dragonDance" ? 1.5 : attack.name === "tornado" ? 1.18 : attack.name === "super" ? 1.45 : 1.05;
      const forward = 0.48 + reach * 0.36 + Math.sin(progress * Math.PI) * 0.22;
      const lateral = attack.name === "heavy" ? Math.sin(progress * Math.PI * 2) * 0.08 : 0;

      rig.attack.scale.set(reach * size, attack.height / 92, (attack.depth || 80) / 72);
      rig.attack.position.set(lateral, attack.level === "low" ? 0.42 : 0.98, forward);
      rig.attack.material.color.set(color);
      rig.attack.material.opacity = isActive ? 0.42 : 0.18;

      rig.attackCore.position.set(lateral, (attack.level === "low" ? 0.48 : 1.08) + Math.sin(progress * Math.PI) * 0.16, forward + 0.28);
      rig.attackCore.scale.setScalar(attack.name === "super" ? 1.9 : attack.name === "dragonDance" ? 1.7 : attack.name === "bladeDive" ? 1.65 : attack.name === "shoryuken" ? 1.45 : attack.name === "tornado" ? 1.5 : attack.name === "special" || attack.name === "bladeWave" ? 1.35 : attack.name === "heavy" || attack.name === "bladeHeavy" ? 1.08 : 0.82);
      rig.attackCore.material.color.set(color);
      rig.attackCore.material.opacity = isActive ? 0.95 : 0.45;

      rig.attackRing.position.copy(rig.attackCore.position);
      rig.attackRing.rotation.set(Math.PI / 2, 0, progress * Math.PI * 3);
      rig.attackRing.scale.setScalar(attack.name === "super" ? 1.75 : attack.name === "dragonDance" ? 1.55 : attack.name === "bladeDive" ? 1.5 : attack.name === "shoryuken" ? 1.38 : attack.name === "tornado" ? 1.45 : attack.name === "heavy" || attack.name === "bladeHeavy" ? 1.25 : 1);
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
      if (this.victoryCinematic && this.victoryCinematic.winnerFighter) {
        const { winnerFighter, timer, duration } = this.victoryCinematic;
        const progress = 1 - Math.max(0, timer / duration);
        const ease = 1 - Math.pow(1 - progress, 3);
        const fighterWorld = this.toWorld(winnerFighter.x, winnerFighter.y - 96, winnerFighter.z);
        const forward = new THREE.Vector3(winnerFighter.forwardX || 0, 0, winnerFighter.forwardZ || -1).normalize();
        const distance = 3.25 - ease * 1.05;
        const height = 0.42 + Math.sin(progress * Math.PI) * 0.24;
        this.camera.position.copy(fighterWorld)
          .add(forward.clone().multiplyScalar(distance))
          .add(new THREE.Vector3(0, height, 0));
        this.camera.lookAt(fighterWorld.clone().add(new THREE.Vector3(0, 0.82, 0)));
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
        this.getFighterOcclusionTarget(this.playerRig),
        this.getFighterOcclusionTarget(this.cpuRig)
      ];
      this.backdropOccluders.forEach((occluder) => {
        occluder.visible = true;
      });
      for (const occluder of this.backdropOccluders) {
        const meshes = occluder.userData.occlusionMeshes || [];
        occluder.visible = !this.isBackdropOnCameraSide(occluder) && !targets.some((target) => this.isBackdropBlockingTarget(meshes, target));
      }
    }

    getFighterOcclusionTarget(rig) {
      const center = rig.group.position.clone().add(new THREE.Vector3(0, 0.96, 0));
      const points = [
        center.clone().add(new THREE.Vector3(-0.46, -0.82, 0)),
        center.clone().add(new THREE.Vector3(0.46, -0.82, 0)),
        center.clone().add(new THREE.Vector3(-0.46, 0.74, 0)),
        center.clone().add(new THREE.Vector3(0.46, 0.74, 0))
      ];
      return {
        world: center,
        screenBounds: this.getProjectedBounds(points, 0.035)
      };
    }

    isBackdropBlockingTarget(meshes, target) {
      if (!target.screenBounds) return false;
      const blockingMesh = meshes.find((mesh) => {
        const bounds = this.getObjectScreenBounds(mesh, 0.01);
        return bounds && this.screenBoundsOverlap(bounds, target.screenBounds);
      });
      if (blockingMesh) return true;

      const toTarget = target.world.clone().sub(this.camera.position);
      const distance = toTarget.length();
      if (distance <= 0.25) return false;
      this.occlusionRaycaster.set(this.camera.position, toTarget.normalize());
      this.occlusionRaycaster.near = 0.1;
      this.occlusionRaycaster.far = distance - 0.25;
      return this.occlusionRaycaster.intersectObjects(meshes, false).length > 0;
    }

    isBackdropOnCameraSide(occluder) {
      const side = occluder.userData.side || 0;
      if (!side) return false;
      return this.camera.position.z * side > occluder.position.z * side - 0.12;
    }

    getObjectScreenBounds(object, padding = 0) {
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return null;
      const points = [
        new THREE.Vector3(box.min.x, box.min.y, box.min.z),
        new THREE.Vector3(box.min.x, box.min.y, box.max.z),
        new THREE.Vector3(box.min.x, box.max.y, box.min.z),
        new THREE.Vector3(box.min.x, box.max.y, box.max.z),
        new THREE.Vector3(box.max.x, box.min.y, box.min.z),
        new THREE.Vector3(box.max.x, box.min.y, box.max.z),
        new THREE.Vector3(box.max.x, box.max.y, box.min.z),
        new THREE.Vector3(box.max.x, box.max.y, box.max.z)
      ];
      return this.getProjectedBounds(points, padding);
    }

    getProjectedBounds(points, padding = 0) {
      const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      let visiblePointCount = 0;
      points.forEach((point) => {
        const projected = point.clone().project(this.camera);
        if (projected.z < -1 || projected.z > 1) return;
        visiblePointCount += 1;
        bounds.minX = Math.min(bounds.minX, projected.x);
        bounds.maxX = Math.max(bounds.maxX, projected.x);
        bounds.minY = Math.min(bounds.minY, projected.y);
        bounds.maxY = Math.max(bounds.maxY, projected.y);
      });
      if (!visiblePointCount) return null;
      bounds.minX -= padding;
      bounds.maxX += padding;
      bounds.minY -= padding;
      bounds.maxY += padding;
      return bounds;
    }

    screenBoundsOverlap(a, b) {
      return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
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
