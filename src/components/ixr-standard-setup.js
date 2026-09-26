AFRAME.registerComponent("ixr-standard-setup", {
  schema: {
    rig: { type: "string", default: "#camera-rig" },
    createUI: { type: "boolean", default: true }
  },

  init() {
    // é garantido que a câmera possua um id para referenciar os componentes
    if (!this.el.id) {
      this.el.id = "ixr-default-camera";
    }

    const cameraId = `#${this.el.id}`;

    // são injetados os componentes caso não tenham sido declarados pelo usuário
    if (!this.el.hasAttribute("ixr-hand-tracking")) {
      this.el.setAttribute("ixr-hand-tracking", "maxHands: 1");
    }

    if (!this.el.hasAttribute("ixr-gesture-detector")) {
      this.el.setAttribute("ixr-gesture-detector", `source: ${cameraId}`);
    }

    if (!this.el.hasAttribute("ixr-hand-model")) {
      this.el.setAttribute("ixr-hand-model", `source: ${cameraId}`);
    }

    if (!this.el.hasAttribute("ixr-cursor")) {
      this.el.setAttribute("ixr-cursor", "targetClass: .grabbable, .interactable");
    }

    if (!this.el.hasAttribute("ixr-gaze-grabber")) {
      this.el.setAttribute("ixr-gaze-grabber", "targetClass: .grabbable; activationPose: victory; grabPose: grab");
    }

    if (!this.el.hasAttribute("ixr-interactor")) {
      this.el.setAttribute("ixr-interactor", "targetClass: .interactable; interactPose: pinch");
    }

    if (!this.el.hasAttribute("ixr-teleport")) {
      this.el.setAttribute("ixr-teleport", `rig: ${this.data.rig}; activationPose: rock; confirmPose: pinch; cancelPose: grab; floorY: 0`);
    }

    // é gerada a interface inicial se habilitado
    if (this.data.createUI) {
      this.injectStartUI();
    }
  },

  injectStartUI() {
    // é evitada a duplicidade caso a tela já exista
    if (document.getElementById("ixr-start-screen")) return;

    // é construída a estrutura da tela de sobreposição de forma programática
    const overlay = document.createElement("div");
    overlay.id = "ixr-start-screen";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      backgroundColor: "rgba(15, 15, 15, 0.95)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "99999",
      fontFamily: "sans-serif",
      color: "#ffffff",
      transition: "opacity 0.3s ease"
    });

    const title = document.createElement("h1");
    title.innerText = "InteracXR Toolkit";
    title.style.marginBottom = "10px";

    const subtitle = document.createElement("p");
    subtitle.innerText = "allow camera access to start immersive webxr";
    subtitle.style.marginBottom = "30px";
    subtitle.style.color = "#aaaaaa";

    const startButton = document.createElement("button");
    startButton.innerText = "start experience";
    Object.assign(startButton.style, {
      padding: "15px 40px",
      fontSize: "18px",
      fontWeight: "bold",
      border: "none",
      borderRadius: "8px",
      backgroundColor: "#4CC3D9",
      color: "#ffffff",
      cursor: "pointer",
      boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
    });

    // é escutado o clique para liberar as permissões do navegador e iniciar a ia
    startButton.addEventListener("click", () => {
      const trackingComponent = this.el.components["ixr-hand-tracking"];
      if (trackingComponent) {
        trackingComponent.startTracking();
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 300);
      }
    });

    overlay.appendChild(title);
    overlay.appendChild(subtitle);
    overlay.appendChild(startButton);
    document.body.appendChild(overlay);
  }
});