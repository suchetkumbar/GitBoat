/* ============================================
   GitBoat — Ambient Particles
   Sea spray near waves + subtle cloud layer
   ============================================ */

import * as THREE from 'three';

const SPRAY_COUNT = 600;
const CLOUD_COUNT = 30;

/**
 * Create particle systems for the ocean scene
 * @param {THREE.Scene} scene
 * @returns {Object} Particle system references
 */
export function createParticles(scene) {
  const spray = createSeaSpray(scene);
  const clouds = createClouds(scene);
  return { spray, clouds };
}

/**
 * Update particles each frame
 */
export function updateParticles(particles, time) {
  if (particles.spray) {
    updateSeaSpray(particles.spray, time);
  }
  if (particles.clouds) {
    updateClouds(particles.clouds, time);
  }
}

// ── Sea Spray ──

function createSeaSpray(scene) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(SPRAY_COUNT * 3);
  const velocities = new Float32Array(SPRAY_COUNT * 3);
  const lifetimes = new Float32Array(SPRAY_COUNT);

  for (let i = 0; i < SPRAY_COUNT; i++) {
    resetSprayParticle(positions, velocities, lifetimes, i);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xc8e6f0,
    size: 0.08,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  return { points, velocities, lifetimes };
}

function resetSprayParticle(positions, velocities, lifetimes, index) {
  const i3 = index * 3;

  // Spawn within the ocean area
  positions[i3] = (Math.random() - 0.5) * 60;
  positions[i3 + 1] = Math.random() * 0.5;
  positions[i3 + 2] = (Math.random() - 0.5) * 60;

  // Upward + slight drift
  velocities[i3] = (Math.random() - 0.5) * 0.02;
  velocities[i3 + 1] = Math.random() * 0.03 + 0.01;
  velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;

  lifetimes[index] = Math.random() * 3.0 + 1.0; // 1-4 seconds
}

function updateSeaSpray(spray, time) {
  const positions = spray.points.geometry.attributes.position.array;
  const { velocities, lifetimes } = spray;

  for (let i = 0; i < SPRAY_COUNT; i++) {
    const i3 = i * 3;

    // Move particles
    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    // Gravity
    velocities[i3 + 1] -= 0.0003;

    // Age
    lifetimes[i] -= 0.016; // ~60fps dt

    // Reset dead particles
    if (lifetimes[i] <= 0 || positions[i3 + 1] < -0.5) {
      resetSprayParticle(positions, velocities, lifetimes, i);
    }
  }

  spray.points.geometry.attributes.position.needsUpdate = true;

  // Subtle opacity pulse with time
  spray.points.material.opacity = 0.25 + Math.sin(time * 0.5) * 0.1;
}

// ── Clouds ──

function createClouds(scene) {
  const group = new THREE.Group();

  const cloudTexture = createCloudTexture();

  for (let i = 0; i < CLOUD_COUNT; i++) {
    const material = new THREE.SpriteMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.04 + Math.random() * 0.06,
      color: new THREE.Color(0.15, 0.2, 0.3),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);

    // Position clouds at horizon height, spread wide
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 40;
    sprite.position.set(
      Math.cos(angle) * dist,
      8 + Math.random() * 15,
      Math.sin(angle) * dist
    );

    const scale = 15 + Math.random() * 25;
    sprite.scale.set(scale, scale * 0.3, 1);

    group.add(sprite);
  }

  scene.add(group);
  return group;
}

function updateClouds(clouds, time) {
  clouds.children.forEach((cloud, i) => {
    // Very slow drift
    cloud.position.x += Math.sin(time * 0.01 + i) * 0.003;
    cloud.position.z += Math.cos(time * 0.008 + i) * 0.002;
  });
}

function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Soft radial gradient
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
