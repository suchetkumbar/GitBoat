/* ============================================
   GitBoat — Boat Animator
   Wave sync, sail billow, lantern flicker, 
   entrance animation
   ============================================ */

import * as THREE from 'three';
import gsap from 'gsap';
import { getWaveHeightAt } from '../scene/OceanScene.js';

/**
 * Animate the boat every frame (called from render loop)
 * @param {THREE.Group} boat - The boat group from BoatBuilder
 * @param {number} time - Elapsed time from clock
 */
export function updateBoatAnimation(boat, time) {
  if (!boat || !boat.visible) return;

  // ── Wave-Synchronized Bobbing ──
  const waveY = getWaveHeightAt(boat.position.x, boat.position.z, time);
  boat.position.y = waveY;

  // Roll (tilt side-to-side) synced to wave slope
  const waveYLeft = getWaveHeightAt(boat.position.x, boat.position.z - 0.5, time);
  const waveYRight = getWaveHeightAt(boat.position.x, boat.position.z + 0.5, time);
  boat.rotation.z = (waveYLeft - waveYRight) * 0.3;

  // Pitch (tilt front-to-back) synced to wave slope
  const waveYFront = getWaveHeightAt(boat.position.x + 0.5, boat.position.z, time);
  const waveYBack = getWaveHeightAt(boat.position.x - 0.5, boat.position.z, time);
  boat.rotation.x = (waveYBack - waveYFront) * 0.2;

  // ── Sail Billow Animation ──
  const sailsGroup = boat.getObjectByName('sails');
  if (sailsGroup) {
    sailsGroup.children.forEach((sail, index) => {
      if (sail.userData.bellySail) {
        const positions = sail.geometry.attributes.position;
        const originalPositions = sail.userData.originalPositions;

        if (!originalPositions) {
          // Store original positions on first frame
          sail.userData.originalPositions = new Float32Array(positions.array);
          return;
        }

        for (let v = 0; v < positions.count; v++) {
          const origZ = originalPositions[v * 3 + 2];
          const x = positions.getX(v);
          // Add animated wind ripple on top of the baked belly curve
          const ripple = Math.sin(time * 2.5 + x * 4 + index * 1.5) * 0.02;
          positions.setZ(v, origZ + ripple);
        }
        positions.needsUpdate = true;
      }
    });
  }

  // ── Flag Flutter ──
  const flagGroup = boat.getObjectByName('flag');
  if (flagGroup) {
    flagGroup.children.forEach(flag => {
      if (flag.userData.isFlag) {
        const positions = flag.geometry.attributes.position;
        const originalPositions = flag.userData.originalPositions;

        if (!originalPositions) {
          flag.userData.originalPositions = new Float32Array(positions.array);
          return;
        }

        for (let v = 0; v < positions.count; v++) {
          const origX = originalPositions[v * 3];
          const origZ = originalPositions[v * 3 + 2];
          // Flutter increases with distance from pole
          const dist = (origX + 0.2) / 0.4; // normalize
          const flutter = Math.sin(time * 5 + origX * 10) * 0.02 * Math.max(dist, 0);
          positions.setZ(v, origZ + flutter);
        }
        positions.needsUpdate = true;
      }
    });
  }

  // ── Lantern Flicker ──
  const lanternGroup = boat.getObjectByName('lanterns');
  if (lanternGroup) {
    lanternGroup.children.forEach((child, index) => {
      if (child.isPointLight) {
        // Randomized flicker
        child.intensity = 0.25 + Math.sin(time * 3 + index * 2.7) * 0.1
                          + Math.sin(time * 7.1 + index * 1.3) * 0.05;
      }
    });
  }

  // ── Crew Sway ──
  const crewGroup = boat.getObjectByName('crew');
  if (crewGroup) {
    crewGroup.children.forEach((member, index) => {
      member.rotation.z = Math.sin(time * 1.5 + index * 1.8) * 0.05;
    });
  }
}

/**
 * Play the entrance animation — boat sails in from the horizon
 * @param {THREE.Group} boat - The boat group
 * @returns {gsap.core.Timeline} GSAP timeline for chaining
 */
export function playEntranceAnimation(boat) {
  // Start position: off-screen to the right, below water
  boat.position.set(15, -2, 5);
  boat.rotation.y = -Math.PI * 0.15;
  boat.scale.set(0.01, 0.01, 0.01);
  boat.visible = true;

  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
  });

  // Scale up from tiny (appearing on horizon)
  tl.to(boat.scale, {
    x: 1, y: 1, z: 1,
    duration: 1.5,
    ease: 'back.out(1.2)',
  });

  // Sail in from right to center
  tl.to(boat.position, {
    x: 0,
    z: 0,
    duration: 2.5,
    ease: 'power3.out',
  }, '-=1.2');

  // Rise above water
  tl.to(boat.position, {
    y: 0,
    duration: 1.0,
    ease: 'power2.out',
  }, '-=2.0');

  // Straighten rotation
  tl.to(boat.rotation, {
    y: 0,
    duration: 2.0,
    ease: 'power2.out',
  }, '-=2.0');

  return tl;
}

/**
 * Play exit animation — boat sails away
 * @param {THREE.Group} boat - The boat group
 * @returns {gsap.core.Timeline}
 */
export function playExitAnimation(boat) {
  const tl = gsap.timeline({
    defaults: { ease: 'power2.in' },
  });

  tl.to(boat.position, {
    x: -15,
    z: -5,
    duration: 2.0,
  });

  tl.to(boat.scale, {
    x: 0.01, y: 0.01, z: 0.01,
    duration: 1.5,
  }, '-=1.5');

  tl.to(boat.rotation, {
    y: Math.PI * 0.2,
    duration: 1.5,
  }, '-=1.5');

  tl.call(() => {
    boat.visible = false;
  });

  return tl;
}

/**
 * Create a wake trail behind the boat (particle trail)
 * @param {THREE.Scene} scene
 * @returns {Object} Wake object with update function
 */
export function createWake(scene) {
  const wakeCount = 200;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(wakeCount * 3);
  const opacities = new Float32Array(wakeCount);

  for (let i = 0; i < wakeCount; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    opacities[i] = 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xc8e6f0,
    size: 0.12,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const wake = new THREE.Points(geometry, material);
  scene.add(wake);

  let headIndex = 0;

  return {
    mesh: wake,
    update(boatPosition, time) {
      const positions = wake.geometry.attributes.position.array;

      // Add new wake particle at boat stern
      positions[headIndex * 3] = boatPosition.x - 2;
      positions[headIndex * 3 + 1] = boatPosition.y + 0.05;
      positions[headIndex * 3 + 2] = boatPosition.z + (Math.random() - 0.5) * 0.5;

      headIndex = (headIndex + 1) % wakeCount;

      // Spread and fade older particles
      for (let i = 0; i < wakeCount; i++) {
        positions[i * 3 + 2] += (Math.random() - 0.5) * 0.01; // Drift sideways
        positions[i * 3 + 1] -= 0.001; // Sink slowly
      }

      wake.geometry.attributes.position.needsUpdate = true;
    },
  };
}
