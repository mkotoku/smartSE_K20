(function () {
  const actionLabels = {
    left: "Left",
    right: "Right",
    jump: "Jump",
    forward: "Depth In",
    back: "Depth Out",
    guard: "Guard",
    light: "Light",
    heavy: "Heavy",
    tornado: "Tornado",
    special: "Special",
    camera: "Camera",
    pause: "Pause"
  };

  class InputManager {
    constructor(keys) {
      this.keys = Object.assign({}, keys);
      this.downCodes = new Set();
      this.pressedActions = new Set();
      this.waitingAction = null;
      this.onRebind = null;

      window.addEventListener("keydown", (event) => this.handleKeyDown(event));
      window.addEventListener("keyup", (event) => this.handleKeyUp(event));
      window.addEventListener("blur", () => this.clear());
    }

    handleKeyDown(event) {
      if (this.waitingAction) {
        event.preventDefault();
        this.keys[this.waitingAction] = event.code;
        const rebound = this.waitingAction;
        this.waitingAction = null;
        if (this.onRebind) this.onRebind(rebound, event.code);
        return;
      }

      const action = this.actionForCode(event.code);
      if (!action) return;
      event.preventDefault();
      if (!this.downCodes.has(event.code)) this.pressedActions.add(action);
      this.downCodes.add(event.code);
    }

    handleKeyUp(event) {
      this.downCodes.delete(event.code);
    }

    actionForCode(code) {
      return Object.keys(this.keys).find((action) => this.keys[action] === code);
    }

    isDown(action) {
      return this.downCodes.has(this.keys[action]);
    }

    isCodeDown(code) {
      return this.downCodes.has(code);
    }

    consume(action) {
      const hadAction = this.pressedActions.has(action);
      this.pressedActions.delete(action);
      return hadAction;
    }

    beginRebind(action) {
      this.waitingAction = action;
    }

    clear() {
      this.downCodes.clear();
      this.pressedActions.clear();
    }
  }

  function codeToLabel(code) {
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code === "Escape") return "Esc";
    if (code === "Space") return "Space";
    return code.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  window.StreetClashInput = {
    InputManager,
    actionLabels,
    codeToLabel
  };
})();
