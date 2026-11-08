// Cliente en 3D pour la scène de marchandage : buste d'un personnage MakeHuman (pagne wax peint dans la
// texture, foulard) animé par les clips Quaternius, rendu sur un canevas WebGL transparent que la scène
// peinte recopie à la place du portrait dessiné. Les touristes et les enfants restent en portrait peint.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = import.meta.env.BASE_URL || './';
const MODELS = `${BASE}models/`;
export const USE3D = !new URLSearchParams(location.search).has('2d');

let R = null;   // rendu partagé (un seul contexte WebGL)
function renderer() {
  if (R) return R;
  const canvas = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setClearColor(0x000000, 0); r.shadowMap.enabled = false;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
  const loader = new GLTFLoader(); const cache = new Map();
  const load = (url) => { if (!cache.has(url)) cache.set(url, loader.loadAsync(url)); return cache.get(url); };
  R = { r, canvas, load, clips: null };
  return R;
}

// Choix du modèle selon le profil : les femmes en pagne, les hommes en chemise ou en costume
export function modelFor(look, man) {
  const kind = look.kind || '';
  if (kind === 'touriste' || kind === 'epouse' || kind === 'enfant') return null;
  const seed = look.seed || 0;
  return man ? `${MODELS}client_${seed % 2}.glb` : `${MODELS}cliente_${seed % 4}.glb`;
}

export class Customer3D {
  constructor(look, man) {
    this.url = modelFor(look, man); this.ready = false; this.failed = !this.url;
    if (!this.url) return;
    const { r, canvas } = renderer(); this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(27, 0.8, 0.1, 50);
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0xa07040, 0.9));
    const sun = new THREE.DirectionalLight(0xffe6c4, 2.0); sun.position.set(-2, 4, 3); this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd8e8ff, 0.7); fill.position.set(2.5, 1.5, 2); this.scene.add(fill);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.t = 0; this.current = null;
    this.load();
  }
  async load() {
    try {
      const Rr = renderer();
      if (!Rr.clips) Rr.clips = (await Rr.load(`${MODELS}UAL_blender.glb`)).animations.filter(c => c.name !== 'A_TPose');
      const gltf = await Rr.load(this.url);
      const model = skeletonClone(gltf.scene);
      model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.geometry.computeVertexNormals(); } });
      this.group.add(model); this.model = model;
      this.mixer = new THREE.AnimationMixer(model);
      this.head = model.getObjectByName('Head') || model.getObjectByName('head');
      this.play('Idle_Loop', 0.01);
      this.ready = true;
    } catch (e) { console.warn('cliente 3D indisponible', e); this.failed = true; }
  }
  play(name, fade = 0.3) {
    const clips = renderer().clips; const c = clips.find(k => k.name === name); if (!c || this.current === name) return;
    const next = this.mixer.clipAction(c); next.reset().fadeIn(fade).play(); next.time = Math.random() * c.duration;
    if (this.current) this.mixer.clipAction(clips.find(k => k.name === this.current)).fadeOut(fade);
    this.current = name;
  }
  // Rend le buste dans un canevas de w × h pixels. turn, nod, lean viennent de la mise en scène 2D.
  render(w, h, dt, { talking = false, turn = 0, nod = 0, lean = 0, gazeX = 0 } = {}) {
    if (!this.ready) return;
    const { r, canvas } = renderer();
    if (canvas.width !== w || canvas.height !== h) { r.setSize(w, h, false); }
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.t += dt; this.mixer.update(dt);
    this.play(talking ? 'Idle_Talking_Loop' : 'Idle_Loop');
    // orientation : de face, légèrement de trois quarts ; « turn » la fait se détourner, « lean » se pencher vers le comptoir
    this.group.rotation.y = 0.12 + turn * 0.9 + gazeX * 0.1;
    this.group.rotation.x = lean * 0.12;
    if (this.head) { this.head.rotation.x += nod * 0.35; this.head.rotation.y += gazeX * 0.25; }
    // cadrage : de la taille au-dessus de la tête, la caméra à hauteur de poitrine
    const look = new THREE.Vector3(0, 1.3, 0);
    this.camera.position.set(0.05, 1.36, 2.15); this.camera.lookAt(look);
    r.render(this.scene, this.camera);
  }
}
