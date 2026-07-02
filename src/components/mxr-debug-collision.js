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