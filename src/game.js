(function () {
  const { Fighter, rectsOverlap } = window.StreetClashFighter;

  const difficultyProfiles = {
    easy: { reaction: 0.52, aggression: 0.4, defense: 0.28, speed: 230, punish: 0.22 },
    normal: { reaction: 0.34, aggression: 0.62, defense: 0.45, speed: 265, punish: 0.38 },
    hard: { reaction: 0.22, aggression: 0.78, defense: 0.62, speed: 302, punish: 0.58 }
  };

  const fighterSkins = {
    ryu: { color: "#2f80ed", accent: "#ffd166", dark: "#111722" },
    ken: { color: "#e94f64", accent: "#ffd166", dark: "#201016" },
    chun: { color: "#56d6a6", accent: "#7df9ff", dark: "#09231f" }
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
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.width = canvas.width;
      this.height = canvas.height;
      this.floorY = 438;
      this.input = options.input;
      this.onRoundEnd = options.onRoundEnd;
      this.settings = options.settings;
      this.sound = new SoundEngine(this.settings.volume);
      this.player = new Fighter({ name: "PLAYER", x: 210, color: "#2f80ed", accent: "#ffd166", dark: "#111722" });
      this.cpu = new Fighter({ name: "CPU", x: 750, color: "#e94f64", accent: "#56d6a6", dark: "#201016", isCpu: true });
      this.roundTime = 60;
      this.finished = false;
      this.matchFinished = false;
      this.cpuThinkTimer = 0;
      this.cpuPlan = "idle";
      this.cpuMood = "measuring";
      this.hitStop = 0;
      this.shake = 0;
      this.slowMotion = 0;
      this.banner = "";
      this.bannerTimer = 0;
      this.effects = [];
      this.projectiles = [];
      this.combo = { owner: null, hits: 0, damage: 0, timer: 0 };
      this.bestPlayerCombo = 0;
      this.playerRounds = 0;
      this.cpuRounds = 0;
      this.roundNumber = 1;
      this.lastResult = null;
    }

    reset(settings) {
      this.settings = settings || this.settings;
      this.sound.setVolume(this.settings.volume);
      this.applyCosmetics();
      this.playerRounds = 0;
      this.cpuRounds = 0;
      this.roundNumber = 1;
      this.matchFinished = false;
      this.lastResult = null;
      this.startRound();
    }

    startRound() {
      this.player.reset(210);
      this.cpu.reset(750);
      this.roundTime = 60;
      this.finished = false;
      this.cpuThinkTimer = 0;
      this.cpuPlan = "idle";
      this.cpuMood = "measuring";
      this.hitStop = 0;
      this.shake = 0;
      this.slowMotion = 0;
      this.effects = [];
      this.projectiles = [];
      this.combo = { owner: null, hits: 0, damage: 0, timer: 0 };
      this.showBanner(`ROUND ${this.roundNumber}`, 1.0);
      this.sound.play("round");
    }

    applyCosmetics() {
      const skin = fighterSkins[this.settings.fighter] || fighterSkins.ryu;
      Object.assign(this.player, skin);
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
      this.handlePlayerInput();
      this.handleCpu(dt);
      this.updateProjectiles(dt);
      this.player.update(dt, this.width);
      this.cpu.update(dt, this.width);
      this.separateFighters();
      this.resolveAttack(this.player, this.cpu);
      this.resolveAttack(this.cpu, this.player);
      this.resolveProjectiles();
      this.updateEffects(dt);
      this.checkRoundEnd();
    }

    handlePlayerInput() {
      const p = this.player;
      p.guard = this.input.isDown("guard") && p.onGround && !p.attack;
      if (!p.canAct()) return;
      const speed = p.guard ? 92 : 306;
      if (!p.attack) {
        if (this.input.isDown("left")) p.vx = -speed;
        if (this.input.isDown("right")) p.vx = speed;
        if (this.input.consume("jump") && p.onGround && !p.guard) {
          p.vy = -680;
          p.onGround = false;
        }
      }
      if (p.guard && this.input.consume("heavy")) this.tryAttack(p, "throw");
      if (!p.guard) {
        if (this.input.consume("light")) this.tryAttack(p, "light");
        if (this.input.consume("heavy")) this.tryAttack(p, "heavy");
        if (this.input.consume("special")) this.tryAttack(p, p.meter >= 100 ? "super" : "special");
      }
    }

    handleCpu(dt) {
      const cpu = this.cpu;
      const player = this.player;
      const profile = difficultyProfiles[this.settings.difficulty] || difficultyProfiles.normal;
      cpu.guard = false;
      if (!cpu.canAct() || cpu.attack) return;

      this.cpuThinkTimer -= dt;
      const distance = Math.abs(player.x - cpu.x);
      if (this.cpuThinkTimer <= 0) {
        this.cpuThinkTimer = profile.reaction + Math.random() * 0.13;
        if (player.attack && distance < 135 && Math.random() < profile.defense) {
          this.cpuPlan = "guard";
          this.cpuMood = "reading";
        } else if (player.attack && distance < 115 && Math.random() < profile.punish) {
          this.cpuPlan = "punish";
          this.cpuMood = "punish";
        } else if (distance > 210) {
          this.cpuPlan = Math.random() < 0.18 && cpu.meter >= 35 ? "special" : "approach";
          this.cpuMood = "closing";
        } else if (distance < 58) {
          this.cpuPlan = Math.random() < 0.55 ? "throw" : "retreat";
          this.cpuMood = "scramble";
        } else if (Math.random() < profile.aggression) {
          this.cpuPlan = cpu.meter >= 100 && Math.random() < 0.22 ? "super" : Math.random() < 0.56 ? "light" : "heavy";
          this.cpuMood = "attacking";
        } else {
          this.cpuPlan = Math.random() < 0.5 ? "guard" : "retreat";
          this.cpuMood = "measuring";
        }
      }

      if (this.cpuPlan === "approach") cpu.vx = Math.sign(player.x - cpu.x) * profile.speed;
      if (this.cpuPlan === "retreat") cpu.vx = -Math.sign(player.x - cpu.x) * profile.speed * 0.78;
      if (this.cpuPlan === "guard") cpu.guard = cpu.onGround;
      if (this.cpuPlan === "punish") {
        if (distance < 115) this.tryAttack(cpu, "heavy");
        else cpu.vx = Math.sign(player.x - cpu.x) * profile.speed;
      }
      if (["light", "heavy", "special", "super", "throw"].includes(this.cpuPlan)) {
        const needRange = this.cpuPlan === "throw" ? 60 : this.cpuPlan === "special" || this.cpuPlan === "super" ? 150 : 118;
        if (distance < needRange) this.tryAttack(cpu, this.cpuPlan);
        else cpu.vx = Math.sign(player.x - cpu.x) * profile.speed;
      }
    }

    tryAttack(fighter, type) {
      if (!fighter.startAttack(type)) return false;
      this.sound.play(type === "super" ? "super" : "menu");
      if (type === "special" || type === "super") {
        this.spawnWave(fighter, type);
        this.shake = Math.max(this.shake, type === "super" ? 8 : 4);
      }
      return true;
    }

    spawnWave(fighter, type) {
      this.projectiles.push({
        owner: fighter,
        x: fighter.x + fighter.facing * 72,
        y: fighter.y - 72,
        vx: fighter.facing * (type === "super" ? 620 : 480),
        radius: type === "super" ? 34 : 22,
        damage: type === "super" ? 18 : 10,
        knockback: type === "super" ? 430 : 260,
        life: 0.8,
        super: type === "super",
        hit: false
      });
    }

    updateProjectiles(dt) {
      for (const projectile of this.projectiles) {
        projectile.x += projectile.vx * dt;
        projectile.life -= dt;
      }
      this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0 && projectile.x > -80 && projectile.x < this.width + 80 && !projectile.hit);
    }

    resolveProjectiles() {
      for (const projectile of this.projectiles) {
        const defender = projectile.owner === this.player ? this.cpu : this.player;
        const box = {
          x: projectile.x - projectile.radius,
          y: projectile.y - projectile.radius,
          width: projectile.radius * 2,
          height: projectile.radius * 2
        };
        if (!rectsOverlap(box, defender.bounds)) continue;
        const blocked = defender.guard && defender.facing === -projectile.owner.facing && defender.onGround;
        const attack = {
          name: projectile.super ? "super" : "special",
          damage: projectile.damage,
          knockback: projectile.knockback,
          hitStun: projectile.super ? 0.44 : 0.28,
          meterGain: 0,
          sound: projectile.super ? "super" : "hitSpecial",
          spark: projectile.super ? "#ffffff" : "#7df9ff"
        };
        this.applyHit(projectile.owner, defender, attack, blocked, projectile.x, this.floorY + projectile.y);
        projectile.hit = true;
      }
    }

    faceEachOther() {
      this.player.facing = this.player.x <= this.cpu.x ? 1 : -1;
      this.cpu.facing = this.cpu.x <= this.player.x ? 1 : -1;
    }

    separateFighters() {
      const gap = this.cpu.x - this.player.x;
      const minGap = 50;
      if (Math.abs(gap) >= minGap) return;
      const push = (minGap - Math.abs(gap)) / 2;
      const dir = gap >= 0 ? 1 : -1;
      this.player.x -= push * dir;
      this.cpu.x += push * dir;
    }

    resolveAttack(attacker, defender) {
      if (!attacker.attack || attacker.attackHasHit) return;
      const attackBox = attacker.attackBox();
      if (!attackBox || !rectsOverlap(attackBox, defender.bounds)) return;
      const blocked = !attacker.attack.unblockable && defender.guard && defender.facing === -attacker.facing && defender.onGround;
      const sparkX = attacker.facing > 0 ? attackBox.x + attackBox.width : attackBox.x;
      const sparkY = this.floorY + attackBox.y + attackBox.height * 0.45;
      this.applyHit(attacker, defender, attacker.attack, blocked, sparkX, sparkY);
      attacker.attackHasHit = true;
    }

    applyHit(attacker, defender, attack, blocked, sparkX, sparkY) {
      const damage = defender.takeHit(attack, attacker.facing, blocked);
      attacker.gainMeter(attack.meterGain || 0);
      this.hitStop = blocked ? 0.035 : attack.name === "super" ? 0.12 : 0.065;
      this.shake = Math.max(this.shake, blocked ? 3 : attack.name === "super" ? 15 : 8);
      this.slowMotion = attack.name === "super" && !blocked ? 0.32 : this.slowMotion;
      this.sound.play(blocked ? "block" : attack.sound);
      this.spawnSpark(sparkX, sparkY, blocked ? "#7df9ff" : attack.spark, attack.name, blocked);

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

    spawnSpark(x, y, color, type, blocked) {
      const count = type === "super" ? 30 : blocked ? 9 : 18;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
        const speed = (blocked ? 90 : 160) + Math.random() * (type === "super" ? 300 : 170);
        this.effects.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: blocked ? 3 : 4 + Math.random() * 6,
          life: 0.28 + Math.random() * 0.24,
          color
        });
      }
    }

    updateEffects(dt) {
      for (const effect of this.effects) {
        effect.x += effect.vx * dt;
        effect.y += effect.vy * dt;
        effect.vy += 420 * dt;
        effect.life -= dt;
      }
      this.effects = this.effects.filter((effect) => effect.life > 0);
    }

    showBanner(text, seconds) {
      this.banner = text;
      this.bannerTimer = seconds;
    }

    checkRoundEnd() {
      if (this.finished) return;
      let winner = null;
      if (this.player.hp <= 0 && this.cpu.hp <= 0) winner = "draw";
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
      const ctx = this.ctx;
      const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
      const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.save();
      ctx.translate(shakeX, shakeY);
      this.drawBackground(ctx);
      this.drawProjectiles(ctx);
      this.player.draw(ctx, this.floorY, performance.now());
      this.cpu.draw(ctx, this.floorY, performance.now());
      this.drawEffects(ctx);
      ctx.restore();
      this.drawMessage(ctx);
    }

    drawBackground(ctx) {
      const stage = this.settings.stage || "metro";
      const sky = ctx.createLinearGradient(0, 0, 0, this.height);
      if (stage === "dojo") {
        sky.addColorStop(0, "#1f2736");
        sky.addColorStop(0.5, "#586070");
        sky.addColorStop(1, "#242019");
      } else if (stage === "harbor") {
        sky.addColorStop(0, "#47235d");
        sky.addColorStop(0.5, "#d56b4c");
        sky.addColorStop(1, "#172030");
      } else {
        sky.addColorStop(0, "#11162d");
        sky.addColorStop(0.48, "#283b5d");
        sky.addColorStop(1, "#18191f");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, this.width, this.height);

      const time = performance.now() / 1000;
      ctx.fillStyle = stage === "dojo" ? "#3a2f29" : stage === "harbor" ? "#27304a" : "#20243a";
      for (let x = -20; x < this.width; x += 110) {
        const h = 130 + Math.abs(Math.sin(x * 0.02)) * 95;
        if (stage === "dojo") {
          ctx.fillRect(x, this.floorY - 104, 78, 80);
          ctx.fillStyle = "#ffd166";
          ctx.fillRect(x + 10, this.floorY - 90, 58, 10);
        } else {
          ctx.fillRect(x, this.floorY - h - 24, 72, h);
          ctx.fillStyle = Math.sin(time * 3 + x) > 0 ? "#ffd166" : "#56d6a6";
          for (let y = this.floorY - h; y < this.floorY - 42; y += 30) {
            ctx.fillRect(x + 14, y, 10, 12);
            ctx.fillRect(x + 42, y + 5, 10, 12);
          }
        }
        ctx.fillStyle = stage === "dojo" ? "#3a2f29" : stage === "harbor" ? "#27304a" : "#20243a";
      }

      ctx.fillStyle = stage === "harbor" ? "rgba(125, 249, 255, 0.22)" : "rgba(255, 209, 102, 0.28)";
      for (let i = 0; i < 7; i++) {
        const x = 90 + i * 130;
        ctx.beginPath();
        ctx.ellipse(x, this.floorY - 42 + Math.sin(time * 2 + i) * 3, 18, 34, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#34394c";
      ctx.fillRect(0, this.floorY, this.width, this.height - this.floorY);
      ctx.fillStyle = "#202331";
      for (let x = -80 + (time * 35) % 80; x < this.width; x += 80) {
        ctx.fillRect(x, this.floorY + 32, 48, 7);
      }
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(0, this.floorY, this.width, 4);
    }

    drawProjectiles(ctx) {
      for (const projectile of this.projectiles) {
        const gradient = ctx.createRadialGradient(projectile.x, this.floorY + projectile.y, 4, projectile.x, this.floorY + projectile.y, projectile.radius);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.45, projectile.super ? "#ffd166" : "#7df9ff");
        gradient.addColorStop(1, "rgba(125, 249, 255, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(projectile.x, this.floorY + projectile.y, projectile.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawEffects(ctx) {
      for (const effect of this.effects) {
        ctx.globalAlpha = Math.max(0, effect.life * 3);
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawMessage(ctx) {
      if (this.bannerTimer > 0 && this.banner) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.bannerTimer * 2);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        ctx.lineWidth = 8;
        ctx.font = "900 46px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.strokeText(this.banner, this.width / 2, 158);
        ctx.fillText(this.banner, this.width / 2, 158);
        ctx.restore();
      }

      if (this.combo.timer > 0 && this.combo.hits >= 2 && this.combo.owner === this.player) {
        ctx.save();
        ctx.fillStyle = "#ffd166";
        ctx.font = "900 30px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${this.combo.hits} HIT`, 48, 150);
        ctx.font = "800 15px system-ui, sans-serif";
        ctx.fillText(`${this.combo.damage} DAMAGE`, 50, 174);
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#dfe8ff";
      ctx.font = "700 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`CPU: ${this.cpuMood.toUpperCase()}`, this.width / 2, this.height - 24);
      ctx.restore();
    }
  }

  window.StreetClashGame = {
    Game
  };
})();
