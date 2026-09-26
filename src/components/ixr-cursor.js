AFRAME.registerComponent("ixr-cursor", {
  schema: {
    targetClass: { type: "string", default: ".grabbable, .interactable" },
    maxDistance: { type: "number", default: 10 },
    cursorSize: { type: "number", default: 0.01 },
    cursorColor: { type: "color", default: "#FFFFFF" },
    idleOpacity: { type: "number", default: 0.3 },
    hoverOpacity: { type: "number", default: 1.0 },
    // é definida a propriedade para alternar o efeito negativo
    useNegativeEffect: { type: "boolean", default: false }
  },

  init() {
    this.raycaster = new THREE.Raycaster();
    this.cameraPosition = new THREE.Vector3();
    this.cameraDirection = new THREE.Vector3();
    
    this.hoveredElement = null;
    this.intersectionData = null;
    this.isActive = false;

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
    // é construída a configuração base do material
    const materialConfig = {
      color: this.data.cursorColor,
      transparent: true,
      opacity: this.data.idleOpacity,
      depthTest: false,
      side: THREE.DoubleSide
    };

    // é aplicado o efeito negativo caso a propriedade esteja habilitada
    if (this.data.useNegativeEffect) {
      materialConfig.blending = THREE.CustomBlending;
      materialConfig.blendEquation = THREE.AddEquation;
      materialConfig.blendSrc = THREE.OneMinusDstColorFactor;
      materialConfig.blendDst = THREE.OneMinusSrcColorFactor;
    }

    const material = new THREE.MeshBasicMaterial(materialConfig);
    const mesh = new THREE.Mesh(this.ringGeometry, material);
    
    mesh.position.set(0, 0, -1);
    this.el.object3D.add(mesh);

    return mesh;
  },

  setCursorActive(active) {
    this.isActive = active;
    
    if (this.isActive) {
      this.cursorMesh.geometry = this.solidGeometry;
      this.cursorMesh.material.opacity = this.data.hoverOpacity;
    } else {
      this.cursorMesh.geometry = this.ringGeometry;
      this.cursorMesh.material.opacity = this.hoveredElement 
        ? this.data.hoverOpacity 
        : this.data.idleOpacity;
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
      
      // é realizada a busca pelo elemento pai que possui o componente a-frame
      while (hit.parent && !hit.el) {
        hit = hit.parent;
      }

      if (this.hoveredElement !== hit.el) {
        if (this.hoveredElement) {
          this.el.emit("ixr-cursor-hover-end", { el: this.hoveredElement });
        }
        this.hoveredElement = hit.el;
        this.el.emit("ixr-cursor-hover-start", { el: this.hoveredElement });
        
        if (!this.isActive) {
          this.cursorMesh.material.opacity = this.data.hoverOpacity;
        }
      }
      this.intersectionData = intersections[0];
    } else {
      if (this.hoveredElement) {
        this.el.emit("ixr-cursor-hover-end", { el: this.hoveredElement });
        this.hoveredElement = null;
        this.intersectionData = null;
        
        if (!this.isActive) {
          this.cursorMesh.material.opacity = this.data.idleOpacity;
        }
      }
    }
  }
});