import * as THREE from 'three';

let listener = null;
let ambientSound = null;
let isAudioEnabled = false;

export function initAudio(camera) {
  if (listener) return;
  listener = new THREE.AudioListener();
  camera.add(listener);
}

export function toggleAudio(camera) {
  if (!listener) initAudio(camera);
  
  const ctx = listener.context;
  if (!ambientSound) {
    ambientSound = new THREE.Audio(listener);
    // Generate Brown Noise for soothing ocean sound effect
    const bufferSize = 2 * ctx.sampleRate; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Integration for brown noise
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Gain compensation
    }
    ambientSound.setBuffer(buffer);
    ambientSound.setLoop(true);
    ambientSound.setVolume(0.15);
  }

  isAudioEnabled = !isAudioEnabled;
  if (isAudioEnabled) {
    // Web Audio API requires user gesture to resume context
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    ambientSound.play();
  } else {
    ambientSound.pause();
  }
  
  return isAudioEnabled;
}
