/* ============================================
   Ocean Vertex Shader
   Gerstner Wave Displacement (3 octaves)
   ============================================ */

uniform float uTime;
uniform float uWaveHeight;

varying vec2 vUv;
varying float vElevation;
varying vec3 vWorldPosition;
varying vec3 vNormal;

// Gerstner wave function
// Returns displacement and contributes to normal calculation
vec3 gerstnerWave(vec2 position, float steepness, float wavelength, vec2 direction, float time) {
  float k = 2.0 * 3.14159 / wavelength;
  float c = sqrt(9.8 / k);
  vec2 d = normalize(direction);
  float f = k * (dot(d, position) - c * time);
  float a = steepness / k;

  return vec3(
    d.x * (a * cos(f)),
    a * sin(f),
    d.y * (a * cos(f))
  );
}

void main() {
  vUv = uv;
  vec3 pos = position;

  // Wave octave 1: Primary swell
  vec3 wave1 = gerstnerWave(
    pos.xz, 
    0.15,          // steepness
    12.0,          // wavelength
    vec2(1.0, 0.6), // direction
    uTime * 0.8
  );

  // Wave octave 2: Secondary chop
  vec3 wave2 = gerstnerWave(
    pos.xz, 
    0.1,           // steepness
    8.0,           // wavelength
    vec2(-0.4, 1.0), // direction
    uTime * 1.2
  );

  // Wave octave 3: Small ripples
  vec3 wave3 = gerstnerWave(
    pos.xz, 
    0.06,          // steepness
    4.0,           // wavelength
    vec2(0.7, -0.3), // direction
    uTime * 1.6
  );

  // Apply wave displacement
  pos += (wave1 + wave2 + wave3) * uWaveHeight;

  vElevation = pos.y;
  vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;

  // Approximate normal from neighboring wave displacements
  float delta = 0.1;
  vec3 posRight = position + vec3(delta, 0.0, 0.0);
  posRight += (gerstnerWave(posRight.xz, 0.15, 12.0, vec2(1.0, 0.6), uTime * 0.8) +
               gerstnerWave(posRight.xz, 0.1, 8.0, vec2(-0.4, 1.0), uTime * 1.2) +
               gerstnerWave(posRight.xz, 0.06, 4.0, vec2(0.7, -0.3), uTime * 1.6)) * uWaveHeight;

  vec3 posForward = position + vec3(0.0, 0.0, delta);
  posForward += (gerstnerWave(posForward.xz, 0.15, 12.0, vec2(1.0, 0.6), uTime * 0.8) +
                 gerstnerWave(posForward.xz, 0.1, 8.0, vec2(-0.4, 1.0), uTime * 1.2) +
                 gerstnerWave(posForward.xz, 0.06, 4.0, vec2(0.7, -0.3), uTime * 1.6)) * uWaveHeight;

  vec3 tangent = normalize(posRight - pos);
  vec3 bitangent = normalize(posForward - pos);
  vNormal = normalize(cross(bitangent, tangent));

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
