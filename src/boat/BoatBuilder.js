/* ============================================
   GitBoat — Procedural Boat Builder
   Maps GitHub stats → 3D boat geometry
   
   Skills applied:
   - @threejs-skills: Group hierarchy, BufferGeometry, 
     material reuse, GSAP animations
   - @3d-web-experience: Purpose-driven 3D, performance-aware
   ============================================ */

import * as THREE from 'three';

// ── Shared Materials (reuse per @threejs-skills best practice) ──
const MATERIALS = {
  hull: new THREE.MeshStandardMaterial({
    color: 0x3a2518,
    roughness: 0.85,
    metalness: 0.05,
  }),
  hullDark: new THREE.MeshStandardMaterial({
    color: 0x2a1a10,
    roughness: 0.9,
    metalness: 0.02,
  }),
  deck: new THREE.MeshStandardMaterial({
    color: 0x6b4226,
    roughness: 0.75,
    metalness: 0.0,
  }),
  mast: new THREE.MeshStandardMaterial({
    color: 0x4a3020,
    roughness: 0.8,
    metalness: 0.05,
  }),
  sail: new THREE.MeshStandardMaterial({
    color: 0xf0e6d2,
    roughness: 0.6,
    metalness: 0.0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  }),
  lanternGlow: new THREE.MeshBasicMaterial({
    color: 0xffb347,
    transparent: true,
    opacity: 0.9,
  }),
  lanternPost: new THREE.MeshStandardMaterial({
    color: 0x2a2015,
    roughness: 0.7,
    metalness: 0.3,
  }),
  crew: new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    roughness: 0.5,
    metalness: 0.1,
  }),
  flag: new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    roughness: 0.4,
    metalness: 0.0,
    side: THREE.DoubleSide,
  }),
  railing: new THREE.MeshStandardMaterial({
    color: 0x4a3828,
    roughness: 0.7,
    metalness: 0.15,
  }),
};

// ── Stat Normalization ──
// Maps raw GitHub stats to user-friendly ranges for boat building
function normalizeStats(stats) {
  // Use a root curve for commits so average users still get a decent sized hull
  // e.g., 700 commits = ~0.9 scale, 5000 commits = ~1.3 scale
  const commitsRatio = Math.min((stats.totalCommits || 0) / 3000, 1.0);
  const hullScale = 0.4 + Math.pow(commitsRatio, 0.6) * 0.9; // Scale from 0.4 to 1.3
  
  // Sails: 1 sail per 3 repos. Max 6 masts.
  const sailCount = Math.min(Math.max(Math.ceil((stats.publicRepos || 0) / 4), 1), 6);
  
  // Lanterns: 0 if 0 stars. 1 lantern per 10 stars, max 10.
  const lanternCount = (stats.totalStars === 0) ? 0 : Math.min(Math.max(Math.ceil(stats.totalStars / 10), 1), 10);
  
  // Crew: 0 if 0 followers. 1 per 2 followers, max 8.
  const crewCount = (stats.followers === 0) ? 0 : Math.min(Math.max(Math.ceil(stats.followers / 2), 1), 8);
  
  // Patina: Account age mapping 0-1
  const patina = clamp((stats.accountAge || 0) / 10, 0.0, 1.0);
  
  // Fleet: 0 if 0 following. 1 per 2 following, max 5.
  const fleetCount = (stats.following === 0) ? 0 : Math.min(Math.max(Math.ceil(stats.following / 2), 1), 5);

  return {
    hullScale,
    sailCount,
    lanternCount,
    crewCount,
    patina,
    fleetCount,
    avatarUrl: stats.avatarUrl,
    primaryLanguage: stats.primaryLanguage || 'Unknown',
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Build a procedural 3D boat from GitHub stats
 * @param {Object} stats - Normalized boat stats
 * @returns {THREE.Group} Boat group containing all geometry
 */
export function buildBoat(stats) {
  const normalized = normalizeStats(stats);
  const boatGroup = new THREE.Group();
  boatGroup.name = 'boat';

  // Build components in dependency order
  const hull = buildHull(normalized.hullScale, normalized.patina, normalized.primaryLanguage);
  boatGroup.add(hull);

  const deck = buildDeck(normalized.hullScale);
  boatGroup.add(deck);

  const { masts, sails } = buildMastsAndSails(normalized.hullScale, normalized.sailCount);
  boatGroup.add(masts);
  boatGroup.add(sails);

  const lanterns = buildLanterns(normalized.hullScale, normalized.lanternCount);
  boatGroup.add(lanterns);

  const crew = buildCrew(normalized.hullScale, normalized.crewCount);
  boatGroup.add(crew);

  const flag = buildFlag(normalized.hullScale, normalized.avatarUrl);
  boatGroup.add(flag);

  const railings = buildRailings(normalized.hullScale);
  boatGroup.add(railings);

  const fleet = buildFleet(normalized.hullScale, normalized.fleetCount);
  boatGroup.add(fleet);

  // Store normalized stats for animation use
  boatGroup.userData = { normalized, sails };

  return boatGroup;
}

/**
 * Dispose all boat geometry and materials
 */
export function disposeBoat(boatGroup) {
  boatGroup.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose();
    }
  });
}

// ── Hull ──
function buildHull(scale, patina, language) {
  const hullGroup = new THREE.Group();
  hullGroup.name = 'hull';

  let lengthMult = 1.0;
  let widthMult = 1.0;
  let heightMult = 1.0;
  let materialType = 'wood';
  let shapeStyle = 'default';

  if (['JavaScript', 'TypeScript', 'Vue', 'React'].includes(language)) {
    shapeStyle = 'sleek';
    widthMult = 0.8;
    heightMult = 0.7;
  } else if (['Python', 'Jupyter Notebook'].includes(language)) {
    shapeStyle = 'rounded';
    materialType = 'darkMetal';
    lengthMult = 1.2;
    widthMult = 0.9;
  } else if (['Java', 'C#', 'PHP'].includes(language)) {
    shapeStyle = 'bulky';
    widthMult = 1.3;
    heightMult = 1.4;
  } else if (['C', 'C++', 'Rust', 'Go'].includes(language)) {
    shapeStyle = 'angular';
    materialType = 'metal';
    lengthMult = 1.1;
  }

  const length = (4 * scale + 2) * lengthMult;
  const width = (1.2 * scale + 0.6) * widthMult;
  const height = (0.8 * scale + 0.4) * heightMult;

  // Hull body using LatheGeometry for smooth boat shape
  const hullPoints = [];
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Boat cross-section: wider at middle, narrower at bow/stern
    const x = t * length - length / 2;
    
    let bowFactor;
    if (shapeStyle === 'sleek') {
      bowFactor = 1 - Math.pow(t, 2.0); // wide stern, sharp bow
    } else if (shapeStyle === 'rounded') {
      bowFactor = Math.sin(Math.acos(Math.abs(2 * t - 1))); // fully rounded
    } else if (shapeStyle === 'bulky') {
      bowFactor = 1 - Math.pow(Math.abs(2 * t - 1), 4); // boxy
    } else if (shapeStyle === 'angular') {
      bowFactor = 1 - Math.abs(2 * t - 1); // diamond
    } else {
      bowFactor = 1 - Math.pow(Math.abs(2 * t - 1), 2.5); // default
    }

    const y = Math.max(bowFactor * width, 0.05); // prevent zero-radius
    hullPoints.push(new THREE.Vector2(y, x));
  }

  const hullGeometry = new THREE.LatheGeometry(hullPoints, 24, 0, Math.PI);
  hullGeometry.rotateX(Math.PI / 2);
  hullGeometry.rotateZ(Math.PI / 2);
  hullGeometry.scale(1, 0.5, 1);

  // Apply material based on language
  let hullMat;
  if (materialType === 'metal') {
    hullMat = new THREE.MeshStandardMaterial({ color: 0x444a55, roughness: 0.4, metalness: 0.8 });
  } else if (materialType === 'darkMetal') {
    hullMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.6, metalness: 0.6 });
  } else {
    hullMat = MATERIALS.hull.clone();
  }

  // Apply patina color shift
  if (patina > 0.5) {
    if (materialType === 'wood') {
      hullMat.color.lerp(new THREE.Color(0x2a3a2a), (patina - 0.5) * 0.6);
    } else {
      hullMat.color.lerp(new THREE.Color(0x8a3a1a), (patina - 0.5) * 0.8); // Rust
      hullMat.roughness += 0.2;
    }
  }

  const hullMesh = new THREE.Mesh(hullGeometry, hullMat);
  hullMesh.position.y = -height * 0.3;
  hullMesh.castShadow = true;
  hullGroup.add(hullMesh);

  // Keel (bottom ridge)
  const keelGeometry = new THREE.BoxGeometry(length * 0.9, 0.1, 0.08);
  const keel = new THREE.Mesh(keelGeometry, MATERIALS.hullDark);
  keel.position.y = -height * 0.6;
  hullGroup.add(keel);

  // Bowsprit (front pole)
  const bowspritGeo = new THREE.CylinderGeometry(0.03, 0.02, length * 0.3, 6);
  bowspritGeo.rotateZ(Math.PI / 2);
  const bowsprit = new THREE.Mesh(bowspritGeo, MATERIALS.mast);
  bowsprit.position.set(length / 2 + length * 0.12, 0.1, 0);
  hullGroup.add(bowsprit);

  return hullGroup;
}

// ── Deck ──
function buildDeck(scale) {
  const deckGroup = new THREE.Group();
  deckGroup.name = 'deck';

  const length = 4 * scale + 2;
  const width = 1.2 * scale + 0.6;

  // Main deck surface
  const deckGeo = new THREE.BoxGeometry(length * 0.85, 0.06, width * 0.8);
  const deckMesh = new THREE.Mesh(deckGeo, MATERIALS.deck);
  deckMesh.position.y = 0.05;
  deckGroup.add(deckMesh);

  // Cabin (rear quarter)
  const cabinGeo = new THREE.BoxGeometry(length * 0.22, 0.4, width * 0.5);
  const cabin = new THREE.Mesh(cabinGeo, MATERIALS.hullDark);
  cabin.position.set(-length * 0.3, 0.28, 0);
  cabin.castShadow = true;
  deckGroup.add(cabin);

  // Cabin roof (slightly wider)
  const roofGeo = new THREE.BoxGeometry(length * 0.24, 0.04, width * 0.55);
  const roof = new THREE.Mesh(roofGeo, MATERIALS.deck);
  roof.position.set(-length * 0.3, 0.5, 0);
  deckGroup.add(roof);

  return deckGroup;
}

// ── Masts & Sails ──
function buildMastsAndSails(scale, sailCount) {
  const mastsGroup = new THREE.Group();
  mastsGroup.name = 'masts';
  const sailsGroup = new THREE.Group();
  sailsGroup.name = 'sails';

  const length = 4 * scale + 2;
  const mastHeight = 2.5 * scale + 1.5;

  // Sail positions along the hull (evenly spaced)
  const positions = [];
  for (let i = 0; i < sailCount; i++) {
    const t = (i + 1) / (sailCount + 1); // evenly distribute from bow to stern
    positions.push(length * (t - 0.5) * 0.7);
  }

  positions.forEach((xPos, index) => {
    const currentMastHeight = mastHeight * (1 - index * 0.08); // Slightly shorter toward stern

    // Mast pole
    const mastGeo = new THREE.CylinderGeometry(0.04, 0.06, currentMastHeight, 8);
    const mast = new THREE.Mesh(mastGeo, MATERIALS.mast);
    mast.position.set(xPos, currentMastHeight / 2, 0);
    mast.castShadow = true;
    mastsGroup.add(mast);

    // Yardarm (horizontal cross-beam)
    const yardLen = 1.0 * scale + 0.5;
    const yardGeo = new THREE.CylinderGeometry(0.025, 0.025, yardLen, 6);
    yardGeo.rotateZ(Math.PI / 2);
    const yard = new THREE.Mesh(yardGeo, MATERIALS.mast);
    yard.position.set(xPos, currentMastHeight * 0.75, 0);
    mastsGroup.add(yard);

    // Sail (quad plane, slightly curved via shape)
    const sailWidth = yardLen * 0.85;
    const sailHeight = currentMastHeight * 0.45;
    const sailGeo = new THREE.PlaneGeometry(sailWidth, sailHeight, 8, 4);

    // Add belly curve to sail (wind bulge)
    const sailPositions = sailGeo.attributes.position;
    for (let v = 0; v < sailPositions.count; v++) {
      const sx = sailPositions.getX(v);
      const sy = sailPositions.getY(v);
      // Parabolic belly: max Z displacement at center
      const xFactor = 1 - Math.pow(sx / (sailWidth / 2), 2);
      const yFactor = 1 - Math.pow(sy / (sailHeight / 2), 2);
      const belly = xFactor * yFactor * 0.15;
      sailPositions.setZ(v, belly);
    }
    sailGeo.computeVertexNormals();

    const sail = new THREE.Mesh(sailGeo, MATERIALS.sail);
    sail.position.set(xPos, currentMastHeight * 0.5, 0.08);
    sail.castShadow = true;
    sail.userData.bellySail = true; // Tag for animation
    sailsGroup.add(sail);

    // Crow's nest on the tallest mast
    if (index === 0) {
      const nestGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.15, 8, 1, true);
      const nest = new THREE.Mesh(nestGeo, MATERIALS.railing);
      nest.position.set(xPos, currentMastHeight * 0.85, 0);
      mastsGroup.add(nest);
    }
  });

  return { masts: mastsGroup, sails: sailsGroup };
}

// ── Lanterns ──
function buildLanterns(scale, count) {
  const lanternGroup = new THREE.Group();
  lanternGroup.name = 'lanterns';

  const length = 4 * scale + 2;
  const width = 1.2 * scale + 0.6;

  // Reuse geometry per @threejs-skills
  const postGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6);
  const glowGeo = new THREE.SphereGeometry(0.06, 8, 8);

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const xPos = length * (t - 0.5) * 0.7;
    const side = i % 2 === 0 ? 1 : -1;
    const zPos = (width * 0.35) * side;

    // Post
    const post = new THREE.Mesh(postGeo, MATERIALS.lanternPost);
    post.position.set(xPos, 0.22, zPos);
    lanternGroup.add(post);

    // Glow orb
    const glow = new THREE.Mesh(glowGeo, MATERIALS.lanternGlow);
    glow.position.set(xPos, 0.4, zPos);
    lanternGroup.add(glow);

    // Point light for actual glow effect (only on first few for perf)
    if (i < 4) {
      const light = new THREE.PointLight(0xffb347, 0.3, 3);
      light.position.set(xPos, 0.4, zPos);
      lanternGroup.add(light);
    }
  }

  return lanternGroup;
}

// ── Crew Members ──
function buildCrew(scale, count) {
  const crewGroup = new THREE.Group();
  crewGroup.name = 'crew';

  const length = 4 * scale + 2;
  const width = 1.2 * scale + 0.6;

  // Reuse geometry
  const bodyGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.2, 6);
  const headGeo = new THREE.SphereGeometry(0.04, 6, 6);

  for (let i = 0; i < count; i++) {
    const crewMember = new THREE.Group();

    // Body
    const body = new THREE.Mesh(bodyGeo, MATERIALS.crew);
    body.position.y = 0.15;
    crewMember.add(body);

    // Head
    const head = new THREE.Mesh(headGeo, MATERIALS.crew);
    head.position.y = 0.3;
    crewMember.add(head);

    // Position on deck
    const xPos = (Math.random() - 0.5) * length * 0.5;
    const zPos = (Math.random() - 0.5) * width * 0.4;
    crewMember.position.set(xPos, 0.05, zPos);

    crewGroup.add(crewMember);
  }

  return crewGroup;
}

// ── Flag ──
function buildFlag(scale, avatarUrl) {
  const flagGroup = new THREE.Group();
  flagGroup.name = 'flag';

  const length = 4 * scale + 2;
  const mastHeight = 2.5 * scale + 1.5;

  // Flag cloth
  const flagGeo = new THREE.PlaneGeometry(0.4, 0.25, 6, 3);

  // Add wave to flag
  const flagPositions = flagGeo.attributes.position;
  for (let v = 0; v < flagPositions.count; v++) {
    const x = flagPositions.getX(v);
    flagPositions.setZ(v, Math.sin(x * 6) * 0.03);
  }
  flagGeo.computeVertexNormals();

  let flagMat = MATERIALS.flag;
  
  if (avatarUrl) {
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(avatarUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    flagMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
  }

  const flagMesh = new THREE.Mesh(flagGeo, flagMat);
  flagMesh.position.set(
    length * 0.35 * 0.7,    // Near front mast
    mastHeight + 0.15,       // Top of tallest mast
    0.2                      // Offset to side
  );
  flagMesh.userData.isFlag = true; // Tag for animation
  flagGroup.add(flagMesh);

  return flagGroup;
}

// ── Railings ──
function buildRailings(scale) {
  const railGroup = new THREE.Group();
  railGroup.name = 'railings';

  const length = 4 * scale + 2;
  const width = 1.2 * scale + 0.6;

  const postGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.25, 4);
  const railGeo = new THREE.CylinderGeometry(0.008, 0.008, length * 0.7, 4);
  railGeo.rotateZ(Math.PI / 2);

  // Railing posts along both sides
  const postCount = Math.floor(length * 1.5);
  for (let i = 0; i < postCount; i++) {
    const t = (i + 0.5) / postCount;
    const xPos = length * (t - 0.5) * 0.7;

    [-1, 1].forEach(side => {
      const zPos = width * 0.38 * side;
      const post = new THREE.Mesh(postGeo, MATERIALS.railing);
      post.position.set(xPos, 0.18, zPos);
      railGroup.add(post);
    });
  }

  // Horizontal rails
  [-1, 1].forEach(side => {
    const zPos = width * 0.38 * side;
    const rail = new THREE.Mesh(railGeo, MATERIALS.railing);
    rail.position.set(0, 0.28, zPos);
    railGroup.add(rail);
  });

  return railGroup;
}

// ── Fleet (Companion Boats) ──
function buildFleet(primaryScale, count) {
  const fleetGroup = new THREE.Group();
  fleetGroup.name = 'fleet';

  if (count <= 0) return fleetGroup;

  // Simplified geometry for companion boats
  const length = 1.8;
  const width = 0.6;
  
  // Hull body using simple lathed shape
  const hullPoints = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = t * length - length / 2;
    const y = (1 - Math.pow(Math.abs(2 * t - 1), 2.5)) * width;
    hullPoints.push(new THREE.Vector2(y, x));
  }
  const simpleHullGeo = new THREE.LatheGeometry(hullPoints, 12, 0, Math.PI);
  simpleHullGeo.rotateX(Math.PI / 2);
  simpleHullGeo.rotateZ(Math.PI / 2);
  simpleHullGeo.scale(1, 0.5, 1);

  const simpleSailGeo = new THREE.PlaneGeometry(1.0, 1.5, 4, 2);
  const sailPos = simpleSailGeo.attributes.position;
  for (let v = 0; v < sailPos.count; v++) {
    const sx = sailPos.getX(v);
    const sy = sailPos.getY(v);
    const belly = (1 - Math.pow(sx / 0.5, 2)) * (1 - Math.pow(sy / 0.75, 2)) * 0.15;
    sailPos.setZ(v, belly);
  }
  simpleSailGeo.computeVertexNormals();
  simpleSailGeo.translate(0, 0.75, 0.05);

  for (let i = 0; i < count; i++) {
    const boat = new THREE.Group();
    
    // Hull
    const hull = new THREE.Mesh(simpleHullGeo, MATERIALS.hullDark);
    hull.position.y = -0.2;
    boat.add(hull);

    // Mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.8), MATERIALS.mast);
    mast.position.y = 0.9;
    boat.add(mast);

    // Sail
    const sail = new THREE.Mesh(simpleSailGeo, MATERIALS.sail);
    sail.position.y = 0.2;
    sail.userData.bellySail = true; // For animation
    boat.add(sail);

    // Position them in a V-formation behind the main boat
    const row = Math.floor(i / 2) + 1;
    const side = (i % 2 === 0) ? -1 : 1;
    
    // offset behind and to the sides
    const primaryLen = 4 * primaryScale + 2;
    const xPos = -(primaryLen / 2) - (row * 2.5);
    const zPos = side * (row * 1.5 + 1.0);
    
    boat.position.set(xPos, 0, zPos);
    fleetGroup.add(boat);
  }

  return fleetGroup;
}
