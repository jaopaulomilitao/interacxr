AFRAME.registerComponent("mxr-hand-tracking", {
  schema: {
    maxHands: { type: "int", default: 1 },
    delegate: { type: "string", default: "GPU" },
  },

  init() {
    this.isProcessing = false;
    this.videoElement = null;
    this.stream = null;

    // a calibração agora baseia-se num plano físico em metros, ignorando o fov virtual
    window.MXRCalibration = {
      baseDepth: 0.5,
      planeWidth: 0.8,
      planeHeight: 0.45
    };

    this.worker = new Worker(
      new URL("../workers/hand-worker.js", import.meta.url),
      { type: "module" },
    );

    this.worker.onmessage = (event) => {
      const { type, landmarks } = event.data;

      if (type !== "RESULT") return;

      this.el.emit("mxr-hand-data", {
        landmarks: landmarks?.length ? landmarks[0] : null,
      });

      this.isProcessing = false;
    };

    this.worker.postMessage({
      type: "INIT",
      maxHands: this.data.maxHands,
      delegate: this.data.delegate,
    });
  },

  async startTracking() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      this.videoElement = document.createElement("video");
      this.videoElement.srcObject = this.stream;
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;

      this.videoElement.onloadedmetadata = async () => {
        // o aspecto é forçado para paisagem para corresponder ao uso do óculos vr
        const w = this.videoElement.videoWidth;
        const h = this.videoElement.videoHeight;
        const max = Math.max(w, h);
        const min = Math.min(w, h);
        const aspect = max / min; 
        
        // um quadro de 45 centímetros de altura é projetado a 0.5m de distância
        window.MXRCalibration.planeHeight = 0.45;
        window.MXRCalibration.planeWidth = 0.45 * aspect;

        await this.videoElement.play();
        this.el.sceneEl.enterVR?.();

        setTimeout(() => {
          const cam = this.el.getObject3D("camera");
          if (cam) cam.updateProjectionMatrix();
        }, 500);
      };
    } catch (err) {
      console.error("[mxr-hand-tracking] Camera init failed:", err);
    }
  },

  async tick(time) {
    if (!this.videoElement || this.isProcessing || this.videoElement.readyState < 2) {
      return;
    }

    this.isProcessing = true;

    try {
      const bitmap = await createImageBitmap(this.videoElement);
      this.worker.postMessage(
        { type: "PROCESS", image: bitmap, timestamp: time },
        [bitmap],
      );
    } catch (err) {
      console.warn("[mxr-hand-tracking] Frame skipped:", err);
      this.isProcessing = false;
    }
  },

  remove() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.worker) this.worker.terminate();
    this.videoElement = null;
    this.stream = null;
  },
});