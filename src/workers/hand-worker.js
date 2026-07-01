import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

// são declaradas as variáveis globais do worker
let handLandmarker = null;
let isReady = false;

// é executada a inicialização do modelo
async function initializeModel(maxHands, delegate) {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  
  // é aplicado o workaround para contornar o bloqueio de importscripts em modules
  const response = await fetch(vision.wasmLoaderPath);
  const loaderScript = await response.text();
  eval?.(loaderScript); // é injetada a fábrica de módulos (modulefactory) na memória global
  delete vision.wasmLoaderPath; // é deletada a rota para impedir que o mediapipe acione o erro

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: delegate
    },
    runningMode: 'VIDEO',
    numHands: maxHands
  });
  
  isReady = true;
  // é enviada a confirmação de que o modelo carregou
  self.postMessage({ type: 'READY' });
}

// é configurado o ouvinte de mensagens da thread principal
self.onmessage = async (event) => {
  const { type, image, timestamp, maxHands, delegate } = event.data;
  
  if (type === 'INIT') {
    await initializeModel(maxHands, delegate);
    return;
  }
  
  if (type === 'PROCESS' && isReady && image) {
    // é realizada a inferência pela ia
    const results = handLandmarker.detectForVideo(image, timestamp);
    
    // é liberada a memória do bitmap imediatamente
    image.close();
    
    // são devolvidos os pontos estruturados
    self.postMessage({ type: 'RESULT', landmarks: results.landmarks });
  }
};