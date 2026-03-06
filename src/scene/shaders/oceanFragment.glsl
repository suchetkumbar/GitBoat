/* ============================================
   Ocean Fragment Shader
   Depth gradient, Fresnel, Foam, Specular
   ============================================ */

uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uDeepColor;     // Deep ocean color
uniform vec3 uSurfaceColor;  // Surface/shallow color
uniform vec3 uFoamColor;     // Foam/whitecap color
uniform vec3 uSkyColor;      // Sky reflection color

varying vec2 vUv;
varying float vElevation;
varying vec3 vWorldPosition;
varying vec3 vNormal;

// Hash-based noise to avoid grid artifacts
float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// FBM (Fractal Brownian Motion) for organic foam
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p *= 2.2;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  // --- Depth-based color gradient ---
  float depthFactor = smoothstep(-0.8, 0.6, vElevation);
  vec3 waterColor = mix(uDeepColor, uSurfaceColor, depthFactor);

  // --- Fresnel effect ---
  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
  fresnel = clamp(fresnel, 0.0, 1.0);
  waterColor = mix(waterColor, uSkyColor, fresnel * 0.45);

  // --- Foam at wave crests (domain-warped organic noise) ---
  float foamThreshold = 0.30;
  float foam = smoothstep(foamThreshold - 0.15, foamThreshold + 0.1, vElevation);
  // Domain warping: use one noise to offset the coordinates of another
  vec2 foamUV = vWorldPosition.xz * 0.8;
  vec2 warp = vec2(
    fbm(foamUV + vec2(uTime * 0.15, 0.0)),
    fbm(foamUV + vec2(0.0, uTime * 0.12) + 5.2)
  );
  float foamNoise = fbm(foamUV + warp * 2.5 + uTime * 0.08);
  // Second layer at different scale for variation
  foamNoise *= fbm(vWorldPosition.xz * 2.3 - uTime * 0.05 + 8.1) + 0.3;
  foam *= smoothstep(0.2, 0.7, foamNoise);
  foam = clamp(foam * 0.35, 0.0, 0.8);
  waterColor = mix(waterColor, uFoamColor, foam);

  // --- Sun specular highlights ---
  vec3 sunDir = normalize(uSunDirection);
  vec3 halfDir = normalize(sunDir + viewDir);
  float specular = pow(max(dot(normal, halfDir), 0.0), 256.0);
  float specularBroad = pow(max(dot(normal, halfDir), 0.0), 32.0) * 0.12;
  waterColor += vec3(1.0, 0.95, 0.85) * (specular * 0.7 + specularBroad);

  // --- Subsurface scattering ---
  float sss = pow(max(dot(viewDir, -sunDir), 0.0), 4.0);
  sss *= smoothstep(0.0, 0.4, vElevation);
  waterColor += vec3(0.0, 0.35, 0.3) * sss * 0.25;

  // --- Distance fade ---
  float dist = length(vWorldPosition.xz) / 60.0;
  float distFade = smoothstep(0.3, 1.0, dist);
  waterColor = mix(waterColor, uDeepColor * 0.5, distFade * 0.4);

  // --- Final output ---
  gl_FragColor = vec4(waterColor, 0.94);
}
