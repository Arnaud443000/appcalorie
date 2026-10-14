import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { MuscleGroupId } from '@/data';
import { muscleAtTriangle, unionBounds, type GroupGeometry, type MuscleRange } from '../model';
import type { Emphasis, Highlight, ViewName } from '../muscleMap';
import type { AtlasPalette } from '../palette';
import {
  clampState,
  easeInOutCubic,
  FOV_DEGREES,
  halfHeightAt,
  HOME,
  homeDistance,
  isCentered,
  mix,
  nearestAngle,
  PITCH_LIMIT,
  VIEW_YAW,
  viewOf,
  zoomAround,
  clamp,
  type BodyFrame,
  type CameraState,
} from './camera';

export interface PickResult {
  group: MuscleGroupId;
  muscle: string;
}

export interface EngineStatus {
  view: ViewName | null;
  centered: boolean;
}

export interface EngineOptions {
  reducedMotion?: boolean;
  onStatus?: (status: EngineStatus) => void;
}

type Look = 'idle' | Emphasis;

interface Tween {
  from: CameraState;
  to: CameraState;
  start: number;
  duration: number;
}

/** Haut du crâne stylisé (mètres, repère du modèle). */
const HEAD_TOP = 1.715;
const ROTATE_PER_PIXEL = 0.0085;
const PITCH_PER_PIXEL = 0.005;
const VIEW_DURATION = 600;
const RECENTER_DURATION = 450;

/** Lumière de contour (effet de Fresnel) ajoutée aux matériaux standard de Three.js. */
function addRim(
  material: MeshStandardMaterial,
  uniforms: { uRimColor: { value: Color }; uRimStrength: { value: number } },
) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        [
          '#include <emissivemap_fragment>',
          'float atlasRim = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);',
          'totalEmissiveRadiance += uRimColor * uRimStrength * pow(atlasRim, 3.0);',
        ].join('\n'),
      );
  };
  material.customProgramCacheKey = () => 'atlas-rim';
}

/**
 * Scène de l'Atlas 3D : un maillage par groupe musculaire (15 appels de dessin), trois
 * matériaux partagés (repos, principal, secondaire), rendu uniquement quand quelque chose
 * change (pas de boucle permanente).
 */
export class AtlasEngine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV_DEGREES, 1, 0.05, 40);
  private readonly turntable = new Group();
  private readonly body = new Group();
  private readonly materials: Record<Look, MeshStandardMaterial>;
  private readonly rim = { uRimColor: { value: new Color() }, uRimStrength: { value: 0.32 } };
  private readonly hemisphere = new HemisphereLight();
  private readonly lights: DirectionalLight[];
  private readonly raycaster = new Raycaster();
  private readonly options: EngineOptions;
  /** Tête stylisée, plus sombre que les muscles (le modèle s'arrête au cou) : jamais choisie. */
  private readonly headMaterial = new MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  private readonly head = new Group();
  private meshes: Mesh<BufferGeometry, MeshStandardMaterial>[] = [];
  private viewport = { width: 1, height: 1 };
  /** Hauteur (px) cachée en haut de la vue par les boutons Face · Dos · Gauche · Droite. */
  private insetTop = 0;
  /** Part de la hauteur de l'image virtuelle libre de boutons (voir layout). */
  private usable = 1;
  private groupCenters = new Map<MuscleGroupId, number>();
  private frame: BodyFrame = { height: 1.8, width: 0.7 };
  private centerY = 0.9;
  private state: CameraState = { ...HOME };
  private tween: Tween | null = null;
  private highlight: Highlight = {};
  private animationFrame = 0;
  private lastStatus = '';
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, palette: AtlasPalette, options: EngineOptions = {}) {
    this.options = options;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = NeutralToneMapping;

    this.materials = {
      idle: new MeshStandardMaterial({ roughness: 0.82, metalness: 0 }),
      primary: new MeshStandardMaterial({ roughness: 0.6, metalness: 0 }),
      secondary: new MeshStandardMaterial({ roughness: 0.66, metalness: 0 }),
    };
    for (const material of Object.values(this.materials)) addRim(material, this.rim);

    // Lumières fixes par rapport à la caméra : clé en haut à gauche, contre-jour doux.
    const key = new DirectionalLight();
    key.position.set(-2.2, 3.2, 4);
    const fill = new DirectionalLight();
    fill.position.set(3, 0.6, 2.5);
    const top = new DirectionalLight();
    top.position.set(0.5, 4, -3);
    this.lights = [key, fill, top];
    this.scene.add(this.hemisphere, ...this.lights);

    this.buildHead();
    this.turntable.add(this.body);
    this.scene.add(this.turntable);
    this.setPalette(palette);
  }

  /** Couleurs lues dans les variables CSS (voir palette.ts). */
  setPalette(palette: AtlasPalette) {
    const color = (css: string) => {
      const value = new Color();
      if (css) value.setStyle(css);
      return value;
    };
    const muscle = color(palette.muscle);
    this.materials.idle.color.copy(muscle).multiplyScalar(0.78);
    this.headMaterial.color.copy(muscle).multiplyScalar(0.5);
    this.materials.primary.color.copy(color(palette.primary));
    this.materials.primary.emissive.copy(color(palette.primary)).multiplyScalar(0.16);
    this.materials.secondary.color.copy(color(palette.secondary));
    this.materials.secondary.emissive.copy(color(palette.secondary)).multiplyScalar(0.06);
    this.rim.uRimColor.value.copy(color(palette.rim));
    this.hemisphere.color.copy(muscle);
    this.hemisphere.groundColor.copy(color(palette.ground));
    this.hemisphere.intensity = 1.15;
    const [key, fill, top] = this.lights;
    for (const light of this.lights) light.color.copy(muscle);
    if (key) key.intensity = 1.9;
    if (fill) fill.intensity = 0.55;
    if (top) top.intensity = 0.9;
    this.requestRender();
  }

  /** Crée un maillage par groupe (géométries déjà fusionnées par model.ts). */
  setModel(groups: readonly GroupGeometry[]) {
    this.clearModel();
    const bounds = unionBounds(groups);
    const [minX, minY, minZ, maxX] = bounds;
    // Le haut du crâne dépasse des muscles.
    const maxY = Math.max(bounds[4], HEAD_TOP);
    const maxZ = bounds[5];
    // Le corps tourne autour de son axe vertical.
    this.body.position.set(-(minX + maxX) / 2, 0, -(minZ + maxZ) / 2);
    this.centerY = (minY + maxY) / 2;
    this.frame = { height: maxY - minY, width: Math.max(maxX - minX, maxZ - minZ) };
    for (const group of groups) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(group.positions, 3));
      geometry.setIndex(new BufferAttribute(group.indices, 1));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, this.materials.idle);
      mesh.userData = { group: group.group, muscles: group.muscles };
      mesh.matrixAutoUpdate = false;
      this.body.add(mesh);
      this.meshes.push(mesh);
      this.groupCenters.set(group.group, (group.bounds[1] + group.bounds[4]) / 2);
    }
    this.head.visible = true;
    this.applyHighlight();
    this.state = clampState(this.state, this.frame);
    this.requestRender();
  }

  setHighlight(highlight: Highlight) {
    this.highlight = highlight;
    this.applyHighlight();
    this.requestRender();
  }

  resize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.viewport = { width, height };
    this.renderer.setSize(width, height, false);
    this.layout();
  }

  /** Réserve le haut de la vue (boutons) : le corps est centré dans l'espace restant. */
  setInsetTop(pixels: number) {
    this.insetTop = Math.max(0, pixels);
    this.layout();
  }

  private layout() {
    const { width, height } = this.viewport;
    const inset = Math.min(this.insetTop, height / 2);
    // Image virtuelle plus haute que le canvas : son centre tombe au milieu de l'espace libre.
    const fullHeight = height + inset;
    this.camera.aspect = width / fullHeight;
    this.camera.setViewOffset(width, fullHeight, 0, 0, width, height);
    this.usable = (height - inset) / fullHeight;
    this.state = clampState(this.state, this.frame);
    this.requestRender();
  }

  private homeDistance() {
    return homeDistance(this.frame, this.camera.aspect, this.usable);
  }

  rotateBy(dx: number, dy: number) {
    this.tween = null;
    this.state = clampState(
      {
        ...this.state,
        yaw: this.state.yaw + dx * ROTATE_PER_PIXEL,
        pitch: clamp(this.state.pitch + dy * PITCH_PER_PIXEL, -PITCH_LIMIT, PITCH_LIMIT),
      },
      this.frame,
    );
    this.requestRender();
  }

  panBy(dx: number, dy: number) {
    this.tween = null;
    const fullHeight = this.viewport.height + Math.min(this.insetTop, this.viewport.height / 2);
    const metersPerPixel = (2 * halfHeightAt(this.homeDistance() / this.state.zoom)) / fullHeight;
    this.state = clampState(
      {
        ...this.state,
        panX: this.state.panX - dx * metersPerPixel,
        panY: this.state.panY + dy * metersPerPixel,
      },
      this.frame,
    );
    this.requestRender();
  }

  zoomAt(factor: number, clientX: number, clientY: number) {
    this.tween = null;
    // Coordonnées dans l'image virtuelle (voir layout) : 0 = centre de l'espace libre.
    const rect = this.renderer.domElement.getBoundingClientRect();
    const half = (this.viewport.height + Math.min(this.insetTop, this.viewport.height / 2)) / 2;
    const x = ((clientX - rect.left) / (rect.width || 1)) * 2 - 1;
    const y = (half - (clientY - rect.top)) / half;
    this.state = zoomAround(this.state, factor, x, y, this.frame, this.camera.aspect, this.usable);
    this.requestRender();
  }

  /** Zoom au clavier ou par bouton, centré. */
  zoomBy(factor: number) {
    this.tween = null;
    this.state = zoomAround(this.state, factor, 0, 0, this.frame, this.camera.aspect, this.usable);
    this.requestRender();
  }

  /** Tourne vers une vue (Face, Dos, Gauche, Droite) ; le zoom est conservé. */
  showView(view: ViewName) {
    this.animateTo(
      { ...this.state, yaw: nearestAngle(this.state.yaw, VIEW_YAW[view]), pitch: 0 },
      VIEW_DURATION,
    );
  }

  /** Corps entier, centré, sans inclinaison ; l'orientation est conservée. */
  recenter() {
    this.animateTo({ ...this.state, pitch: 0, zoom: 1, panX: 0, panY: 0 }, RECENTER_DURATION);
  }

  /** Montre un groupe : tourne vers sa vue et, si l'on est zoomé, le ramène au centre. */
  focusGroup(group: MuscleGroupId | null, view: ViewName) {
    const target: CameraState = {
      ...this.state,
      yaw: nearestAngle(this.state.yaw, VIEW_YAW[view]),
      pitch: 0,
    };
    const center = group ? this.groupCenters.get(group) : undefined;
    if (center !== undefined && this.state.zoom > 1.2) target.panY = center - this.centerY;
    this.animateTo(clampState(target, this.frame), VIEW_DURATION);
  }

  /** Muscle sous le doigt (lancer de rayon), ou null. */
  pick(clientX: number, clientY: number): PickResult | null {
    if (this.meshes.length === 0) return null;
    const [x, y] = this.toNdc(clientX, clientY);
    this.applyCamera();
    this.scene.updateMatrixWorld();
    this.raycaster.setFromCamera(new Vector2(x, y), this.camera);
    const hit = this.raycaster.intersectObjects(this.meshes, false)[0];
    if (!hit || hit.faceIndex == null) return null;
    const { group, muscles } = hit.object.userData as {
      group: MuscleGroupId;
      muscles: MuscleRange[];
    };
    return { group, muscle: muscleAtTriangle(muscles, hit.faceIndex)?.name ?? '' };
  }

  /** Statistiques pour la mesure de performance. */
  get stats() {
    const info = this.renderer.info;
    return { drawCalls: info.render.calls, triangles: info.render.triangles };
  }

  /** Libère tout (géométries, matériaux, contexte WebGL). */
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.clearModel();
    for (const material of Object.values(this.materials)) material.dispose();
    this.headMaterial.dispose();
    for (const child of this.head.children) (child as Mesh).geometry.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private buildHead() {
    // Crâne posé sur le haut des sterno-cléido-mastoïdiens (y ≈ 1,50 m), légèrement en avant.
    const skull = new Mesh(new SphereGeometry(1, 40, 28), this.headMaterial);
    skull.position.set(0, HEAD_TOP - 0.1, 0.1);
    skull.scale.set(0.08, 0.1, 0.094);
    const jaw = new Mesh(new SphereGeometry(1, 32, 20), this.headMaterial);
    jaw.position.set(0, HEAD_TOP - 0.155, 0.122);
    jaw.scale.set(0.055, 0.045, 0.06);
    this.head.add(skull, jaw);
    this.head.visible = false;
    this.body.add(this.head);
  }

  private clearModel() {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      this.body.remove(mesh);
    }
    this.meshes = [];
    this.groupCenters.clear();
  }

  private applyHighlight() {
    for (const mesh of this.meshes) {
      const group = (mesh.userData as { group: MuscleGroupId }).group;
      mesh.material = this.materials[this.highlight[group] ?? 'idle'];
    }
  }

  private animateTo(target: CameraState, duration: number) {
    if (this.options.reducedMotion) {
      this.tween = null;
      this.state = target;
    } else {
      this.tween = { from: { ...this.state }, to: target, start: performance.now(), duration };
    }
    this.requestRender();
  }

  private toNdc(clientX: number, clientY: number): [number, number] {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return [
      ((clientX - rect.left) / (rect.width || 1)) * 2 - 1,
      -((clientY - rect.top) / (rect.height || 1)) * 2 + 1,
    ];
  }

  private applyCamera() {
    const { yaw, pitch, zoom, panX, panY } = this.state;
    const distance = this.homeDistance() / zoom;
    const targetY = this.centerY + panY;
    this.turntable.rotation.y = yaw;
    this.camera.position.set(
      panX,
      targetY + Math.sin(pitch) * distance,
      Math.cos(pitch) * distance,
    );
    this.camera.lookAt(panX, targetY, 0);
  }

  /** Demande une image (une seule par trame d'affichage). */
  requestRender() {
    if (this.disposed || this.animationFrame) return;
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  }

  private readonly renderFrame = (now: number) => {
    this.animationFrame = 0;
    if (this.disposed) return;
    if (this.tween) {
      const progress = Math.min(1, (now - this.tween.start) / this.tween.duration);
      this.state = mix(this.tween.from, this.tween.to, easeInOutCubic(Math.max(0, progress)));
      if (progress >= 1) this.tween = null;
    }
    this.applyCamera();
    this.renderer.render(this.scene, this.camera);
    if (this.tween) this.requestRender();
    this.reportStatus();
  };

  private reportStatus() {
    const status: EngineStatus = { view: viewOf(this.state), centered: isCentered(this.state) };
    const key = `${status.view}|${status.centered}`;
    if (key === this.lastStatus) return;
    this.lastStatus = key;
    this.options.onStatus?.(status);
  }
}
