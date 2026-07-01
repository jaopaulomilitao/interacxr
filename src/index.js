// é definida a estrutura do shader para o passthrough
const passthroughShader = {
  uniforms: {
    videoTexture: { value: null },
    zoomLevel: { value: 1.0 },
    k1: { value: 0.0 }
  },
  
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      // é calculada a posição do vértice
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform sampler2D videoTexture;
    uniform float zoomLevel;
    uniform float k1;
    
    varying vec2 vUv;
    
    void main() {
      // é centralizado o uv
      vec2 centerUv = vUv - 0.5;
      
      // é calculado o raio para a distorção
      float r2 = dot(centerUv, centerUv);
      
      // é aplicada a distorção de barril
      float distortion = 1.0 + k1 * r2;
      vec2 distortedUv = centerUv * distortion;
      
      // é aplicado o zoom
      vec2 finalUv = (distortedUv / zoomLevel) + 0.5;
      
      // são tratadas as bordas para evitar repetição de textura
      if (finalUv.x < 0.0 || finalUv.x > 1.0 || finalUv.y < 0.0 || finalUv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        // é renderizada a cor do vídeo
        gl_FragColor = texture2D(videoTexture, finalUv);
      }
    }
  `
};

// é registrado o componente a-frame
AFRAME.registerComponent('xr-passthrough', {
  schema: {
    k1: { type: 'number', default: 0.0 },
    zoom: { type: 'number', default: 1.0 }
  },

  init: function () {
    // é armazenada a referência do material para uso no update
    this.customMaterial = null;
  },

  setupVideoPlane: function (videoElement) {
    // é criada a textura a partir do vídeo
    const videoTexture = new THREE.VideoTexture(videoElement);
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

// é aguardado o carregamento do dom para adicionar os eventos
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const startScreen = document.getElementById('start-screen');
  const debugPanel = document.getElementById('debug-panel');
  const sceneEl = document.querySelector('a-scene');
  const cameraEl = document.getElementById('main-camera');

  // é configurada a ação do botão inicial
  startBtn.addEventListener('click', async () => {
    try {
      // é solicitado o acesso à câmera traseira
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 }
      });
      
      // é criado o elemento de vídeo no dom dinamicamente
      const videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.srcObject = stream;

      // é aguardado o vídeo estar pronto para reprodução
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        
        // é injetado o vídeo no componente
        cameraEl.components['xr-passthrough'].setupVideoPlane(videoElement);
        
        // são atualizadas as interfaces
        startScreen.style.display = 'none';
        debugPanel.style.display = 'block';
        
        // é forçado o modo vr nativo do a-frame (tela dividida)
        sceneEl.enterVR();
      };
    } catch (error) {
      console.error('error accessing camera:', error);
      alert('camera permission is required for xr mode.');
    }
  });

  // são atrelados os sliders aos parâmetros do componente
  const bindSlider = (sliderId, valId, propName) => {
    const slider = document.getElementById(sliderId);
    const valDisplay = document.getElementById(valId);
    
    slider.addEventListener('input', (e) => {
      const val = e.target.value;
      valDisplay.textContent = val;
      cameraEl.setAttribute('xr-passthrough', propName, val);
    });
  };

  bindSlider('k1-slider', 'k1-val', 'k1');
  bindSlider('zoom-slider', 'zoom-val', 'zoom');
});