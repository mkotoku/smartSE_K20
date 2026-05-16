(function () {
  const attacks = {
    light: {
      name: "light",
      label: "Jab",
      level: "mid",
      damage: 6,
      meterGain: 8,
      startup: 0.05,
      active: 0.12,
      recovery: 0.16,
      range: 64,
      height: 42,
      knockback: 150,
      hitStun: 0.2,
      cancelWindow: 0.13,
      sound: "hitLight",
      spark: "#fef3a1"
    },
    heavy: {
      name: "heavy",
      label: "Breaker",
      level: "mid",
      damage: 13,
      meterGain: 13,
      startup: 0.13,
      active: 0.15,
      recovery: 0.3,
      range: 84,
      height: 52,
      knockback: 270,
      hitStun: 0.32,
      cancelWindow: 0.14,
      sound: "hitHeavy",
      spark: "#ff8a66"
    },
    special: {
      name: "special",
      label: "Surge Kick",
      level: "mid",
      damage: 19,
      meterGain: 4,
      meterCost: 35,
      startup: 0.16,
      active: 0.22,
      recovery: 0.44,
      range: 116,
      height: 64,
      knockback: 430,
      hitStun: 0.42,
      cancelWindow: 0,
      sound: "hitSpecial",
      spark: "#7df9ff"
    },
    super: {
      name: "super",
      label: "Meteor Rush",
      level: "mid",
      damage: 32,
      meterGain: 0,
      meterCost: 100,
      startup: 0.12,
      active: 0.32,
      recovery: 0.62,
      range: 156,
      height: 76,
      knockback: 560,
      hitStun: 0.58,
      cancelWindow: 0,
      sound: "super",
      spark: "#ffffff"
    },
    throw: {
      name: "throw",
      label: "Throw",
      level: "throw",
      damage: 10,
      meterGain: 10,
      startup: 0.08,
      active: 0.1,
      recovery: 0.28,
      range: 46,
      height: 76,
      knockback: 330,
      hitStun: 0.34,
      cancelWindow: 0,
      sound: "throw",
      spark: "#caff70",
      unblockable: true
    },
    crouchLight: {
      name: "crouchLight",
      label: "Low Jab",
      level: "low",
      damage: 5,
      meterGain: 7,
      startup: 0.06,
      active: 0.13,
      recovery: 0.18,
      range: 62,
      height: 28,
      knockback: 120,
      hitStun: 0.2,
      cancelWindow: 0.14,
      sound: "hitLight",
      spark: "#caff70"
    },
    crouchHeavy: {
      name: "crouchHeavy",
      label: "Sweep",
      level: "low",
      damage: 12,
      meterGain: 12,
      startup: 0.14,
      active: 0.16,
      recovery: 0.34,
      range: 92,
      height: 34,
      knockback: 250,
      hitStun: 0.35,
      cancelWindow: 0,
      sound: "hitHeavy",
      spark: "#caff70"
    }
  };

  class Fighter {
    constructor(options) {
      this.name = options.name;
      this.color = options.color;
      this.accent = options.accent;
      this.dark = options.dark;
      this.isCpu = Boolean(options.isCpu);
      this.startX = options.x;
      this.reset(options.x);
    }

    reset(x = this.startX) {
      this.x = x;
      this.z = 0;
      this.y = 0;
      this.vx = 0;
      this.vz = 0;
      this.vy = 0;
      this.width = 50;
      this.depth = 54;
      this.height = 112;
      this.facing = 1;
      this.yaw = 0;
      this.forwardX = 1;
      this.forwardZ = 0;
      this.hp = 100;
      this.meter = 20;
      this.state = "idle";
      this.attack = null;
      this.attackTimer = 0;
      this.attackHasHit = false;
      this.hitStun = 0;
      this.guard = false;
      this.crouching = false;
      this.onGround = true;
      this.flash = 0;
      this.afterImages = [];
      this.winPose = false;
      this.losePose = false;
      this.comboChain = [];
      this.comboTimer = 0;
    }

    get bounds() {
      return {
        x: this.x - this.width / 2,
        y: this.y - this.height,
        width: this.width,
        height: this.height,
        z: this.z - this.depth / 2,
        depth: this.depth
      };
    }

    canAct() {
      return this.hitStun <= 0 && !this.losePose;
    }

    canCancelInto(type) {
      if (!this.attack || this.hitStun > 0) return false;
      if (this.attack.name === "super") return false;
      if (this.attackTimer < this.attack.startup + this.attack.active) return false;
      const chain = this.comboChain.join(",");
      return (type === "heavy" && chain.endsWith("light")) || (type === "special" && /light,heavy$/.test(chain)) || type === "super";
    }

    startAttack(type) {
      const data = attacks[type];
      if (!data || !this.canAct()) return false;
      if (this.attack && !this.canCancelInto(type)) return false;
      if (data.meterCost && this.meter < data.meterCost) return false;
      if (data.meterCost) this.meter = Math.max(0, this.meter - data.meterCost);
      this.attack = data;
      this.attackTimer = 0;
      this.attackHasHit = false;
      this.state = type;
      this.comboChain.push(type);
      this.comboChain = this.comboChain.slice(-4);
      this.comboTimer = 0.55;
      return true;
    }

    update(dt, arenaWidth, arenaDepth = 260, hasFloor = true) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0 && !this.attack) this.comboChain = [];

      if (this.hitStun > 0) this.hitStun = Math.max(0, this.hitStun - dt);

      if (this.attack) {
        this.attackTimer += dt;
        const total = this.attack.startup + this.attack.active + this.attack.recovery;
        if (this.attackTimer >= total) {
          this.attack = null;
          this.attackTimer = 0;
          this.attackHasHit = false;
        }
      }

      this.vy += 1600 * dt;
      this.x += this.vx * dt;
      this.z += this.vz * dt;
      this.y += this.vy * dt;

      if (hasFloor && this.y > 0) {
        this.y = 0;
        this.vy = 0;
        this.onGround = true;
      } else {
        this.onGround = false;
      }

      this.x = Math.max(42, Math.min(arenaWidth - 42, this.x));
      this.z = Math.max(-arenaDepth / 2, Math.min(arenaDepth / 2, this.z));
      this.vx *= this.onGround ? Math.pow(0.0008, dt) : Math.pow(0.05, dt);
      this.vz *= Math.pow(0.0008, dt);
      this.flash = Math.max(0, this.flash - dt);

      for (const ghost of this.afterImages) ghost.life -= dt;
      this.afterImages = this.afterImages.filter((ghost) => ghost.life > 0);
      if (this.attack && (this.attack.name === "special" || this.attack.name === "super")) {
        this.afterImages.push({ x: this.x, y: this.y, facing: this.facing, life: 0.18, state: this.state });
        this.afterImages = this.afterImages.slice(-8);
      }

      if (!this.attack && this.hitStun <= 0) {
        if (this.winPose) this.state = "win";
        else if (this.losePose) this.state = "down";
        else if (!this.onGround) this.state = "jump";
        else if (this.guard) this.state = "guard";
        else if (Math.abs(this.vx) > 20) this.state = "walk";
        else this.state = "idle";
      }
    }

    attackBox() {
      if (!this.attack) return null;
      const activeStart = this.attack.startup;
      const activeEnd = activeStart + this.attack.active;
      if (this.attackTimer < activeStart || this.attackTimer > activeEnd) return null;
      const range = this.attack.range;
      const isLow = this.attack.level === "low";
      const fx = this.forwardX || this.facing;
      const fz = this.forwardZ || 0;
      const depth = this.depth + 36;
      const centerX = this.x + fx * (this.width / 2 + range / 2);
      const centerZ = this.z + fz * (this.depth / 2 + range / 2);
      return {
        x: centerX - range / 2,
        y: isLow ? this.y - 44 : this.y - this.height + 18,
        z: centerZ - depth / 2,
        width: range,
        height: this.attack.height,
        depth
      };
    }

    takeHit(attack, direction, blocked) {
      const damage = blocked ? Math.ceil(attack.damage * 0.18) : attack.damage;
      this.hp = Math.max(0, this.hp - damage);
      this.meter = Math.min(100, this.meter + (blocked ? 5 : 8));
      this.vx = direction * (blocked ? attack.knockback * 0.28 : attack.knockback);
      if (!blocked && attack.name !== "light") this.vy = Math.min(this.vy, -120);
      this.hitStun = blocked ? 0.1 : attack.hitStun;
      this.flash = blocked ? 0.08 : 0.16;
      if (!blocked) this.state = "hurt";
      return damage;
    }

    gainMeter(amount) {
      this.meter = Math.min(100, this.meter + amount);
    }

    draw(ctx, floorY, time) {
      for (const ghost of this.afterImages) {
        ctx.save();
        ctx.globalAlpha = ghost.life * 1.8;
        this.drawBody(ctx, floorY, time, ghost.x, ghost.y, ghost.facing, true);
        ctx.restore();
      }
      this.drawBody(ctx, floorY, time, this.x, this.y, this.facing, false);
    }

    drawBody(ctx, floorY, time, x, y, facing, ghost) {
      const walk = this.state === "walk" ? Math.sin(time / 80) : 0;
      const idle = Math.sin(time / 260) * 2;
      const hurt = this.state === "hurt" ? -8 : 0;
      const crouch = this.state === "guard" ? 8 : 0;
      const bodyColor = ghost ? "rgba(125, 249, 255, 0.38)" : this.flash > 0 ? "#fff6b8" : this.color;
      const accent = ghost ? "rgba(255, 255, 255, 0.35)" : this.accent;

      ctx.save();
      ctx.translate(x, floorY + y);
      ctx.scale(facing, 1);

      ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
      ctx.beginPath();
      ctx.ellipse(0, 8, 42, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      if (this.state === "down") {
        ctx.rotate(-0.85);
        ctx.translate(-18, 28);
      }

      const hipY = -34 + crouch;
      const chestY = -74 + idle + crouch;
      const headY = -100 + idle + crouch;

      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 13;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      this.limb(ctx, -14, hipY, -24, -6, -35 + walk * 8, 4);
      this.limb(ctx, 13, hipY, 20, -8, 34 - walk * 8, 4);

      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.roundRect(-22 + hurt, chestY, 44, 48, 10);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillRect(-18 + hurt, chestY + 8, 36, 8);

      let frontArm = [23, chestY + 12, 42, chestY + 28, 50, chestY + 42];
      let backArm = [-22, chestY + 14, -36, chestY + 31, -35, chestY + 48];
      if (this.state === "light") frontArm = [23, chestY + 10, 58, chestY + 9, 82, chestY + 14];
      if (this.state === "heavy") frontArm = [23, chestY + 12, 60, chestY - 6, 94, chestY + 6];
      if (this.state === "special" || this.state === "super") frontArm = [23, chestY + 8, 66, chestY - 6, 108, chestY + 4];
      if (this.state === "guard") {
        frontArm = [20, chestY + 10, 34, chestY - 6, 21, chestY - 20];
        backArm = [-18, chestY + 12, -2, chestY - 10, -12, chestY - 25];
      }
      this.limb(ctx, ...backArm);
      this.limb(ctx, ...frontArm);

      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(hurt, headY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.dark;
      ctx.fillRect(6 + hurt, headY - 5, 7, 4);

      if (this.guard && !ghost) {
        ctx.strokeStyle = "rgba(125, 249, 255, 0.82)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(6, -60, 50, -1.2, 1.2);
        ctx.stroke();
      }

      const box = this.attackBox();
      if (box && !ghost) {
        const pulse = this.attack.name === "super" ? 0.65 : 0.38;
        ctx.fillStyle = this.attack.name === "special" || this.attack.name === "super" ? `rgba(125, 249, 255, ${pulse})` : "rgba(255, 255, 255, 0.28)";
        ctx.beginPath();
        ctx.roundRect(this.width / 2, -88, this.attack.range, this.attack.height, 24);
        ctx.fill();
      }

      if (this.state === "win" && !ghost) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 22px system-ui, sans-serif";
        ctx.fillText("K.O.", -20, -132);
      }

      ctx.restore();
    }

    limb(ctx, x1, y1, x2, y2, x3, y3) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.stroke();
    }
  }

  function rectsOverlap(a, b) {
    const zOverlap = a.z === undefined || b.z === undefined || (a.z < b.z + b.depth && a.z + a.depth > b.z);
    return zOverlap && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  window.StreetClashFighter = {
    Fighter,
    attacks,
    rectsOverlap
  };
})();
