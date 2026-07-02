AFRAME.registerComponent('mxr-laser-grabber', {
  schema: {
    targetClass: { type: 'string', default: '.grabbable' }
  },

  init: function () {
    this.grabbedElement = null;
    this.hoveredElement = null;
    this.isAiming = false;
    
    this.palmPosition = new THREE.Vector3();
    this.palmDirection = new THREE.Vector3();
    this.grabDistance = 0;
    this.raycaster = new THREE.Raycaster();

    this.originalOpacity = 1;
    this.originalTransparent = false;

    // é criada a caixa de depuracao do paralelepipedo central
    const boxGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.01);
    const boxMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    this.debugBox = new THREE.Mesh(boxGeometry, boxMaterial);
    this.debugBox.visible = false;
    this.el.sceneEl.object3D.add(this.debugBox);

    // é instanciado o visual do laser de apontamento
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xFFFFFF,
      linewidth: 3,
      blending: THREE.DifferenceBlending,
      transparent: true
    });
    const lineGeometry = new THREE.BufferGeometry();
    this.laserLine = new THREE.Line(lineGeometry, lineMaterial);
    this.laserLine.visible = false;
    this.el.sceneEl.object3D.add(this.laserLine);

    // é instanciado o retículo visual de impacto
    const cursorGeometry = new THREE.RingGeometry(0.02, 0.03, 16);
    const cursorMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      side: THREE.DoubleSide,
      depthTest: false
    });
    this.cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial);
    this.cursorMesh.visible = false;
    this.el.sceneEl.object3D.add(this.cursorMesh);

    this.onVictoryStart = this.onVictoryStart.bind(this);
    this.onVictoryMove = this.onVictoryMove.bind(this);
    this.onVictoryEnd = this.onVictoryEnd.bind(this);
    this.onGrabStart = this.onGrabStart.bind(this);
    this.onGrabMove = this.onGrabMove.bind(this);
    this.onGrabEnd = this.onGrabEnd.bind(this);
    this.onHandLost = this.onHandLost.bind(this);

    this.el.addEventListener('mxr-victory-start', this.onVictoryStart);
    this.el.addEventListener('mxr-victory-move', this.onVictoryMove);
    this.el.addEventListener('mxr-victory-end', this.onVictoryEnd);
    this.el.addEventListener('mxr-grab-start', this.onGrabStart);
    this.el.addEventListener('mxr-grab-move', this.onGrabMove);
    this.el.addEventListener('mxr-grab-end', this.onGrabEnd);
    this.el.addEventListener('mxr-hand-lost', this.onHandLost);
  },

  remove: function () {
    this.el.removeEventListener('mxr-victory-start', this.onVictoryStart);
    this.el.removeEventListener('mxr-victory-move', this.onVictoryMove);
    this.el.removeEventListener('mxr-victory-end', this.onVictoryEnd);
    this.el.removeEventListener('mxr-grab-start', this.onGrabStart);
    this.el.removeEventListener('mxr-grab-move', this.onGrabMove);
    this.el.removeEventListener('mxr-grab-end', this.onGrabEnd);
    this.el.removeEventListener('mxr-hand-lost', this.onHandLost);
    this.el.sceneEl.object3D.remove(this.laserLine);
    this.el.sceneEl.object3D.remove(this.cursorMesh);
    this.el.sceneEl.object3D.remove(this.debugBox);
  },

  updateRayData: function (event) {
    const cameraObject = this.el.getObject3D('camera');
    if (!cameraObject || !event.detail.center || !event.detail.normal) return;

    // é alinhado o centro local com a base global da cena
    const localPosition = new THREE.Vector3(event.detail.center.x, event.detail.center.y, event.detail.center.z);
    this.palmPosition.copy(localPosition).applyMatrix4(cameraObject.matrixWorld);

    // é alinhada a normal com a rotacao atual do visualizador
    const localNormal = new THREE.Vector3(event.detail.normal.x, event.detail.normal.y, event.detail.normal.z);
    const rotationMatrix = new THREE.Matrix4().extractRotation(cameraObject.matrixWorld);
    this.palmDirection.copy(localNormal).applyMatrix4(rotationMatrix).normalize();

    // é refletida visualmente a base de emissao
    this.debugBox.position.copy(this.palmPosition);
    this.debugBox.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.palmDirection);
  },

  setHoverOpacity: function (targetElement) {
    if (this.hoveredElement === targetElement) return;
    this.clearHover();
    
    this.hoveredElement = targetElement;
    const mesh = targetElement.getObject3D('mesh');
    
    if (mesh && mesh.material) {
      this.originalOpacity = mesh.material.opacity;
      this.originalTransparent = mesh.material.transparent;
      
      mesh.material.opacity = 0.4;
      mesh.material.transparent = true;
    }
  },

  clearHover: function () {
    if (this.hoveredElement) {
      const mesh = this.hoveredElement.getObject3D('mesh');
      if (mesh && mesh.material) {
        mesh.material.opacity = this.originalOpacity;
        mesh.material.transparent = this.originalTransparent;
      }
      this.hoveredElement = null;
    }
  },

  onVictoryStart: function (event) {
    if (this.grabbedElement) return;
    console.log('laser de disparo iniciado');
    this.isAiming = true;
    this.laserLine.visible = true;
    this.debugBox.visible = true;
    this.updateRayData(event);
  },

  onVictoryMove: function (event) {
    if (this.isAiming) {
      this.updateRayData(event);
    }
  },

  onVictoryEnd: function () {
    console.log('laser de disparo interrompido');
    this.isAiming = false;
    
    if (!this.grabbedElement) {
      this.laserLine.visible = false;
      this.cursorMesh.visible = false;
      this.debugBox.visible = false;
      this.clearHover();
    }
  },

  onGrabStart: function () {
    console.log('solicitacao de agarrar recebida');
    if (this.hoveredElement && !this.grabbedElement) {
      this.grabbedElement = this.hoveredElement;
      
      // é ancorada a distancia baseada na emissao central da palma
      this.grabDistance = this.palmPosition.distanceTo(this.grabbedElement.object3D.position);
      
      this.laserLine.visible = true;
      this.cursorMesh.visible = false;
      this.debugBox.visible = true;
      console.log('objeto adquirido pela mecanica de raycast', this.grabbedElement);
      this.el.emit('mxr-grab-acquired', { el: this.grabbedElement });
    }
  },

  onGrabMove: function () {
    // a direcao é omitida durante o grab, pois o victory nao esta ativo
  },

  onGrabEnd: function () {
    if (this.grabbedElement) {
      console.log('objeto solto no cenario');
      this.el.emit('mxr-grab-released', { el: this.grabbedElement });
      this.grabbedElement = null;
      this.laserLine.visible = false;
      this.debugBox.visible = false;
    }
  },

  onHandLost: function () {
    this.onVictoryEnd();
    this.onGrabEnd();
  },

  tick: function () {
    const cameraObject = this.el.getObject3D('camera');
    if (!cameraObject) return;

    if (this.isAiming && !this.grabbedElement) {
      // é projetado o raio direcional partindo da geometria base
      this.raycaster.set(this.palmPosition, this.palmDirection);
      
      const interactables = Array.from(this.el.sceneEl.querySelectorAll(this.data.targetClass))
        .map(el => el.object3D).filter(obj => obj !== undefined);
      
      const intersects = this.raycaster.intersectObjects(interactables, true);

      if (intersects.length > 0) {
        let hitObject = intersects[0].object;
        while (hitObject.parent && !hitObject.el) { hitObject = hitObject.parent; }
        
        this.setHoverOpacity(hitObject.el);

        this.cursorMesh.position.copy(intersects[0].point);
        this.cursorMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), intersects[0].face.normal);
        this.cursorMesh.visible = true;

        this.laserLine.geometry.setFromPoints([this.palmPosition, intersects[0].point]);
      } else {
        this.clearHover();
        this.cursorMesh.visible = false;
        
        // é propagado o limite de linha a 10 unidades
        const distantPoint = this.palmPosition.clone().add(this.palmDirection.clone().multiplyScalar(10));
        this.laserLine.geometry.setFromPoints([this.palmPosition, distantPoint]);
      }
    } else if (this.grabbedElement) {
      // é processada a interacao de drag baseada na palma
      const rayDirection = new THREE.Vector3().subVectors(this.palmPosition, cameraObject.position).normalize();
      const targetPosition = cameraObject.position.clone().add(rayDirection.multiplyScalar(this.grabDistance));
      
      this.grabbedElement.setAttribute('position', `${targetPosition.x} ${targetPosition.y} ${targetPosition.z}`);
      this.laserLine.geometry.setFromPoints([this.palmPosition, targetPosition]);
      
      // é atualizada a visualizacao persistente
      this.debugBox.position.copy(this.palmPosition);
      this.debugBox.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), rayDirection);
    }
  }
});