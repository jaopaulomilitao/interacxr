import { passthroughShader } from "../shaders/passthrough-shader.js";

AFRAME.registerComponent("xr-passthrough", {
  schema: {
    k1: { type: "number", default: 0.05 },
    zoom: { type: "number", default: 1.1 },
  },

  init() {
    this.customMaterial = null;
    this.videoElement = null;
    this.videoPlane = null;
    this.stream = null;
  },

  async startCamera() {
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
        await this.videoElement.play();

        this.setupVideoPlane();

        this.el.sceneEl.enterVR();
      };
    } catch (error) {
      console.error(error);

      alert("camera permission is required for xr mode.");
    }
  },

  setupVideoPlane: function () {
    const videoTexture = new THREE.VideoTexture(this.videoElement);

    videoTexture.minFilter = THREE.LinearFilter;

    videoTexture.magFilter = THREE.LinearFilter;

    videoTexture.format = THREE.RGBAFormat;

    this.customMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(passthroughShader.uniforms),

      vertexShader: passthroughShader.vertexShader,

      fragmentShader: passthroughShader.fragmentShader,

      depthWrite: false,

      side: THREE.DoubleSide,
    });

    this.customMaterial.uniforms.videoTexture.value = videoTexture;

    const aspect = this.videoElement.videoWidth / this.videoElement.videoHeight;

    const planeHeight = 18;

    const planeWidth = planeHeight * aspect;

    const planeGeometry = new THREE.PlaneGeometry(
      planeWidth,

      planeHeight,
    );

    const videoPlane = new THREE.Mesh(
      planeGeometry,

      this.customMaterial,
    );

    videoPlane.position.set(
      0,

      0,

      -50,
    );

    this.el.object3D.add(videoPlane);
  },

  update() {
    if (!this.customMaterial) return;

    this.customMaterial.uniforms.k1.value = this.data.k1;

    this.customMaterial.uniforms.zoomLevel.value = this.data.zoom;
  },

  remove() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }

    if (this.videoPlane) {
      this.el.object3D.remove(this.videoPlane);
    }
  },
});
