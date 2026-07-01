AFRAME.registerComponent('mxr-hand-tracking', {
  schema: {
    maxHands: { type: 'int', default: 1 },
    delegate: { type: 'string', default: 'GPU' }
  },

  init: function () {
    this.isProcessing = false;
    this.videoElement = null;
    
    this.handCollider = document.createElement('a-box');
    this.handCollider.setAttribute('color', '#00FF00');
    this.handCollider.setAttribute('wireframe', 'true');
    this.handCollider.setAttribute('visible', 'false');
    
    this.el.appendChild(this.handCollider);

    this.worker = new Worker(new URL('../workers/hand-worker.js', import.meta.url), { type: 'module' });
    
    this.worker.onmessage = (event) => {
      const { type, landmarks } = event.data;
      if (type === 'RESULT') {
        this.updateHandPosition(landmarks);
        this.isProcessing = false;
      }
    };

    this.worker.postMessage({
      type: 'INIT',
      maxHands: this.data.maxHands,
      delegate: this.data.delegate
    });
  },

  updateHandPosition: function (landmarks) {
    if (!landmarks || landmarks.length === 0) {
      this.handCollider.setAttribute('visible', 'false');
      return;
    }

    this.handCollider.setAttribute('visible', 'true');
    
    const hand = landmarks[0];
    const cameraObj = this.el.getObject3D('camera');
    
    if (!cameraObj) return;

    let minX = 1, minY = 1, minZ = 1;
    let maxX = 0, maxY = 0, maxZ = 0;

    for (let i = 0; i < hand.length; i++) {
      const lm = hand[i];
      if (lm.x < minX) minX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.z < minZ) minZ = lm.z;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y > maxY) maxY = lm.y;
      if (lm.z > maxZ) maxZ = lm.z;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    const baseDepth = 0.5;
    const vFov = (cameraObj.fov * Math.PI) / 180;
    const frustumHeight = 2 * Math.tan(vFov / 2) * baseDepth;
    const frustumWidth = frustumHeight * cameraObj.aspect;

    const finalX = (cx - 0.5) * frustumWidth;
    const finalY = -(cy - 0.5) * frustumHeight;
    const finalZ = -baseDepth + (cz * frustumWidth);

    this.handCollider.setAttribute('position', `${finalX} ${finalY} ${finalZ}`);

    const boxWidth = Math.max((maxX - minX) * frustumWidth, 0.05);
    const boxHeight = Math.max((maxY - minY) * frustumHeight, 0.05);
    const boxDepth = Math.max((maxZ - minZ) * frustumWidth, 0.05);

    this.handCollider.setAttribute('scale', `${boxWidth} ${boxHeight} ${boxDepth}`);
  },

  tick: async function (time) {
    if (!this.videoElement) {
      const passthrough = this.el.components['xr-passthrough'];
      if (passthrough && passthrough.videoElement) {
        this.videoElement = passthrough.videoElement;
      }
      return;
    }

    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const bitmap = await createImageBitmap(this.videoElement);
      this.worker.postMessage(
        { type: 'PROCESS', image: bitmap, timestamp: time },
        [bitmap]
      );
    } catch (e) {
      this.isProcessing = false;
    }
  }
});