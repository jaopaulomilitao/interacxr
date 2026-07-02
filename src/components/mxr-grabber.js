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