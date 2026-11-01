import * as THREE from 'three';

const FILES = 'abcdefgh';
const materialDefaults = { roughness: 0.28, metalness: 0.78 };

// All material maps are generated locally. No remote model or texture CDN is required.
const WOOD_FINISHES = {
  heritage: { light:'#dca96d', dark:'#382216', frame:'#704523', table:'#a7835d', white:'#e8dcc4', black:'#4a2815' },
  walnut:   { light:'#c9955f', dark:'#2b1711', frame:'#57321f', table:'#805333', white:'#dfc8a4', black:'#32170e' },
  oak:      { light:'#e8c58e', dark:'#65452d', frame:'#93663d', table:'#c49a6b', white:'#f1e4ca', black:'#56331d' },
  ebony:    { light:'#d8c6a7', dark:'#211b1b', frame:'#3b2926', table:'#5a4034', white:'#f0e5d1', black:'#191313' },
  cherry:   { light:'#d7a16f', dark:'#4b211b', frame:'#783d2b', table:'#9a5b3c', white:'#efd6ba', black:'#512016' }
};

function mat(color, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color, ...materialDefaults, clearcoat: .38, clearcoatRoughness: .24, ...extra });
}
function addMesh(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = false;
  parent.add(object);
  return object;
}
function cylinderBetween(parent, a, b, radiusTop, radiusBottom, material, radial = 10) {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const direction = new THREE.Vector3().subVectors(to, from);
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, direction.length(), radial, 1);
  const object = new THREE.Mesh(geometry, material);
  object.position.copy(from).add(to).multiplyScalar(.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  object.castShadow = true;
  object.receiveShadow = false;
  parent.add(object);
  return object;
}
function addGem(parent, material, position, radius = .055) {
  return addMesh(parent, new THREE.IcosahedronGeometry(radius, 1), material, position, [0, 0, Math.PI / 4]);
}
function createSword(parent, metal, trim, scale = 1) {
  const sword = new THREE.Group();
  sword.scale.setScalar(scale);
  addMesh(sword, new THREE.BoxGeometry(.045, .36, .035), metal, [0, .19, 0], [0, 0, -.08]);
  addMesh(sword, new THREE.BoxGeometry(.19, .035, .065), trim, [0, .015, 0], [0, 0, -.08]);
  addMesh(sword, new THREE.CylinderGeometry(.025, .025, .13, 8), trim, [0, -.07, 0]);
  addGem(sword, trim, [0, -.15, 0], .035);
  parent.add(sword);
  return sword;
}
function createShield(parent, metal, trim, accent) {
  const shield = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, .25); shape.lineTo(.18, .18); shape.lineTo(.15, -.08); shape.lineTo(0, -.29); shape.lineTo(-.15, -.08); shape.lineTo(-.18, .18); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .055, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .025, bevelThickness: .025 });
  addMesh(shield, geometry, metal, [0, 0, 0], [0, 0, 0]);
  addMesh(shield, new THREE.BoxGeometry(.022, .34, .012), trim, [0, 0, .065]);
  addGem(shield, accent, [0, .02, .08], .045);
  shield.position.set(-.28, .5, .12);
  shield.rotation.z = .12;
  parent.add(shield);
  return shield;
}
function addCrown(parent, trim, gem, royal = false) {
  const crown = new THREE.Group();
  addMesh(crown, new THREE.CylinderGeometry(.14, .16, .075, 12), trim, [0, 0, 0]);
  addMesh(crown, new THREE.TorusGeometry(.145, .018, 8, 18), gem, [0, .05, 0], [Math.PI / 2, 0, 0]);
  const spikes = royal ? 7 : 5;
  for (let i = 0; i < spikes; i++) {
    const angle = i / spikes * Math.PI * 2;
    const x = Math.cos(angle) * .12;
    const z = Math.sin(angle) * .12;
    addMesh(crown, new THREE.ConeGeometry(.035, royal ? .18 : .13, 5), trim, [x, .11, z]);
    addGem(crown, gem, [x, royal ? .205 : .18, z], .025);
  }
  crown.position.y = .95;
  parent.add(crown);
  return crown;
}

function createWoodTexture(hex, seed = 1, grain = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  // Canvas 2D expects sRGB byte values. THREE.Color stores linearized RGB,
  // so parsing the source hex directly avoids unintentionally dark wood textures.
  const sourceHex = String(hex).replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(sourceHex)) throw new Error(`Invalid wood colour: ${hex}`);
  const channels = [0, 2, 4].map(offset => parseInt(sourceHex.slice(offset, offset + 2), 16));
  const rgb = `rgb(${channels[0]},${channels[1]},${channels[2]})`;
  ctx.fillStyle = rgb;
  ctx.fillRect(0, 0, 512, 512);

  // Quiet, fine-grained wood figure; the texture remains subtle at board scale.
  let state = seed >>> 0;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < 150; i++) {
    const y = rand() * 512;
    const alpha = (0.025 + rand() * 0.055) * grain;
    const shade = rand() > .52 ? 18 : -18;
    const r = Math.max(0, Math.min(255, channels[0] + shade));
    const g = Math.max(0, Math.min(255, channels[1] + shade));
    const b = Math.max(0, Math.min(255, channels[2] + shade));
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.lineWidth = .5 + rand() * 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(130, y + (rand() - .5) * 22, 340, y + (rand() - .5) * 18, 512, y + (rand() - .5) * 16);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const x = rand() * 512, y = rand() * 512, w = 18 + rand() * 42, h = 3 + rand() * 7;
    ctx.strokeStyle = `rgba(40,28,18,${.05 * grain})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, w, h, rand() * .15, 0, Math.PI * 2); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeWoodMaterial(texture, roughness = .29) {
  return new THREE.MeshPhysicalMaterial({
    map: texture,
    color: 0xffffff,
    roughness,
    metalness: .035,
    clearcoat: .62,
    clearcoatRoughness: .2
  });
}

function lathe(parent, profile, material, segments = 40) {
  const points = profile.map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(points, segments);
  return addMesh(parent, geometry, material);
}

function horizontalRing(parent, radius, tube, y, material) {
  return addMesh(parent, new THREE.TorusGeometry(radius, tube, 7, 36), material, [0, y, 0], [Math.PI / 2, 0, 0]);
}

function addTurnedBase(root, wood, trim, style = 'standard') {
  const profiles = {
    standard: [[0,.015],[.22,.015],[.29,.035],[.33,.075],[.33,.12],[.29,.15],[.25,.18],[.23,.22],[.19,.25],[.16,.31],[.14,.38],[.13,.45],[.16,.49],[.20,.53],[.18,.57],[.13,.61],[0,.62]],
    tall: [[0,.015],[.23,.015],[.30,.04],[.34,.08],[.33,.13],[.29,.16],[.25,.19],[.21,.25],[.16,.34],[.14,.45],[.14,.55],[.17,.60],[.21,.64],[.18,.69],[.12,.75],[0,.75]],
    short: [[0,.015],[.24,.015],[.31,.04],[.34,.08],[.33,.13],[.28,.17],[.24,.20],[.19,.26],[.15,.33],[.15,.40],[.19,.45],[.17,.49],[.12,.54],[0,.54]]
  };
  lathe(root, profiles[style] || profiles.standard, wood, 48);
  horizontalRing(root, .292, .012, .105, trim);
  horizontalRing(root, .235, .009, .215, trim);
  horizontalRing(root, .165, .008, style === 'tall' ? .63 : style === 'short' ? .46 : .51, trim);
}

function addKnightHorse(root, wood, trim, dark) {
  // Extruded horse-head silhouette: actual 3D geometry, not a bitmap or Unicode glyph.
  const shape = new THREE.Shape();
  shape.moveTo(-.17, .02);
  shape.lineTo(-.17, .25);
  shape.bezierCurveTo(-.29, .44, -.27, .68, -.17, .82);
  shape.bezierCurveTo(-.10, .94, .02, 1.02, .15, .98);
  shape.lineTo(.24, .91);
  shape.lineTo(.17, .84);
  shape.lineTo(.28, .78);
  shape.lineTo(.18, .71);
  shape.bezierCurveTo(.23, .55, .17, .39, .08, .31);
  shape.lineTo(.09, .02);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .18, bevelEnabled: true, bevelSegments: 3, steps: 1,
    bevelSize: .028, bevelThickness: .028, curveSegments: 12
  });
  const horse = addMesh(root, geometry, wood, [0, .42, -.09]);
  horse.castShadow = true;

  // Mane ridges, muzzle and eye make the profile legible from a 3/4 camera.
  for (let i = 0; i < 4; i++) {
    const mane = new THREE.Mesh(new THREE.ConeGeometry(.045, .17, 7), trim);
    mane.position.set(-.14 + i * .045, 1.02 - i * .055, -.005);
    mane.rotation.z = -.22;
    mane.castShadow = true;
    root.add(mane);
  }
  addMesh(root, new THREE.SphereGeometry(.026, 10, 8), dark, [.135, 1.23, .105]);
  addMesh(root, new THREE.ConeGeometry(.042, .16, 7), wood, [-.09, 1.36, -.02], [0, 0, -.18]);
  addMesh(root, new THREE.ConeGeometry(.038, .14, 7), wood, [.035, 1.35, -.02], [0, 0, -.28]);
  addMesh(root, new THREE.BoxGeometry(.085, .06, .12), trim, [.17, 1.08, .02]);
}

function makeStauntonPiece(type, color, theme, pieceTextures) {
  const root = new THREE.Group();
  const wood = makeWoodMaterial(pieceTextures[color], color === 'w' ? .24 : .3);
  const trimColor = new THREE.Color(0x9b754b);
  const trim = new THREE.MeshPhysicalMaterial({
    color: trimColor, metalness: .58, roughness: .3,
    clearcoat: .4, clearcoatRoughness: .22
  });
  const dark = new THREE.MeshStandardMaterial({
    color: color === 'w' ? 0x78654f : 0x090b0e,
    roughness: .58, metalness: .06
  });
  const ivory = new THREE.MeshStandardMaterial({
    color: color === 'w' ? 0xf8efdc : 0x4a3d31,
    roughness: .3, metalness: .08
  });

  addTurnedBase(root, wood, trim, type === 'k' || type === 'q' ? 'tall' : type === 'p' ? 'short' : 'standard');

  if (type === 'p') {
    addMesh(root, new THREE.SphereGeometry(.145, 28, 22), wood, [0, .78, 0], [0, 0, 0], [1, 1.04, 1]);
    addMesh(root, new THREE.SphereGeometry(.025, 10, 8), trim, [0, .80, .135]);
    horizontalRing(root, .13, .012, .63, trim);
  } else if (type === 'r') {
    lathe(root, [[0,.57],[.15,.57],[.18,.62],[.18,.92],[.21,.96],[.21,1.02],[0,1.02]], wood, 36);
    addMesh(root, new THREE.CylinderGeometry(.22,.22,.085,24), wood, [0, 1.04, 0]);
    addMesh(root, new THREE.TorusGeometry(.215,.014,7,32), trim, [0,1.085,0], [Math.PI/2,0,0]);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * .25 + i * Math.PI / 2;
      addMesh(root, new THREE.BoxGeometry(.105,.15,.105), wood, [Math.cos(a)*.145,1.16,Math.sin(a)*.145]);
    }
  } else if (type === 'n') {
    addKnightHorse(root, wood, trim, dark);
  } else if (type === 'b') {
    lathe(root, [[0,.58],[.14,.58],[.17,.65],[.14,.75],[.11,.85],[.16,.95],[.19,1.02],[.16,1.10],[.10,1.20],[0,1.27]], wood, 40);
    addMesh(root, new THREE.SphereGeometry(.045,16,12), trim, [0,1.29,0]);
    // Traditional bishop mitre incision.
    addMesh(root, new THREE.BoxGeometry(.018,.26,.012), dark, [.015,1.05,.105], [0,0,.52]);
    horizontalRing(root, .155, .011, .91, trim);
  } else if (type === 'q') {
    lathe(root, [[0,.58],[.15,.58],[.17,.66],[.115,.78],[.095,.91],[.14,1.0],[.20,1.05],[.18,1.11],[.12,1.16],[0,1.18]], wood, 44);
    horizontalRing(root, .18, .018, 1.08, trim);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      addMesh(root, new THREE.ConeGeometry(.035,.14,8), trim, [Math.cos(a)*.145,1.20,Math.sin(a)*.145]);
    }
    addMesh(root, new THREE.SphereGeometry(.065,18,14), trim, [0,1.29,0]);
  } else if (type === 'k') {
    lathe(root, [[0,.58],[.15,.58],[.18,.66],[.13,.78],[.105,.94],[.15,1.04],[.20,1.10],[.18,1.17],[.12,1.22],[0,1.24]], wood, 44);
    horizontalRing(root, .18, .018, 1.14, trim);
    addMesh(root, new THREE.BoxGeometry(.075,.33,.075), trim, [0,1.39,0]);
    addMesh(root, new THREE.BoxGeometry(.25,.065,.075), trim, [0,1.43,0]);
    addMesh(root, new THREE.SphereGeometry(.035,14,10), trim, [0,1.57,0]);
  }
  root.userData.weapon = null;
  root.userData.weaponArm = null;
  root.userData.materials = [wood, trim, dark, ivory];
  root.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  return { root, materials: root.userData.materials };
}

function createCombatWarrior(type, color, theme) {
  // Temporary miniature fighters appear only during a capture. The normal pieces
  // remain full-size Staunton chessmen before and after the on-board duel.
  const fighter = new THREE.Group();
  const isWhite = color === 'w';
  const armor = new THREE.MeshPhysicalMaterial({
    color: isWhite ? 0xd7c7a7 : 0x202731,
    metalness: .72, roughness: .24, clearcoat: .8, clearcoatRoughness: .18
  });
  const darkArmor = new THREE.MeshPhysicalMaterial({
    color: isWhite ? 0x77664f : 0x090d13,
    metalness: .58, roughness: .34, clearcoat: .45
  });
  const trim = new THREE.MeshPhysicalMaterial({
    color: theme.accent, metalness: .72, roughness: .22, clearcoat: .8
  });
  const leather = new THREE.MeshStandardMaterial({ color: isWhite ? 0x4e3a2a : 0x13151b, roughness: .72 });
  const glow = new THREE.MeshBasicMaterial({ color: theme.accent });
  const materials = [armor, darkArmor, trim, leather, glow];

  // Small round plinth and two armored legs.
  addMesh(fighter, new THREE.CylinderGeometry(.19, .21, .075, 20), darkArmor, [0, .055, 0]);
  addMesh(fighter, new THREE.TorusGeometry(.18, .012, 6, 28), trim, [0, .095, 0]);
  for (const x of [-.095, .095]) {
    cylinderBetween(fighter, [x, .09, 0], [x * 1.08, .34, .015], .055, .075, armor, 9);
    addMesh(fighter, new THREE.SphereGeometry(.064, 10, 8), darkArmor, [x * 1.08, .33, .015]);
    addMesh(fighter, new THREE.BoxGeometry(.12, .075, .18), leather, [x * 1.08, .13, .075]);
  }
  // Chest, belt, shoulder plates and helmet.
  cylinderBetween(fighter, [0, .34, 0], [0, .68, 0], .15, .205, armor, 12);
  addMesh(fighter, new THREE.BoxGeometry(.20, .06, .035), trim, [0, .43, .18]);
  addGem(fighter, glow, [0, .54, .18], .035);
  for (const x of [-.205, .205]) {
    addMesh(fighter, new THREE.SphereGeometry(.105, 12, 10), darkArmor, [x, .64, 0], [0, 0, x < 0 ? -.2 : .2], [1.05, .72, 1]);
    addGem(fighter, trim, [x * 1.08, .67, .055], .022);
  }
  addMesh(fighter, new THREE.SphereGeometry(.105, 18, 14), armor, [0, .82, 0]);
  addMesh(fighter, new THREE.SphereGeometry(.115, 16, 12, 0, Math.PI * 2, 0, Math.PI * .58), darkArmor, [0, .84, 0]);
  addMesh(fighter, new THREE.BoxGeometry(.14, .045, .12), trim, [0, .80, .095]);
  addMesh(fighter, new THREE.BoxGeometry(.11, .018, .025), leather, [0, .81, .16]);
  // Short cape behind the miniature fighter.
  const capeShape = new THREE.Shape();
  capeShape.moveTo(-.12, .68); capeShape.lineTo(.12, .68); capeShape.lineTo(.18, .27);
  capeShape.quadraticCurveTo(0, .20, -.18, .27); capeShape.closePath();
  const cape = addMesh(fighter, new THREE.ExtrudeGeometry(capeShape, { depth:.018, bevelEnabled:true, bevelSegments:1, bevelSize:.01, bevelThickness:.01 }), leather, [0,0,-.13]);
  cape.rotation.y = Math.PI;

  // Weapon arm is a pivot so the capture sequence can wind up and strike.
  const weaponArm = new THREE.Group();
  weaponArm.position.set(.205, .62, .015);
  fighter.add(weaponArm);
  cylinderBetween(weaponArm, [0, 0, 0], [.055, -.16, .045], .052, .045, armor, 9);
  addMesh(weaponArm, new THREE.SphereGeometry(.047, 10, 8), darkArmor, [.055, -.16, .045]);
  const weapon = new THREE.Group();
  weapon.position.set(.065, -.19, .06);
  weaponArm.add(weapon);

  // Each chess role has a different weapon silhouette and therefore a different
  // readable attack when it captures on the board.
  if (type === 'p') {
    cylinderBetween(weapon, [0, -.18, 0], [0, .31, 0], .014, .018, darkArmor, 7);
    addMesh(weapon, new THREE.ConeGeometry(.045, .13, 7), trim, [0, .37, 0]);
    addMesh(weapon, new THREE.TorusGeometry(.035, .009, 5, 12), trim, [0, -.11, 0]);
  } else if (type === 'r') {
    cylinderBetween(weapon, [0, -.18, 0], [0, .20, 0], .028, .032, leather, 8);
    addMesh(weapon, new THREE.CylinderGeometry(.105, .105, .13, 8), darkArmor, [0, .25, 0], [0, 0, Math.PI / 2]);
    addGem(weapon, trim, [0, .25, .105], .035);
  } else if (type === 'b' || type === 'q') {
    cylinderBetween(weapon, [0, -.18, 0], [0, .31, 0], .018, .022, darkArmor, 8);
    addMesh(weapon, new THREE.OctahedronGeometry(type === 'q' ? .095 : .075, 1), trim, [0, .37, 0]);
    addMesh(weapon, new THREE.TorusGeometry(.09, .012, 6, 20), glow, [0, .37, 0], [Math.PI / 2, 0, 0]);
  } else {
    const sword = new THREE.Shape();
    sword.moveTo(-.035, -.12); sword.lineTo(-.023, .17); sword.lineTo(0, .43);
    sword.lineTo(.023, .17); sword.lineTo(.035, -.12); sword.closePath();
    addMesh(weapon, new THREE.ExtrudeGeometry(sword, { depth:.025, bevelEnabled:true, bevelSegments:2, bevelSize:.012, bevelThickness:.01 }), armor, [0,0,-.012]);
    addMesh(weapon, new THREE.BoxGeometry(.18,.035,.055), trim, [0,-.12,0]);
    addMesh(weapon, new THREE.CylinderGeometry(.022,.025,.13,8), leather, [0,-.20,0]);
    addGem(weapon, trim, [0,-.275,0], .03);
  }
  // Defensive arm and small shield, visible as the fighters clash.
  const guardArm = new THREE.Group();
  guardArm.position.set(-.205, .61, .005);
  fighter.add(guardArm);
  cylinderBetween(guardArm, [0,0,0], [-.045,-.16,.04], .05, .043, armor, 9);
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(0,.16); shieldShape.lineTo(.11,.11); shieldShape.lineTo(.09,-.08);
  shieldShape.lineTo(0,-.20); shieldShape.lineTo(-.09,-.08); shieldShape.lineTo(-.11,.11); shieldShape.closePath();
  addMesh(guardArm, new THREE.ExtrudeGeometry(shieldShape, { depth:.035, bevelEnabled:true, bevelSegments:2, bevelSize:.01, bevelThickness:.01 }), darkArmor, [-.045,-.18,.06]);
  addGem(guardArm, trim, [-.045,-.18,.105], .028);

  fighter.userData.weapon = weapon;
  fighter.userData.weaponArm = weaponArm;
  fighter.userData.materials = materials;
  fighter.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  return fighter;
}

function turnPieceIntoCombatWarrior(piece, type, color, theme) {
  const originalChildren = [...piece.children];
  for (const child of originalChildren) child.visible = false;
  const avatar = createCombatWarrior(type, color, theme);
  piece.add(avatar);
  piece.userData.combatAvatar = avatar;
  piece.userData.combatOriginalChildren = originalChildren;
  piece.userData.weapon = avatar.userData.weapon;
  piece.userData.weaponArm = avatar.userData.weaponArm;
  piece.userData.materials = avatar.userData.materials;
  return avatar;
}

function restoreStauntonPiece(piece) {
  const avatar = piece.userData.combatAvatar;
  if (avatar) {
    piece.remove(avatar);
    avatar.traverse(object => {
      object.geometry?.dispose?.();
      if (object.material) {
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach(material => material.dispose?.());
      }
    });
  }
  for (const child of piece.userData.combatOriginalChildren || []) child.visible = true;
  piece.userData.combatAvatar = null;
  piece.userData.combatOriginalChildren = null;
  piece.userData.weapon = null;
  piece.userData.weaponArm = null;
}

function makeCoordinateSprite(label, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,128,128);
  ctx.fillStyle = color;
  ctx.font = '600 66px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label,64,66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map:texture, transparent:true, depthWrite:false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(.16,.16,1);
  return sprite;
}

export class ThreeChessboard {
  constructor(host, { board, orientation = 'w', theme, woodFinish = 'heritage', selectedSquare = null, legalTargets = [], checkedSquare = null, checkmate = false, lastMove = null, onSquareClick = () => {}, onSquareDrop = () => {}, interactive = true, animationsEnabled = true }) {
    this.host = host;
    this.theme = theme;
    this.orientation = orientation;
    this.onSquareClick = onSquareClick;
    this.onSquareDrop = onSquareDrop;
    this.interactive = interactive;
    this.animationsEnabled = animationsEnabled;
    this.disposed = false;
    this.anim = null;
    this.particles = [];
    this.effects = [];
    this.pieces = [];
    this.pieceTemplates = new Map();
    this.pieceBySquare = new Map();
    this.tileHits = [];
    this.coordinateSprites = [];
    this.highlightObjects = [];
    this.checkmate = checkmate;
    this.woodFinish = WOOD_FINISHES[woodFinish] ? woodFinish : 'heritage';
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x8b6a4b, 24, 44);
    this.camera = new THREE.PerspectiveCamera(30, 1, .1, 80);
    this.cameraTarget = new THREE.Vector3(0, .02, 0);
    this.defaultCameraPosition = new THREE.Vector3(0, 13.8, 9.6);
    this.camera.position.copy(this.defaultCameraPosition);
    this.camera.lookAt(this.cameraTarget);
    const memory = Number(navigator.deviceMemory || 4);
    const cores = Number(navigator.hardwareConcurrency || 4);
    this.lowPower = memory <= 4 || cores <= 4;
    // Some Linux/older integrated GPUs reject high-performance + antialias=true.
    // Try a conservative WebGL2 context before allowing the app to use 2D safe mode.
    const rendererAttempts = [
      { antialias: !this.lowPower, alpha: false, powerPreference: 'default', stencil: false },
      { antialias: false, alpha: false, powerPreference: 'low-power', stencil: false },
      { antialias: false, alpha: true, powerPreference: 'default', stencil: false }
    ];
    let renderer = null;
    const rendererErrors = [];
    for (const options of rendererAttempts) {
      try { renderer = new THREE.WebGLRenderer(options); break; }
      catch (error) { rendererErrors.push(error?.message || String(error)); }
    }
    if (!renderer) {
      const details = rendererErrors.filter(Boolean).at(-1) || 'No WebGL2 context could be created.';
      throw new Error(`Three.js could not create a WebGL2 renderer. ${details} Enable Chrome hardware acceleration and confirm WebGL 2 is available at chrome://gpu.`);
    }
    this.renderer = renderer;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowPower ? 1 : 1.35));
    this.renderer.shadowMap.enabled = !this.lowPower;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setClearColor(0x24180f, 1);
    // Use focused real-time lights instead of generating a costly environment map on each move.
    // Selection changes update highlights in place, so they do not rebuild the WebGL scene.
    this.renderer.domElement.className = 'three-board-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional chessboard. Click a piece, then a destination square.');
    host.replaceChildren(this.renderer.domElement);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    // The playable set uses a consistent natural hardwood palette in every realm.
    // Textures are generated locally at runtime, so the board is fully offline-ready.
    const finish = WOOD_FINISHES[this.woodFinish];
    this.boardTextures = {
      light: createWoodTexture(finish.light, 11, .96),
      dark: createWoodTexture(finish.dark, 29, 1.08),
      frame: createWoodTexture(finish.frame, 47, .94),
      table: createWoodTexture(finish.table, 59, .76)
    };
    this.boardTextures.table.repeat.set(3, 2.35);
    this.pieceTextures = {
      w: createWoodTexture(finish.white, 71, .66),
      b: createWoodTexture(finish.black, 97, .86)
    };
    this.makeLights();
    this.makeBoard();
    this.addPieces(board, lastMove);
    this.addHighlights(selectedSquare, legalTargets, checkedSquare);
    this.handlePointerDown = event => this.pointerDown(event);
    this.handlePointerMove = event => this.pointerMove(event);
    this.handlePointerUp = event => this.pointerUp(event);
    if (this.interactive) {
      this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
      this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
      this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
      this.renderer.domElement.addEventListener('pointercancel', this.handlePointerUp);
      this.renderer.domElement.style.touchAction = 'none';
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.startTime = performance.now();
    this.render();
  }

  makeLights() {
    this.scene.add(new THREE.HemisphereLight(0xffedda, 0x3b2818, 1.55));
    const key = new THREE.DirectionalLight(0xffe3bd, 2.9);
    key.position.set(-5, 11, 7); key.castShadow = true;
    key.shadow.mapSize.set(this.lowPower ? 512 : 1024, this.lowPower ? 512 : 1024);
    key.shadow.camera.left = -8; key.shadow.camera.right = 8;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    key.shadow.bias = -.00025;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xd8b47d, 1.05);
    rim.position.set(5, 6, -5); this.scene.add(rim);
    const fill = new THREE.PointLight(0xffd7a0, 2.1, 15, 2);
    fill.position.set(0, 4.2, 0); this.scene.add(fill);
  }

  squarePosition(square) {
    const file = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    // Squares finish at y=.15; piece bases begin at local y=.015.
    // This puts every wooden base directly on the board instead of hovering.
    return this.orientation === 'w'
      ? new THREE.Vector3(file - 3.5, .135, 4.5 - rank)
      : new THREE.Vector3(3.5 - file, .135, rank - 4.5);
  }


  makeBoard() {
    const baseMat = makeWoodMaterial(this.boardTextures.frame, .34);
    const edgeMat = new THREE.MeshPhysicalMaterial({
      color: 0x986d40, metalness: .34, roughness: .42,
      clearcoat: .5, clearcoatRoughness: .28
    });
    // A real tabletop slab is placed directly under the thick framed board.
    const tableMat = makeWoodMaterial(this.boardTextures.table, .58);
    const tabletop = addMesh(this.scene, new THREE.BoxGeometry(18, .18, 15), tableMat, [0, -.26, 0]);
    tabletop.receiveShadow = true;
    addMesh(this.scene, new THREE.BoxGeometry(8.56, .34, 8.56), baseMat, [0, 0, 0]);
    addMesh(this.scene, new THREE.BoxGeometry(8.5, .055, 8.5), edgeMat, [0, -.17, 0]);
    const lightMat = makeWoodMaterial(this.boardTextures.light, .4);
    const darkMat = makeWoodMaterial(this.boardTextures.dark, .43);
    const tileGeo = new THREE.BoxGeometry(.985, .11, .985);
    const lightSquares = [];
    const darkSquares = [];
    for (let rank = 1; rank <= 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = `${FILES[file]}${rank}`;
        const p = this.squarePosition(square);
        ((file + rank) % 2 === 0 ? lightSquares : darkSquares).push({ square, position:p });
      }
    }
    const dummy = new THREE.Object3D();
    for (const [entries, material] of [[lightSquares, lightMat], [darkSquares, darkMat]]) {
      const tiles = new THREE.InstancedMesh(tileGeo, material, entries.length);
      tiles.receiveShadow = true;
      tiles.castShadow = false;
      tiles.userData.squares = entries.map(entry => entry.square);
      tiles.userData.entries = entries;
      entries.forEach((entry, index) => {
        dummy.position.set(entry.position.x, .095, entry.position.z);
        dummy.updateMatrix();
        tiles.setMatrixAt(index, dummy.matrix);
      });
      tiles.instanceMatrix.needsUpdate = true;
      this.scene.add(tiles);
      this.tileHits.push(tiles);
    }
    const rail = new THREE.MeshPhysicalMaterial({ color:0xb18a57, metalness:.24, roughness:.46 });
    addMesh(this.scene, new THREE.BoxGeometry(8.58,.045,.09), rail, [0,.055,4.29]);
    addMesh(this.scene, new THREE.BoxGeometry(8.58,.045,.09), rail, [0,.055,-4.29]);
    addMesh(this.scene, new THREE.BoxGeometry(.09,.045,8.58), rail, [4.29,.055,0]);
    addMesh(this.scene, new THREE.BoxGeometry(.09,.045,8.58), rail, [-4.29,.055,0]);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(8.44,.018,.018), edgeMat);
    trim.position.set(0,.084,4.235); this.scene.add(trim);
    this.addCoordinates();
  }

  addCoordinates() {
    for (const sprite of this.coordinateSprites) {
      this.scene.remove(sprite);
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    this.coordinateSprites.length = 0;
    const color = '#59432f';
    for (let file = 0; file < 8; file++) {
      const x = this.orientation === 'w' ? file - 3.5 : 3.5 - file;
      for (const z of [4.39, -4.39]) {
        const sprite = makeCoordinateSprite(FILES[file], color);
        sprite.position.set(x, .183, z);
        this.scene.add(sprite); this.coordinateSprites.push(sprite);
      }
    }
    for (let rank = 1; rank <= 8; rank++) {
      const z = this.orientation === 'w' ? 4.5 - rank : rank - 4.5;
      for (const x of [-4.39, 4.39]) {
        const sprite = makeCoordinateSprite(String(rank), color);
        sprite.position.set(x, .183, z);
        this.scene.add(sprite); this.coordinateSprites.push(sprite);
      }
    }
  }

  addPieces(board, lastMove) {
    const skip = this.animationsEnabled && lastMove?.animate && lastMove?.piece && lastMove?.from && lastMove?.to ? lastMove.to : null;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;
        const square = `${FILES[col]}${8 - row}`;
        if (skip === square) continue;
        this.addPiece(piece.type, piece.color, square);
      }
    }
    if (skip) {
      const from = this.squarePosition(lastMove.from);
      const to = this.squarePosition(lastMove.to);
      const movingType = lastMove.promotion || lastMove.piece;
      const moving = this.addPiece(movingType, lastMove.color, lastMove.from);
      moving.position.copy(from);
      const victim = lastMove.captured ? this.addPiece(lastMove.captured, lastMove.color === 'w' ? 'b' : 'w', lastMove.to, true) : null;
      let attackerAvatar = null;
      let victimAvatar = null;
      if (lastMove.captured) {
        attackerAvatar = turnPieceIntoCombatWarrior(moving, lastMove.piece, lastMove.color, this.theme);
        if (victim) victimAvatar = turnPieceIntoCombatWarrior(victim, lastMove.captured, lastMove.color === 'w' ? 'b' : 'w', this.theme);
      }
      const delta = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
      const direction = delta.lengthSq() ? delta.normalize() : new THREE.Vector3(0, 0, -1);
      const heading = Math.atan2(direction.x, direction.z);
      const approach = to.clone().addScaledVector(direction, -.43);
      const impact = to.clone().addScaledVector(direction, -.16);
      const weapon = moving.userData.weapon;
      const weaponArm = moving.userData.weaponArm;
      const weaponBase = weapon ? { x:weapon.rotation.x, y:weapon.rotation.y, z:weapon.rotation.z } : null;
      const weaponArmBase = weaponArm ? { x:weaponArm.rotation.x, y:weaponArm.rotation.y, z:weaponArm.rotation.z } : null;
      this.anim = {
        moving, victim, from, to, fromSquare:lastMove.from, toSquare:lastMove.to, approach, impact, direction, heading,
        type:lastMove.piece, started:performance.now(), duration:lastMove.captured ? 2180 : 430,
        capture:Boolean(lastMove.captured), weapon, weaponBase, weaponArm, weaponArmBase, victimBase:victim ? victim.rotation.clone() : null,
        impactDone:false, initialRotation:moving.rotation.y
      };
    }
  }

  addPiece(type, color, square, victim = false) {
    const templateKey = `${color}:${type}`;
    let template = this.pieceTemplates.get(templateKey);
    if (!template) {
      template = makeStauntonPiece(type, color, this.theme, this.pieceTextures).root;
      this.pieceTemplates.set(templateKey, template);
    }
    // Object3D.clone shares immutable geometry/material resources. That avoids
    // rebuilding 32 sets of lathe/extrude geometry after every move.
    const piece = template.clone(true);
    const materials = new Set();
    piece.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach(material => materials.add(material));
      }
    });
    const position = this.squarePosition(square);
    piece.position.copy(position);
    piece.rotation.y = color === 'w' ? 0 : Math.PI;
    piece.userData.square = square;
    piece.userData.materials = [...materials];
    piece.userData.isVictim = victim;
    piece.userData.weapon = null;
    piece.userData.weaponArm = null;
    this.scene.add(piece);
    this.pieces.push(piece);
    if (!victim) this.pieceBySquare.set(square, piece);
    return piece;
  }

  clearHighlights() {
    for (const object of this.highlightObjects) {
      this.scene.remove(object);
      object.geometry?.dispose?.();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose?.());
      }
    }
    this.highlightObjects.length = 0;
    this.checkRing = null;
  }

  setHighlights(selected, targets, checked, checkmate = false) {
    this.clearHighlights();
    this.checkmate = checkmate;
    this.addHighlights(selected, targets, checked);
    this.drawOnce();
  }

  addHighlights(selected, targets, checked) {
    const track = object => { this.scene.add(object); this.highlightObjects.push(object); return object; };
    const selectedMat = new THREE.MeshBasicMaterial({ color: 0xd4b67b, transparent: true, opacity: .19, depthWrite: false, side: THREE.DoubleSide });
    const targetMat = new THREE.MeshBasicMaterial({ color: 0x719b83, transparent: true, opacity: .62, depthWrite: false });
    if (selected) {
      const p = this.squarePosition(selected);
      const selectedPlane = new THREE.Mesh(new THREE.PlaneGeometry(.92, .92), selectedMat);
      selectedPlane.rotation.x = -Math.PI / 2; selectedPlane.position.set(p.x, .154, p.z); track(selectedPlane);
    }
    for (const square of targets) {
      const p = this.squarePosition(square);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(.095, 18), targetMat.clone());
      dot.rotation.x = -Math.PI / 2; dot.position.set(p.x, .158, p.z); track(dot);
    }
    targetMat.dispose();
    if (checked) {
      const p = this.squarePosition(checked);
      const color = this.checkmate ? 0xa99daf : 0xb69d70;
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .46, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .024, 8, 36), ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.set(p.x, .235, p.z); track(ring);
      const glow = new THREE.PointLight(color, .58, 1.55);
      glow.position.set(p.x, .48, p.z); track(glow);
      this.checkRing = ring;
    }
  }


  tileAtPointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.tileHits, false)[0];
    return hit?.object?.userData?.squares?.[hit.instanceId] || null;
  }

  planePoint(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -.15);
    return this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  }

  pointerDown(event) {
    if (this.disposed || this.anim || !this.interactive) return;
    const square = this.tileAtPointer(event);
    if (!square) return;
    const piece = this.pieceBySquare.get(square);
    this.dragState = {
      square, piece, original:piece?.position.clone() || null,
      startX:event.clientX, startY:event.clientY, moved:false, selected:false,
      pointerId:event.pointerId
    };
    try { this.renderer.domElement.setPointerCapture(event.pointerId); } catch {}
  }

  pointerMove(event) {
    const state = this.dragState;
    if (!state || !state.piece || this.anim) return;
    const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
    if (!state.moved && distance > 6) {
      state.moved = true;
      this.onSquareClick(state.square);
      state.selected = true;
    }
    if (!state.moved) return;
    const point = this.planePoint(event);
    if (!point) return;
    state.piece.position.set(point.x, .48, point.z);
    this.drawOnce();
  }

  pointerUp(event) {
    const state = this.dragState;
    if (!state) return;
    this.dragState = null;
    if (state.moved && state.piece) {
      const target = this.tileAtPointer(event);
      state.piece.position.copy(state.original);
      if (target && target !== state.square) this.onSquareDrop(state.square, target);
      else if (state.selected) this.onSquareClick(state.square);
      this.drawOnce();
    } else {
      this.onSquareClick(state.square);
    }
  }

  pickSquare(event) {
    const square = this.tileAtPointer(event);
    if (square) this.onSquareClick(square);
  }

  attach(host) {
    if (this.disposed || !host) return;
    if (this.host === host && this.renderer.domElement.parentElement === host) return;
    this.resizeObserver?.disconnect();
    this.host = host;
    host.replaceChildren(this.renderer.domElement);
    this.resizeObserver?.observe(host);
    this.resize();
  }

  clearPieces() {
    // Piece clones share cached immutable geometry/material templates. Remove
    // instances only; the templates live until this board is destroyed. If the
    // user restarts mid-capture, dispose the temporary fighter rig as well.
    for (const piece of this.pieces) {
      restoreStauntonPiece(piece);
      this.scene.remove(piece);
    }
    this.pieces.length = 0;
    this.pieceBySquare.clear();
    this.anim = null;
  }

  updateBoardOrientation() {
    const dummy = new THREE.Object3D();
    for (const tiles of this.tileHits) {
      const entries = tiles.userData.entries || [];
      entries.forEach((entry, index) => {
        const p = this.squarePosition(entry.square);
        dummy.position.set(p.x, .095, p.z);
        dummy.updateMatrix();
        tiles.setMatrixAt(index, dummy.matrix);
      });
      tiles.instanceMatrix.needsUpdate = true;
    }
    this.addCoordinates();
  }

  updatePosition({ board, orientation = this.orientation, selectedSquare = null, legalTargets = [], checkedSquare = null, checkmate = false, lastMove = null }) {
    if (this.disposed) return;
    const flipped = orientation !== this.orientation;
    this.orientation = orientation;
    if (flipped) this.updateBoardOrientation();
    this.clearPieces();
    this.clearHighlights();
    this.checkmate = checkmate;
    this.addPieces(board, this.animationsEnabled ? lastMove : null);
    this.addHighlights(selectedSquare, legalTargets, checkedSquare);
    this.drawOnce();
  }

  zoomBy(factor) {
    if (this.disposed || !Number.isFinite(factor) || factor <= 0) return;
    const offset = this.camera.position.clone().sub(this.cameraTarget);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, 12.4, 23.5);
    offset.normalize().multiplyScalar(distance);
    this.camera.position.copy(this.cameraTarget).add(offset);
    this.camera.lookAt(this.cameraTarget);
    this.drawOnce();
  }

  rotateCamera(radians) {
    if (this.disposed || !Number.isFinite(radians)) return;
    const offset = this.camera.position.clone().sub(this.cameraTarget);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), radians);
    this.camera.position.copy(this.cameraTarget).add(offset);
    this.camera.lookAt(this.cameraTarget);
    this.drawOnce();
  }

  resetCamera() {
    if (this.disposed) return;
    this.camera.position.copy(this.defaultCameraPosition);
    this.camera.lookAt(this.cameraTarget);
    this.drawOnce();
  }

  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.drawOnce();
  }

  updateAnimation(now) {
    if (!this.anim) return false;
    const a = this.anim;
    const p = Math.min(1, (now - a.started) / a.duration);
    const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
    const lerpVec = (from, to, t) => from.clone().lerp(to, smooth(t));
    const direction = a.direction;
    const style = {
      n:{ jump:1.02, windup:.42, swing:-.9, spin:.55, knock:.52, recoil:.22, impact:.60 },
      k:{ jump:.10, windup:.88, swing:-1.35, spin:.06, knock:.66, recoil:.18, impact:.66 },
      q:{ jump:.16, windup:.58, swing:-1.08, spin:1.05, knock:.53, recoil:.23, impact:.61 },
      b:{ jump:.12, windup:.64, swing:-1.02, spin:.24, knock:.43, recoil:.20, impact:.63 },
      r:{ jump:.03, windup:-.42, swing:-.72, spin:.02, knock:.75, recoil:.12, impact:.68 },
      p:{ jump:.25, windup:.25, swing:-.56, spin:.02, knock:.32, recoil:.10, impact:.57 }
    }[a.type] || { jump:.18, windup:.5, swing:-1.2, spin:.1, knock:.35, recoil:.2, impact:.62 };

    if (!a.capture) {
      const eased = smooth(p);
      a.moving.position.lerpVectors(a.from, a.to, eased);
      if (a.type === 'n') a.moving.position.y += Math.sin(p * Math.PI) * .38;
      return p < 1 ? true : this.finishAnimation(a);
    }

    // A capture is staged as a fight on the live chessboard: wind-up, approach,
    // weapon strike, victim reaction, then a short victory recovery.
    const weapon = a.weapon;
    const weaponArm = a.weaponArm;
    if (p < .18) {
      const t = smooth(p / .18);
      a.moving.position.copy(a.from).addScaledVector(direction, -.105 * t);
      a.moving.rotation.y = a.heading;
      a.moving.rotation.x = -.035 * t;
      a.moving.rotation.z = (a.type === 'r' ? -.035 : -.09) * t;
      if (weaponArm && a.weaponArmBase) weaponArm.rotation.z = a.weaponArmBase.z + style.windup * .58 * t;
      if (weapon && a.weaponBase) weapon.rotation.z = a.weaponBase.z + style.windup * .18 * t;
    } else if (p < .57) {
      const t = smooth((p - .18) / .39);
      a.moving.position.copy(lerpVec(a.from, a.approach, t));
      const jump = style.jump * Math.sin(t * Math.PI);
      a.moving.position.y += jump;
      a.moving.rotation.y = a.heading + (a.type === 'q' ? style.spin * t * .25 : 0);
      a.moving.rotation.x = -.07 * Math.sin(t * Math.PI);
      a.moving.rotation.z = -.12 * Math.sin(t * Math.PI) * (a.type === 'r' ? .45 : 1);
      if (weaponArm && a.weaponArmBase) weaponArm.rotation.z = a.weaponArmBase.z + style.windup * .58 * (1 - t) + style.swing * .18 * t;
      if (weapon && a.weaponBase) weapon.rotation.z = a.weaponBase.z + style.windup * .12 * (1 - t) + style.swing * .08 * t;
    } else if (p < .76) {
      const t = smooth((p - .57) / .19);
      a.moving.position.copy(lerpVec(a.approach, a.impact, t));
      a.moving.position.y += Math.sin(t * Math.PI) * (a.type === 'n' ? .16 : .055);
      a.moving.rotation.y = a.heading + style.spin * t;
      a.moving.rotation.x = -.10 * (1 - t);
      a.moving.rotation.z = -.18 * Math.sin(t * Math.PI) * (a.type === 'r' ? .45 : 1);
      if (weaponArm && a.weaponArmBase) {
        const armSwing = Math.sin(t * Math.PI * .5);
        weaponArm.rotation.z = a.weaponArmBase.z + style.windup * .35 * (1 - t) + style.swing * .62 * armSwing;
        weaponArm.rotation.x = a.weaponArmBase.x + (a.type === 'b' ? -.42 : 0) * armSwing;
      }
      if (weapon && a.weaponBase) {
        const swing = Math.sin(t * Math.PI * .5);
        weapon.rotation.z = a.weaponBase.z + style.swing * .46 * swing;
        weapon.rotation.x = a.weaponBase.x + (a.type === 'b' ? -.18 : 0) * swing;
      }
      if (p >= style.impact && !a.impactDone) {
        a.impactDone = true;
        this.spawnImpact(a.to, a.type, this.theme.accent, direction);
      }
    } else if (p < .94) {
      const t = smooth((p - .76) / .18);
      a.moving.position.copy(lerpVec(a.impact, a.to, t));
      a.moving.position.y += Math.sin((1 - t) * Math.PI) * .055;
      a.moving.rotation.y = a.heading + style.spin * (1 - t) * .35;
      a.moving.rotation.x *= (1 - t);
      if (weaponArm && a.weaponArmBase) {
        weaponArm.rotation.z += (a.weaponArmBase.z - weaponArm.rotation.z) * .18;
        weaponArm.rotation.x += (a.weaponArmBase.x - weaponArm.rotation.x) * .18;
      }
      if (weapon && a.weaponBase) {
        weapon.rotation.z += (a.weaponBase.z - weapon.rotation.z) * .18;
        weapon.rotation.x += (a.weaponBase.x - weapon.rotation.x) * .18;
      }
    } else {
      const t = smooth((p - .94) / .06);
      a.moving.position.copy(a.to);
      a.moving.rotation.y = a.heading + (a.initialRotation - a.heading) * t;
      a.moving.rotation.x *= (1 - t);
      a.moving.rotation.z *= (1 - t);
      if (weaponArm && a.weaponArmBase) weaponArm.rotation.set(
        weaponArm.rotation.x + (a.weaponArmBase.x - weaponArm.rotation.x) * .26,
        weaponArm.rotation.y + (a.weaponArmBase.y - weaponArm.rotation.y) * .26,
        weaponArm.rotation.z + (a.weaponArmBase.z - weaponArm.rotation.z) * .26
      );
      if (weapon && a.weaponBase) {
        weapon.rotation.x += (a.weaponBase.x - weapon.rotation.x) * .26;
        weapon.rotation.y += (a.weaponBase.y - weapon.rotation.y) * .26;
        weapon.rotation.z += (a.weaponBase.z - weapon.rotation.z) * .26;
      }
    }

    if (a.victim && p >= .62) {
      const hit = smooth((p - .62) / .38);
      const knock = style.knock * hit;
      a.victim.position.x = a.to.x + direction.x * knock;
      a.victim.position.z = a.to.z + direction.z * knock;
      a.victim.position.y = a.to.y + .06 + Math.sin(hit * Math.PI) * .11 - hit * .035;
      a.victim.rotation.z = (direction.x >= 0 ? -1 : 1) * hit * (a.type === 'r' || a.type === 'k' ? 1.35 : .96);
      a.victim.rotation.x = hit * .62;
      a.victim.rotation.y = (a.victimBase?.y || 0) + hit * (a.type === 'n' ? .52 : .24);
      const fade = Math.max(0, 1 - Math.max(0, (p - .82) / .18));
      for (const material of (a.victim.userData.materials || [])) {
        material.transparent = true;
        material.opacity = fade;
        material.depthWrite = fade > .8;
      }
    }
    if (p >= 1) return this.finishAnimation(a);
    return true;
  }

  finishAnimation(animation) {
    animation.moving.position.copy(animation.to);
    animation.moving.position.y = .135;
    animation.moving.rotation.x = 0;
    animation.moving.rotation.z = 0;
    animation.moving.rotation.y = animation.initialRotation;
    if (animation.weaponArm && animation.weaponArmBase) {
      animation.weaponArm.rotation.set(animation.weaponArmBase.x, animation.weaponArmBase.y, animation.weaponArmBase.z);
    }
    if (animation.weapon && animation.weaponBase) {
      animation.weapon.rotation.set(animation.weaponBase.x, animation.weaponBase.y, animation.weaponBase.z);
    }
    if (animation.victim) {
      restoreStauntonPiece(animation.victim);
      this.scene.remove(animation.victim);
      this.pieceBySquare.delete(animation.toSquare || animation.victim.userData.square);
      this.pieces = this.pieces.filter(piece => piece !== animation.victim);
    }
    if (animation.capture) restoreStauntonPiece(animation.moving);
    this.pieceBySquare.delete(animation.fromSquare || animation.moving.userData.square);
    animation.moving.userData.square = animation.toSquare || animation.moving.userData.square;
    this.pieceBySquare.set(animation.moving.userData.square, animation.moving);
    this.anim = null;
    return false;
  }

  spawnImpact(position, attackerType, accent, direction) {
    const color = attackerType === 'b' ? 0x9b8bd6 : attackerType === 'q' ? 0xd8b879 : attackerType === 'n' ? 0xc8d9e8 : new THREE.Color(accent);
    this.spawnBurst(position, attackerType === 'k' || attackerType === 'q' ? 1.45 : 1, color);
    this.spawnShockwave(position, color);
    this.spawnSlashArc(position, direction, color, attackerType);
  }

  spawnBurst(position, intensity = 1, color = null) {
    const base = color ? new THREE.Color(color) : new THREE.Color(this.theme.accent);
    const count = Math.round(12 * intensity);
    for (let i = 0; i < count; i++) {
      const particle = new THREE.Mesh(
        new THREE.IcosahedronGeometry(.018 + Math.random() * .026, 0),
        new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? 0xffedcf : base, transparent: true, opacity: .85 })
      );
      particle.position.set(position.x, .36 + Math.random() * .42, position.z);
      particle.userData.velocity = new THREE.Vector3((Math.random() - .5) * (1.5 + intensity), Math.random() * (1.35 + intensity), (Math.random() - .5) * (1.5 + intensity));
      particle.userData.born = performance.now();
      particle.userData.life = 650 + Math.random() * 260;
      this.scene.add(particle); this.particles.push(particle);
    }
  }

  spawnShockwave(position, color) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .52, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.28, .018, 6, 42), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(position.x, .235, position.z);
    this.scene.add(ring);
    this.effects.push({ mesh:ring, born:performance.now(), duration:620, kind:'shockwave' });
  }

  spawnSlashArc(position, direction, color, type) {
    const side = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    const scale = type === 'r' || type === 'k' ? 1.1 : .85;
    const points = [
      new THREE.Vector3(position.x - side.x * .38 * scale - direction.x * .08, .45, position.z - side.z * .38 * scale - direction.z * .08),
      new THREE.Vector3(position.x - side.x * .28 * scale + direction.x * .06, .86, position.z - side.z * .28 * scale + direction.z * .06),
      new THREE.Vector3(position.x + side.x * .08 * scale + direction.x * .18, 1.02, position.z + side.z * .08 * scale + direction.z * .18),
      new THREE.Vector3(position.x + side.x * .42 * scale + direction.x * .22, .52, position.z + side.z * .42 * scale + direction.z * .22)
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 18, type === 'p' ? .012 : .022, 5, false);
    const material = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:.8, depthWrite:false });
    const slash = new THREE.Mesh(geometry, material);
    this.scene.add(slash);
    this.effects.push({ mesh:slash, born:performance.now(), duration:480, kind:'slash' });
  }

  render() {
    if (this.disposed) return;
    const now = performance.now();
    const moving = this.updateAnimation(now);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const life = particle.userData.life || 760;
      const age = (now - particle.userData.born) / life;
      if (age >= 1) { this.scene.remove(particle); particle.geometry.dispose(); particle.material.dispose(); this.particles.splice(i, 1); continue; }
      particle.position.addScaledVector(particle.userData.velocity, .012);
      particle.userData.velocity.y -= .034;
      particle.material.opacity = .86 * (1 - age);
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      const age = Math.min(1, (now - effect.born) / effect.duration);
      if (age >= 1) {
        this.scene.remove(effect.mesh); effect.mesh.geometry.dispose(); effect.mesh.material.dispose();
        this.effects.splice(i, 1); continue;
      }
      if (effect.kind === 'shockwave') {
        effect.mesh.scale.setScalar(.45 + age * 2.2);
        effect.mesh.material.opacity = .48 * (1 - age);
      } else {
        effect.mesh.material.opacity = .8 * (1 - age);
        effect.mesh.scale.set(1 + age * .14, 1 + age * .14, 1 + age * .14);
      }
    }
    // Check ring stays steady: no flashing or pulsing that distracts the player.
    this.renderer.render(this.scene, this.camera);
    if (moving || this.particles.length || this.effects.length) this.raf = requestAnimationFrame(() => this.render());
    else this.raf = null;
  }

  drawOnce() {
    if (this.disposed) return;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.renderer.render(this.scene, this.camera);
    if (this.anim || this.particles.length || this.effects.length) this.raf = requestAnimationFrame(() => this.render());
  }

  destroy() {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointercancel', this.handlePointerUp);
    const geometries = new Set();
    const materials = new Set();
    const collect = root => root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach(material => materials.add(material));
      }
    });
    collect(this.scene);
    for (const template of this.pieceTemplates.values()) collect(template);
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    this.pieceTemplates.clear();
    this.effects.length = 0;
    for (const texture of Object.values(this.boardTextures || {})) texture.dispose();
    for (const texture of Object.values(this.pieceTextures || {})) texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
