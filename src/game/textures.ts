import * as THREE from 'three';

export interface CityTextureSet {
  asphaltTexture: THREE.CanvasTexture;
  sidewalkTexture: THREE.CanvasTexture;
  buildingTexture: THREE.CanvasTexture;
  earthRoadTexture: THREE.CanvasTexture;
  earthWallTexture: THREE.CanvasTexture;
  kitchenRoadTexture: THREE.CanvasTexture;
  bathRoadTexture: THREE.CanvasTexture;
  labRoadTexture: THREE.CanvasTexture;
  spaceRoadTexture: THREE.CanvasTexture;
  chitinWingTexture: THREE.CanvasTexture;
  fabricWeaveTexture: THREE.CanvasTexture;
  reticleTexture: THREE.CanvasTexture;
  shadowTexture: THREE.CanvasTexture;
  snowFlakeTexture: THREE.CanvasTexture;
  shopSigns: THREE.CanvasTexture[];
  setAnisotropy: (level: number) => void;
  dispose: () => void;
}

const SHOP_SIGNS = [
  { name: 'ÇAY OCAĞI', sub: 'Bİ DEMLİ ÇAY KOYUN HELE', bg: '#7c2d12', accent: '#fde047' },
  { name: 'BAKKAL RIZA', sub: 'TAZE KIRINTI · SİMİT', bg: '#065f46', accent: '#a7f3d0' },
  { name: 'OTO TAMİR', sub: 'KAZIM USTA · LASTİK', bg: '#1e3a8a', accent: '#93c5fd' },
  { name: 'DİVA BUTİK', sub: 'DİVALAR YEMEK YAPMAZ', bg: '#831843', accent: '#fbcfe8' },
  { name: 'ACİL DUKTUR', sub: '7/24 NÖBETÇİ KLİNİK', bg: '#0f172a', accent: '#38bdf8' },
  { name: 'GECE BÜFESİ', sub: 'İKİ GÖZÜM AYDINLAT', bg: '#78350f', accent: '#fef08a' },
];

export function createCityTextures(maxAnisotropy: number): CityTextureSet {
  // 1. Precision 3-Lane Asphalt Road (Exact 1/3, 2/3 lane dividers so Sol/Orta/Sağ align 1:1!)
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 512;
  const rCtx = roadCanvas.getContext('2d')!;

  rCtx.fillStyle = '#18202a';
  rCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.random() > 0.5 ? 255 : 0;
    rCtx.fillStyle = `rgba(${v},${v},${v},0.035)`;
    rCtx.fillRect(x, y, 2, 2);
  }

  // Exact lane centers at 1/6, 3/6, 5/6 (85.3, 256, 426.7)
  [85, 256, 427].forEach((cx) => {
    const grad = rCtx.createLinearGradient(cx - 56, 0, cx + 56, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(7,10,16,0.42)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    rCtx.fillStyle = grad;
    rCtx.fillRect(cx - 56, 0, 112, 512);
  });

  // Amber edge boundary lines
  rCtx.fillStyle = '#f59e0b';
  rCtx.fillRect(6, 0, 8, 512);
  rCtx.fillRect(498, 0, 8, 512);

  // Crisp white dashed dividers at exact 1/3 (170.6) and 2/3 (341.3)
  rCtx.fillStyle = '#f8fafc';
  for (let y = 16; y < 512; y += 128) {
    rCtx.fillRect(166, y, 9, 76);
    rCtx.fillRect(337, y, 9, 76);
  }

  const asphaltTexture = new THREE.CanvasTexture(roadCanvas);
  asphaltTexture.colorSpace = THREE.SRGBColorSpace;
  asphaltTexture.wrapS = THREE.ClampToEdgeWrapping;
  asphaltTexture.wrapT = THREE.RepeatWrapping;
  asphaltTexture.repeat.set(1, 2);
  asphaltTexture.anisotropy = maxAnisotropy;

  // 2. City Sidewalk Interlocking Pavement Stones
  const swCanvas = document.createElement('canvas');
  swCanvas.width = 256;
  swCanvas.height = 256;
  const sCtx = swCanvas.getContext('2d')!;
  sCtx.fillStyle = '#475569';
  sCtx.fillRect(0, 0, 256, 256);

  const brickW = 64;
  const brickH = 32;
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < 5; col++) {
      const shade = 104 + Math.floor(Math.random() * 26);
      sCtx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 14})`;
      sCtx.fillRect(col * brickW + offset + 2, row * brickH + 2, brickW - 4, brickH - 4);
    }
  }
  const sidewalkTexture = new THREE.CanvasTexture(swCanvas);
  sidewalkTexture.colorSpace = THREE.SRGBColorSpace;
  sidewalkTexture.wrapS = THREE.RepeatWrapping;
  sidewalkTexture.wrapT = THREE.RepeatWrapping;
  sidewalkTexture.repeat.set(1, 4);
  sidewalkTexture.anisotropy = maxAnisotropy;

  // 3. Apartment Building Facade
  const bCanvas = document.createElement('canvas');
  bCanvas.width = 512;
  bCanvas.height = 512;
  const bCtx = bCanvas.getContext('2d')!;
  bCtx.fillStyle = '#2d3748';
  bCtx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 128) {
    bCtx.fillStyle = '#1a202c';
    bCtx.fillRect(0, y, 512, 12);
  }

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const wx = 34 + col * 120;
      const wy = 26 + row * 128;
      const isLit = (row * 5 + col * 3) % 3 !== 0;

      bCtx.fillStyle = '#0f172a';
      bCtx.fillRect(wx - 4, wy - 4, 68, 78);

      if (isLit) {
        const wGrad = bCtx.createLinearGradient(wx, wy, wx, wy + 70);
        wGrad.addColorStop(0, '#fde68a');
        wGrad.addColorStop(1, '#f59e0b');
        bCtx.fillStyle = wGrad;
      } else {
        bCtx.fillStyle = '#1e293b';
      }
      bCtx.fillRect(wx, wy, 60, 70);

      bCtx.fillStyle = '#0f172a';
      bCtx.fillRect(wx + 28, wy, 4, 70);
      bCtx.fillRect(wx, wy + 33, 60, 4);
    }
  }
  const buildingTexture = new THREE.CanvasTexture(bCanvas);
  buildingTexture.colorSpace = THREE.SRGBColorSpace;
  buildingTexture.wrapS = THREE.RepeatWrapping;
  buildingTexture.wrapT = THREE.RepeatWrapping;
  buildingTexture.anisotropy = maxAnisotropy;

  // 4. Realistic Cockroach Tegmina (Forewing) Chitin Texture (mahogany base + honey-amber rim + branching veins!)
  const wingCanvas = document.createElement('canvas');
  wingCanvas.width = 256;
  wingCanvas.height = 256;
  const wCtx = wingCanvas.getContext('2d')!;

  // Rich chestnut-mahogany gradient with warm translucent honey-amber costal border & wing tip
  const wGrad = wCtx.createLinearGradient(0, 0, 256, 256);
  wGrad.addColorStop(0, '#3a1606');
  wGrad.addColorStop(0.25, '#6b2e11');
  wGrad.addColorStop(0.58, '#8d4319');
  wGrad.addColorStop(0.84, '#a85a24');
  wGrad.addColorStop(1, '#4a1d08');
  wCtx.fillStyle = wGrad;
  wCtx.fillRect(0, 0, 256, 256);

  // Darker inner anal-field shading & warm amber costal margin highlight
  const edgeGrad = wCtx.createLinearGradient(0, 0, 256, 0);
  edgeGrad.addColorStop(0, 'rgba(32, 11, 4, 0.42)');
  edgeGrad.addColorStop(0.45, 'rgba(180, 95, 38, 0.14)');
  edgeGrad.addColorStop(0.85, 'rgba(217, 134, 62, 0.34)');
  edgeGrad.addColorStop(1, 'rgba(48, 18, 6, 0.45)');
  wCtx.fillStyle = edgeGrad;
  wCtx.fillRect(0, 0, 256, 256);

  // Subtle wet carapace highlight sheen along wing dome
  const ridgeGrad = wCtx.createRadialGradient(132, 96, 12, 128, 120, 128);
  ridgeGrad.addColorStop(0, 'rgba(255, 232, 198, 0.24)');
  ridgeGrad.addColorStop(0.55, 'rgba(255, 210, 160, 0.08)');
  ridgeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  wCtx.fillStyle = ridgeGrad;
  wCtx.fillRect(0, 0, 256, 256);

  // Main longitudinal radial vein (humeral ridge)
  wCtx.strokeStyle = 'rgba(24, 8, 2, 0.52)';
  wCtx.lineWidth = 4;
  wCtx.beginPath();
  wCtx.moveTo(92, 0);
  wCtx.bezierCurveTo(118, 70, 126, 160, 116, 256);
  wCtx.stroke();

  // Delicate fan-like branching diagonal tegmina veins
  wCtx.strokeStyle = 'rgba(28, 10, 3, 0.34)';
  wCtx.lineWidth = 2;
  for (let y = 18; y < 238; y += 22) {
    wCtx.beginPath();
    wCtx.moveTo(106, y);
    wCtx.quadraticCurveTo(165, y + 18, 248, Math.min(254, y + 44));
    wCtx.stroke();

    wCtx.beginPath();
    wCtx.moveTo(96, y + 8);
    wCtx.quadraticCurveTo(54, y + 26, 12, Math.min(254, y + 50));
    wCtx.stroke();
  }

  // Fine cross-vein archetypical insect wing cells
  wCtx.strokeStyle = 'rgba(255, 205, 150, 0.1)';
  wCtx.lineWidth = 1;
  for (let x = 28; x < 236; x += 26) {
    wCtx.beginPath();
    wCtx.moveTo(x, 0);
    wCtx.lineTo(x + (x - 128) * 0.14, 256);
    wCtx.stroke();
  }
  const chitinWingTexture = new THREE.CanvasTexture(wingCanvas);
  chitinWingTexture.colorSpace = THREE.SRGBColorSpace;
  chitinWingTexture.anisotropy = maxAnisotropy;

  // 4b. Neutral High-Resolution Fabric Weave Texture (tints cleanly with outfit color!)
  const fabCanvas = document.createElement('canvas');
  fabCanvas.width = 128;
  fabCanvas.height = 128;
  const fCtx = fabCanvas.getContext('2d')!;
  fCtx.fillStyle = '#f4f4f6';
  fCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    fCtx.fillStyle = y % 8 === 0 ? 'rgba(0, 0, 0, 0.055)' : 'rgba(255, 255, 255, 0.06)';
    fCtx.fillRect(0, y, 128, 2);
  }
  for (let x = 0; x < 128; x += 4) {
    fCtx.fillStyle = x % 8 === 0 ? 'rgba(0, 0, 0, 0.045)' : 'rgba(255, 255, 255, 0.05)';
    fCtx.fillRect(x, 0, 2, 128);
  }
  const fabricWeaveTexture = new THREE.CanvasTexture(fabCanvas);
  fabricWeaveTexture.colorSpace = THREE.SRGBColorSpace;
  fabricWeaveTexture.wrapS = THREE.RepeatWrapping;
  fabricWeaveTexture.wrapT = THREE.RepeatWrapping;
  fabricWeaveTexture.repeat.set(4, 4);
  fabricWeaveTexture.anisotropy = maxAnisotropy;

  // 5. Red Target Reticle
  const retCanvas = document.createElement('canvas');
  retCanvas.width = 256;
  retCanvas.height = 256;
  const rtCtx = retCanvas.getContext('2d')!;
  rtCtx.fillStyle = 'rgba(239, 68, 68, 0.28)';
  rtCtx.beginPath();
  rtCtx.arc(128, 128, 108, 0, Math.PI * 2);
  rtCtx.fill();

  rtCtx.strokeStyle = '#ef4444';
  rtCtx.lineWidth = 14;
  rtCtx.beginPath();
  rtCtx.arc(128, 128, 100, 0, Math.PI * 2);
  rtCtx.stroke();

  rtCtx.strokeStyle = '#ffffff';
  rtCtx.lineWidth = 8;
  rtCtx.beginPath();
  rtCtx.arc(128, 128, 52, 0, Math.PI * 2);
  rtCtx.stroke();

  const reticleTexture = new THREE.CanvasTexture(retCanvas);
  reticleTexture.colorSpace = THREE.SRGBColorSpace;
  reticleTexture.anisotropy = maxAnisotropy;

  // 6. Soft Radial Shadow
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 128;
  shCanvas.height = 128;
  const shCtx = shCanvas.getContext('2d')!;
  const grad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shCanvas);
  shadowTexture.colorSpace = THREE.SRGBColorSpace;

  // 7. Shop Signs
  const shopSigns = SHOP_SIGNS.map((item) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 192;
    const ctx = c.getContext('2d')!;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 192);
    ctx.fillStyle = item.bg;
    ctx.fillRect(10, 10, 492, 172);
    ctx.strokeStyle = item.accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, 480, 160);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 44px "Bricolage Grotesque", system-ui, sans-serif';
    ctx.fillText(item.name, 256, 74);

    ctx.fillStyle = item.accent;
    ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(item.sub, 256, 134);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  });

  // 8. Realistic Packed Earth & Pebble Soil Trail Texture (seamless vertical tile)
  const erCanvas = document.createElement('canvas');
  erCanvas.width = 512;
  erCanvas.height = 512;
  const erCtx = erCanvas.getContext('2d')!;
  erCtx.fillStyle = '#4e2f18';
  erCtx.fillRect(0, 0, 512, 512);

  // Subtle darker worn trail tracks in the 3 lanes
  [85, 256, 427].forEach((cx) => {
    const tGrad = erCtx.createLinearGradient(cx - 58, 0, cx + 58, 0);
    tGrad.addColorStop(0, 'rgba(30, 16, 8, 0)');
    tGrad.addColorStop(0.5, 'rgba(32, 18, 9, 0.45)');
    tGrad.addColorStop(1, 'rgba(30, 16, 8, 0)');
    erCtx.fillStyle = tGrad;
    erCtx.fillRect(cx - 58, 0, 116, 512);
  });

  // Organic soil clods & mineral flecks (wrapped vertically for zero seam)
  for (let i = 0; i < 3600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 3.5;
    const shade = Math.random();
    erCtx.fillStyle =
      shade < 0.35
        ? 'rgba(34, 19, 9, 0.45)'
        : shade < 0.72
          ? 'rgba(110, 68, 34, 0.35)'
          : 'rgba(148, 108, 72, 0.28)';
    erCtx.beginPath();
    erCtx.ellipse(x, y, r * 1.2, r * 0.85, Math.random() * Math.PI, 0, Math.PI * 2);
    erCtx.fill();
    if (y < 8 || y > 504) {
      erCtx.beginPath();
      erCtx.ellipse(x, y < 8 ? y + 512 : y - 512, r * 1.2, r * 0.85, 0, 0, Math.PI * 2);
      erCtx.fill();
    }
  }

  // Embedded small pebbles & root strands
  for (let i = 0; i < 140; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const pr = 2.5 + Math.random() * 4.5;
    erCtx.fillStyle = i % 3 === 0 ? '#78716c' : '#57534e';
    erCtx.beginPath();
    erCtx.ellipse(px, py, pr, pr * 0.72, Math.random() * 2, 0, Math.PI * 2);
    erCtx.fill();
  }

  const earthRoadTexture = new THREE.CanvasTexture(erCanvas);
  earthRoadTexture.colorSpace = THREE.SRGBColorSpace;
  earthRoadTexture.wrapS = THREE.RepeatWrapping;
  earthRoadTexture.wrapT = THREE.RepeatWrapping;
  earthRoadTexture.anisotropy = maxAnisotropy;

  // 9. Subterranean Earth Strata & Rock Wall Texture (for tunnel walls & dome roof)
  const ewCanvas = document.createElement('canvas');
  ewCanvas.width = 512;
  ewCanvas.height = 512;
  const ewCtx = ewCanvas.getContext('2d')!;
  ewCtx.fillStyle = '#331d0f';
  ewCtx.fillRect(0, 0, 512, 512);

  // Horizontal sedimentary earth layers
  for (let y = 0; y < 512; y += 32) {
    ewCtx.fillStyle =
      y % 64 === 0 ? 'rgba(72, 41, 20, 0.52)' : 'rgba(24, 13, 6, 0.45)';
    ewCtx.fillRect(0, y, 512, 18 + Math.random() * 10);
  }
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1.5 + Math.random() * 5;
    ewCtx.fillStyle =
      i % 4 === 0
        ? 'rgba(87, 83, 78, 0.38)'
        : i % 2 === 0
          ? 'rgba(92, 54, 24, 0.36)'
          : 'rgba(22, 12, 6, 0.42)';
    ewCtx.beginPath();
    ewCtx.arc(x, y, r, 0, Math.PI * 2);
    ewCtx.fill();
  }
  const earthWallTexture = new THREE.CanvasTexture(ewCanvas);
  earthWallTexture.colorSpace = THREE.SRGBColorSpace;
  earthWallTexture.wrapS = THREE.RepeatWrapping;
  earthWallTexture.wrapT = THREE.RepeatWrapping;
  earthWallTexture.repeat.set(2, 2);
  earthWallTexture.anisotropy = maxAnisotropy;

  // 10. Giant Kitchen Checkered Tile Countertop with Ketchup & Mustard Edge Stripes
  const ktCanvas = document.createElement('canvas');
  ktCanvas.width = 256;
  ktCanvas.height = 256;
  const ktCtx = ktCanvas.getContext('2d')!;
  const ktTile = 42.666;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      ktCtx.fillStyle = (row + col) % 2 === 0 ? '#fef3c7' : '#fed7aa';
      ktCtx.fillRect(col * ktTile, row * ktTile, ktTile, ktTile);
    }
  }
  ktCtx.fillStyle = '#dc2626'; // Ketchup left rail
  ktCtx.fillRect(0, 0, 10, 256);
  ktCtx.fillStyle = '#eab308'; // Mustard right rail
  ktCtx.fillRect(246, 0, 10, 256);
  ktCtx.fillStyle = 'rgba(180, 83, 9, 0.28)';
  for (let y = 10; y < 256; y += 64) {
    ktCtx.fillRect(83, y, 5, 38);
    ktCtx.fillRect(168, y, 5, 38);
  }
  const kitchenRoadTexture = new THREE.CanvasTexture(ktCanvas);
  kitchenRoadTexture.colorSpace = THREE.SRGBColorSpace;
  kitchenRoadTexture.wrapS = THREE.ClampToEdgeWrapping;
  kitchenRoadTexture.wrapT = THREE.RepeatWrapping;
  kitchenRoadTexture.repeat.set(1, 3);
  kitchenRoadTexture.anisotropy = maxAnisotropy;

  // 11. Bubbly Bathroom Aqua Gloss Tile Floor
  const btCanvas = document.createElement('canvas');
  btCanvas.width = 256;
  btCanvas.height = 256;
  const btCtx = btCanvas.getContext('2d')!;
  const btTile = 42.666;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      btCtx.fillStyle = (row + col) % 2 === 0 ? '#cffafe' : '#67e8f9';
      btCtx.fillRect(col * btTile, row * btTile, btTile, btTile);
      btCtx.strokeStyle = 'rgba(255,255,255,0.65)';
      btCtx.lineWidth = 2;
      btCtx.strokeRect(col * btTile, row * btTile, btTile, btTile);
    }
  }
  btCtx.fillStyle = '#06b6d4';
  btCtx.fillRect(0, 0, 8, 256);
  btCtx.fillRect(248, 0, 8, 256);
  const bathRoadTexture = new THREE.CanvasTexture(btCanvas);
  bathRoadTexture.colorSpace = THREE.SRGBColorSpace;
  bathRoadTexture.wrapS = THREE.ClampToEdgeWrapping;
  bathRoadTexture.wrapT = THREE.RepeatWrapping;
  bathRoadTexture.repeat.set(1, 3);
  bathRoadTexture.anisotropy = maxAnisotropy;

  // 12. Mad Lab Dark Metallic Tech Grid with Neon Toxic Hazard Borders
  const lbCanvas = document.createElement('canvas');
  lbCanvas.width = 256;
  lbCanvas.height = 256;
  const lbCtx = lbCanvas.getContext('2d')!;
  lbCtx.fillStyle = '#0f172a';
  lbCtx.fillRect(0, 0, 256, 256);
  lbCtx.strokeStyle = 'rgba(74, 222, 128, 0.25)';
  lbCtx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 42.666) {
    lbCtx.beginPath();
    lbCtx.moveTo(i, 0);
    lbCtx.lineTo(i, 256);
    lbCtx.stroke();
    lbCtx.beginPath();
    lbCtx.moveTo(0, i);
    lbCtx.lineTo(256, i);
    lbCtx.stroke();
  }
  // Caution hazard stripes along edges
  for (let y = 0; y < 256; y += 32) {
    lbCtx.fillStyle = (y / 32) % 2 === 0 ? '#22c55e' : '#052e16';
    lbCtx.fillRect(0, y, 10, 32);
    lbCtx.fillRect(246, y, 10, 32);
  }
  lbCtx.fillStyle = '#4ade80';
  for (let y = 12; y < 256; y += 64) {
    lbCtx.fillRect(84, y, 4, 34);
    lbCtx.fillRect(169, y, 4, 34);
  }
  const labRoadTexture = new THREE.CanvasTexture(lbCanvas);
  labRoadTexture.colorSpace = THREE.SRGBColorSpace;
  labRoadTexture.wrapS = THREE.ClampToEdgeWrapping;
  labRoadTexture.wrapT = THREE.RepeatWrapping;
  labRoadTexture.repeat.set(1, 3);
  labRoadTexture.anisotropy = maxAnisotropy;

  // 13. Cheese Galaxy Starlight Cosmic Runway
  const spCanvas = document.createElement('canvas');
  spCanvas.width = 256;
  spCanvas.height = 256;
  const spCtx = spCanvas.getContext('2d')!;
  spCtx.fillStyle = '#1e1b4b';
  spCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    spCtx.fillStyle = i % 4 === 0 ? '#fde047' : '#e0e7ff';
    spCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  spCtx.fillStyle = '#e879f9';
  spCtx.fillRect(0, 0, 8, 256);
  spCtx.fillRect(248, 0, 8, 256);
  spCtx.fillStyle = 'rgba(56, 189, 248, 0.55)';
  for (let y = 12; y < 256; y += 64) {
    spCtx.fillRect(84, y, 4, 34);
    spCtx.fillRect(169, y, 4, 34);
  }
  const spaceRoadTexture = new THREE.CanvasTexture(spCanvas);
  spaceRoadTexture.colorSpace = THREE.SRGBColorSpace;
  spaceRoadTexture.wrapS = THREE.ClampToEdgeWrapping;
  spaceRoadTexture.wrapT = THREE.RepeatWrapping;
  spaceRoadTexture.repeat.set(1, 3);
  spaceRoadTexture.anisotropy = maxAnisotropy;

  // 14. Soft Fluffy Snowflake Crystal Sprite (realistic snowfall, zero square pixels)
  const sfCanvas = document.createElement('canvas');
  sfCanvas.width = 128;
  sfCanvas.height = 128;
  const sfCtx = sfCanvas.getContext('2d')!;
  const sfGrad = sfCtx.createRadialGradient(64, 64, 4, 64, 64, 60);
  sfGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  sfGrad.addColorStop(0.32, 'rgba(240, 249, 255, 0.92)');
  sfGrad.addColorStop(0.68, 'rgba(224, 242, 254, 0.38)');
  sfGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
  sfCtx.fillStyle = sfGrad;
  sfCtx.fillRect(0, 0, 128, 128);

  // Subtle 6-branch feathery ice star glints inside the flake
  sfCtx.save();
  sfCtx.translate(64, 64);
  sfCtx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  sfCtx.lineCap = 'round';
  sfCtx.lineWidth = 3;
  for (let a = 0; a < 6; a++) {
    sfCtx.rotate(Math.PI / 3);
    sfCtx.beginPath();
    sfCtx.moveTo(0, 0);
    sfCtx.lineTo(0, -40);
    sfCtx.moveTo(0, -24);
    sfCtx.lineTo(-10, -34);
    sfCtx.moveTo(0, -24);
    sfCtx.lineTo(10, -34);
    sfCtx.stroke();
  }
  sfCtx.restore();

  const snowFlakeTexture = new THREE.CanvasTexture(sfCanvas);
  snowFlakeTexture.colorSpace = THREE.SRGBColorSpace;
  snowFlakeTexture.anisotropy = maxAnisotropy;

  const allTextures: THREE.Texture[] = [
    asphaltTexture,
    sidewalkTexture,
    buildingTexture,
    earthRoadTexture,
    earthWallTexture,
    kitchenRoadTexture,
    bathRoadTexture,
    labRoadTexture,
    spaceRoadTexture,
    chitinWingTexture,
    fabricWeaveTexture,
    reticleTexture,
    shadowTexture,
    snowFlakeTexture,
    ...shopSigns,
  ];

  let currentAniso = maxAnisotropy;

  return {
    asphaltTexture,
    sidewalkTexture,
    buildingTexture,
    earthRoadTexture,
    earthWallTexture,
    kitchenRoadTexture,
    bathRoadTexture,
    labRoadTexture,
    spaceRoadTexture,
    chitinWingTexture,
    fabricWeaveTexture,
    reticleTexture,
    shadowTexture,
    snowFlakeTexture,
    shopSigns,
    setAnisotropy: (level: number) => {
      const clamped = Math.max(1, Math.min(maxAnisotropy, Math.round(level)));
      if (clamped === currentAniso) return;
      currentAniso = clamped;
      for (const tex of allTextures) {
        tex.anisotropy = clamped;
      }
    },
    dispose: () => {
      for (const tex of allTextures) {
        tex.dispose();
      }
    },
  };
}
