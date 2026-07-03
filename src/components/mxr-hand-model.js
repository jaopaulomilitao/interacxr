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

    const jointMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const boneMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

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
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
    ];

    this.connections.forEach(() => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(this.data.boneRadius, this.data.boneRadius, 1, 8),
        boneMaterial,
      );
      mesh.visible = false;
      this.el.object3D.add(mesh);
      this.bones.push(mesh);
    });

    this.data.source.addEventListener("mxr-hand-data", this.onHandData);
  },

  remove() {
    this.data.source.removeEventListener("mxr-hand-data", this.onHandData);
  },

  // a função foi purificada para utilizar exclusivamente proporções físicas rígidas
  mapPoint(lm) {
    const cal = window.MXRCalibration;
    const x = (lm.x - 0.5) * cal.planeWidth;
    const y = -(lm.y - 0.5) * cal.planeHeight;
    const z = -cal.baseDepth + (lm.z * cal.planeWidth);

    return new THREE.Vector3(x, y, z);
  },

  onHandData(e) {
    const hand = e.detail.landmarks;

    if (!hand) {
      this.handVisible = false;
      this.joints.forEach((j) => { j.visible = false; });
      this.bones.forEach((b) => { b.visible = false; });
      for (let i = 0; i < 21; i++) { this.targets[i].set(0, 0, 0); }
      return;
    }

    this.handVisible = true;
    for (let i = 0; i < 21; i++) {
      this.targets[i].copy(this.mapPoint(hand[i]));
    }
  },

  tick() {
    if (!this.handVisible) return;

    for (let i = 0; i < 21; i++) {
      const mesh = this.joints[i];
      mesh.visible = true;
      mesh.position.lerp(this.targets[i], this.data.jointSmoothing);
    }

    for (let i = 0; i < this.connections.length; i++) {
      const bone = this.bones[i];
      const a = this.joints[this.connections[i][0]];
      const b = this.joints[this.connections[i][1]];

      bone.visible = true;
      this.tmpMid.addVectors(a.position, b.position).multiplyScalar(0.5);
      bone.position.copy(this.tmpMid);
      this.tmpDir.subVectors(b.position, a.position);
      bone.scale.set(1, this.tmpDir.length(), 1);
      bone.quaternion.setFromUnitVectors(this.up, this.tmpDir.normalize());
    }
  },
});