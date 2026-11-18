import * as THREE from 'three';

/**
 * Cena 3D da abertura: um quarto à noite, low-poly e renderizado em baixa
 * resolução (cara de PS1). A câmera anda da porta até ficar com a tela do
 * monitor ocupando a visão. Só é carregada sob demanda pela abertura.
 */

export interface RoomHandle {
  dispose: () => void;
}

interface Options {
  /** Duração da caminhada, em ms. */
  walkMs: number;
  /** Chamado a cada passo (para o som). */
  onStep?: () => void;
}

/** Quantos pixels da tela viram 1 pixel renderizado. */
const PIXEL = 3;

const SCREEN = { x: 0, y: 1.16, z: -2.36, w: 0.62, h: 0.38 };

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function drawScreen(g: CanvasRenderingContext2D, cursorOn: boolean): void {
  g.fillStyle = '#0d1017';
  g.fillRect(0, 0, 160, 98);
  g.fillStyle = '#161b26';
  g.fillRect(0, 0, 160, 8);
  g.fillRect(0, 8, 8, 90);
  g.fillStyle = '#11151e';
  g.fillRect(8, 8, 34, 90);
  const tree = ['#c9d4e3', '#c9d4e3', '#c9d4e3', '#39ff14', '#c9d4e3', '#c9d4e3', '#c9d4e3'];
  tree.forEach((c, i) => {
    g.fillStyle = c;
    g.fillRect(12 + (i % 3) * 3, 13 + i * 7, 18 - (i % 3) * 3, 2);
  });
  g.fillStyle = '#39ff14';
  g.fillRect(2, 11, 4, 4);
  const code: [string, number, number][] = [
    ['#6b7d99', 48, 40],
    ['#ff5c8a', 48, 18],
    ['#7fd4ff', 68, 30],
    ['#c9d4e3', 54, 52],
    ['#9be564', 54, 34],
    ['#f5c542', 54, 22],
    ['#c9d4e3', 48, 8],
  ];
  code.forEach(([c, x, w], i) => {
    g.fillStyle = '#2b3648';
    g.fillRect(44, 14 + i * 7, 2, 2);
    g.fillStyle = c;
    g.fillRect(x, 14 + i * 7, w, 2);
  });
  g.fillStyle = '#39ff14';
  g.fillRect(44, 66, 116, 1);
  g.fillStyle = '#7fd4ff';
  g.fillRect(48, 72, 40, 2);
  if (cursorOn) {
    g.fillStyle = '#39ff14';
    g.fillRect(90, 71, 3, 4);
  }
  g.fillStyle = '#1f6b2a';
  g.fillRect(0, 94, 160, 4);
}

export function mountRoom(canvas: HTMLCanvasElement, { walkMs, onStep }: Options): RoomHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05070b');
  scene.fog = new THREE.Fog('#05070b', 5, 13);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 30);

  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const mat = (color: string, emissive?: string) =>
    keep(new THREE.MeshLambertMaterial({ color, flatShading: true, ...(emissive ? { emissive, emissiveIntensity: 1 } : {}) }));
  const glow = (color: string) => keep(new THREE.MeshBasicMaterial({ color }));
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), m);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  // ── quarto ──
  const floorTex = keep(
    canvasTexture(64, 64, (g) => {
      g.fillStyle = '#121722';
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#0c1018';
      for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 1);
      for (let y = 0; y < 64; y += 16) for (let x = (y / 16) % 2 ? 0 : 32; x < 64; x += 64) g.fillRect(x, y, 1, 16);
    }),
  );
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(4, 6);
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(6, 10)), keep(new THREE.MeshLambertMaterial({ map: floorTex })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 1.5);
  scene.add(floor);

  const wallM = mat('#1b2333');
  box(6, 3, 0.1, wallM, 0, 1.5, -3.05); // fundo
  box(0.1, 3, 10, wallM, -3, 1.5, 1.5); // esquerda
  box(0.1, 3, 10, wallM, 3, 1.5, 1.5); // direita
  box(6, 0.1, 10, mat('#141a26'), 0, 3, 1.5); // teto
  box(6, 0.12, 0.04, mat('#2b3648'), 0, 0.06, -2.99); // rodapé

  // janela com a cidade
  const cityTex = keep(
    canvasTexture(64, 48, (g) => {
      g.fillStyle = '#070b14';
      g.fillRect(0, 0, 64, 48);
      const blds = [[2, 20, 10], [13, 12, 9], [23, 26, 8], [32, 16, 12], [45, 22, 8], [54, 10, 9]];
      for (const [x, y, w] of blds) {
        g.fillStyle = '#101a2e';
        g.fillRect(x!, y!, w!, 48 - y!);
        g.fillStyle = '#f5c542';
        for (let yy = y! + 3; yy < 46; yy += 5) for (let xx = x! + 2; xx < x! + w! - 1; xx += 3) if ((xx * 7 + yy * 3) % 5 < 2) g.fillRect(xx, yy, 1, 2);
      }
      g.fillStyle = '#cfe8ff';
      g.fillRect(50, 4, 3, 3);
    }),
  );
  box(1.5, 1.1, 0.08, mat('#2b3648'), -1.7, 1.75, -2.98);
  const win = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.36, 0.96)), keep(new THREE.MeshBasicMaterial({ map: cityTex })));
  win.position.set(-1.7, 1.75, -2.93);
  scene.add(win);
  box(0.05, 0.96, 0.05, mat('#2b3648'), -1.7, 1.75, -2.92);

  // pôster </>
  const posterTex = keep(
    canvasTexture(48, 36, (g) => {
      g.fillStyle = '#1a2230';
      g.fillRect(0, 0, 48, 36);
      g.strokeStyle = '#39ff14';
      g.lineWidth = 2;
      g.strokeRect(1, 1, 46, 34);
      g.fillStyle = '#39ff14';
      g.font = 'bold 14px monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('</>', 24, 19);
    }),
  );
  const poster = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.8, 0.6)), keep(new THREE.MeshLambertMaterial({ map: posterTex, emissive: '#0a2a08' })));
  poster.position.set(1.65, 1.85, -2.98);
  scene.add(poster);

  // ── mesa ──
  const wood = mat('#6b4a30');
  const woodDark = mat('#3a2718');
  box(1.8, 0.06, 0.8, wood, 0, 0.76, -2.45);
  for (const [x, z] of [[-0.84, -2.1], [0.84, -2.1], [-0.84, -2.8], [0.84, -2.8]]) box(0.06, 0.76, 0.06, woodDark, x!, 0.38, z!);

  // monitor
  const plastic = mat('#2b3648');
  box(0.7, 0.46, 0.05, plastic, SCREEN.x, SCREEN.y, SCREEN.z - 0.03);
  box(0.06, 0.24, 0.05, plastic, 0, 0.9, SCREEN.z - 0.06);
  box(0.3, 0.02, 0.18, plastic, 0, 0.8, SCREEN.z - 0.04);
  let cursorOn = true;
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 160;
  screenCanvas.height = 98;
  const sg = screenCanvas.getContext('2d')!;
  drawScreen(sg, cursorOn);
  const screenTex = keep(new THREE.CanvasTexture(screenCanvas));
  screenTex.magFilter = THREE.NearestFilter;
  screenTex.minFilter = THREE.NearestFilter;
  screenTex.generateMipmaps = false;
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h)), keep(new THREE.MeshBasicMaterial({ map: screenTex })));
  screen.position.set(SCREEN.x, SCREEN.y, SCREEN.z);
  scene.add(screen);

  // teclado, mouse, caneca, planta, gabinete
  box(0.5, 0.025, 0.16, mat('#1a2230'), 0, 0.8, -2.15);
  box(0.46, 0.01, 0.12, mat('#2b3648'), 0, 0.815, -2.15);
  box(0.06, 0.025, 0.09, mat('#1a2230'), 0.36, 0.8, -2.15);
  const mug = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.045, 0.045, 0.11, 8)), mat('#e8e8f0'));
  mug.position.set(-0.52, 0.85, -2.25);
  scene.add(mug);
  box(0.02, 0.05, 0.035, mat('#e8e8f0'), -0.465, 0.85, -2.25);
  const coffee = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.04, 0.04, 0.005, 8)), mat('#6b3e1e'));
  coffee.position.set(-0.52, 0.903, -2.25);
  scene.add(coffee);
  box(0.14, 0.14, 0.14, mat('#7a4a3a'), -0.72, 0.86, -2.6);
  const leafM = mat('#3d7a1f');
  for (const [x, h, r] of [[-0.75, 0.32, 0.05], [-0.69, 0.42, 0.045], [-0.72, 0.26, 0.06]]) {
    const leaf = new THREE.Mesh(keep(new THREE.ConeGeometry(r!, h!, 4)), leafM);
    leaf.position.set(x!, 0.93 + h! / 2, -2.6);
    scene.add(leaf);
  }
  box(0.2, 0.44, 0.42, mat('#1a2230'), 0.62, 1.01, -2.55);
  const led = box(0.02, 0.02, 0.01, glow('#39ff14'), 0.56, 1.18, -2.335);
  box(0.12, 0.01, 0.01, plastic, 0.62, 1.08, -2.335);
  box(0.12, 0.01, 0.01, plastic, 0.62, 1.04, -2.335);

  // cadeira, afastada para o lado
  const chairM = mat('#10141d');
  const chair = new THREE.Group();
  for (const [w, h, d, x, y, z] of [
    [0.5, 0.07, 0.5, 0, 0.48, 0],
    [0.5, 0.6, 0.06, 0, 0.84, 0.24],
    [0.06, 0.44, 0.06, 0, 0.24, 0],
    [0.5, 0.04, 0.06, 0, 0.03, 0],
    [0.06, 0.04, 0.5, 0, 0.03, 0],
  ] as const) {
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), chairM);
    m.position.set(x, y, z);
    chair.add(m);
  }
  chair.position.set(0.85, 0, -1.55);
  chair.rotation.y = -0.6;
  scene.add(chair);

  // estante à direita
  const shelfM = mat('#2a2030');
  box(0.35, 1.6, 0.9, shelfM, 2.8, 0.8, -1.2);
  const bookColors = ['#ff5c8a', '#4fc3f7', '#f5c542', '#b388ff', '#39ff14', '#ff8a50'];
  for (let shelf = 0; shelf < 3; shelf++) {
    box(0.34, 0.03, 0.88, mat('#3a2e40'), 2.8, 0.35 + shelf * 0.5, -1.2);
    for (let i = 0; i < 6; i++) box(0.22, 0.26 + (i % 3) * 0.04, 0.08, mat(bookColors[(i + shelf) % 6]!), 2.72, 0.5 + shelf * 0.5, -1.55 + i * 0.12);
  }

  // ── luzes ──
  scene.add(new THREE.AmbientLight('#5a6a96', 1.1));
  const moon = new THREE.DirectionalLight('#8fb0ff', 0.8);
  moon.position.set(-2, 3, -1);
  scene.add(moon);
  const monitorLight = new THREE.PointLight('#7dffa0', 1.4, 3.2, 1.8);
  monitorLight.position.set(0, 1.2, -2.0);
  scene.add(monitorLight);
  const lamp = new THREE.PointLight('#ffb36b', 2.2, 7, 1.4);
  lamp.position.set(1.8, 2.6, 0.5);
  scene.add(lamp);

  // ── câmera ──
  const startPos = new THREE.Vector3(-0.35, 1.62, 3.6);
  const endPos = new THREE.Vector3(SCREEN.x, SCREEN.y, SCREEN.z + 0.36);
  const startLook = new THREE.Vector3(-0.9, 1.45, -2.6);
  const endLook = new THREE.Vector3(SCREEN.x, SCREEN.y, SCREEN.z);
  const look = new THREE.Vector3();

  const resize = () => {
    const w = Math.max(1, Math.floor(canvas.clientWidth / PIXEL));
    const h = Math.max(1, Math.floor(canvas.clientHeight / PIXEL));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // a tela do monitor precisa encher a visão no fim, também em retrato
    endPos.z = SCREEN.z + Math.max(0.36, SCREEN.w / 2 / Math.tan((camera.fov / 2) * (Math.PI / 180)) / camera.aspect * 0.98);
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const start = performance.now();
  let lastStep = -1;
  let lastBlink = 0;
  let frame = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / walkMs);
    const e = ease(t);
    camera.position.lerpVectors(startPos, endPos, e);
    // balanço da cabeça enquanto anda, sumindo ao chegar
    const walking = Math.sin(Math.PI * Math.min(1, t * 1.15));
    const phase = ((now - start) / 430) * Math.PI;
    camera.position.y += Math.abs(Math.sin(phase)) * 0.045 * walking;
    camera.position.x += Math.sin(phase / 2) * 0.03 * walking;
    look.lerpVectors(startLook, endLook, Math.min(1, ease(Math.min(1, t * 1.3))));
    camera.lookAt(look);
    camera.rotation.z += Math.sin(phase / 2) * 0.012 * walking;

    const step = Math.floor((now - start) / 430);
    if (step !== lastStep && t < 0.9) {
      lastStep = step;
      onStep?.();
    }
    if (now - lastBlink > 500) {
      lastBlink = now;
      cursorOn = !cursorOn;
      drawScreen(sg, cursorOn);
      screenTex.needsUpdate = true;
      (led.material as THREE.MeshBasicMaterial).color.set(cursorOn ? '#39ff14' : '#0f3a0a');
    }
    monitorLight.intensity = 1.35 + Math.sin(now / 90) * 0.08;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    dispose: () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
}
