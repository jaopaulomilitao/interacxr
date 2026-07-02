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