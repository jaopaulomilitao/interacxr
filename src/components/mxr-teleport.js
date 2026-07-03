AFRAME.registerComponent("mxr-teleport", {
  schema: {
    rig: {
      type: "selector",
      default: "#camera-rig",
    },
    // NOVO: define quais objetos bloqueiam o arco e servem de chão
    targetClass: {
      type: "string",
      default: ".navmesh", 
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
    this.raycaster = new THREE.Raycaster(); // NOVO: motor de colisão da curva

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
    this.reticle.setAttribute("radius-inner", "0.18");
    this.reticle.setAttribute("radius-outer", "0.28");
    this.reticle.setAttribute("rotation", "-90 0 0");
    this.reticle.setAttribute("material", "shader:flat;color:#ffffff;transparent:true;opacity:0.85");
    this.reticle.setAttribute("visible", false);

    this.el.sceneEl.appendChild(this.reticle);
  },

  bindEvents() {
    this.onActivate = this.onActivate.bind(this);
    this.onConfirm = this.onConfirm.bind(this);
    this.onHandLost = this.onHandLost.bind(this);

    this.el.addEventListener(`mxr-${this.data.activationPose}-start`, this.onActivate);
    this.el.addEventListener(`mxr-${this.data.confirmPose}-start`, this.onConfirm);
    this.el.addEventListener("mxr-hand-lost", this.onHandLost);
  },

  remove() {
    this.el.removeEventListener(`mxr-${this.data.activationPose}-start`, this.onActivate);
    this.el.removeEventListener(`mxr-${this.data.confirmPose}-start`, this.onConfirm);
    this.el.removeEventListener("mxr-hand-lost", this.onHandLost);

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

    if (!MXRInteractionManager.request("teleport", this)) {
      return;
    }

    this.isAiming = true;
    this.arcLine.visible = this.data.showArc;
  },

  onConfirm() {
    if (!this.isAiming || !this.isValidHit || !this.data.rig) {
      return;
    }

    // NOVO: feedback visual preenchendo o cursor instantaneamente
    const cursor = this.el.components["mxr-cursor"];
    if (cursor && typeof cursor.setCursorActive === 'function') {
      cursor.setCursorActive(true);
      setTimeout(() => {
        if (this.el.components["mxr-cursor"]) {
          this.el.components["mxr-cursor"].setCursorActive(false);
        }
      }, 150);
    }

    // NOVO: o eixo Y agora adota a altura exata do obstáculo atingido
    this.data.rig.setAttribute("position", {
      x: this.hitPoint.x,
      y: this.hitPoint.y,
      z: this.hitPoint.z,
    });

    this.cancel();
  },

  onHandLost() {},

  cancel() {
    this.isAiming = false;
    this.isValidHit = false;
    this.arcLine.visible = false;
    this.reticle.setAttribute("visible", false);
    MXRInteractionManager.release(this);
  },

  tick() {
    if (!this.isAiming) return;

    const camera = this.el.getObject3D("camera");
    if (!camera) return;

    const startPos = new THREE.Vector3();
    camera.getWorldPosition(startPos);
    startPos.y -= 0.2;

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    direction.y += 0.2;
    direction.normalize();

    const velocity = direction.multiplyScalar(this.data.power);
    const gravity = new THREE.Vector3(0, -9.8, 0);
    const dt = 0.05;

    let currentPos = startPos.clone();
    const points = [currentPos.clone()];
    this.isValidHit = false;

    // NOVO: mapeia os objetos físicos do cenário que bloqueiam o teleporte
    const objects = Array.from(this.el.sceneEl.querySelectorAll(this.data.targetClass))
      .map((e) => e.object3D).filter(Boolean);

    for (let i = 0; i < 40; i++) {
      let nextPos = currentPos.clone().add(velocity.clone().multiplyScalar(dt));
      velocity.add(gravity.clone().multiplyScalar(dt));

      // NOVO: atira um raycast para verificar colisão no segmento atual da parábola
      let stepDirection = nextPos.clone().sub(currentPos);
      let stepDistance = stepDirection.length();
      stepDirection.normalize();

      this.raycaster.set(currentPos, stepDirection);
      let intersects = this.raycaster.intersectObjects(objects, true);

      if (intersects.length > 0 && intersects[0].distance <= stepDistance) {
        // bateu em um objeto (degrau, cubo, plataforma)
        this.hitPoint.copy(intersects[0].point);
        this.isValidHit = true;
        points.push(this.hitPoint.clone());
        break;
      }

      // FALLBACK: se não bater em nada, para no chão infinito (floorY)
      if (nextPos.y <= this.data.floorY) {
        let ratio = (currentPos.y - this.data.floorY) / (currentPos.y - nextPos.y);
        this.hitPoint.lerpVectors(currentPos, nextPos, ratio);
        this.isValidHit = true;
        points.push(this.hitPoint.clone());
        break;
      }

      currentPos = nextPos;
      points.push(currentPos.clone());
    }

    if (this.data.showArc) {
      this.arcLine.geometry.setFromPoints(points);
    }

    this.reticle.setAttribute("visible", this.isValidHit);

    if (this.isValidHit) {
      this.reticle.setAttribute(
        "position",
        `${this.hitPoint.x} ${this.hitPoint.y + 0.01} ${this.hitPoint.z}`,
      );
    }
  },
});