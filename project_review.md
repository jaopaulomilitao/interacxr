# InteracXR: WebXR Hand Tracking & Interaction Engine

## 1. Project Objective
Develop a high-performance, low-cost WebXR hand-tracking library for mobile devices using MediaPipe and A-Frame. The focus is to democratize immersive virtual reality (VR) interactions, such as spatial manipulation and locomotion, without the need for expensive dedicated headsets (e.g., Meta Quest).


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
      mxr-gaze-grabber.js
      mxr-gesture-detector.js
      mxr-hand-model.js
      mxr-hand-tracking.js
      mxr-hud.js
      mxr-teleport.js
      xr-passthrough.js
    core
      mxr-interaction-manager.js
    index.js
    shaders
      passthrough-shader.js
    utils
    workers
      hand-worker.js
```

---

## 5. Codebase Files

### File: src/components/mxr-gaze-grabber.js

```javascript
AFRAME.registerComponent("mxr-gaze-grabber", {
  schema: {
    targetClass: {
      type: "string",
      default: ".grabbable",
    },

    activationPose: {
      type: "string",
      default: "victory",
    },

    grabPose: {
      type: "string",
      default: "grab",
    },

    hoverOpacity: {
      type: "number",
      default: 0.45,
    },

    grabOpacity: {
      type: "number",
      default: 0.35,
    },

    grabSmoothing: {
      type: "number",
      default: 0.2,
    },

    maxDistance: {
      type: "number",
      default: 10,
    },

    showCursor: {
      type: "boolean",
      default: true,
    },

    cursorSize: {
      type: "number",
      default: 0.01,
    },

    cursorColor: {
      type: "color",
      default: "#FFFFFF",
    },

    showHUD: {
      type: "boolean",
      default: true,
    },
  },

  init() {
    this.isAiming = false;

    this.hoveredElement = null;

    this.grabbedElement = null;

    this.lockedDistance = 0;

    this.cameraPosition = new THREE.Vector3();

    this.cameraDirection = new THREE.Vector3();

    this.targetPosition = new THREE.Vector3();

    this.raycaster = new THREE.Raycaster();

    this.originalMaterials = new WeakMap();

    this.cursor = this.createCursor();

    if (this.data.showHUD) {
      this.createHUD();
    }

    this.bindEvents();
  },

  createCursor() {
    const geometry = new THREE.RingGeometry(
      this.data.cursorSize,

      this.data.cursorSize * 1.5,

      32,
    );

    const material = new THREE.MeshBasicMaterial({
      color: this.data.cursorColor,

      transparent: true,

      opacity: 0.9,

      depthTest: false,

      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(
      geometry,

      material,
    );

    mesh.position.set(
      0,

      0,

      -1,
    );

    mesh.visible = false;

    this.el.object3D.add(mesh);

    return mesh;
  },

  createHUD() {
    this.hud = document.createElement("a-text");

    this.hud.setAttribute(
      "position",

      "0 -0.45 -1",
    );

    this.hud.setAttribute(
      "align",

      "center",
    );

    this.hud.setAttribute(
      "width",

      "2",
    );

    this.hud.setAttribute(
      "value",

      "Idle",
    );

    this.hud.setAttribute(
      "color",

      "#FFFFFF",
    );

    this.el.appendChild(this.hud);
  },

  setHUD(text) {
    if (!this.hud) return;

    this.hud.setAttribute(
      "value",

      text,
    );
  },

  bindEvents() {
    this.onAimStart = this.onAimStart.bind(this);

    this.onAimEnd = this.onAimEnd.bind(this);

    this.onGrabStart = this.onGrabStart.bind(this);

    this.onGrabEnd = this.onGrabEnd.bind(this);

    this.onHandLost = this.onHandLost.bind(this);

    this.el.addEventListener(
      `mxr-${this.data.activationPose}-start`,

      this.onAimStart,
    );

    this.el.addEventListener(
      `mxr-${this.data.activationPose}-end`,

      this.onAimEnd,
    );

    this.el.addEventListener(
      `mxr-${this.data.grabPose}-start`,

      this.onGrabStart,
    );

    this.el.addEventListener(
      `mxr-${this.data.grabPose}-end`,

      this.onGrabEnd,
    );

    this.el.addEventListener(
      "mxr-hand-lost",

      this.onHandLost,
    );
  },

  remove() {
    this.el.removeEventListener(
      `mxr-${this.data.activationPose}-start`,

      this.onAimStart,
    );

    this.el.removeEventListener(
      `mxr-${this.data.activationPose}-end`,

      this.onAimEnd,
    );

    this.el.removeEventListener(
      `mxr-${this.data.grabPose}-start`,

      this.onGrabStart,
    );

    this.el.removeEventListener(
      `mxr-${this.data.grabPose}-end`,

      this.onGrabEnd,
    );

    this.el.removeEventListener(
      "mxr-hand-lost",

      this.onHandLost,
    );
  },

  onAimStart() {
    if (
      !MXRInteractionManager.request(
        "grab",

        this,
      )
    ) {
      return;
    }

    this.isAiming = true;

    this.cursor.visible = true;

    this.setHUD("Aiming");
  },

  onAimEnd() {
    if (this.grabbedElement) {
      return;
    }

    this.isAiming = false;

    this.cursor.visible = false;

    this.clearHover();

    MXRInteractionManager.release(this);

    this.setHUD("Idle");
  },

  onGrabStart() {
    if (!this.hoveredElement) {
      return;
    }

    this.grabbedElement = this.hoveredElement;

    const cameraObj = this.el.getObject3D("camera");

    const worldPos = new THREE.Vector3();

    cameraObj.getWorldPosition(this.cameraPosition);

    this.grabbedElement.object3D.getWorldPosition(worldPos);

    this.lockedDistance = worldPos.distanceTo(this.cameraPosition);

    this.applyGrabMaterial(this.grabbedElement);

    this.setHUD("Holding");
  },

  onGrabEnd() {
    if (!this.grabbedElement) {
      return;
    }

    this.restoreMaterial(this.grabbedElement);

    this.grabbedElement = null;

    this.isAiming = false;

    this.cursor.visible = false;

    this.clearHover();

    MXRInteractionManager.release(this);

    this.setHUD("Idle");
  },

  onHandLost() {
    this.onGrabEnd();

    this.onAimEnd();
  },

  saveMaterial(el) {
    if (this.originalMaterials.has(el)) {
      return;
    }

    const mesh = el.getObject3D("mesh");

    if (!mesh || !mesh.material) {
      return;
    }

    this.originalMaterials.set(
      el,

      {
        opacity: mesh.material.opacity,

        transparent: mesh.material.transparent,
      },
    );
  },

  restoreMaterial(el) {
    const mesh = el.getObject3D("mesh");

    const data = this.originalMaterials.get(el);

    if (!mesh || !mesh.material || !data) {
      return;
    }

    mesh.material.opacity = data.opacity;

    mesh.material.transparent = data.transparent;
  },

  applyGrabMaterial(el) {
    const mesh = el.getObject3D("mesh");

    if (!mesh || !mesh.material) {
      return;
    }

    this.saveMaterial(el);

    mesh.material.opacity = this.data.grabOpacity;

    mesh.material.transparent = true;
  },

  setHover(el) {
    if (this.hoveredElement === el) {
      return;
    }

    this.clearHover();

    this.hoveredElement = el;

    this.saveMaterial(el);
  },

  clearHover() {
    if (!this.hoveredElement) {
      return;
    }

    if (this.hoveredElement !== this.grabbedElement) {
      this.restoreMaterial(this.hoveredElement);
    }

    this.hoveredElement = null;
  },

  tick() {
    const camera = this.el.getObject3D("camera");

    if (!camera) {
      return;
    }

    camera.getWorldPosition(this.cameraPosition);

    camera.getWorldDirection(this.cameraDirection);

    if (this.isAiming && !this.grabbedElement) {
      this.raycaster.set(
        this.cameraPosition,

        this.cameraDirection,
      );

      const objects = Array.from(
        this.el.sceneEl.querySelectorAll(this.data.targetClass),
      )

        .map((e) => e.object3D)

        .filter(Boolean);

      const intersections = this.raycaster.intersectObjects(
        objects,

        true,
      );

      if (intersections.length) {
        let hit = intersections[0].object;

        while (hit.parent && !hit.el) {
          hit = hit.parent;
        }

        this.setHover(hit.el);
      } else {
        this.clearHover();
      }
    }

    if (this.hoveredElement && !this.grabbedElement) {
      const mesh = this.hoveredElement.getObject3D("mesh");

      if (mesh && mesh.material) {
        const pulse = 0.65 + Math.sin(performance.now() * 0.005) * 0.2;

        mesh.material.opacity = pulse;

        mesh.material.transparent = true;
      }
    }

    if (this.grabbedElement) {
      this.targetPosition.copy(this.cameraPosition);

      this.targetPosition.add(
        this.cameraDirection

          .clone()

          .multiplyScalar(this.lockedDistance),
      );

      const pos = this.grabbedElement.object3D.position;

      pos.lerp(
        this.targetPosition,

        this.data.grabSmoothing,
      );

      this.grabbedElement.setAttribute(
        "position",

        `${pos.x} ${pos.y} ${pos.z}`,
      );
    }
  },
});

```

---

### File: src/components/mxr-gesture-detector.js

```javascript
AFRAME.registerComponent("mxr-gesture-detector", {
  schema: {
    source: {
      type: "selector",
      default: "#main-camera",
    },
  },

  init() {
    this.states = {
      grab: false,

      victory: false,

      rock: false,

      point: false,

      pinch: false,
    };

    this.onHandData = this.onHandData.bind(this);

    this.data.source.addEventListener(
      "mxr-hand-data",

      this.onHandData,
    );
  },

  remove() {
    this.data.source.removeEventListener(
      "mxr-hand-data",

      this.onHandData,
    );
  },

  emitPose(name, state, payload = {}) {
    const start = `mxr-${name}-start`;

    const move = `mxr-${name}-move`;

    const end = `mxr-${name}-end`;

    if (state && !this.states[name]) {
      this.states[name] = true;

      this.el.emit(
        start,

        payload,
      );

      return;
    }

    if (state && this.states[name]) {
      this.el.emit(
        move,

        payload,
      );

      return;
    }

    if (!state && this.states[name]) {
      this.states[name] = false;

      this.el.emit(
        end,

        payload,
      );
    }
  },

  reset() {
    Object.keys(this.states).forEach((pose) => {
      if (this.states[pose]) {
        this.states[pose] = false;

        this.el.emit(`mxr-${pose}-end`);
      }
    });

    this.el.emit("mxr-hand-lost");
  },

  distance(a, b) {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2),
    );
  },

  onHandData(event) {
    const hand = event.detail.landmarks;

    if (!hand) {
      this.reset();

      return;
    }

    const wrist = hand[0];

    const index =
      this.distance(
        hand[8],

        wrist,
      ) >
      this.distance(
        hand[6],

        wrist,
      );

    const middle =
      this.distance(
        hand[12],

        wrist,
      ) >
      this.distance(
        hand[10],

        wrist,
      );

    const ring =
      this.distance(
        hand[16],

        wrist,
      ) >
      this.distance(
        hand[14],

        wrist,
      );

    const pinky =
      this.distance(
        hand[20],

        wrist,
      ) >
      this.distance(
        hand[18],

        wrist,
      );

    const grab = !index && !middle && !ring && !pinky;

    const victory = index && middle && !ring && !pinky;

    const rock = index && pinky && !middle && !ring;

    const point = index && !middle && !ring && !pinky;

    const pinch =
      this.distance(
        hand[4],

        hand[8],
      ) < 0.04;

    this.emitPose(
      "grab",

      grab,
    );

    this.emitPose(
      "victory",

      victory,
    );

    this.emitPose(
      "rock",

      rock,
    );

    this.emitPose(
      "point",

      point,
    );

    this.emitPose(
      "pinch",

      pinch,
    );
  },
});

```

---

### File: src/components/mxr-hand-model.js

```javascript
AFRAME.registerComponent("mxr-hand-model", {
  schema: {
    source: { type: "selector" },

    jointRadius: { default: 0.012 },

    jointSmoothing: { default: 0.35 },

    boneRadius: { default: 0.004 },
  },

  init() {
    this.joints = [];

    this.bones = [];

    this.targets = [];

    this.handVisible = false;

    this.tmpMid = new THREE.Vector3();

    this.tmpDir = new THREE.Vector3();

    this.up = new THREE.Vector3(0, 1, 0);

    this.onHandData = this.onHandData.bind(this);

    const jointMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    const boneMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    for (let i = 0; i < 21; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(this.data.jointRadius, 12, 12),

        jointMaterial,
      );

      mesh.visible = false;

      this.el.object3D.add(mesh);

      this.joints.push(mesh);

      this.targets.push(new THREE.Vector3());
    }

    this.connections = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],

      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],

      [0, 9],
      [9, 10],
      [10, 11],
      [11, 12],

      [0, 13],
      [13, 14],
      [14, 15],
      [15, 16],

      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20],
    ];

    this.connections.forEach(() => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(
          this.data.boneRadius,

          this.data.boneRadius,

          1,

          8,
        ),

        boneMaterial,
      );

      mesh.visible = false;

      this.el.object3D.add(mesh);

      this.bones.push(mesh);
    });

    this.data.source.addEventListener(
      "mxr-hand-data",

      this.onHandData,
    );
  },

  remove() {
    this.data.source.removeEventListener(
      "mxr-hand-data",

      this.onHandData,
    );
  },

  mapPoint(lm) {
    const camera = this.el.sceneEl.camera;

    const calibration = window.MXRCalibration;

    const depth = calibration.baseDepth;

    const aspect = calibration.aspect;

    const xScale = calibration.xScale || 1;

    const yScale = calibration.yScale || 1;

    const vfov = THREE.MathUtils.degToRad(camera.fov);

    const visibleHeight = 2 * Math.tan(vfov * 0.5) * depth;

    const visibleWidth = visibleHeight * aspect;

    const x = (lm.x - 0.5) * visibleWidth * xScale;

    const y = -(lm.y - 0.5) * visibleHeight * yScale;

    const z = -depth + lm.z * visibleWidth;

    return new THREE.Vector3(
      x,

      y,

      z,
    );
  },

  onHandData(e) {
    const hand = e.detail.landmarks;

    if (!hand) {
      this.handVisible = false;

      this.joints.forEach((j) => {
        j.visible = false;
      });

      this.bones.forEach((b) => {
        b.visible = false;
      });

      for (let i = 0; i < 21; i++) {
        this.targets[i].set(
          0,

          0,

          0,
        );
      }

      return;
    }

    this.handVisible = true;

    for (let i = 0; i < 21; i++) {
      this.targets[i].copy(this.mapPoint(hand[i]));
    }
  },

  tick() {
    if (!this.handVisible) {
      return;
    }

    for (let i = 0; i < 21; i++) {
      const mesh = this.joints[i];

      mesh.visible = true;

      mesh.position.lerp(
        this.targets[i],

        this.data.jointSmoothing,
      );
    }

    for (let i = 0; i < this.connections.length; i++) {
      const bone = this.bones[i];

      const a = this.joints[this.connections[i][0]];

      const b = this.joints[this.connections[i][1]];

      bone.visible = true;

      this.tmpMid

        .addVectors(
          a.position,

          b.position,
        )

        .multiplyScalar(0.5);

      bone.position.copy(this.tmpMid);

      this.tmpDir.subVectors(
        b.position,

        a.position,
      );

      bone.scale.set(
        1,

        this.tmpDir.length(),

        1,
      );

      bone.quaternion.setFromUnitVectors(
        this.up,

        this.tmpDir.normalize(),
      );
    }
  },
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

  init() {
    this.isProcessing = false;
    this.videoElement = null;
    this.stream = null;

    window.MXRCalibration = {
      aspect: 16 / 9,

      cameraAspect: 16 / 9,

      viewportAspect: 1,

      baseDepth: 0.5,

      xScale: 1.2,

      yScale: 1.0,
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
        window.MXRCalibration.cameraAspect = this.videoElement.videoWidth / this.videoElement.videoHeight;

        window.MXRCalibration.aspect = window.MXRCalibration.cameraAspect;

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
    if (
      !this.videoElement ||
      this.isProcessing ||
      this.videoElement.readyState < 2 // HAVE_CURRENT_DATA
    ) {
      return;
    }

    this.isProcessing = true;

    try {
      const bitmap = await createImageBitmap(this.videoElement);

      this.worker.postMessage(
        {
          type: "PROCESS",
          image: bitmap,
          timestamp: time,
        },
        [bitmap],
      );
    } catch (err) {
      // importante: libera o lock do pipeline mesmo em erro
      console.warn("[mxr-hand-tracking] Frame skipped:", err);
      this.isProcessing = false;
    }
  },

  remove() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }

    if (this.worker) {
      this.worker.terminate();
    }

    this.videoElement = null;
    this.stream = null;
  },
});

```

---

### File: src/components/mxr-hud.js

```javascript
AFRAME.registerComponent("mxr-hud", {
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

    window.MXRHUD = this;

    window.addEventListener(
      "mxr-mode-change",

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

```

---

### File: src/components/mxr-teleport.js

```javascript
AFRAME.registerComponent("mxr-teleport", {
  schema: {
    rig: {
      type: "selector",
      default: "#camera-rig",
    },

    activationPose: {
      type: "string",
      default: "rock",
    },

    confirmPose: {
      type: "string",
      default: "pinch",
    },

    cancelPose: {
      type: "string",
      default: "rock",
    },

    power: {
      type: "number",
      default: 6,
    },

    floorY: {
      type: "number",
      default: 0,
    },

    showArc: {
      type: "boolean",
      default: true,
    },
  },

  init() {
    this.isAiming = false;

    this.isValidHit = false;

    this.hitPoint = new THREE.Vector3();

    this.createArc();

    this.createReticle();

    this.bindEvents();
  },

  createArc() {
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,

      transparent: true,

      opacity: 0.9,

      blending: THREE.DifferenceBlending,
    });

    this.arcLine = new THREE.Line(
      new THREE.BufferGeometry(),

      material,
    );

    this.arcLine.visible = false;

    this.el.sceneEl.object3D.add(this.arcLine);
  },

  createReticle() {
    this.reticle = document.createElement("a-ring");

    this.reticle.setAttribute(
      "radius-inner",

      "0.18",
    );

    this.reticle.setAttribute(
      "radius-outer",

      "0.28",
    );

    this.reticle.setAttribute(
      "rotation",

      "-90 0 0",
    );

    this.reticle.setAttribute(
      "material",

      "shader:flat;color:#ffffff;transparent:true;opacity:0.85",
    );

    this.reticle.setAttribute(
      "visible",

      false,
    );

    this.el.sceneEl.appendChild(this.reticle);
  },

  bindEvents() {
    this.onActivate = this.onActivate.bind(this);

    this.onConfirm = this.onConfirm.bind(this);

    this.onHandLost = this.onHandLost.bind(this);

    this.el.addEventListener(
      `mxr-${this.data.activationPose}-start`,

      this.onActivate,
    );

    this.el.addEventListener(
      `mxr-${this.data.confirmPose}-start`,

      this.onConfirm,
    );

    this.el.addEventListener(
      "mxr-hand-lost",

      this.onHandLost,
    );
  },

  remove() {
    this.el.removeEventListener(
      `mxr-${this.data.activationPose}-start`,

      this.onActivate,
    );

    this.el.removeEventListener(
      `mxr-${this.data.confirmPose}-start`,

      this.onConfirm,
    );

    this.el.removeEventListener(
      "mxr-hand-lost",

      this.onHandLost,
    );

    this.el.sceneEl.object3D.remove(this.arcLine);

    if (this.reticle.parentNode) {
      this.reticle.parentNode.removeChild(this.reticle);
    }
  },

  onActivate() {
    if (this.isAiming) {
      this.cancel();

      return;
    }

    if (
      !MXRInteractionManager.request(
        "teleport",

        this,
      )
    ) {
      return;
    }

    this.isAiming = true;

    this.arcLine.visible = this.data.showArc;

    window.MXRHUD?.setText("Teleport");
  },

  onConfirm() {
    if (!this.isAiming) {
      return;
    }

    if (!this.isValidHit) {
      return;
    }

    if (!this.data.rig) {
      return;
    }

    const current = this.data.rig.getAttribute("position");

    this.data.rig.setAttribute(
      "position",

      {
        x: this.hitPoint.x,

        y: current.y,

        z: this.hitPoint.z,
      },
    );

    this.cancel();
  },

  onHandLost() {},

  cancel() {
    this.isAiming = false;

    this.isValidHit = false;

    this.arcLine.visible = false;

    this.reticle.setAttribute(
      "visible",

      false,
    );

    MXRInteractionManager.release(this);

    window.MXRHUD?.setText("Idle");
  },

  tick() {
    if (!this.isAiming) {
      return;
    }

    const camera = this.el.getObject3D("camera");

    if (!camera) {
      return;
    }

    const startPos = new THREE.Vector3();

    camera.getWorldPosition(startPos);

    startPos.y -= 0.2;

    const direction = new THREE.Vector3(
      0,

      0,

      -1,
    );

    direction.applyQuaternion(
      camera.getWorldQuaternion(new THREE.Quaternion()),
    );

    direction.y += 0.2;

    direction.normalize();

    const velocity = direction.multiplyScalar(this.data.power);

    const gravity = new THREE.Vector3(
      0,

      -9.8,

      0,
    );

    const dt = 0.05;

    let currentPos = startPos.clone();

    const points = [];

    this.isValidHit = false;

    for (let i = 0; i < 40; i++) {
      points.push(currentPos.clone());

      if (currentPos.y <= this.data.floorY) {
        this.hitPoint.copy(currentPos);

        this.hitPoint.y = this.data.floorY;

        this.isValidHit = true;

        break;
      }

      currentPos.add(
        velocity
          .clone()

          .multiplyScalar(dt),
      );

      velocity.add(
        gravity
          .clone()

          .multiplyScalar(dt),
      );
    }

    if (this.data.showArc) {
      this.arcLine.geometry.setFromPoints(points);
    }

    this.reticle.setAttribute(
      "visible",

      this.isValidHit,
    );

    if (this.isValidHit) {
      this.reticle.setAttribute(
        "position",

        `${this.hitPoint.x} ${this.hitPoint.y + 0.01} ${this.hitPoint.z}`,
      );
    }
  },
});

```

---

### File: src/components/xr-passthrough.js

```javascript
import { passthroughShader } from "../shaders/passthrough-shader.js";

AFRAME.registerComponent("xr-passthrough", {
  schema: {
    k1: { type: "number", default: 0.0 },
    zoom: { type: "number", default: 1.0 },
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

      -10,
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

```

---

### File: src/core/mxr-interaction-manager.js

```javascript
window.MXRInteractionManager = {
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

```

---

### File: src/index.js

```javascript
import "./core/mxr-interaction-manager.js";

import "./components/mxr-hud.js";

import "./components/mxr-hand-tracking.js";

import "./components/mxr-gesture-detector.js";

import "./components/mxr-hand-model.js";

import "./components/mxr-gaze-grabber.js";

import "./components/mxr-teleport.js";

console.log("InteracXR loaded");

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

  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>InteracXR V2 Demo</title>

  <link rel="stylesheet" href="./style.css" />

  <script src="https://aframe.io/releases/1.4.2/aframe.min.js"></script>

  <script type="module" src="../../src/index.js"></script>

</head>

<body>

  <div id="start-screen">

    <h1>InteracXR</h1>

    <p>allow camera access</p>

    <button id="start-btn">

      start experience

    </button>

  </div>

  <a-scene xr-mode-ui="enabled:false" background="color:#111" renderer="colorManagement:true">

    <a-sky color="#87CEEB"></a-sky>

    <a-plane position="0 0 0" rotation="-90 0 0" width="50" height="50" color="#808080"
      material="roughness:1;metalness:0">

    </a-plane>

    <a-grid position="0 0.01 0">

    </a-grid>

    <a-box id="cube" class="grabbable" position="0 1.5 -1.5" rotation="0 45 0" color="#4CC3D9" animation="
property:rotation;
to:0 405 0;
loop:true;
dur:3000">

    </a-box>

    <a-sphere id="sphere" class="grabbable" radius="0.20" position="0.7 1.5 -2" color="#ff3366">

    </a-sphere>

    <a-cylinder id="cylinder" class="grabbable" position="-0.7 1.5 -2" radius="0.15" height="0.40" color="#00ff88">

    </a-cylinder>

    <a-entity id="camera-rig" position="0 1.6 0">

      <a-camera id="main-camera" position="0 0 0" mxr-hand-tracking="

maxHands:1

" mxr-gesture-detector="

source:#main-camera

" mxr-hand-model="

source:#main-camera

" mxr-gaze-grabber="

targetClass:.grabbable;

activationPose:victory;

grabPose:grab;

hoverOpacity:0.45;

grabOpacity:0.35;

grabSmoothing:0.2;

maxDistance:10;

showCursor:true

" mxr-teleport="

rig:#camera-rig;

activationPose:rock;

confirmPose:pinch;

cancelPose:grab;

power:6;

floorY:0;

showArc:true

">

      </a-camera>

    </a-entity>

  </a-scene>

  <script>

    document
      .getElementById(

        "start-btn"

      )

      .addEventListener(

        "click",

        () => {

          const camera =

            document.getElementById(

              "main-camera"

            );

          camera

            .components

          ["mxr-hand-tracking"]

            .startTracking();

          document

            .getElementById(

              "start-screen"

            )

            .style.display =

            "none";

        }

      );

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

