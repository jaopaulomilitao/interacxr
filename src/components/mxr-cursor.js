AFRAME.registerComponent("mxr-cursor", {
  schema: {
    targetClass: { type: "string", default: ".grabbable, .interactable" },
    maxDistance: { type: "number", default: 10 },
    cursorSize: { type: "number", default: 0.01 },
    cursorColor: { type: "color", default: "#FFFFFF" },
    idleOpacity: { type: "number", default: 0.3 },
    hoverOpacity: { type: "number", default: 1.0 }
  },

  init() {
    this.raycaster = new THREE.Raycaster();
    this.cameraPosition = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();
    
    this.hoveredElement = null;
    this.intersectionData = null;
    this.isActive = false; // é controlada a flag de preenchimento

    // são pré-criadas as duas geometrias (anel para repouso, círculo para ativo)
    this.ringGeometry = new THREE.RingGeometry(
      this.data.cursorSize,
      this.data.cursorSize * 1.5,
      32
    );
    this.solidGeometry = new THREE.CircleGeometry(
      this.data.cursorSize * 1.5,
      32
    );

    this.cursorMesh = this.createCursor();
  },

  createCursor() {
    const material = new THREE.MeshBasicMaterial({
      color: this.data.cursorColor,
      transparent: true,
      opacity: this.data.idleOpacity,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.DifferenceBlending // é aplicado o efeito negativo
    });

    const mesh = new THREE.Mesh(this.ringGeometry, material);
    mesh.position.set(0, 0, -1);
    this.el.object3D.add(mesh);

    return mesh;
  },

  // é alternado o estado visual da malha
  setCursorActive(active) {
    this.isActive = active;
    if (this.isActive) {
      this.cursorMesh.geometry = this.solidGeometry;
      this.cursorMesh.material.opacity = this.data.hoverOpacity; // brilho máximo
    } else {
      this.cursorMesh.geometry = this.ringGeometry;
      this.cursorMesh.material.opacity = this.hoveredElement ? this.data.hoverOpacity : this.data.idleOpacity;
    }
  },

  getHoveredElement() {
    return this.hoveredElement;
  },

  getIntersection() {
    return this.intersectionData;
  },

  tick() {
    const camera = this.el.getObject3D("camera");
    if (!camera) return;

    camera.getWorldPosition(this.cameraPosition);
    camera.getWorldDirection(this.cameraDirection);

    this.raycaster.set(this.cameraPosition, this.cameraDirection);

    const objects = Array.from(
      this.el.sceneEl.querySelectorAll(this.data.targetClass)
    ).map((e) => e.object3D).filter(Boolean);

    const intersections = this.raycaster.intersectObjects(objects, true);

    if (intersections.length > 0 && intersections[0].distance <= this.data.maxDistance) {
      let hit = intersections[0].object;
      
      while (hit.parent && !hit.el) {
        hit = hit.parent;
      }

      if (this.hoveredElement !== hit.el) {
        if (this.hoveredElement) {
          this.el.emit("mxr-cursor-hover-end", { el: this.hoveredElement });
        }
        this.hoveredElement = hit.el;
        this.el.emit("mxr-cursor-hover-start", { el: this.hoveredElement });
        
        // a opacidade só é alterada pelo raycast se a ferramenta não estiver a agarrar algo
        if (!this.isActive) {
          this.cursorMesh.material.opacity = this.data.hoverOpacity;
        }
      }
      this.intersectionData = intersections[0];
    } else {
      if (this.hoveredElement) {
        this.el.emit("mxr-cursor-hover-end", { el: this.hoveredElement });
        this.hoveredElement = null;
        this.intersectionData = null;
        
        if (!this.isActive) {
          this.cursorMesh.material.opacity = this.data.idleOpacity;
        }
      }
    }
  }
});