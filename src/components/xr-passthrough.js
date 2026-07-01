import { passthroughShader } from '../shaders/passthrough-shader.js';

// é registrado o componente a-frame de passthrough
AFRAME.registerComponent('xr-passthrough', {
  schema: {
    k1: { type: 'number', default: 0.0 },
    zoom: { type: 'number', default: 1.0 }
  },

  init: function () {
    // é armazenada a referência do material e do vídeo para uso interno
    this.customMaterial = null;
    this.videoElement = null;
  },

  startCamera: async function () {
    try {
      // é solicitado o acesso à câmera traseira
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 }
      });
      
      // é criado o elemento de vídeo internamente
      this.videoElement = document.createElement('video');
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      this.videoElement.srcObject = stream;

      // é aguardado o vídeo estar pronto para reprodução
      this.videoElement.onloadedmetadata = () => {
        this.videoElement.play();
        // é executada a configuração do plano 3d
        this.setupVideoPlane();
        // é forçado o modo vr nativo do a-frame
        this.el.sceneEl.enterVR();
      };
    } catch (error) {
      console.error('error accessing camera:', error);
      alert('camera permission is required for xr mode.');
    }
  },

  setupVideoPlane: function () {
    // é criada a textura a partir do vídeo interno
    const videoTexture = new THREE.VideoTexture(this.videoElement);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;

    // é instanciado o shader material
    this.customMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(passthroughShader.uniforms),
      vertexShader: passthroughShader.vertexShader,
      fragmentShader: passthroughShader.fragmentShader,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    this.customMaterial.uniforms.videoTexture.value = videoTexture;

    // é criado o plano de fundo e adicionado à câmera
    const planeGeometry = new THREE.PlaneGeometry(32, 18);
    const videoPlane = new THREE.Mesh(planeGeometry, this.customMaterial);
    
    videoPlane.position.set(0, 0, -10);
    this.el.object3D.add(videoPlane);
  },

  update: function () {
    // são atualizados os uniformes via sliders
    if (this.customMaterial) {
      this.customMaterial.uniforms.k1.value = this.data.k1;
      this.customMaterial.uniforms.zoomLevel.value = this.data.zoom;
    }
  }
});