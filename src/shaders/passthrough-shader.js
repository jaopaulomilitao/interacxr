// é exportada a estrutura do shader para o passthrough
export const passthroughShader = {
  uniforms: {
    videoTexture: { value: null },
    zoomLevel: { value: 1.0 },
    k1: { value: 0.0 }
  },
  
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      // é calculada a posição do vértice
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform sampler2D videoTexture;
    uniform float zoomLevel;
    uniform float k1;
    
    varying vec2 vUv;
    
    void main() {
      // é centralizado o uv
      vec2 centerUv = vUv - 0.5;
      
      // é calculado o raio para a distorção
      float r2 = dot(centerUv, centerUv);
      
      // é aplicada a distorção de barril
      float distortion = 1.0 + k1 * r2;
      vec2 distortedUv = centerUv * distortion;
      
      // é aplicado o zoom
      vec2 finalUv = (distortedUv / zoomLevel) + 0.5;
      
      // são tratadas as bordas para evitar repetição de textura
      if (finalUv.x < 0.0 || finalUv.x > 1.0 || finalUv.y < 0.0 || finalUv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        // é renderizada a cor do vídeo
        gl_FragColor = texture2D(videoTexture, finalUv);
      }
    }
  `
};