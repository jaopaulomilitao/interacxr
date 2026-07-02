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