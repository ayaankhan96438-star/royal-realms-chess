import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FILES = 'abcdefgh';
const materialDefaults = { roughness: 0.28, metalness: 0.78 };

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
function makeWarrior(type, color, accentHex) {
  const root = new THREE.Group();
  const isWhite = color === 'w';
  const primary = mat(isWhite ? 0xe7e0d2 : 0x222834, { metalness: .88, roughness: .23 });
  const secondary = mat(isWhite ? 0xb8a27c : 0x596174, { metalness: .82, roughness: .3 });
  const trim = mat(isWhite ? 0xc99f5c : 0x8a77ad, { metalness: .91, roughness: .2 });
  const dark = mat(isWhite ? 0x4d4a45 : 0x10131a, { metalness: .58, roughness: .42 });
  const gem = mat(accentHex, { emissive: accentHex, emissiveIntensity: .48, metalness: .55, roughness: .2 });
  const skin = mat(isWhite ? 0xcbbba3 : 0x6a6872, { metalness: .2, roughness: .72 });

  // A miniature sculpted plinth keeps the pieces grounded on the board.
  addMesh(root, new THREE.CylinderGeometry(.32, .36, .09, 24), dark, [0, .07, 0]);
  addMesh(root, new THREE.CylinderGeometry(.285, .31, .035, 24), trim, [0, .125, 0]);
  addMesh(root, new THREE.TorusGeometry(.265, .018, 7, 24), gem, [0, .15, 0]);

  if (type === 'r') {
    // Rook: a heavy bastion guardian with a battlement crown and broad shield.
    addMesh(root, new THREE.CylinderGeometry(.18, .28, .52, 10), primary, [0, .42, 0]);
    addMesh(root, new THREE.BoxGeometry(.36, .25, .29), secondary, [0, .78, 0]);
    addMesh(root, new THREE.BoxGeometry(.32, .08, .32), trim, [0, .93, 0]);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2 + Math.PI / 4;
      addMesh(root, new THREE.BoxGeometry(.105, .13, .105), primary, [Math.cos(angle) * .15, 1.025, Math.sin(angle) * .15]);
    }
    addMesh(root, new THREE.BoxGeometry(.075, .2, .04), dark, [0, .79, .16]);
    addGem(root, gem, [0, .8, .195], .055);
    createShield(root, primary, trim, gem);
    const maul = new THREE.Group();
    addMesh(maul, new THREE.CylinderGeometry(.025, .032, .53, 8), trim, [0, 0, 0]);
    addMesh(maul, new THREE.BoxGeometry(.21, .16, .14), primary, [0, .27, 0]);
    maul.position.set(.32, .53, .03); maul.rotation.z = -.34; root.add(maul); root.userData.weapon = maul;
    return { root, materials: [primary, secondary, trim, dark, gem, skin] };
  }

  // Shared humanoid anatomy. Geometry is genuinely 3D; no cropped picture is used.
  addMesh(root, new THREE.CylinderGeometry(.16, .275, type === 'p' ? .38 : .47, 12, 1), primary, [0, .36, -.01]);
  addMesh(root, new THREE.SphereGeometry(.19, 16, 12), secondary, [0, .61, .005], [0, 0, 0], [1.06, .82, .72]);
  addMesh(root, new THREE.BoxGeometry(.18, .12, .075), trim, [0, .59, .17]);
  addGem(root, gem, [0, .61, .218], .038);

  // Legs and articulated-looking boots.
  for (const side of [-1, 1]) {
    const x = side * .105;
    cylinderBetween(root, [x, .13, .025], [x * .9, .29, 0], .075, .09, secondary, 9);
    addMesh(root, new THREE.BoxGeometry(.13, .075, .19), dark, [x, .145, .055], [0, 0, side * -.08]);
  }
  // Shoulder armour and arms.
  for (const side of [-1, 1]) {
    addMesh(root, new THREE.SphereGeometry(.105, 12, 10), trim, [side * .22, .59, 0], [0, 0, side * .18]);
    cylinderBetween(root, [side * .22, .57, .02], [side * .31, .43, .13], .072, .058, primary, 9);
    addMesh(root, new THREE.SphereGeometry(.06, 10, 8), secondary, [side * .31, .43, .13]);
  }

  // Neck and head/helmet.
  addMesh(root, new THREE.CylinderGeometry(.075, .085, .09, 10), trim, [0, .69, 0]);
  addMesh(root, new THREE.SphereGeometry(.135, 16, 12), dark, [0, .82, .01], [0, 0, 0], [1, 1.06, .9]);
  addMesh(root, new THREE.SphereGeometry(.148, 14, 10, 0, Math.PI * 2, 0, Math.PI * .56), primary, [0, .83, -.012], [0, 0, 0], [1.03, 1.06, 1]);
  addMesh(root, new THREE.BoxGeometry(.17, .035, .04), trim, [0, .8, .13]);
  addMesh(root, new THREE.BoxGeometry(.115, .018, .025), dark, [0, .78, .153]);

  // Back mantle gives each warrior a readable silhouette from the angled camera.
  const mantle = addMesh(root, new THREE.ConeGeometry(type === 'q' ? .26 : .29, type === 'p' ? .28 : .45, 10, 1, true), secondary, [0, .42, -.15], [Math.PI, 0, 0]);
  mantle.material.side = THREE.DoubleSide;

  let weapon;
  if (type === 'n') {
    // Knight: crested helm and a longer duelling blade.
    addMesh(root, new THREE.ConeGeometry(.07, .26, 7), trim, [0, 1.01, -.04], [0, 0, -.22]);
    addMesh(root, new THREE.TorusGeometry(.105, .018, 6, 14), gem, [0, .91, 0], [Math.PI / 2, 0, 0]);
    weapon = createSword(root, primary, trim, 1.25);
    weapon.position.set(.34, .5, .08); weapon.rotation.z = -.42;
    createShield(root, secondary, trim, gem);
  } else if (type === 'k') {
    addCrown(root, trim, gem, true);
    weapon = createSword(root, primary, trim, 1.32);
    weapon.position.set(.34, .53, .08); weapon.rotation.z = -.46;
    createShield(root, secondary, trim, gem);
    addMesh(root, new THREE.BoxGeometry(.24, .1, .13), trim, [0, .69, -.03]);
  } else if (type === 'q') {
    addCrown(root, trim, gem, true);
    addMesh(root, new THREE.ConeGeometry(.12, .24, 7), secondary, [0, 1.03, 0]);
    weapon = new THREE.Group();
    addMesh(weapon, new THREE.CylinderGeometry(.018, .022, .48, 8), trim, [0, .18, 0]);
    addMesh(weapon, new THREE.TorusGeometry(.075, .014, 6, 14), gem, [0, .43, 0], [Math.PI / 2, 0, 0]);
    addGem(weapon, gem, [0, .5, 0], .07);
    weapon.position.set(.34, .42, .08); weapon.rotation.z = -.16; root.add(weapon);
    createShield(root, secondary, trim, gem);
  } else if (type === 'b') {
    addMesh(root, new THREE.ConeGeometry(.16, .3, 8), secondary, [0, 1.02, -.01]);
    addGem(root, gem, [0, 1.18, 0], .06);
    weapon = new THREE.Group();
    addMesh(weapon, new THREE.CylinderGeometry(.018, .024, .67, 8), trim, [0, .16, 0]);
    addMesh(weapon, new THREE.OctahedronGeometry(.115, 1), gem, [0, .54, 0]);
    addMesh(weapon, new THREE.TorusGeometry(.1, .012, 6, 14), trim, [0, .54, 0], [Math.PI / 2, 0, 0]);
    weapon.position.set(.33, .43, .04); weapon.rotation.z = -.12; root.add(weapon);
  } else {
    // Pawn: a lighter foot soldier with a short spear and compact helmet.
    addMesh(root, new THREE.ConeGeometry(.13, .2, 8), trim, [0, .99, 0]);
    addGem(root, gem, [0, 1.105, 0], .035);
    weapon = new THREE.Group();
    addMesh(weapon, new THREE.CylinderGeometry(.012, .018, .47, 7), trim, [0, .17, 0]);
    addMesh(weapon, new THREE.ConeGeometry(.045, .13, 7), primary, [0, .47, 0]);
    weapon.position.set(.31, .42, .05); weapon.rotation.z = -.15; root.add(weapon);
    createShield(root, secondary, trim, gem);
  }
  if (weapon && !weapon.parent) root.add(weapon);
  root.userData.weapon = weapon || null;
  let shadowCasters = 0;
  root.traverse(object => { if (object.isMesh) { object.castShadow = shadowCasters < 9; shadowCasters++; } });
  return { root, materials: [primary, secondary, trim, dark, gem, skin] };
}

export class ThreeChessboard {
  constructor(host, { board, orientation = 'w', theme, selectedSquare = null, legalTargets = [], checkedSquare = null, lastMove = null, onSquareClick = () => {} }) {
    this.host = host;
    this.theme = theme;
    this.orientation = orientation;
    this.onSquareClick = onSquareClick;
    this.disposed = false;
    this.anim = null;
    this.particles = [];
    this.pieces = [];
    this.tileHits = [];
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x090a0d, 13, 27);
    this.camera = new THREE.PerspectiveCamera(28, 1, .1, 60);
    this.camera.position.set(0, 13.8, 9.6);
    this.camera.lookAt(0, .15, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setClearColor(0x08090d, 0);
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.roomEnvironment = new RoomEnvironment();
    this.environmentTarget = this.pmremGenerator.fromScene(this.roomEnvironment);
    this.scene.environment = this.environmentTarget.texture;
    this.renderer.domElement.className = 'three-board-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional chessboard. Click a piece, then a destination square.');
    host.replaceChildren(this.renderer.domElement);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.makeLights();
    this.makeBoard();
    this.addPieces(board, lastMove);
    this.addHighlights(selectedSquare, legalTargets, checkedSquare);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointer = event => this.pickSquare(event));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.startTime = performance.now();
    this.render();
  }

  makeLights() {
    this.scene.add(new THREE.HemisphereLight(0xe7e4ff, 0x17121b, 1.75));
    const key = new THREE.DirectionalLight(0xffedcf, 3.3);
    key.position.set(-5, 10, 7); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
    key.shadow.bias = -.00025;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(this.theme.accent), 2.25);
    rim.position.set(5, 6, -5); this.scene.add(rim);
    const fill = new THREE.PointLight(new THREE.Color(this.theme.accent), 8, 12, 2);
    fill.position.set(0, 3.5, 0); this.scene.add(fill);
  }

  squarePosition(square) {
    const file = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    return this.orientation === 'w'
      ? new THREE.Vector3(file - 3.5, .19, 4.5 - rank)
      : new THREE.Vector3(3.5 - file, .19, rank - 4.5);
  }

  makeBoard() {
    const accent = new THREE.Color(this.theme.accent);
    const baseMat = mat(0x17151a, { metalness: .82, roughness: .28 });
    const edgeMat = mat(this.theme.accent, { metalness: .9, roughness: .23, emissive: accent, emissiveIntensity: .12 });
    addMesh(this.scene, new THREE.BoxGeometry(8.45, .28, 8.45), baseMat, [0, 0, 0]);
    addMesh(this.scene, new THREE.BoxGeometry(8.36, .055, 8.36), edgeMat, [0, -.12, 0]);
    const lightMat = mat(this.theme.light, { metalness: .36, roughness: .34 });
    const darkMat = mat(this.theme.dark, { metalness: .62, roughness: .27 });
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
      entries.forEach((entry, index) => {
        dummy.position.set(entry.position.x, .095, entry.position.z);
        dummy.updateMatrix();
        tiles.setMatrixAt(index, dummy.matrix);
      });
      tiles.instanceMatrix.needsUpdate = true;
      this.scene.add(tiles);
      this.tileHits.push(tiles);
    }
    const rail = mat(0xc49a5c, { metalness: .88, roughness: .25, emissive: 0x5a3713, emissiveIntensity: .12 });
    addMesh(this.scene, new THREE.BoxGeometry(8.5, .035, .07), rail, [0, .02, 4.22]);
    addMesh(this.scene, new THREE.BoxGeometry(8.5, .035, .07), rail, [0, .02, -4.22]);
    addMesh(this.scene, new THREE.BoxGeometry(.07, .035, 8.5), rail, [4.22, .02, 0]);
    addMesh(this.scene, new THREE.BoxGeometry(.07, .035, 8.5), rail, [-4.22, .02, 0]);
  }

  addPieces(board, lastMove) {
    const skip = lastMove?.piece && lastMove?.from && lastMove?.to ? lastMove.to : null;
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
      this.anim = { moving, victim, from, to, type: lastMove.piece, started: performance.now(), duration: lastMove.captured ? 1120 : 430, capture: Boolean(lastMove.captured) };
    }
  }

  addPiece(type, color, square, victim = false) {
    const built = makeWarrior(type, color, this.theme.accent);
    const piece = built.root;
    const position = this.squarePosition(square);
    piece.position.copy(position);
    piece.rotation.y = color === 'w' ? 0 : Math.PI;
    piece.userData.square = square;
    piece.userData.materials = built.materials;
    piece.userData.isVictim = victim;
    this.scene.add(piece);
    this.pieces.push(piece);
    return piece;
  }

  addHighlights(selected, targets, checked) {
    const selectedMat = new THREE.MeshBasicMaterial({ color: 0xffd45d, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide });
    const dangerMat = new THREE.MeshBasicMaterial({ color: 0xff3434, transparent: true, opacity: .25, depthWrite: false, side: THREE.DoubleSide });
    const targetMat = new THREE.MeshBasicMaterial({ color: 0x2c7a4e, transparent: true, opacity: .75, depthWrite: false });
    const overlayGeo = new THREE.PlaneGeometry(.92, .92);
    if (selected) {
      const p = this.squarePosition(selected);
      addMesh(this.scene, overlayGeo, selectedMat, [p.x, .202, p.z], [-Math.PI / 2, 0, 0]);
    }
    for (const square of targets) {
      const p = this.squarePosition(square);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(.105, 18), targetMat);
      dot.rotation.x = -Math.PI / 2; dot.position.set(p.x, .205, p.z); this.scene.add(dot);
    }
    if (checked) {
      const p = this.squarePosition(checked);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: .9, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .035, 8, 36), ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.set(p.x, .23, p.z); this.scene.add(ring);
      const glow = new THREE.PointLight(0xff2323, 2.4, 2.1); glow.position.set(p.x, .55, p.z); this.scene.add(glow);
      this.checkRing = ring;
    }
  }

  pickSquare(event) {
    if (this.disposed) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.tileHits, false)[0];
    const square = hit?.object?.userData?.squares?.[hit.instanceId];
    if (square) this.onSquareClick(square);
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
    const progress = Math.min(1, (now - a.started) / a.duration);
    const eased = progress * progress * (3 - 2 * progress);
    const jump = a.type === 'n' ? Math.sin(progress * Math.PI) * .78 : a.type === 'p' ? Math.sin(progress * Math.PI) * .18 : Math.sin(progress * Math.PI) * .34;
    a.moving.position.lerpVectors(a.from, a.to, eased);
    a.moving.position.y += jump;
    if (a.type === 'n') a.moving.rotation.z = Math.sin(progress * Math.PI) * -.28;
    if (a.type === 'q' || a.type === 'b') a.moving.rotation.y += .018;
    const weapon = a.moving.userData.weapon;
    if (weapon && a.capture) {
      const strike = Math.max(0, Math.min(1, (progress - .42) / .22));
      weapon.rotation.z += (a.type === 'k' ? -1 : a.type === 'r' ? -.34 : -.72) * strike * .045;
    }
    if (a.victim) {
      const fall = Math.max(0, (progress - .53) / .47);
      a.victim.rotation.z = fall * (a.type === 'r' ? 1.55 : -.95);
      a.victim.rotation.x = fall * .75;
      a.victim.position.x = a.to.x + fall * .24;
      a.victim.position.y = a.to.y + .015 + fall * .05;
      a.victim.scale.setScalar(1 - fall * .62);
      a.victim.traverse(object => {
        if (object.isMesh && object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(m => { m.transparent = true; m.opacity = 1 - fall; });
        }
      });
      if (progress > .48 && !a.burstDone) { a.burstDone = true; this.spawnBurst(a.to); }
    }
    if (progress >= 1) {
      a.moving.position.copy(a.to);
      a.moving.position.y = .19;
      a.moving.rotation.z = 0;
      if (a.victim) this.scene.remove(a.victim);
      this.anim = null;
      return false;
    }
    return true;
  }

  spawnBurst(position) {
    const color = new THREE.Color(this.theme.accent);
    for (let i = 0; i < 18; i++) {
      const particle = new THREE.Mesh(new THREE.IcosahedronGeometry(.025 + Math.random() * .025, 0), new THREE.MeshBasicMaterial({ color: i % 3 ? color : 0xffefca, transparent: true }));
      particle.position.set(position.x, .35 + Math.random() * .45, position.z);
      particle.userData.velocity = new THREE.Vector3((Math.random() - .5) * 2.2, Math.random() * 2.1, (Math.random() - .5) * 2.2);
      particle.userData.born = performance.now();
      this.scene.add(particle); this.particles.push(particle);
    }
  }

  render() {
    if (this.disposed) return;
    const now = performance.now();
    const moving = this.updateAnimation(now);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const age = (now - particle.userData.born) / 760;
      if (age >= 1) { this.scene.remove(particle); particle.geometry.dispose(); particle.material.dispose(); this.particles.splice(i, 1); continue; }
      particle.position.addScaledVector(particle.userData.velocity, .016);
      particle.userData.velocity.y -= .055;
      particle.material.opacity = 1 - age;
    }
    if (this.checkRing) this.checkRing.scale.setScalar(1 + Math.sin(now * .006) * .045);
    this.renderer.render(this.scene, this.camera);
    if (moving || this.particles.length) this.raf = requestAnimationFrame(() => this.render());
    else this.raf = null;
  }

  drawOnce() {
    if (this.disposed) return;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.renderer.render(this.scene, this.camera);
    if (this.anim || this.particles.length) this.raf = requestAnimationFrame(() => this.render());
  }

  destroy() {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointer);
    this.scene.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
    this.environmentTarget?.dispose();
    this.pmremGenerator?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
