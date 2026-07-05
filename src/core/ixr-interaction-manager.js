window.ixrInteractionManager = {
  mode: "idle",

  owner: null,

  listeners: [],

  request(mode, owner = null) {
    if (this.mode !== "idle") {
      return false;
    }

    this.mode = mode;

    this.owner = owner;

    this.notify();

    return true;
  },

  force(mode, owner = null) {
    this.mode = mode;

    this.owner = owner;

    this.notify();

    return true;
  },

  release(owner = null) {
    if (owner) {
      if (this.owner !== owner) {
        return;
      }
    }

    this.mode = "idle";

    this.owner = null;

    this.notify();
  },

  isIdle() {
    return this.mode === "idle";
  },

  isActive(mode) {
    return this.mode === mode;
  },

  getMode() {
    return this.mode;
  },

  subscribe(callback) {
    this.listeners.push(callback);
  },

  unsubscribe(callback) {
    const index = this.listeners.indexOf(callback);

    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  },

  notify() {
    for (const callback of this.listeners) {
      callback({
        mode: this.mode,

        owner: this.owner,
      });
    }
  },
};
