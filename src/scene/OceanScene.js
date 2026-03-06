/* ============================================
   GitBoat — Ocean Scene
   Three.js scene with animated ocean, sky, fog
   ============================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import oceanVertexShader from './shaders/oceanVertex.glsl';
import oceanFragmentShader from './shaders/oceanFragment.glsl';
import { createParticles, updateParticles } from './Particles.js';

// ── Scene Configuration ──
const CONFIG = {
  ocean: {
    size: 120,
    segments: 256,
    waveHeight: 1.0,
  },
  camera: {
    fov: 55,
    near: 0.1,
    far: 200,
    position: new THREE.Vector3(0, 8, 20),
    lookAt: new THREE.Vector3(0, 0, 0),
  },
  sun: {
    direction: new THREE.Vector3(0.5, 0.4, 0.3),
    color: 0xfff4e6,
    intensity: 1.5,
  },
  colors: {
    deep: new THREE.Color(0x030810),
    surface: new THREE.Color(0x0a4a6e),
    foam: new THREE.Color(0xc8e6f0),
    sky: new THREE.Color(0x0d1b2a),
    fog: new THREE.Color(0x070d17),
    ambient: new THREE.Color(0x1a3050),
  },
};

let scene, camera, renderer, controls;
let oceanMesh, oceanMaterial;
let particles;
let clock;
let animationFrameId = null;
let isRunning = false;
let onUpdateCallbacks = [];

// ── Public API ──

/**
 * Initialize the ocean scene and start rendering
 * @param {HTMLCanvasElement} canvas - The canvas element to render to
 */
export function initOceanScene(canvas) {
  clock = new THREE.Clock();

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap for performance
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;

  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(CONFIG.colors.fog, 0.012);

  // Camera
  camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far
  );
  camera.position.copy(CONFIG.camera.position);
  camera.lookAt(CONFIG.camera.lookAt);

  // Controls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI * 0.48; // Don't go below water
  controls.minDistance = 5;
  controls.maxDistance = 60;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;

  // Build scene elements
  createLighting();
  createOcean();
  createSkyDome();
  particles = createParticles(scene);

  // Resize handler
  window.addEventListener('resize', handleResize);

  // Start render loop
  isRunning = true;
  animate();

  return { scene, camera, renderer, controls };
}

/**
 * Get the scene objects for external modules (boat placement etc.)
 */
export function getScene() {
  return { scene, camera, renderer, controls };
}

/**
 * Get the ocean wave height at a given XZ position (for boat bobbing)
 */
export function getWaveHeightAt(x, z, time) {
  // Replicate the Gerstner wave math from the vertex shader
  let height = 0;
  const waves = [
    { steepness: 0.15, wavelength: 12.0, dir: [1.0, 0.6], speed: 0.8 },
    { steepness: 0.1, wavelength: 8.0, dir: [-0.4, 1.0], speed: 1.2 },
    { steepness: 0.06, wavelength: 4.0, dir: [0.7, -0.3], speed: 1.6 },
  ];

  for (const wave of waves) {
    const k = (2 * Math.PI) / wave.wavelength;
    const c = Math.sqrt(9.8 / k);
    const dirLen = Math.sqrt(wave.dir[0] ** 2 + wave.dir[1] ** 2);
    const dx = wave.dir[0] / dirLen;
    const dz = wave.dir[1] / dirLen;
    const f = k * (dx * x + dz * z - c * time * wave.speed);
    const a = wave.steepness / k;
    height += a * Math.sin(f);
  }

  return height * CONFIG.ocean.waveHeight;
}

/**
 * Set OrbitControls target (e.g., focus on boat)
 */
export function setFocusTarget(target) {
  if (controls) {
    controls.target.copy(target);
  }
}

/**
 * Pause/resume auto-rotate
 */
export function setAutoRotate(enabled) {
  if (controls) {
    controls.autoRotate = enabled;
  }
}

/**
 * Adjust camera for profile view (closer, angled)
 */
export function setCameraForProfile() {
  if (camera && controls) {
    controls.autoRotateSpeed = 0.15;
    // Animate camera closer to the boat
    const targetPos = { x: 6, y: 5, z: 10 };
    const current = camera.position;
    const steps = 60;
    let step = 0;
    const moveCamera = () => {
      if (step >= steps) return;
      step++;
      const t = step / steps;
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.x += (targetPos.x - current.x) * ease * 0.02;
      camera.position.y += (targetPos.y - current.y) * ease * 0.02;
      camera.position.z += (targetPos.z - current.z) * ease * 0.02;
      requestAnimationFrame(moveCamera);
    };
    moveCamera();
  }
}

/**
 * Reset camera for landing view
 */
export function setCameraForLanding() {
  if (camera && controls) {
    controls.autoRotateSpeed = 0.3;
  }
}

/**
 * Clean up resources
 */
export function disposeOceanScene() {
  isRunning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  if (renderer) {
    renderer.dispose();
  }
  if (controls) {
    controls.dispose();
  }
  window.removeEventListener('resize', handleResize);
  onUpdateCallbacks = [];
}

/**
 * Register a callback to be invoked each frame with (elapsed)
 */
export function onRenderUpdate(callback) {
  onUpdateCallbacks.push(callback);
}

/**
 * Remove a render update callback
 */
export function offRenderUpdate(callback) {
  onUpdateCallbacks = onUpdateCallbacks.filter(cb => cb !== callback);
}

// ── Private Functions ──

function createLighting() {
  // Hemisphere light (sky + ground bounce)
  const hemiLight = new THREE.HemisphereLight(
    CONFIG.colors.sky,
    CONFIG.colors.deep,
    0.4
  );
  scene.add(hemiLight);

  // Directional sun light
  const sunLight = new THREE.DirectionalLight(
    CONFIG.sun.color,
    CONFIG.sun.intensity
  );
  sunLight.position.copy(CONFIG.sun.direction).multiplyScalar(50);
  scene.add(sunLight);

  // Ambient fill
  const ambientLight = new THREE.AmbientLight(CONFIG.colors.ambient, 0.2);
  scene.add(ambientLight);
}

function createOcean() {
  const geometry = new THREE.PlaneGeometry(
    CONFIG.ocean.size,
    CONFIG.ocean.size,
    CONFIG.ocean.segments,
    CONFIG.ocean.segments
  );
  geometry.rotateX(-Math.PI / 2); // Lay flat

  oceanMaterial = new THREE.ShaderMaterial({
    vertexShader: oceanVertexShader,
    fragmentShader: oceanFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uWaveHeight: { value: CONFIG.ocean.waveHeight },
      uSunDirection: { value: CONFIG.sun.direction },
      uDeepColor: { value: CONFIG.colors.deep },
      uSurfaceColor: { value: CONFIG.colors.surface },
      uFoamColor: { value: CONFIG.colors.foam },
      uSkyColor: { value: CONFIG.colors.sky },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  oceanMesh = new THREE.Mesh(geometry, oceanMaterial);
  scene.add(oceanMesh);
}

function createSkyDome() {
  // Large inverted sphere for the sky
  const skyGeo = new THREE.SphereGeometry(90, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      void main() {
        float height = normalize(vWorldPosition).y;
        // Deep navy at horizon → darker above
        vec3 bottomColor = vec3(0.04, 0.08, 0.14);
        vec3 topColor = vec3(0.01, 0.02, 0.06);
        vec3 horizonGlow = vec3(0.08, 0.15, 0.25);
        
        float t = max(height, 0.0);
        vec3 color = mix(bottomColor, topColor, pow(t, 0.6));
        
        // Horizon glow band
        float horizonFactor = 1.0 - abs(height);
        horizonFactor = pow(horizonFactor, 8.0);
        color += horizonGlow * horizonFactor * 0.5;
        
        // Subtle stars
        float starNoise = fract(sin(dot(normalize(vWorldPosition.xz) * 300.0, vec2(12.9898, 78.233))) * 43758.5453);
        if (starNoise > 0.997 && height > 0.15) {
          color += vec3(0.6, 0.7, 0.8) * (starNoise - 0.997) * 300.0 * smoothstep(0.15, 0.5, height);
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);
}

function handleResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  if (!isRunning) return;

  animationFrameId = requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  // Update ocean shader time
  if (oceanMaterial) {
    oceanMaterial.uniforms.uTime.value = elapsed;
  }

  // Update particles
  if (particles) {
    updateParticles(particles, elapsed);
  }

  // Update controls
  if (controls) {
    controls.update();
  }

  // Run external update callbacks (boat animation etc.)
  for (const cb of onUpdateCallbacks) {
    cb(elapsed);
  }

  // Render
  renderer.render(scene, camera);
}
