AFRAME.registerComponent("ixr-hud", {
  schema: {
    position: {
      default: "0 -0.5 -1",
    },

    width: {
      default: 2,
    },

    color: {
      default: "#FFFFFF",
    },

    debugColor: {
      default: "#00FFAA",
    },

    showDebug: {
      default: true,
    },
  },

  init() {
    this.text = document.createElement("a-text");

    this.text.setAttribute(
      "position",

      this.data.position,
    );

    this.text.setAttribute(
      "align",

      "center",
    );

    this.text.setAttribute(
      "width",

      this.data.width,
    );

    this.text.setAttribute(
      "value",

      "Idle",
    );

    this.text.setAttribute(
      "color",

      this.data.color,
    );

    this.el.appendChild(this.text);

    this.debug = document.createElement("a-text");

    this.debug.setAttribute(
      "position",

      "0 -0.62 -1",
    );

    this.debug.setAttribute(
      "align",

      "center",
    );

    this.debug.setAttribute(
      "width",

      2.5,
    );

    this.debug.setAttribute(
      "value",

      "",
    );

    this.debug.setAttribute(
      "color",

      this.data.debugColor,
    );

    this.debug.setAttribute(
      "visible",

      this.data.showDebug,
    );

    this.el.appendChild(this.debug);

    window.ixrHUD = this;

    window.addEventListener(
      "ixr-mode-change",

      this.onModeChange.bind(this),
    );
  },

  setText(value) {
    this.text.setAttribute(
      "value",

      value,
    );
  },

  setDebug(value) {
    this.debug.setAttribute(
      "value",

      value,
    );
  },

  clearDebug() {
    this.debug.setAttribute(
      "value",

      "",
    );
  },

  onModeChange(e) {
    const mode = e.detail.mode;

    switch (mode) {
      case "idle":
        this.setText("Idle");

        break;

      case "grab":
        this.setText("Grab");

        break;

      case "teleport":
        this.setText("Teleport");

        break;

      case "point":
        this.setText("Point");

        break;

      default:
        this.setText(mode);
    }
  },
});
