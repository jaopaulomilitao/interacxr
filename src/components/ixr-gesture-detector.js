AFRAME.registerComponent("ixr-gesture-detector", {
  schema: {
    source: {
      type: "selector",
      default: "#main-camera",
    },
  },

  init() {
    this.states = { grab: false, victory: false, rock: false, point: false, pinch: false };
    this.onHandData = this.onHandData.bind(this);
    this.data.source.addEventListener("ixr-hand-data", this.onHandData);
  },

  remove() {
    this.data.source.removeEventListener("ixr-hand-data", this.onHandData);
  },

  emitPose(name, state, payload = {}) {
    const start = `ixr-${name}-start`;
    const move = `ixr-${name}-move`;
    const end = `ixr-${name}-end`;

    if (state && !this.states[name]) {
      this.states[name] = true;
      this.el.emit(start, payload);
      return;
    }

    if (state && this.states[name]) {
      this.el.emit(move, payload);
      return;
    }

    if (!state && this.states[name]) {
      this.states[name] = false;
      this.el.emit(end, payload);
    }
  },

  reset() {
    Object.keys(this.states).forEach((pose) => {
      if (this.states[pose]) {
        this.states[pose] = false;
        this.el.emit(`ixr-${pose}-end`);
      }
    });
    this.el.emit("ixr-hand-lost");
  },

  distance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
  },

  // a lógica acompanha rigorosamente o modelo visual físico
  getWorldPosition(landmark) {
    const cal = window.ixrCalibration;
    if (!cal) return null;

    return {
      x: (landmark.x - 0.5) * cal.planeWidth,
      y: -(landmark.y - 0.5) * cal.planeHeight,
      z: -cal.baseDepth + (landmark.z * cal.planeWidth),
    };
  },

  onHandData(event) {
    const hand = event.detail.landmarks;
    if (!hand) {
      this.reset();
      return;
    }

    const wrist = hand[0];
    const get2DDistance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const handSize = get2DDistance(wrist, hand[9]);

    const index = this.distance(hand[8], wrist) > this.distance(hand[6], wrist);
    const middle = this.distance(hand[12], wrist) > this.distance(hand[10], wrist);
    const ring = this.distance(hand[16], wrist) > this.distance(hand[14], wrist);
    const pinky = this.distance(hand[20], wrist) > this.distance(hand[18], wrist);

    const grab = !index && !middle && !ring && !pinky;
    const victory = index && middle && !ring && !pinky;
    const rock = index && pinky && !middle && !ring;
    const point = index && !middle && !ring && !pinky;
    
    const pinchDist = this.distance(hand[4], hand[8]);
    let pinch = this.states.pinch;

    if (!grab && !rock) {
      if (!pinch && pinchDist < 0.04) {
        pinch = true;
      } else if (pinch && pinchDist > 0.06) {
        pinch = false;
      }
    } else {
      pinch = false;
    }

    const wristWorldPos = this.getWorldPosition(wrist);
    const indexWorldPos = this.getWorldPosition(hand[8]);
    
    const pinchCenter = {
      x: (hand[4].x + hand[8].x) / 2,
      y: (hand[4].y + hand[8].y) / 2,
      z: (hand[4].z + hand[8].z) / 2,
    };
    const pinchWorldPos = this.getWorldPosition(pinchCenter);

    const payloadWrist = { position: wristWorldPos, handSize: handSize };
    const payloadIndex = { position: indexWorldPos, handSize: handSize };
    const payloadPinch = { position: pinchWorldPos, handSize: handSize };

    this.emitPose("grab", grab, payloadWrist);
    this.emitPose("victory", victory, payloadIndex);
    this.emitPose("rock", rock, payloadIndex);
    this.emitPose("point", point, payloadIndex);
    this.emitPose("pinch", pinch, payloadPinch);
  },
});