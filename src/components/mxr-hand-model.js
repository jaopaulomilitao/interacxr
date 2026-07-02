AFRAME.registerComponent('mxr-hand-model', {
  schema: {
    source: { type: 'selector', default: '#main-camera' },
    jointColor: { type: 'color', default: '#fff8f0' },
    boneColor: { type: 'color', default: '#ffffff' }
  },

  init: function () {
    // são mapeados os pares de índices para formar a topologia da mão
    this.boneConnections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17]
    ];
    
    // são instanciados os arrays para armazenar as malhas
    this.jointMeshes = [];
    this.boneMeshes = [];
    this.onHandData = this.onHandData.bind(this);

    // é configurada a geometria inicial das juntas e ossos
    this.setupVisuals();

    if (this.data.source) {
      this.data.source.addEventListener('mxr-hand-data', this.onHandData);
    }
  },

  setupVisuals: function () {
    // é definida a geometria e o material base das juntas
    const jointGeometry = new THREE.SphereGeometry(0.015, 16, 16);
    const jointMaterial = new THREE.MeshBasicMaterial({ color: this.data.jointColor });

    for (let i = 0; i < 21; i++) {
      const jointMesh = new THREE.Mesh(jointGeometry, jointMaterial);
      jointMesh.visible = false;
      
      this.el.object3D.add(jointMesh);
      this.jointMeshes.push(jointMesh);
    }

    // é definida a geometria e o material base dos ossos
    const boneGeometry = new THREE.CylinderGeometry(0.005, 0.005, 1, 8);
    const boneMaterial = new THREE.MeshBasicMaterial({ color: this.data.boneColor });

    for (let i = 0; i < this.boneConnections.length; i++) {
      const boneMesh = new THREE.Mesh(boneGeometry, boneMaterial);
      boneMesh.visible = false;
      
      this.el.object3D.add(boneMesh);
      this.boneMeshes.push(boneMesh);
    }
  },

  onHandData: function (event) {
    const handData = event.detail.landmarks;

    if (!handData) {
      // é ocultada a malha completa quando o tracking é perdido
      this.toggleVisibility(false);
      return;
    }

    this.toggleVisibility(true);
    this.updateJointPositions(handData);
    this.updateBonePositions();
  },

  updateJointPositions: function (landmarks) {
    const cameraObject = this.data.source.getObject3D('camera');
    if (!cameraObject) return;

    // é calculada a dimensão do frustum para a projeção espacial
    const baseDepth = 0.5;
    const verticalFov = (cameraObject.fov * Math.PI) / 180;
    const frustumHeight = 2 * Math.tan(verticalFov / 2) * baseDepth;
    const frustumWidth = frustumHeight * cameraObject.aspect;

    for (let i = 0; i < 21; i++) {
      const landmark = landmarks[i];

      // é calculada a posição espacial exata da junta
      const positionX = (landmark.x - 0.5) * frustumWidth;
      const positionY = -(landmark.y - 0.5) * frustumHeight;
      const positionZ = -baseDepth + (landmark.z * frustumWidth);

      this.jointMeshes[i].position.set(positionX, positionY, positionZ);
    }
  },

  updateBonePositions: function () {
    // é instanciado o vetor base que representa o alinhamento nativo do cilindro no three.js
    const upVector = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < this.boneConnections.length; i++) {
      const [startIndex, endIndex] = this.boneConnections[i];
      const startJointPosition = this.jointMeshes[startIndex].position;
      const endJointPosition = this.jointMeshes[endIndex].position;

      // é calculada a distância real e o ponto central exato entre as duas juntas conectadas
      const distance = startJointPosition.distanceTo(endJointPosition);
      const midPoint = new THREE.Vector3().addVectors(startJointPosition, endJointPosition).multiplyScalar(0.5);

      // é gerado o vetor normalizado apontando da origem para o destino
      const direction = new THREE.Vector3().subVectors(endJointPosition, startJointPosition).normalize();

      const boneMesh = this.boneMeshes[i];

      // é atualizada a posição para o centro e a escala y para preencher o vão
      boneMesh.position.copy(midPoint);
      boneMesh.scale.set(1, distance, 1);
      
      // é rotacionado o cilindro para que seu eixo nativo se alinhe com a direção calculada
      boneMesh.quaternion.setFromUnitVectors(upVector, direction);
    }
  },

  toggleVisibility: function (isVisible) {
    // é atualizada a visibilidade de todas as juntas
    for (let i = 0; i < this.jointMeshes.length; i++) {
      this.jointMeshes[i].visible = isVisible;
    }
    
    // é atualizada a visibilidade de todos os ossos
    for (let i = 0; i < this.boneMeshes.length; i++) {
      this.boneMeshes[i].visible = isVisible;
    }
  },

  remove: function () {
    if (this.data.source) {
      this.data.source.removeEventListener('mxr-hand-data', this.onHandData);
    }
  }
});