# InteracXR: WebXR Hand Tracking & Interaction Engine

## 1. Project Objective
Develop a high-performance, low-cost WebXR hand-tracking library for mobile devices using MediaPipe and A-Frame. The focus is to democratize immersive virtual reality (VR) interactions, such as spatial manipulation and locomotion, without the need for expensive dedicated headsets (e.g., Meta Quest).

## 2. Progress Tracker

### 2.1. What Has Been Done
* Implementation of the core hand-tracking engine via Web Workers (`mxr-hand-tracking.js`).
* Creation of a robust Gesture State Machine (`mxr-gesture-detector.js`) identifying: Point, Grab, Pinch, Rock, and Gun.
* Integration of mathematical Jitter reduction (Hysteresis) and state exclusivity.
* Development of a parabolic locomotion system (`mxr-teleport.js`) using kinematic physics and Difference Blending.
* Implementation of a long-distance object manipulation system (`mxr-laser-grabber.js`) using Raycasting.
* Isolation of the VR environment to ensure stable 60 FPS on mobile hardware.

### 2.2. What Needs To Be Done
* Integrate 3D hand models to replace the wireframe/laser visualizer.
* Fine-tune the physics and colliders for the grabbed objects.
* Write the academic article mapping the architecture.

---

## 3. Academic Article Structure

1. **Introduction:** Context of low-cost VR/AR, WebXR accessibility, and current hardware limitations.
2. **Related Works:** Analysis of frameworks (A-Frame, Three.js) and ML models (MediaPipe).
3. **Proposed Architecture:** Modular component system and Web Worker ML offloading.
4. **Interaction Paradigms:** Spatial Locomotion (Parabolic) and Remote Manipulation (Laser).
5. **Performance & UX:** FPS metrics, optical tracking noise mitigation, and gesture usability.
6. **Conclusion:** MVP success summary and roadmap for future OS-level AR integrations.

---

## 4. Directory Structure

```text
.
  docs
  examples
    basic
      index.html
      style.css
  generate_docs.sh
  LICENSE
  project_review.md
  src
    components
      mxr-debug-collision.js
      mxr-gesture-detector.js
      mxr-grabber.js
      mxr-hand-tracking.js
      mxr-laser-grabber.js
      mxr-teleport.js
      xr-passthrough.js
    index.js
    shaders
      passthrough-shader.js
    utils
    workers
      hand-worker.js
```

---

## 5. Codebase Files

### File: src/components/mxr-debug-collision.js

```javascript
import * as THREE from 'three';

AFRAME.registerComponent('mxr-debug-collision', {
  schema: {
    handTracker: { type: 'selector', default: '#main-camera' },
    threshold: { type: 'number', default: 0.3 }
  },

  tick: function () {
    const trackerComponent = this.data.handTracker.components['mxr-hand-tracking'];
    if (!trackerComponent || !trackerComponent.handCollider) return;

    if (trackerComponent.handCollider.getAttribute('visible') === 'false') {
      this.el.setAttribute('color', '#4CC3D9');
      return;
    }

    const cubeWorldPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(cubeWorldPos);

    const handWorldPos = new THREE.Vector3();
    trackerComponent.handCollider.object3D.getWorldPosition(handWorldPos);

    const distance = cubeWorldPos.distanceTo(handWorldPos);

    if (distance < this.data.threshold) {
      this.el.setAttribute('color', '#FF0000'); 
    } else {
      this.el.setAttribute('color', '#4CC3D9');
    }
  }
});
```

---

### File: src/components/mxr-gesture-detector.js

```javascript
AFRAME.registerComponent('mxr-gesture-detector', {
  schema: {
    source: { type: 'selector', default: '#main-camera' }
  },

  init: function () {
    this.gestureStates = { pinch: false, grab: false, point: false, rock: false };
    this.onHandData = this.onHandData.bind(this);
    
    if (this.data.source) {
      this.data.source.addEventListener('mxr-hand-data', this.onHandData);
    }
  },

  remove: function () {
    if (this.data.source) {
      this.data.source.removeEventListener('mxr-hand-data', this.onHandData);
    }
  },

  resetGestures: function () {
    if (this.gestureStates.grab) {
      this.gestureStates.grab = false;
      this.el.emit('mxr-grab-end');
    }
    if (this.gestureStates.point) {
      this.gestureStates.point = false;
      this.el.emit('mxr-point-end', { position: null });
    }
    if (this.gestureStates.pinch) {
      this.gestureStates.pinch = false;
      this.el.emit('mxr-pinch-end', { distance: 0, position: null });
    }
    if (this.gestureStates.rock) {
      this.gestureStates.rock = false;
      this.el.emit('mxr-rock-end');
    }
    
    this.el.emit('mxr-hand-lost');
  },

  getWorldPosition: function (landmark) {
    const cameraObj = this.data.source.getObject3D('camera');
    if (!cameraObj) return null;

    const baseDepth = 0.5;
    const vFov = (cameraObj.fov * Math.PI) / 180;
    const frustumHeight = 2 * Math.tan(vFov / 2) * baseDepth;
    const frustumWidth = frustumHeight * cameraObj.aspect;

    return {
      x: (landmark.x - 0.5) * frustumWidth,
      y: -(landmark.y - 0.5) * frustumHeight,
      z: -baseDepth + (landmark.z * frustumWidth)
    };
  },

  onHandData: function (event) {
    const hand = event.detail.landmarks;
    
    if (!hand) {
      this.resetGestures();
      return;
    }

    const getDistance = (p1, p2) => Math.sqrt(
      Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2)
    );

    const wrist = hand[0];
    
    const isIndexOpen = getDistance(hand[8], wrist) > getDistance(hand[6], wrist);
    const isMiddleOpen = getDistance(hand[12], wrist) > getDistance(hand[10], wrist);
    const isRingOpen = getDistance(hand[16], wrist) > getDistance(hand[14], wrist);
    const isPinkyOpen = getDistance(hand[20], wrist) > getDistance(hand[18], wrist);

    const isGrabbing = !isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen;
    if (isGrabbing && !this.gestureStates.grab) {
      this.gestureStates.grab = true;
      this.el.emit('mxr-grab-start');
    } else if (!isGrabbing && this.gestureStates.grab) {
      this.gestureStates.grab = false;
      this.el.emit('mxr-grab-end');
    }

    const isRocking = isIndexOpen && !isMiddleOpen && !isRingOpen && isPinkyOpen;
    if (isRocking && !this.gestureStates.rock) {
      this.gestureStates.rock = true;
      this.el.emit('mxr-rock-start');
    } else if (!isRocking && this.gestureStates.rock) {
      this.gestureStates.rock = false;
      this.el.emit('mxr-rock-end');
    }

    const isPointing = isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen;
    let indexWorldPos = null;

    if (isPointing || this.gestureStates.point) {
      indexWorldPos = this.getWorldPosition(hand[8]);
    }

    if (isPointing && !this.gestureStates.point) {
      this.gestureStates.point = true;
      this.el.emit('mxr-point-start', { position: indexWorldPos });
    } else if (!isPointing && this.gestureStates.point) {
      this.gestureStates.point = false;
      this.el.emit('mxr-point-end', { position: indexWorldPos });
    }

    if (this.gestureStates.point && indexWorldPos) {
      this.el.emit('mxr-point-move', { position: indexWorldPos });
    }

    const pinchDistance = getDistance(hand[4], hand[8]);
    let isPinching = this.gestureStates.pinch;

    if (!isGrabbing && !isRocking) {
      if (!isPinching && pinchDistance < 0.04) {
        isPinching = true;
      } else if (isPinching && pinchDistance > 0.06) {
        isPinching = false;
      }
    } else {
      isPinching = false;
    }

    const pinchCenter = {
      x: (hand[4].x + hand[8].x) / 2,
      y: (hand[4].y + hand[8].y) / 2,
      z: (hand[4].z + hand[8].z) / 2
    };
    
    let pinchWorldPos = null;
    if (isPinching || this.gestureStates.pinch) {
      pinchWorldPos = this.getWorldPosition(pinchCenter);
    }

    if (isPinching && !this.gestureStates.pinch) {
      this.gestureStates.pinch = true;
      this.el.emit('mxr-pinch-start', { distance: pinchDistance, position: pinchWorldPos });
    } else if (!isPinching && this.gestureStates.pinch) {
      this.gestureStates.pinch = false;
      this.el.emit('mxr-pinch-end', { distance: pinchDistance, position: pinchWorldPos });
    }

    if (this.gestureStates.pinch) {
      this.el.emit('mxr-pinch-move', { distance: pinchDistance, position: pinchWorldPos });
    }
  }
});
```

---

### File: src/components/mxr-grabber.js

```javascript
AFRAME.registerComponent('mxr-grabber', {
  schema: {
    targetClass: { type: 'string', default: '.grabbable' },
    grabRadius: { type: 'number', default: 0.3 }
  },

  init: function () {
    this.grabbedEl = null;
    this.offset = new THREE.Vector3();
    this.handLocalPos = new THREE.Vector3();

    this.onPinchStart = this.onPinchStart.bind(this);
    this.onPinchEnd = this.onPinchEnd.bind(this);
    this.onPinchMove = this.onPinchMove.bind(this);
    this.onHandLost = this.onPinchEnd.bind(this);

    this.el.addEventListener('mxr-pinch-start', this.onPinchStart);
    this.el.addEventListener('mxr-pinch-end', this.onPinchEnd);
    this.el.addEventListener('mxr-pinch-move', this.onPinchMove);
    this.el.addEventListener('mxr-hand-lost', this.onHandLost);
  },

  remove: function () {
    this.el.removeEventListener('mxr-pinch-start', this.onPinchStart);
    this.el.removeEventListener('mxr-pinch-end', this.onPinchEnd);
    this.el.removeEventListener('mxr-pinch-move', this.onPinchMove);
    this.el.removeEventListener('mxr-hand-lost', this.onHandLost);
  },

  onPinchStart: function (event) {
    if (!event.detail.position || this.grabbedEl) return;
    
    this.handLocalPos.copy(event.detail.position);

    const cameraObj = this.el.getObject3D('camera');
    if (!cameraObj) return;

    const worldHandPos = this.handLocalPos.clone().applyMatrix4(cameraObj.matrixWorld);
    const interactables = this.el.sceneEl.querySelectorAll(this.data.targetClass);

    let closest = null;
    let minDistance = this.data.grabRadius;

    for (let i = 0; i < interactables.length; i++) {
      const el = interactables[i];
      if (!el.object3D) continue;

      const dist = el.object3D.position.distanceTo(worldHandPos);
      if (dist < minDistance) {
        minDistance = dist;
        closest = el;
      }
    }

    if (closest) {
      this.grabbedEl = closest;
      this.offset.copy(this.grabbedEl.object3D.position).sub(worldHandPos);
      this.el.emit('mxr-grab-acquired', { el: this.grabbedEl });
    }
  },

  onPinchMove: function (event) {
    if (!this.grabbedEl || !event.detail.position) return;
    this.handLocalPos.copy(event.detail.position);
  },

  onPinchEnd: function () {
    if (this.grabbedEl) {
      this.el.emit('mxr-grab-released', { el: this.grabbedEl });
      this.grabbedEl = null;
    }
  },

  tick: function () {
    if (this.grabbedEl) {
      const cameraObj = this.el.getObject3D('camera');
      if (!cameraObj) return;

      const worldHandPos = this.handLocalPos.clone().applyMatrix4(cameraObj.matrixWorld);
      const newPos = worldHandPos.add(this.offset);
      
      this.grabbedEl.setAttribute('position', `${newPos.x} ${newPos.y} ${newPos.z}`);
    }
  }
});
```

---

### File: src/components/mxr-hand-tracking.js

```javascript
AFRAME.registerComponent("mxr-hand-tracking", {
  schema: {
    maxHands: { type: "int", default: 1 },
    delegate: { type: "string", default: "GPU" },
  },

  init: function () {
    this.isProcessing = false;
    this.videoElement = null;

    this.handCollider = document.createElement("a-box");
    this.handCollider.setAttribute("color", "#00FF00");
    this.handCollider.setAttribute("wireframe", "true");
    this.handCollider.setAttribute("visible", "false");

    this.el.appendChild(this.handCollider);

    this.worker = new Worker(
      new URL("../workers/hand-worker.js", import.meta.url),
      { type: "module" },
    );

    this.worker.onmessage = (event) => {
      const { type, landmarks } = event.data;
      if (type === "RESULT") {
        this.updateHandPosition(landmarks);

        if (landmarks && landmarks.length > 0) {
          this.el.emit("mxr-hand-data", { landmarks: landmarks[0] });
        } else {
          this.el.emit("mxr-hand-data", { landmarks: null });
        }

        this.isProcessing = false;
      }
    };

    this.worker.postMessage({
      type: "INIT",
      maxHands: this.data.maxHands,
      delegate: this.data.delegate,
    });
  },

  startTracking: async function () {
    try {
      // the camera stream is requested internally for background ml processing
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1280, height: 720 }
      });

      this.videoElement = document.createElement("video");
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      this.videoElement.srcObject = stream;

      this.videoElement.onloadedmetadata = () => {
        this.videoElement.play();
        this.el.sceneEl.enterVR();
      };
    } catch (error) {
      console.error("camera access failed for tracking:", error);
    }
  },

  updateHandPosition: function (landmarks) {
    if (!landmarks || landmarks.length === 0) {
      this.handCollider.setAttribute("visible", "false");
      return;
    }

    this.handCollider.setAttribute("visible", "true");

    const hand = landmarks[0];
    const cameraObj = this.el.getObject3D("camera");

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
    const finalZ = -baseDepth + cz * frustumWidth;

    this.handCollider.setAttribute("position", `${finalX} ${finalY} ${finalZ}`);

    const boxWidth = Math.max((maxX - minX) * frustumWidth, 0.05);
    const boxHeight = Math.max((maxY - minY) * frustumHeight, 0.05);
    const boxDepth = Math.max((maxZ - minZ) * frustumWidth, 0.05);

    this.handCollider.setAttribute(
      "scale",
      `${boxWidth} ${boxHeight} ${boxDepth}`,
    );
  },

  tick: async function (time) {
    if (!this.videoElement || this.isProcessing) return;
    this.isProcessing = true;

    try {
      const bitmap = await createImageBitmap(this.videoElement);
      this.worker.postMessage(
        { type: "PROCESS", image: bitmap, timestamp: time },
        [bitmap],
      );
    } catch (e) {
      this.isProcessing = false;
    }
  },
});
```

---

### File: src/components/mxr-laser-grabber.js

```javascript
AFRAME.registerComponent('mxr-laser-grabber', {
  schema: {
    targetClass: { type: 'string', default: '.grabbable' }
  },

  init: function () {
    this.grabbedEl = null;
    this.hoveredEl = null;
    this.isAiming = false;
    this.handPos = new THREE.Vector3();
    this.grabDistance = 0;
    this.raycaster = new THREE.Raycaster();

    // o laser visual é criado com mesclagem de diferença
    const material = new THREE.LineBasicMaterial({
      color: 0xFFFFFF,
      linewidth: 3,
      blending: THREE.DifferenceBlending,
      transparent: true
    });
    const geometry = new THREE.BufferGeometry();
    this.laserLine = new THREE.Line(geometry, material);
    this.laserLine.visible = false;
    this.el.sceneEl.object3D.add(this.laserLine);

    this.onGunStart = this.onGunStart.bind(this);
    this.onGunMove = this.onGunMove.bind(this);
    this.onGunEnd = this.onGunEnd.bind(this);
    this.onPointStart = this.onPointStart.bind(this);
    this.onPointMove = this.onPointMove.bind(this);
    this.onPointEnd = this.onPointEnd.bind(this);
    this.onHandLost = this.onHandLost.bind(this);

    this.el.addEventListener('mxr-gun-start', this.onGunStart);
    this.el.addEventListener('mxr-gun-move', this.onGunMove);
    this.el.addEventListener('mxr-gun-end', this.onGunEnd);
    this.el.addEventListener('mxr-point-start', this.onPointStart);
    this.el.addEventListener('mxr-point-move', this.onPointMove);
    this.el.addEventListener('mxr-point-end', this.onPointEnd);
    this.el.addEventListener('mxr-hand-lost', this.onHandLost);
  },

  remove: function () {
    this.el.removeEventListener('mxr-gun-start', this.onGunStart);
    this.el.removeEventListener('mxr-gun-move', this.onGunMove);
    this.el.removeEventListener('mxr-gun-end', this.onGunEnd);
    this.el.removeEventListener('mxr-point-start', this.onPointStart);
    this.el.removeEventListener('mxr-point-move', this.onPointMove);
    this.el.removeEventListener('mxr-point-end', this.onPointEnd);
    this.el.removeEventListener('mxr-hand-lost', this.onHandLost);
    this.el.sceneEl.object3D.remove(this.laserLine);
  },

  onGunStart: function (event) {
    if (!event.detail.position || this.grabbedEl) return;
    this.isAiming = true;
    this.laserLine.visible = true;
    this.handPos.copy(event.detail.position);
  },

  onGunMove: function (event) {
    if (this.isAiming && event.detail.position) {
      this.handPos.copy(event.detail.position);
    }
  },

  onGunEnd: function () {
    this.isAiming = false;
    // o laser só é escondido se um objeto não foi adquirido no mesmo quadro
    if (!this.grabbedEl) this.laserLine.visible = false;
  },

  onPointStart: function (event) {
    // a transição de arminha para apontar captura o objeto em foco
    if (this.hoveredEl && !this.grabbedEl && event.detail.position) {
      this.grabbedEl = this.hoveredEl;
      this.handPos.copy(event.detail.position);
      
      const cameraObj = this.el.getObject3D('camera');
      this.grabDistance = cameraObj.position.distanceTo(this.grabbedEl.object3D.position);
      
      this.laserLine.visible = true;
      this.el.emit('mxr-grab-acquired', { el: this.grabbedEl });
    }
  },

  onPointMove: function (event) {
    if (this.grabbedEl && event.detail.position) {
      this.handPos.copy(event.detail.position);
    }
  },

  onPointEnd: function () {
    if (this.grabbedEl) {
      this.el.emit('mxr-grab-released', { el: this.grabbedEl });
      this.grabbedEl = null;
      this.laserLine.visible = false;
    }
  },

  onHandLost: function () {
    this.onGunEnd();
    this.onPointEnd();
  },

  tick: function () {
    const cameraObj = this.el.getObject3D('camera');
    if (!cameraObj) return;

    // a posição mundial absoluta do dedo é calculada
    const worldHandPos = this.handPos.clone().applyMatrix4(cameraObj.matrixWorld);
    
    // a direção do raio vai da câmera diretamente através do dedo apontado
    const rayDir = new THREE.Vector3().subVectors(worldHandPos, cameraObj.position).normalize();

    if (this.isAiming && !this.grabbedEl) {
      this.raycaster.set(cameraObj.position, rayDir);
      
      const interactables = Array.from(this.el.sceneEl.querySelectorAll(this.data.targetClass))
        .map(el => el.object3D).filter(obj => obj !== undefined);
      
      const intersects = this.raycaster.intersectObjects(interactables, true);

      if (intersects.length > 0) {
        // a entidade raiz é recuperada caso uma malha filha tenha sido atingida
        let hitObj = intersects[0].object;
        while (hitObj.parent && !hitObj.el) { hitObj = hitObj.parent; }
        
        this.hoveredEl = hitObj.el;
        this.laserLine.geometry.setFromPoints([worldHandPos, intersects[0].point]);
      } else {
        this.hoveredEl = null;
        const distantPoint = worldHandPos.clone().add(rayDir.multiplyScalar(10));
        this.laserLine.geometry.setFromPoints([worldHandPos, distantPoint]);
      }
    } else if (this.grabbedEl) {
      // o objeto é arrastado seguindo a direção do raio restringido pela distância inicial
      const targetPos = cameraObj.position.clone().add(rayDir.multiplyScalar(this.grabDistance));
      this.grabbedEl.setAttribute('position', `${targetPos.x} ${targetPos.y} ${targetPos.z}`);
      
      this.laserLine.geometry.setFromPoints([worldHandPos, targetPos]);
    }
  }
});
```

---

### File: src/components/mxr-teleport.js

```javascript
AFRAME.registerComponent('mxr-teleport', {
  schema: {
    rig: { type: 'selector', default: '#camera-rig' },
    power: { type: 'number', default: 6 },
    floorY: { type: 'number', default: 0 }
  },

  init: function () {
    this.isAiming = false;
    this.isValidHit = false;
    this.hitPoint = new THREE.Vector3();

    // a curva visual de mira é construída
    const material = new THREE.LineBasicMaterial({
      color: 0xFFFFFF,
      linewidth: 2,
      blending: THREE.DifferenceBlending,
      transparent: true
    });
    
    const geometry = new THREE.BufferGeometry();
    this.arcLine = new THREE.Line(geometry, material);
    this.arcLine.visible = false;
    this.el.sceneEl.object3D.add(this.arcLine);

    // o retículo de chão é criado
    this.reticle = document.createElement('a-ring');
    this.reticle.setAttribute('material', 'color: #FFFFFF; shader: flat; blending: difference; transparent: true; depthTest: false');
    this.reticle.setAttribute('radius-inner', '0.2');
    this.reticle.setAttribute('radius-outer', '0.35');
    this.reticle.setAttribute('rotation', '-90 0 0');
    this.reticle.setAttribute('visible', 'false');
    this.el.sceneEl.appendChild(this.reticle);

    this.onRockStart = this.onRockStart.bind(this);
    this.onPinchStart = this.onPinchStart.bind(this);

    this.el.addEventListener('mxr-rock-start', this.onRockStart);
    this.el.addEventListener('mxr-pinch-start', this.onPinchStart);
  },

  remove: function () {
    this.el.removeEventListener('mxr-rock-start', this.onRockStart);
    this.el.removeEventListener('mxr-pinch-start', this.onPinchStart);
    this.el.sceneEl.object3D.remove(this.arcLine);
  },

  onRockStart: function () {
    // o estado da mira é alternado
    if (this.isAiming) {
      this.cancelAim();
    } else {
      this.isAiming = true;
      this.arcLine.visible = true;
      this.el.emit('mxr-teleport-aiming');
    }
  },

  onPinchStart: function () {
    // o rig é movido para a posição do retículo se for válido
    if (this.isAiming && this.isValidHit && this.data.rig) {
      const currentPos = this.data.rig.getAttribute('position');
      this.data.rig.setAttribute('position', {
        x: this.hitPoint.x,
        y: currentPos.y,
        z: this.hitPoint.z
      });
      this.cancelAim();
    }
  },

  cancelAim: function () {
    // os visuais e a lógica de mira são desligados
    this.isAiming = false;
    this.arcLine.visible = false;
    this.reticle.setAttribute('visible', 'false');
    this.el.emit('mxr-teleport-canceled');
  },

  tick: function () {
    if (!this.isAiming) return;

    const cameraObj = this.el.getObject3D('camera');
    if (!cameraObj) return;

    const startPos = new THREE.Vector3();
    cameraObj.getWorldPosition(startPos);
    startPos.y -= 0.2;

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(cameraObj.getWorldQuaternion(new THREE.Quaternion()));

    // um leve ângulo para cima é adicionado para melhorar o arco
    direction.y += 0.2;
    direction.normalize();

    const velocity = direction.multiplyScalar(this.data.power);
    const gravity = new THREE.Vector3(0, -9.8, 0);
    const dt = 0.05;
    let currentPos = startPos.clone();

    const points = [];
    this.isValidHit = false;

    // o cálculo cinemático de física é executado
    for (let i = 0; i < 40; i++) {
      points.push(currentPos.clone());

      if (currentPos.y <= this.data.floorY) {
        this.hitPoint.copy(currentPos);
        this.hitPoint.y = this.data.floorY;
        this.isValidHit = true;
        break;
      }

      currentPos.add(velocity.clone().multiplyScalar(dt));
      velocity.add(gravity.clone().multiplyScalar(dt));
    }

    this.arcLine.geometry.setFromPoints(points);

    if (this.isValidHit) {
      this.reticle.setAttribute('position', `${this.hitPoint.x} ${this.hitPoint.y + 0.01} ${this.hitPoint.z}`);
      this.reticle.setAttribute('visible', 'true');
    } else {
      this.reticle.setAttribute('visible', 'false');
    }
  }
});
```

---

### File: src/components/xr-passthrough.js

```javascript
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
```

---

### File: src/index.js

```javascript
// é importado o conjunto de ferramentas da biblioteca
import './components/xr-passthrough.js';
import './components/mxr-hand-tracking.js'; // <- nova linha
import './components/mxr-gesture-detector.js'; // <- nova linha
import './components/mxr-teleport.js';
import './components/mxr-grabber.js';  
import './components/mxr-laser-grabber.js'; // <- nova linha
// é registrado no console o carregamento da biblioteca em ambiente de desenvolvimento
console.log('mxr-hand-controller library loaded successfully!');
```

---

### File: src/shaders/passthrough-shader.js

```javascript
// é exportada a estrutura do shader para o passthrough
export const passthroughShader = {
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
```

---

### File: src/workers/hand-worker.js

```javascript
import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

// são declaradas as variáveis globais do worker
let handLandmarker = null;
let isReady = false;

// é executada a inicialização do modelo
async function initializeModel(maxHands, delegate) {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  
  // é aplicado o workaround para contornar o bloqueio de importscripts em modules
  const response = await fetch(vision.wasmLoaderPath);
  const loaderScript = await response.text();
  eval?.(loaderScript); // é injetada a fábrica de módulos (modulefactory) na memória global
  delete vision.wasmLoaderPath; // é deletada a rota para impedir que o mediapipe acione o erro

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: delegate
    },
    runningMode: 'VIDEO',
    numHands: maxHands
  });
  
  isReady = true;
  // é enviada a confirmação de que o modelo carregou
  self.postMessage({ type: 'READY' });
}

// é configurado o ouvinte de mensagens da thread principal
self.onmessage = async (event) => {
  const { type, image, timestamp, maxHands, delegate } = event.data;
  
  if (type === 'INIT') {
    await initializeModel(maxHands, delegate);
    return;
  }
  
  if (type === 'PROCESS' && isReady && image) {
    // é realizada a inferência pela ia
    const results = handLandmarker.detectForVideo(image, timestamp);
    
    // é liberada a memória do bitmap imediatamente
    image.close();
    
    // são devolvidos os pontos estruturados
    self.postMessage({ type: 'RESULT', landmarks: results.landmarks });
  }
};
```

---

### File: examples/basic/index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VR Locomotion & Drag System</title>
  <link rel="stylesheet" href="style.css">
  
  <script src="https://aframe.io/releases/1.4.2/aframe.min.js"></script>
  <script type="module" src="../../src/index.js"></script>
</head>
<body>
  <div id="start-screen">
    <h1>WebXR Hand Engine</h1>
    <p>Please allow camera access to continue.</p>
    <button id="start-btn">Start VR Mode</button>
  </div>

  <a-scene xr-mode-ui="enabled: false"> 
    
    <a-sky color="#87CEEB"></a-sky>
    
    <a-plane 
      position="0 0 0" 
      rotation="-90 0 0" 
      width="50" 
      height="50" 
      color="#808080"
      material="roughness: 1; metalness: 0">
    </a-plane>
    <a-grid position="0 0.01 0"></a-grid>

    <a-box 
      id="target-cube"
      class="grabbable"
      position="0 1.5 -1.5" 
      rotation="0 45 0" 
      color="#4CC3D9"
      animation="property: rotation; to: 0 405 0; loop: true; dur: 3000">
    </a-box>

    <a-entity id="camera-rig" position="0 1.6 0">
      <a-camera 
        id="main-camera" 
        position="0 0 0"
        mxr-hand-tracking="maxHands: 1" 
        mxr-gesture-detector="source: #main-camera"
        mxr-teleport="rig: #camera-rig; floorY: 0"
        mxr-grabber="targetClass: .grabbable; grabRadius: 0.35">
        
        <a-text 
          id="hud-text" 
          value="Status: None" 
          position="0 -0.5 -1" 
          color="#FFF" 
          align="center" 
          width="2">
        </a-text>
      </a-camera>
    </a-entity>
    
  </a-scene>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const startBtn = document.getElementById('start-btn');
      const startScreen = document.getElementById('start-screen');
      const cameraEl = document.getElementById('main-camera');
      const hudText = document.getElementById('hud-text');
      const targetCube = document.getElementById('target-cube');

      let isAiming = false;

      startBtn.addEventListener('click', () => {
        cameraEl.components['mxr-hand-tracking'].startTracking();
        startScreen.style.display = 'none';
      });

      cameraEl.addEventListener('mxr-teleport-aiming', () => {
        isAiming = true;
        hudText.setAttribute('value', 'AIMING (Pinch to Move, Rock to Cancel)');
      });

      cameraEl.addEventListener('mxr-teleport-canceled', () => {
        isAiming = false;
        hudText.setAttribute('value', 'Status: None');
      });

      cameraEl.addEventListener('mxr-grab-start', () => {
        if (!isAiming) hudText.setAttribute('value', 'Status: GRAB');
      });

      cameraEl.addEventListener('mxr-grab-end', () => {
        if (!isAiming) hudText.setAttribute('value', 'Status: None');
      });

      cameraEl.addEventListener('mxr-point-start', () => {
        if (!isAiming) hudText.setAttribute('value', 'Status: POINT');
      });

      cameraEl.addEventListener('mxr-point-end', () => {
        if (!isAiming) hudText.setAttribute('value', 'Status: None');
      });

      cameraEl.addEventListener('mxr-pinch-start', () => {
        if (!isAiming) hudText.setAttribute('value', 'Status: PINCH');
      });

      cameraEl.addEventListener('mxr-pinch-end', () => {
        if (!isAiming) hudText.setAttribute('value', 'Status: None');
      });

      cameraEl.addEventListener('mxr-hand-lost', () => {
        if (!isAiming) hudText.setAttribute('value', 'Status: None');
      });

      // grabber specific visual feedback
      cameraEl.addEventListener('mxr-grab-acquired', (e) => {
        e.detail.el.setAttribute('color', '#00FF00');
        hudText.setAttribute('value', 'Status: HOLDING OBJECT');
      });

      cameraEl.addEventListener('mxr-grab-released', (e) => {
        e.detail.el.setAttribute('color', '#4CC3D9');
        if (!isAiming) hudText.setAttribute('value', 'Status: None');
      });
    });
  </script>
</body>
</html>
```

---

### File: examples/basic/style.css

```css
body { margin: 0; padding: 0; overflow: hidden; background: #000; }
#start-screen {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: #222; color: white; display: flex; flex-direction: column;
  align-items: center; justify-content: center; z-index: 10000; font-family: sans-serif;
}
#start-btn {
  padding: 15px 30px; font-size: 18px; cursor: pointer; background: #4CC3D9; border: none; border-radius: 5px; color: #fff; font-weight: bold;
}
#debug-panel {
  position: absolute; top: 10px; left: 10px; background: rgba(0, 0, 0, 0.8);
  color: white; padding: 15px; border-radius: 8px; z-index: 9999; font-family: monospace; pointer-events: auto;
}
.slider-group { margin-bottom: 10px; }
.slider-group label { display: block; margin-bottom: 5px; }
```

---

