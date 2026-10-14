import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Vector3,
  type Object3D,
  type Side,
} from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildGroupGeometries, parseManifest } from '../model';
import { createHeadGeometry } from './head';
import {
  chooseCandidate,
  createPickTargets,
  DEPTH_TOLERANCE,
  fingerOffsets,
  firstVisibleHit,
  pickAt,
  type Candidate,
} from './picking';

const WIDTH = 390;
const HEIGHT = 560;

function box(group: string, x: number, z: number, width = 0.4, side: Side = FrontSide) {
  const mesh = new Mesh(new BoxGeometry(width, 0.4, 0.2), new MeshBasicMaterial({ side }));
  mesh.position.set(x, 0, z);
  mesh.userData = { group, muscle: group };
  mesh.updateMatrixWorld();
  return mesh;
}

/** Caméra de face, à 4,4 m, comme dans l'Atlas. */
function frontCamera(targetY = 0) {
  const camera = new PerspectiveCamera(30, WIDTH / HEIGHT, 0.05, 40);
  camera.position.set(0, targetY, 4.4);
  camera.lookAt(0, targetY, 0);
  camera.updateMatrixWorld();
  return camera;
}

function ndcOf(camera: PerspectiveCamera, x: number, y: number, z = 0): [number, number] {
  const point = new Vector3(x, y, z).project(camera);
  return [point.x, point.y];
}

const candidate = (group: string, distance: number) =>
  ({ group, muscle: group, distance }) as Candidate;

describe('Lancer de rayon : premier impact visible', () => {
  it('trie par distance : le muscle de devant gagne, quel que soit l’ordre des cibles', () => {
    const front = box('quads', 0, 0.3);
    const back = box('hamstrings', 0, -0.3);
    const raycaster = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
    expect(firstVisibleHit(raycaster, [back, front])?.group).toBe('quads');
    expect(firstVisibleHit(raycaster, [front, back])?.group).toBe('quads');
  });

  it('ignore les faces qui tournent le dos à la caméra, même avec un matériau double face', () => {
    // Plan devant tout, mais orienté vers l'arrière (normale vers -Z) : il ne se voit pas.
    const hidden = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ side: DoubleSide }));
    hidden.rotation.y = Math.PI;
    hidden.position.z = 1;
    hidden.userData = { group: 'lats', muscle: 'caché' };
    hidden.updateMatrixWorld();
    const front = box('abs', 0, 0, 0.4, DoubleSide);
    const raycaster = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
    expect(raycaster.intersectObject(hidden)[0]?.distance).toBeCloseTo(4); // touché…
    expect(firstVisibleHit(raycaster, [hidden, front])?.group).toBe('abs'); // …mais ignoré
  });

  it('ne renvoie rien à côté du corps', () => {
    const raycaster = new Raycaster(new Vector3(3, 0, 5), new Vector3(0, 0, -1));
    expect(firstVisibleHit(raycaster, [box('quads', 0, 0)])).toBeNull();
  });
});

describe('Toucher de la taille d’un doigt', () => {
  it('garde le rayon central à la frontière de deux muscles', () => {
    // Centre sur le triceps ; quelques rayons tombent sur le dorsal voisin, plus saillant.
    const around = [
      ...Array.from({ length: 4 }, () => candidate('lats', 2.95)),
      ...Array.from({ length: 8 }, () => candidate('triceps', 3.0)),
    ];
    expect(chooseCandidate(candidate('triceps', 3), around)?.group).toBe('triceps');
    // Écart de profondeur sous la tolérance : toujours le centre.
    const close = Array.from({ length: 12 }, () => candidate('chest', 3 - DEPTH_TOLERANCE / 2));
    expect(chooseCandidate(candidate('abs', 3), close)?.group).toBe('abs');
  });

  it('écarte le rayon central passé à travers une fente ou un bord', () => {
    const around = [
      ...Array.from({ length: 10 }, (_, i) => candidate('abs', 2.79 + i / 1000)),
      candidate('lats', 3),
      candidate('lats', 3),
    ];
    expect(chooseCandidate(candidate('lats', 3), around)?.group).toBe('abs');
    expect(chooseCandidate(candidate('lats', 3), around)?.distance).toBeCloseTo(2.79);
  });

  it('prend le groupe majoritaire devant le doigt, pas un voisin isolé plus proche', () => {
    // Juste sous le genou : le centre passe entre les muscles ; le quadriceps (tendon) est plus
    // proche sur deux rayons seulement, la jambe sur tous les autres.
    const around = [
      candidate('quads', 4.16),
      candidate('quads', 4.17),
      ...Array.from({ length: 10 }, () => candidate('calves', 4.19)),
    ];
    expect(chooseCandidate(candidate('calves', 4.23), around)?.group).toBe('calves');
    expect(chooseCandidate(null, around)?.group).toBe('calves');
  });

  it('sans impact au centre : groupe majoritaire (à égalité, le plus proche) ; sinon rien', () => {
    expect(chooseCandidate(null, [candidate('quads', 3), candidate('adductors', 2.9)])?.group).toBe(
      'adductors',
    );
    expect(chooseCandidate(null, [])).toBeNull();
    expect(chooseCandidate(candidate('neck', 3), [])?.group).toBe('neck');
  });

  it('dans une fente du muscle de devant, choisit celui de devant et pas celui de derrière', () => {
    const camera = frontCamera();
    // Deux moitiés d'abdomen séparées par une fente de 1 cm, un dos derrière.
    const targets = [
      box('abs', -0.105, 0.2, 0.2),
      box('abs', 0.105, 0.2, 0.2),
      box('lats', 0, -0.2, 0.6),
    ];
    const raycaster = new Raycaster();
    const [x, y] = ndcOf(camera, 0, 0, 0.3);
    raycaster.setFromCamera({ x, y } as never, camera);
    expect(firstVisibleHit(raycaster, targets)?.group).toBe('lats'); // un seul rayon se trompe
    expect(pickAt(raycaster, camera, targets, x, y, fingerOffsets(WIDTH, HEIGHT))?.group).toBe(
      'abs',
    );
  });

  it('une surface sans groupe (la tête) fait écran : rien n’est choisi derrière elle', () => {
    const camera = frontCamera();
    const head = box('', 0, 0.4, 0.6);
    head.userData = {};
    const targets = [head, box('traps', 0, -0.2, 0.6)];
    const [x, y] = ndcOf(camera, 0, 0, 0.5);
    expect(pickAt(new Raycaster(), camera, targets, x, y, fingerOffsets(WIDTH, HEIGHT))).toBeNull();
  });

  it('place 12 rayons sur deux cercles autour du doigt', () => {
    const offsets = fingerOffsets(WIDTH, HEIGHT, 12);
    expect(offsets).toHaveLength(12);
    const pixels = offsets.map(([dx, dy]) => Math.hypot((dx * WIDTH) / 2, (dy * HEIGHT) / 2));
    expect(Math.min(...pixels)).toBeCloseTo(6);
    expect(Math.max(...pixels)).toBeCloseTo(12);
  });
});

// Lecture du vrai modèle via node:fs. Import dynamique non typé : les types Node ne sont pas
// chargés dans src/ (tsconfig.app.json).
interface NodeFs {
  readFileSync(path: string, encoding?: 'utf8'): string & Uint8Array;
}
const NODE_FS = 'node:fs';

describe('Sur le vrai modèle : le muscle choisi est celui qu’on voit', () => {
  const body = new Group();
  const targets: Object3D[] = [];

  beforeAll(async () => {
    const { readFileSync } = (await import(/* @vite-ignore */ NODE_FS)) as NodeFs;
    const entries = parseManifest(
      JSON.parse(readFileSync('public/atlas3d/muscles_q.json', 'utf8')),
    );
    const file: Uint8Array = readFileSync('public/atlas3d/muscles_q.bin');
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const material = new MeshBasicMaterial();
    for (const group of buildGroupGeometries(entries, buffer as ArrayBuffer)) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(group.positions, 3));
      geometry.setIndex(new BufferAttribute(group.indices, 1));
      const groupTargets = createPickTargets(group, geometry, material);
      body.add(...groupTargets);
      targets.push(...groupTargets);
    }
    // La tête stylisée, comme dans la scène : un écran sans groupe.
    const head = new Mesh(createHeadGeometry(), new MeshBasicMaterial());
    head.userData = {};
    body.add(head);
    targets.push(head);
  });

  /** Touche le point (x, y) du corps (mètres, repère du modèle) dans la vue donnée. */
  function touch(view: 'front' | 'back', x: number, y: number) {
    body.rotation.y = view === 'front' ? 0 : Math.PI;
    body.updateMatrixWorld(true);
    const camera = frontCamera(y);
    const [nx, ny] = ndcOf(camera, view === 'front' ? x : -x, y);
    return pickAt(new Raycaster(), camera, targets, nx, ny, fingerOffsets(WIDTH, HEIGHT));
  }

  it.each([
    { name: 'milieu de l’abdomen (fente du droit absent)', x: 0, y: 1.05, group: 'abs' },
    { name: 'milieu de l’abdomen, plus bas', x: 0, y: 0.98, group: 'abs' },
    { name: 'abdomen à gauche', x: 0.05, y: 1.05, group: 'abs' },
    { name: 'cuisse droite', x: -0.09, y: 0.65, group: 'quads' },
    { name: 'biceps droit', x: -0.2, y: 1.2, group: 'biceps' },
    { name: 'pectoral gauche', x: 0.08, y: 1.3, group: 'chest' },
    { name: 'tibia droit', x: -0.1, y: 0.3, group: 'calves' },
  ] as const)('de face, $name → $group', ({ x, y, group }) => {
    expect(touch('front', x, y)?.group).toBe(group);
  });

  it.each([
    { name: 'grand dorsal gauche', x: 0.1, y: 1.15, group: 'lats' },
    { name: 'arrière de la cuisse droite', x: -0.09, y: 0.6, group: 'hamstrings' },
    { name: 'triceps droit', x: -0.21, y: 1.2, group: 'triceps' },
    { name: 'mollet gauche', x: 0.1, y: 0.35, group: 'calves' },
  ] as const)('de dos, $name → $group', ({ x, y, group }) => {
    expect(touch('back', x, y)?.group).toBe(group);
  });

  it('toucher la tête ne choisit rien (ni le trapèze caché derrière)', () => {
    expect(touch('front', 0, 1.6)).toBeNull();
    expect(touch('back', 0, 1.6)).toBeNull();
  });

  it('chaque muscle a ses cibles, et un toucher reste rapide', () => {
    const muscles = new Set(targets.map((t) => `${t.userData.group}/${t.userData.muscle}`));
    expect(muscles.size).toBe(66); // 65 noms de muscles (gauche + droite) + la tête
    expect(targets.length).toBeGreaterThan(130);
    const start = performance.now();
    for (let i = 0; i < 10; i++) touch('back', 0.1, 1.15); // dos : beaucoup de muscles traversés
    expect((performance.now() - start) / 10).toBeLessThan(60);
  });
});
