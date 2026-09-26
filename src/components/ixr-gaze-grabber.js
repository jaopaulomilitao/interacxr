AFRAME.registerComponent("ixr-gaze-grabber", {
  schema: {
    targetClass: { type: "string", default: ".grabbable" },
    activationPose: { type: "string", default: "victory" },
    grabPose: { type: "string", default: "grab" },
    grabOpacity: { type: "number", default: 0.35 },
    grabSmoothing: { type: "number", default: 0.2 },
    pushPullMultiplier: { type: "number", default: 10.0 },
    showHUD: { type: "boolean", default: false }
  },

  init() {
    this.isAiming = false;
    this.grabbedElement = null;
    
    this.lockedDistance = 0;
    this.baseLockedDistance = 0;
    this.initialHandSize = null;

    this.cameraPosition = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.originalMaterials = new WeakMap();

    if (this.data.showHUD) {
      this.createHUD();
    }
    this.bindEvents();
  },

  createHUD() {
    this.hud = document.createElement("a-text");
    this.hud.setAttribute("position", "0 -0.45 -1");
    this.hud.setAttribute("align", "center");
    this.hud.setAttribute("width", "2");
    this.hud.setAttribute("value", "Idle");
    this.hud.setAttribute("color", "#FFFFFF");
    this.el.appendChild(this.hud);
  },

  setHUD(text) {
    if (!this.hud) return;
    this.hud.setAttribute("value", text);
  },

  bindEvents() {
    this.onAimStart = this.onAimStart.bind(this);
    this.onAimEnd = this.onAimEnd.bind(this);
    this.onGrabStart = this.onGrabStart.bind(this);
    this.onGrabMove = this.onGrabMove.bind(this);
    this.onGrabEnd = this.onGrabEnd.bind(this);
    this.onHandLost = this.onHandLost.bind(this);

    this.el.addEventListener(`ixr-${this.data.activationPose}-start`, this.onAimStart);
    this.el.addEventListener(`ixr-${this.data.activationPose}-end`, this.onAimEnd);
    this.el.addEventListener(`ixr-${this.data.grabPose}-start`, this.onGrabStart);
    this.el.addEventListener(`ixr-${this.data.grabPose}-move`, this.onGrabMove);
    this.el.addEventListener(`ixr-${this.data.grabPose}-end`, this.onGrabEnd);
    this.el.addEventListener("ixr-hand-lost", this.onHandLost);
  },

  remove() {
    this.el.removeEventListener(`ixr-${this.data.activationPose}-start`, this.onAimStart);
    this.el.removeEventListener(`ixr-${this.data.activationPose}-end`, this.onAimEnd);
    this.el.removeEventListener(`ixr-${this.data.grabPose}-start`, this.onGrabStart);
    this.el.removeEventListener(`ixr-${this.data.grabPose}-move`, this.onGrabMove);
    this.el.removeEventListener(`ixr-${this.data.grabPose}-end`, this.onGrabEnd);
    this.el.removeEventListener("ixr-hand-lost", this.onHandLost);
  },

  onAimStart() {
    if (!ixrInteractionManager.request("grab", this)) return;
    this.isAiming = true;
    this.setHUD("Aiming");
  },

  onAimEnd() {
    if (this.grabbedElement) return;
    this.isAiming = false;
    ixrInteractionManager.release(this);
    this.setHUD("Idle");
  },

  onGrabStart(event) {
    if (!this.isAiming) return;

    const cursor = this.el.components["ixr-cursor"];
    if (!cursor) return;

    const hovered = cursor.getHoveredElement();
    if (!hovered || !hovered.matches(this.data.targetClass)) return;

    this.grabbedElement = hovered;

    // a bolinha é preenchida
    cursor.setCursorActive(true);

    const cameraObj = this.el.getObject3D("camera");
    const worldPos = new THREE.Vector3();
    cameraObj.getWorldPosition(this.cameraPosition);
    this.grabbedElement.object3D.getWorldPosition(worldPos);

    this.baseLockedDistance = worldPos.distanceTo(this.cameraPosition);
    this.lockedDistance = this.baseLockedDistance;

    if (event.detail && event.detail.handSize) {
      this.initialHandSize = event.detail.handSize;
    } else {
      this.initialHandSize = null;
    }

    this.applyGrabMaterial(this.grabbedElement);
    this.setHUD("Holding");
  },

  onGrabMove(event) {
    if (!this.grabbedElement || !this.initialHandSize || !event.detail || !event.detail.handSize) return;

    const currentHandSize = event.detail.handSize;
    const sizeDelta = this.initialHandSize - currentHandSize;
    
    this.lockedDistance = Math.max(0.4, this.baseLockedDistance + (sizeDelta * this.data.pushPullMultiplier));
  },

  onGrabEnd() {
    if (!this.grabbedElement) return;
    
    // o preenchimento da bolinha é removido
    const cursor = this.el.components["ixr-cursor"];
    if (cursor) cursor.setCursorActive(false);

    this.restoreMaterial(this.grabbedElement);
    this.grabbedElement = null;
    this.isAiming = false;
    ixrInteractionManager.release(this);
    this.setHUD("Idle");
  },

  onHandLost() {
    this.onGrabEnd();
    this.onAimEnd();
  },

  saveMaterial(el) {
    if (this.originalMaterials.has(el)) return;
    const mesh = el.getObject3D("mesh");
    if (!mesh || !mesh.material) return;
    this.originalMaterials.set(el, {
      opacity: mesh.material.opacity,
      transparent: mesh.material.transparent,
    });
  },

  restoreMaterial(el) {
    const mesh = el.getObject3D("mesh");
    const data = this.originalMaterials.get(el);
    if (!mesh || !mesh.material || !data) return;
    mesh.material.opacity = data.opacity;
    mesh.material.transparent = data.transparent;
  },

  applyGrabMaterial(el) {
    const mesh = el.getObject3D("mesh");
    if (!mesh || !mesh.material) return;
    this.saveMaterial(el);
    mesh.material.opacity = this.data.grabOpacity;
    mesh.material.transparent = true;
  },

  tick() {
    if (this.grabbedElement) {
      const camera = this.el.getObject3D("camera");
      if (!camera) return;

      camera.getWorldPosition(this.cameraPosition);
      camera.getWorldDirection(this.cameraDirection);

      this.targetPosition.copy(this.cameraPosition);
      this.targetPosition.add(this.cameraDirection.clone().multiplyScalar(this.lockedDistance));

      const pos = this.grabbedElement.object3D.position;
      pos.lerp(this.targetPosition, this.data.grabSmoothing);
      this.grabbedElement.setAttribute("position", `${pos.x} ${pos.y} ${pos.z}`);
    }
  }
});