/* ============================================
   GitBoat — Main Application Entry
   State Machine: LANDING → LOADING → PROFILE
   ============================================ */

import './styles/main.css';
import { gsap } from 'gsap';
import { initOceanScene, setCameraForProfile, setCameraForLanding, getScene, onRenderUpdate, offRenderUpdate } from './scene/OceanScene.js';
import { buildBoat, disposeBoat } from './boat/BoatBuilder.js';
import { updateBoatAnimation, playEntranceAnimation, playExitAnimation, createWake } from './boat/BoatAnimator.js';

// ── App State ──
const AppState = {
  LANDING: 'LANDING',
  LOADING: 'LOADING',
  PROFILE: 'PROFILE',
};

let currentState = AppState.LANDING;
let currentBoat = null;
let boatWake = null;
let boatUpdateCallback = null;

// ── DOM References ──
const screens = {
  landing: document.getElementById('landing'),
  loading: document.getElementById('loading'),
  profile: document.getElementById('profile'),
};

const dom = {
  canvas: document.getElementById('ocean-canvas'),
  searchForm: document.getElementById('search-form'),
  usernameInput: document.getElementById('username-input'),
  setSailBtn: document.getElementById('set-sail-btn'),
  subtitleEl: document.getElementById('subtitle-typewriter'),
  loadingText: document.getElementById('loading-text'),
  backBtn: document.getElementById('back-btn'),
  tryAgainBtn: document.getElementById('try-again-btn'),
  profileCard: document.getElementById('profile-card'),
  errorCard: document.getElementById('error-card'),
  profileAvatar: document.getElementById('profile-avatar'),
  profileName: document.getElementById('profile-name'),
  profileBio: document.getElementById('profile-bio'),
  statsGrid: document.getElementById('stats-grid'),
  legendBtn: document.getElementById('legend-btn'),
  legendPanel: document.getElementById('legend-panel'),
};

// ── State Transitions ──
function switchScreen(newState) {
  // Hide all screens
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });

  // Show target screen
  currentState = newState;
  switch (newState) {
    case AppState.LANDING:
      screens.landing.classList.add('active');
      dom.errorCard.style.display = 'none';
      dom.profileCard.style.display = '';
      setCameraForLanding();
      break;
    case AppState.LOADING:
      screens.loading.classList.add('active');
      startLoadingMessages();
      break;
    case AppState.PROFILE:
      screens.profile.classList.add('active');
      setCameraForProfile();
      break;
  }
}

// ── Typewriter Effect ──
const subtitleText = 'Your GitHub story, told at sea.';
let typewriterIndex = 0;
let typewriterTimer = null;

function startTypewriter() {
  typewriterIndex = 0;
  dom.subtitleEl.innerHTML = '<span class="cursor-blink"></span>';

  typewriterTimer = setInterval(() => {
    if (typewriterIndex < subtitleText.length) {
      const char = subtitleText[typewriterIndex];
      // Insert character before the cursor
      const cursor = dom.subtitleEl.querySelector('.cursor-blink');
      const textNode = document.createTextNode(char);
      dom.subtitleEl.insertBefore(textNode, cursor);
      typewriterIndex++;
    } else {
      clearInterval(typewriterTimer);
      // Remove cursor after a pause
      setTimeout(() => {
        const cursor = dom.subtitleEl.querySelector('.cursor-blink');
        if (cursor) cursor.style.animation = 'blink 1s step-end 3';
      }, 1500);
    }
  }, 65);
}

// ── Loading Messages ──
const loadingMessages = [
  'Charting course…',
  'Loading cargo…',
  'Raising sails…',
  'Checking the wind…',
  'Preparing the deck…',
];
let loadingMsgIndex = 0;
let loadingMsgTimer = null;

function startLoadingMessages() {
  loadingMsgIndex = 0;
  dom.loadingText.textContent = loadingMessages[0];

  loadingMsgTimer = setInterval(() => {
    loadingMsgIndex = (loadingMsgIndex + 1) % loadingMessages.length;
    dom.loadingText.style.opacity = '0';
    setTimeout(() => {
      dom.loadingText.textContent = loadingMessages[loadingMsgIndex];
      dom.loadingText.style.opacity = '1';
    }, 200);
  }, 1800);
}

function stopLoadingMessages() {
  if (loadingMsgTimer) {
    clearInterval(loadingMsgTimer);
    loadingMsgTimer = null;
  }
}

// ── Legend Panel Toggle ──
function setupLegend() {
  const legendData = [
    { icon: '📏', stat: 'Commits', arrow: '→', boat: 'Hull Size' },
    { icon: '⛵', stat: 'Repos', arrow: '→', boat: 'Number of Sails' },
    { icon: '⭐', stat: 'Stars', arrow: '→', boat: 'Deck Lanterns' },
    { icon: '👥', stat: 'Followers', arrow: '→', boat: 'Crew Members' },
    { icon: '🚢', stat: 'Following', arrow: '→', boat: 'Fleet Boats' },
    { icon: '📅', stat: 'Account Age', arrow: '→', boat: 'Hull Patina' },
    { icon: '🏴', stat: 'Avatar', arrow: '→', boat: 'Flag Texture' },
  ];

  dom.legendPanel.innerHTML = legendData.map(item => `
    <div class="legend-item">
      <span class="legend-icon">${item.icon}</span>
      <span>${item.stat}</span>
      <span class="legend-arrow">${item.arrow}</span>
      <span style="color: var(--glow-cyan)">${item.boat}</span>
    </div>
  `).join('');

  dom.legendBtn.addEventListener('click', () => {
    const isOpen = dom.legendPanel.classList.toggle('open');
    dom.legendBtn.textContent = isOpen ? 'Hide Boat Legend ▴' : 'View Boat Legend ▾';
  });
}

// ── Stats Rendering ──
function renderStats(stats) {
  const items = [
    { value: stats.totalCommits ?? '—', label: 'Commits', icon: '📏 Hull' },
    { value: stats.publicRepos, label: 'Repos', icon: '⛵ Sails' },
    { value: stats.totalStars, label: 'Stars', icon: '⭐ Lanterns' },
    { value: stats.followers, label: 'Followers', icon: '👥 Crew' },
    { value: stats.following, label: 'Following', icon: '🚢 Fleet' },
    { value: stats.accountAge + 'y', label: 'Account Age', icon: '📅 Patina' },
  ];

  dom.statsGrid.innerHTML = items.map(item => `
    <div class="stat-item">
      <div class="stat-value" data-count="${typeof item.value === 'number' ? item.value : 0}">${item.value}</div>
      <div class="stat-label">${item.label}</div>
      <div class="stat-boat-icon">${item.icon}</div>
    </div>
  `).join('');
}

// ── Profile Display ──
function showProfile(profile, stats) {
  dom.profileAvatar.src = profile.avatar_url;
  dom.profileAvatar.alt = `${profile.login}'s avatar`;
  dom.profileName.textContent = profile.name || profile.login;
  dom.profileBio.textContent = profile.bio || 'No bio';
  renderStats(stats);
  dom.profileCard.style.display = '';
  dom.errorCard.style.display = 'none';
  switchScreen(AppState.PROFILE);

  // Profile fade-up reveal
  gsap.fromTo(dom.profileCard,
    { autoAlpha: 0, y: 50 },
    { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }
  );
  gsap.fromTo('.stat-item',
    { autoAlpha: 0, y: 20 },
    { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out', delay: 0.4 }
  );
}

function showError(message) {
  dom.profileCard.style.display = 'none';
  dom.errorCard.style.display = '';
  document.getElementById('error-message').textContent = message;
  switchScreen(AppState.PROFILE);
}

// ── Count-Up Animation ──
function animateCountUp() {
  const statValues = dom.statsGrid.querySelectorAll('.stat-value[data-count]');
  statValues.forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target) || target === 0) return;

    const duration = 1200;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  });
}

// ── Event Handlers ──
function handleSearch(e) {
  e.preventDefault();
  const username = dom.usernameInput.value.trim();
  if (!username) return;

  // Wave Wipe Transition
  gsap.to('#wave-wipe', {
    y: '0%',
    duration: 1.2,
    ease: 'power3.inOut',
    onComplete: () => {
      switchScreen(AppState.LOADING);
      
      // Move wave wipe up to reveal loading
      gsap.to('#wave-wipe', {
        y: '-120%', 
        duration: 1.2,
        ease: 'power3.inOut',
        onComplete: () => {
          gsap.set('#wave-wipe', { y: '100%' }); // Reset
        }
      });
      
      // Fetch data
      setTimeout(async () => {
        stopLoadingMessages();
        try {
          // Phase 5: Replace with real API call
          // import { fetchUserProfile, fetchUserRepos, calculateBoatStats } from './api/github.js';
          // const profile = await fetchUserProfile(username);
          // const repos = await fetchUserRepos(username);
          // const stats = calculateBoatStats(profile, repos);

          // Temporary stub data
          const profile = {
            login: username,
            name: username,
            avatar_url: `https://github.com/${username}.png`,
            bio: 'Loading real data in Phase 5...',
          };
          const stats = {
            totalCommits: 1234,
            publicRepos: 42,
            totalStars: 567,
            followers: 890,
            following: 123,
            accountAge: 5,
          };

          showProfile(profile, stats);
          spawnBoat(stats);
          setTimeout(animateCountUp, 500); // Trigger slightly later due to fade up
        } catch (err) {
          showError(err.message || 'Could not find this sailor on the seas.');
        }
      }, 2000);
    }
  });
}

function handleBack() {
  removeBoat();
  switchScreen(AppState.LANDING);
  dom.usernameInput.value = '';
  dom.usernameInput.focus();

  // Landing entrance animation (re-play)
  gsap.fromTo('.shimmer-text', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' });
  gsap.fromTo('.subtitle', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.2 });
  gsap.fromTo('.search-container', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.4 });
}

// ── Boat Lifecycle ──
function spawnBoat(stats) {
  // Remove any existing boat
  removeBoat();

  const { scene } = getScene();
  if (!scene) return;

  // Build the boat from stats
  currentBoat = buildBoat(stats);
  currentBoat.visible = false;
  scene.add(currentBoat);

  // Create wake trail
  boatWake = createWake(scene);

  // Register per-frame animation callback
  boatUpdateCallback = (elapsed) => {
    updateBoatAnimation(currentBoat, elapsed);
    if (boatWake && currentBoat.visible) {
      boatWake.update(currentBoat.position, elapsed);
    }
  };
  onRenderUpdate(boatUpdateCallback);

  // Play entrance animation
  playEntranceAnimation(currentBoat);
}

function removeBoat() {
  if (currentBoat) {
    const { scene } = getScene();
    if (scene) {
      // Play exit or just remove
      disposeBoat(currentBoat);
      scene.remove(currentBoat);
    }
    if (boatUpdateCallback) {
      offRenderUpdate(boatUpdateCallback);
      boatUpdateCallback = null;
    }
    if (boatWake && boatWake.mesh) {
      const { scene: s } = getScene();
      if (s) s.remove(boatWake.mesh);
      boatWake.mesh.geometry.dispose();
      boatWake.mesh.material.dispose();
    }
    currentBoat = null;
    boatWake = null;
  }
}

// ── Initialization ──
function init() {
  // Event listeners
  dom.searchForm.addEventListener('submit', handleSearch);
  dom.backBtn.addEventListener('click', handleBack);
  dom.tryAgainBtn.addEventListener('click', handleBack);

  // Set up legend
  setupLegend();

  // Start typewriter
  startTypewriter();

  // Initialize 3D ocean scene
  initOceanScene(dom.canvas);

  // Activate landing screen
  switchScreen(AppState.LANDING);

  // Initial Landing entrance animation
  gsap.from('.shimmer-text', { autoAlpha: 0, y: 30, duration: 1, ease: 'power3.out', delay: 0.2 });
  // Typewriter handles the subtitle, let's just fade its container slightly
  gsap.from('.subtitle', { autoAlpha: 0, y: 20, duration: 0.8, ease: 'power3.out', delay: 0.5 });
  gsap.from('.search-container', { autoAlpha: 0, y: 20, duration: 0.8, ease: 'power3.out', delay: 0.8 });

  console.log('🚢 GitBoat initialized');
}

// ── Export for other modules ──
export { switchScreen, showProfile, showError, stopLoadingMessages, animateCountUp, AppState, dom };

// ── Start ──
init();

// Clean up Vite boilerplate files (they're no longer needed)
