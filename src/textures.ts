import * as THREE from 'three';

/** Textures dessinées à la main sur un canvas (papier peint, tapis, dos de livres…). */

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvasTexture(w: number, h: number, draw: Draw, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  return tex;
}

/** Petites taches et grain pour vieillir une surface. */
function grain(g: CanvasRenderingContext2D, w: number, h: number, count: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alpha * Math.random()})` : `rgba(255,240,210,${alpha * Math.random() * 0.6})`;
    const s = 1 + Math.random() * 2;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

function stains(g: CanvasRenderingContext2D, w: number, h: number, count: number, color: string) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 20 + Math.random() * 120;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// ---------- Papier peint damassé ----------
function damaskMotif(g: CanvasRenderingContext2D, cx: number, cy: number) {
  g.save();
  g.translate(cx, cy);
  for (const side of [1, -1]) {
    g.save();
    g.scale(side, 1);
    g.beginPath();
    g.moveTo(0, -120);
    g.bezierCurveTo(30, -100, 55, -70, 30, -40);
    g.bezierCurveTo(80, -60, 105, -10, 70, 15);
    g.bezierCurveTo(100, 40, 80, 85, 40, 70);
    g.bezierCurveTo(45, 95, 20, 115, 0, 125);
    g.lineTo(0, -120);
    g.fill();
    // volutes
    g.beginPath();
    g.arc(78, -55, 14, 0.5, PI2 - 0.5);
    g.moveTo(95, 60);
    g.arc(82, 60, 13, 0, PI2 - 1);
    g.stroke();
    // feuilles
    g.beginPath();
    g.ellipse(52, -95, 7, 22, 0.7, 0, PI2);
    g.ellipse(100, 25, 6, 18, -0.4, 0, PI2);
    g.fill();
    g.restore();
  }
  // cœur du motif plus sombre
  g.fillStyle = 'rgba(20,35,25,0.35)';
  g.beginPath();
  g.moveTo(0, -50);
  g.quadraticCurveTo(28, 0, 0, 50);
  g.quadraticCurveTo(-28, 0, 0, -50);
  g.fill();
  g.restore();
}

const PI2 = Math.PI * 2;

export function wallpaperTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#34503d';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = x % 64 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.025)';
      g.fillRect(x, 0, 32, h);
    }
    g.fillStyle = 'rgba(200,170,105,0.2)';
    g.strokeStyle = 'rgba(200,170,105,0.26)';
    g.lineWidth = 3;
    for (const [x, y] of [[256, 256], [0, 0], [512, 0], [0, 512], [512, 512]]) damaskMotif(g, x, y);
    grain(g, w, h, 6000, 0.12);
    stains(g, w, h, 4, 'rgba(60,45,20,0.08)');
  }, [1, 1]);
}

// ---------- Tapis persan ----------
export function rugTexture() {
  return canvasTexture(1024, 768, (g, w, h) => {
    const red = '#7a1d1a';
    const navy = '#1d2a4a';
    const cream = '#d9c49a';
    const gold = '#b8892f';
    g.fillStyle = navy;
    g.fillRect(0, 0, w, h);
    g.fillStyle = cream;
    g.fillRect(40, 40, w - 80, h - 80);
    g.fillStyle = navy;
    g.fillRect(70, 70, w - 140, h - 140);
    // frise de bordure
    g.fillStyle = gold;
    for (let x = 90; x < w - 90; x += 34) {
      diamond(g, x, 55, 10);
      diamond(g, x, h - 55, 10);
    }
    for (let y = 90; y < h - 90; y += 34) {
      diamond(g, 55, y, 10);
      diamond(g, w - 55, y, 10);
    }
    g.fillStyle = red;
    g.fillRect(110, 110, w - 220, h - 220);
    // motifs du champ
    g.fillStyle = 'rgba(217,196,154,0.5)';
    for (let x = 150; x < w - 130; x += 60) {
      for (let y = 150; y < h - 130; y += 60) {
        g.beginPath();
        g.arc(x, y, 6, 0, PI2);
        g.fill();
        diamond(g, x + 30, y + 30, 5);
      }
    }
    // médaillon central
    g.save();
    g.translate(w / 2, h / 2);
    g.fillStyle = navy;
    g.beginPath();
    g.ellipse(0, 0, 230, 160, 0, 0, PI2);
    g.fill();
    g.strokeStyle = gold;
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = cream;
    g.beginPath();
    g.ellipse(0, 0, 150, 100, 0, 0, PI2);
    g.fill();
    g.fillStyle = red;
    for (let i = 0; i < 12; i++) {
      g.save();
      g.rotate((i / 12) * PI2);
      g.beginPath();
      g.ellipse(0, -60, 14, 34, 0, 0, PI2);
      g.fill();
      g.restore();
    }
    g.fillStyle = navy;
    g.beginPath();
    g.arc(0, 0, 26, 0, PI2);
    g.fill();
    g.restore();
    // coins
    g.fillStyle = navy;
    for (const [x, y] of [[110, 110], [w - 110, 110], [110, h - 110], [w - 110, h - 110]]) {
      g.beginPath();
      g.arc(x, y, 90, 0, PI2);
      g.fill();
    }
    // usure
    grain(g, w, h, 40000, 0.25);
    stains(g, w, h, 10, 'rgba(255,230,190,0.08)');
  });
}

function diamond(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r, y);
  g.closePath();
  g.fill();
}

// ---------- Carte ancienne (à partir de la texture satellite) ----------
export function antiqueMapTexture(img: HTMLImageElement) {
  const w = 2048;
  const h = 1024;
  return canvasTexture(w, h, (g) => {
    g.drawImage(img, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h);
    const p = data.data;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i];
      const gr = p[i + 1];
      const b = p[i + 2];
      const lum = (r + gr + b) / 765;
      const sea = b > r + 8 && b > gr - 10;
      if (sea) {
        // océans : parchemin légèrement verdâtre
        p[i] = 196 + lum * 30;
        p[i + 1] = 186 + lum * 30;
        p[i + 2] = 148 + lum * 20;
      } else {
        // terres : ocre/brun selon le relief
        const t = Math.min(1, lum * 1.6);
        p[i] = 120 + t * 105;
        p[i + 1] = 82 + t * 90;
        p[i + 2] = 42 + t * 60;
      }
    }
    g.putImageData(data, 0, 0);

    // méridiens et parallèles à l'encre
    g.strokeStyle = 'rgba(70,40,15,0.45)';
    g.lineWidth = 1.5;
    for (let lon = 0; lon <= 360; lon += 15) {
      const x = (lon / 360) * w;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const y = ((90 - lat) / 180) * h;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    // équateur et tropiques en rouge
    g.strokeStyle = 'rgba(130,30,20,0.6)';
    g.lineWidth = 3;
    for (const lat of [0, 23.44, -23.44]) {
      const y = ((90 - lat) / 180) * h;
      g.setLineDash(lat === 0 ? [] : [12, 8]);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.setLineDash([]);
    // noms d'océans
    g.fillStyle = 'rgba(70,40,15,0.7)';
    g.font = 'italic 30px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('OCÉAN  ATLANTIQUE', 0.4 * w, 0.48 * h);
    g.fillText('OCÉAN  PACIFIQUE', 0.1 * w, 0.55 * h);
    g.fillText('OCÉAN  INDIEN', 0.7 * w, 0.62 * h);
    g.fillText('OCÉAN  PACIFIQUE', 0.92 * w, 0.42 * h);
    stains(g, w, h, 25, 'rgba(90,55,20,0.12)');
    grain(g, w, h, 30000, 0.15);
  });
}

// ---------- Dos de livres anciens ----------
export const LEATHER = ['#5a1a14', '#2e3d22', '#1f2a3d', '#6b4220', '#3a1d2e', '#4a3420', '#7a5a2a', '#22201c'];

export function spineTexture(color: string, style: number) {
  return canvasTexture(64, 256, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    // arrondi du dos
    const shade = g.createLinearGradient(0, 0, w, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0.45)');
    shade.addColorStop(0.35, 'rgba(255,255,255,0.08)');
    shade.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = shade;
    g.fillRect(0, 0, w, h);
    grain(g, w, h, 600, 0.3);
    const gold = 'rgba(214,170,80,0.9)';
    g.fillStyle = gold;
    // nerfs (bandes dorées)
    const bands = style % 2 === 0 ? [18, 60, 196, 238] : [24, 230];
    for (const y of bands) {
      g.fillRect(0, y, w, 3);
      g.fillRect(0, y + 6, w, 1.5);
    }
    // pièce de titre
    if (style % 3 !== 2) {
      g.fillStyle = style % 3 === 0 ? '#1a1410' : '#6a1610';
      g.fillRect(6, 82, w - 12, 46);
      g.strokeStyle = gold;
      g.lineWidth = 1.5;
      g.strokeRect(8, 84, w - 16, 42);
      g.fillStyle = gold;
      g.fillRect(14, 98, w - 28, 3);
      g.fillRect(18, 108, w - 36, 2);
    } else {
      g.font = 'bold 14px Georgia, serif';
      g.textAlign = 'center';
      g.fillText(['I', 'II', 'III', 'IV', 'V'][Math.floor(Math.random() * 5)], w / 2, 150);
    }
  });
}

export function pageEdgeTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#d8c9a3';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = `rgba(120,90,50,${0.05 + Math.random() * 0.12})`;
      g.fillRect(0, y, w, 1);
    }
  });
}

// ---------- Plans, cartes du ciel, tableau noir, étiquettes ----------
export function blueprintTexture() {
  return canvasTexture(1024, 700, (g, w, h) => {
    g.fillStyle = '#e6dcc0';
    g.fillRect(0, 0, w, h);
    stains(g, w, h, 6, 'rgba(120,80,30,0.12)');
    g.strokeStyle = 'rgba(40,60,110,0.18)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 20) line(g, x, 0, x, h);
    for (let y = 0; y < h; y += 20) line(g, 0, y, w, y);
    g.strokeStyle = 'rgba(30,35,60,0.85)';
    g.lineWidth = 2.5;
    // une machine à vapeur stylisée : roue, piston, chaudière
    g.beginPath();
    g.arc(700, 360, 170, 0, PI2);
    g.moveTo(760, 360);
    g.arc(700, 360, 60, 0, PI2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI2;
      g.moveTo(700 + Math.cos(a) * 60, 360 + Math.sin(a) * 60);
      g.lineTo(700 + Math.cos(a) * 165, 360 + Math.sin(a) * 165);
    }
    g.stroke();
    g.strokeRect(120, 300, 300, 120);
    g.strokeRect(160, 330, 120, 60);
    line(g, 280, 360, 640, 300);
    g.beginPath();
    g.arc(160, 240, 40, Math.PI, 0);
    g.stroke();
    g.strokeRect(150, 180, 20, 60);
    // cotes
    g.lineWidth = 1.2;
    line(g, 120, 470, 420, 470);
    line(g, 120, 460, 120, 480);
    line(g, 420, 460, 420, 480);
    g.fillStyle = 'rgba(30,35,60,0.9)';
    g.font = 'italic 22px Georgia, serif';
    g.fillText('1 200 mm', 230, 500);
    g.fillText('Ø 340', 660, 580);
    g.font = '28px Georgia, serif';
    g.fillText('Machine à vapeur — Pl. IV', 60, 70);
    g.font = 'italic 18px Georgia, serif';
    g.fillText('Échelle 1/10', 60, 100);
    g.strokeRect(20, 20, w - 40, h - 40);
    grain(g, w, h, 8000, 0.15);
  });
}

function line(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

export function starChartTexture(title: string, seed: number, clue = false) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return canvasTexture(512, 700, (g, w, h) => {
    g.fillStyle = '#1b2236';
    g.fillRect(0, 0, w, h);
    stains(g, w, h, 6, 'rgba(120,100,60,0.15)');
    g.strokeStyle = 'rgba(214,180,100,0.8)';
    g.lineWidth = 3;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 1;
    g.strokeRect(22, 22, w - 44, h - 44);
    g.beginPath();
    g.arc(w / 2, 340, 210, 0, PI2);
    g.stroke();
    for (let r = 70; r < 210; r += 70) {
      g.beginPath();
      g.arc(w / 2, 340, r, 0, PI2);
      g.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI2;
      line(g, w / 2, 340, w / 2 + Math.cos(a) * 210, 340 + Math.sin(a) * 210);
    }
    g.fillStyle = '#efe2c0';
    const pts: [number, number][] = [];
    for (let i = 0; i < 220; i++) {
      const a = rand() * PI2;
      const r = Math.sqrt(rand()) * 205;
      const x = w / 2 + Math.cos(a) * r;
      const y = 340 + Math.sin(a) * r;
      const size = rand() < 0.1 ? 3 : 1.2;
      g.beginPath();
      g.arc(x, y, size, 0, PI2);
      g.fill();
      if (size > 2) pts.push([x, y]);
    }
    g.strokeStyle = 'rgba(214,180,100,0.6)';
    for (let i = 0; i < pts.length - 1; i += 2) line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    g.fillStyle = 'rgba(214,180,100,0.95)';
    g.font = '30px Georgia, serif';
    g.textAlign = 'center';
    g.fillText(title, w / 2, 610);
    g.font = 'italic 18px Georgia, serif';
    g.fillText('Atlas Coelestis — MDCCCLII', w / 2, 645);
    if (clue) {
      // Indice secret n° II : noté au bord de la carte (Sn = étain → ♃)
      g.fillStyle = 'rgba(214,180,100,0.55)';
      g.font = 'italic 14px Georgia, serif';
      g.fillText('II · Sn', 100, 515);
    }
    grain(g, w, h, 5000, 0.2);
  });
}

export function chalkboardTexture() {
  return canvasTexture(1024, 640, (g, w, h) => {
    g.fillStyle = '#1e2a24';
    g.fillRect(0, 0, w, h);
    stains(g, w, h, 30, 'rgba(255,255,255,0.035)');
    g.strokeStyle = 'rgba(235,235,225,0.85)';
    g.fillStyle = 'rgba(235,235,225,0.85)';
    g.lineWidth = 3;
    g.font = '44px "Segoe Script", "Comic Sans MS", cursive';
    g.fillText('a² + b² = c²', 70, 110);
    g.fillText('E = mc²', 620, 120);
    g.fillText('F = m · a', 640, 300);
    g.fillText('π ≈ 3,14159', 80, 560);
    g.font = '30px "Segoe Script", "Comic Sans MS", cursive';
    g.fillText('v = 299 792 km/s', 600, 560);
    // Indice secret n° I : à la craie, presque effacé (Fe = fer → ♂)
    g.fillStyle = 'rgba(235,235,225,0.22)';
    g.font = '26px "Segoe Script", cursive';
    g.fillText('I · Fe', 950, 600);
    // triangle de Pythagore
    g.beginPath();
    g.moveTo(100, 420);
    g.lineTo(400, 420);
    g.lineTo(100, 200);
    g.closePath();
    g.stroke();
    g.strokeRect(100, 390, 30, 30);
    g.fillText('a', 60, 320);
    g.fillText('b', 240, 470);
    g.fillText('c', 270, 300);
    // pendule
    line(g, 800, 330, 800, 340);
    line(g, 740, 340, 860, 340);
    line(g, 800, 340, 740, 470);
    g.beginPath();
    g.arc(740, 480, 14, 0, PI2);
    g.stroke();
    g.setLineDash([6, 8]);
    g.beginPath();
    g.arc(800, 340, 140, 1.9, 2.4);
    g.stroke();
    g.setLineDash([]);
    grain(g, w, h, 20000, 0.08);
  });
}

export function labelTexture(text: string, sub = '', mark = '') {
  return canvasTexture(256, 160, (g, w, h) => {
    g.fillStyle = '#e8dcbc';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a2a18';
    g.lineWidth = 4;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 1.5;
    g.strokeRect(15, 15, w - 30, h - 30);
    g.fillStyle = '#2a1c10';
    g.textAlign = 'center';
    g.font = 'bold 36px Georgia, serif';
    g.fillText(text, w / 2, 82);
    g.font = 'italic 22px Georgia, serif';
    g.fillText(sub, w / 2, 120);
    if (mark) {
      g.font = 'italic 13px Georgia, serif';
      g.fillStyle = 'rgba(42,28,16,0.6)';
      g.fillText(mark, w - 28, h - 22);
    }
    grain(g, w, h, 1500, 0.2);
  });
}

/** Affiche ancienne du tableau périodique (version simplifiée, 1869 façon Mendeleïev). */
export function periodicTableTexture() {
  const rows = [
    ['H', '', '', '', '', '', '', 'He'],
    ['Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne'],
    ['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar'],
    ['K', 'Ca', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'],
    ['Rb', 'Sr', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe'],
    ['Cs', 'Ba', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn'],
  ];
  return canvasTexture(900, 640, (g, w, h) => {
    g.fillStyle = '#e4d4ac';
    g.fillRect(0, 0, w, h);
    stains(g, w, h, 10, 'rgba(120,80,30,0.15)');
    g.fillStyle = '#2a1c10';
    g.textAlign = 'center';
    g.font = '40px Georgia, serif';
    g.fillText('Système périodique des éléments', w / 2, 62);
    g.font = 'italic 20px Georgia, serif';
    g.fillText('d’après D. Mendeleïev — 1869', w / 2, 92);
    const cw = 96;
    const ch = 76;
    const x0 = (w - cw * 8) / 2;
    rows.forEach((row, r) => {
      row.forEach((sym, c) => {
        if (!sym) return;
        const x = x0 + c * cw;
        const y = 120 + r * ch;
        g.fillStyle = ['#c9a86a', '#b8c49a', '#c49a8a', '#a8b8c4'][(c + r) % 4];
        g.fillRect(x + 3, y + 3, cw - 6, ch - 6);
        g.strokeStyle = '#3a2412';
        g.lineWidth = 2;
        g.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
        g.fillStyle = '#2a1c10';
        g.font = 'bold 32px Georgia, serif';
        g.fillText(sym, x + cw / 2, y + ch / 2 + 10);
      });
    });
    g.strokeStyle = '#3a2412';
    g.lineWidth = 4;
    g.strokeRect(16, 16, w - 32, h - 32);
    grain(g, w, h, 15000, 0.15);
  });
}

/** Fenêtre en verre ancien : vitrail en haut, losanges de verre dépoli sertis de plomb en dessous. */
export function leadedGlassTexture() {
  return canvasTexture(256, 472, (g, w, h) => {
    const top = h * 0.24;
    // Losanges de verre dépoli, teintes légèrement différentes
    const tints = ['#f3ead2', '#efe6cf', '#e9eedb', '#f5e6c4', '#ece4d6'];
    const dw = 42;
    const dh = 64;
    for (let y = top - dh; y < h + dh; y += dh / 2) {
      const row = Math.round((y - top) / (dh / 2));
      for (let x = (row % 2) * (dw / 2) - dw; x < w + dw; x += dw) {
        g.fillStyle = tints[Math.floor(Math.random() * tints.length)];
        g.beginPath();
        g.moveTo(x, y - dh / 2);
        g.lineTo(x + dw / 2, y);
        g.lineTo(x, y + dh / 2);
        g.lineTo(x - dw / 2, y);
        g.closePath();
        g.fill();
      }
    }
    // texture « verre cathédrale » : ondulations claires et sombres
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * w;
      const y = top + Math.random() * (h - top);
      const r = 2 + Math.random() * 7;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, Math.random() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(150,130,90,0.18)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // plombs
    g.strokeStyle = '#3a342c';
    g.lineWidth = 3;
    for (let x = -h; x < w + h; x += dw) {
      g.beginPath();
      g.moveTo(x, top);
      g.lineTo(x + (h - top) * (dw / dh), h);
      g.moveTo(x, top);
      g.lineTo(x - (h - top) * (dw / dh), h);
      g.stroke();
    }

    // Vitrail : rosace colorée avec une étoile dorée
    g.fillStyle = '#2a3f6e';
    g.fillRect(0, 0, w, top);
    const cx = w / 2;
    const cy = top / 2;
    const R = top * 0.44;
    const colors = ['#9a1f1a', '#d49a2a', '#2f6a3a', '#7a3a8a', '#c4561e', '#2a6aa0'];
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2;
      const a1 = ((i + 1) / 12) * Math.PI * 2;
      g.fillStyle = colors[i % colors.length];
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, R, a0, a1);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#f2d36a';
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? R * 0.28 : R * 0.62;
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    for (const [x, c] of [[w * 0.12, '#d49a2a'], [w * 0.88, '#d49a2a']] as const) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, cy, top * 0.18, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#2a241c';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.moveTo(cx + R * 0.62, cy);
    g.arc(cx, cy, R * 0.62, 0, Math.PI * 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.moveTo(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62);
      g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    }
    g.stroke();
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(0, top);
    g.lineTo(w, top);
    g.stroke();
  });
}

/** Carte postale ancienne, sépia : une gravure simple et une légende manuscrite. */
export function vintagePostcardTexture(i: number) {
  const scenes = ['Souvenir de Paris', 'Le Caire — les Pyramides', 'Venise', 'Naples — le Vésuve', 'Le Transatlantique', 'Ascension en ballon'];
  return canvasTexture(384, 256, (g, w, h) => {
    g.fillStyle = '#e9dcbc';
    g.fillRect(0, 0, w, h);
    stains(g, w, h, 6, 'rgba(120,80,30,0.12)');
    // cadre de la gravure
    const x0 = 18, y0 = 16, iw = w - 36, ih = h - 62;
    const sky = g.createLinearGradient(0, y0, 0, y0 + ih);
    sky.addColorStop(0, '#d8c49a');
    sky.addColorStop(1, '#b89a68');
    g.fillStyle = sky;
    g.fillRect(x0, y0, iw, ih);
    g.save();
    g.beginPath();
    g.rect(x0, y0, iw, ih);
    g.clip();
    g.fillStyle = '#5a3e22';
    g.strokeStyle = '#4a3018';
    g.lineWidth = 2;
    const ground = y0 + ih * 0.78;
    const cx = x0 + iw / 2;
    if (i === 0) {
      // tour de fer
      g.fillRect(x0, ground, iw, ih);
      g.beginPath();
      g.moveTo(cx - 40, ground);
      g.quadraticCurveTo(cx - 10, ground - 70, cx - 3, y0 + 14);
      g.lineTo(cx + 3, y0 + 14);
      g.quadraticCurveTo(cx + 10, ground - 70, cx + 40, ground);
      g.lineTo(cx + 22, ground);
      g.quadraticCurveTo(cx, ground - 40, cx - 22, ground);
      g.fill();
      for (const y of [ground - 45, ground - 95]) g.fillRect(cx - 24 + (ground - y) * 0.18, y, 48 - (ground - y) * 0.36, 4);
    } else if (i === 1) {
      g.fillStyle = '#c8a064';
      g.fillRect(x0, ground, iw, ih);
      g.fillStyle = '#6a4a26';
      for (const [px, s] of [[cx - 50, 70], [cx + 30, 95], [cx + 105, 50]] as const) {
        g.beginPath();
        g.moveTo(px - s, ground);
        g.lineTo(px, ground - s * 0.9);
        g.lineTo(px + s, ground);
        g.fill();
      }
      g.beginPath();
      g.arc(x0 + 50, y0 + 40, 16, 0, Math.PI * 2);
      g.fillStyle = '#efd8a0';
      g.fill();
    } else if (i === 2) {
      g.fillStyle = '#8a7656';
      g.fillRect(x0, ground, iw, ih);
      g.fillStyle = '#5a3e22';
      g.fillRect(x0 + 20, ground - 90, 26, 90); // campanile
      g.beginPath();
      g.moveTo(x0 + 18, ground - 90);
      g.lineTo(x0 + 33, ground - 120);
      g.lineTo(x0 + 48, ground - 90);
      g.fill();
      g.fillRect(x0 + 70, ground - 50, 150, 50);
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x0 + 100 + k * 45, ground - 50, 16, Math.PI, 0);
        g.fill();
      }
      g.beginPath(); // gondole
      g.moveTo(cx + 40, ground + 18);
      g.quadraticCurveTo(cx + 90, ground + 30, cx + 140, ground + 8);
      g.lineTo(cx + 135, ground + 18);
      g.quadraticCurveTo(cx + 90, ground + 34, cx + 45, ground + 24);
      g.fill();
    } else if (i === 3) {
      g.fillStyle = '#7a6a50';
      g.fillRect(x0, ground, iw, ih);
      g.fillStyle = '#5a3e22';
      g.beginPath();
      g.moveTo(x0 + 20, ground);
      g.lineTo(cx - 20, y0 + 50);
      g.lineTo(cx + 20, y0 + 54);
      g.lineTo(x0 + iw - 20, ground);
      g.fill();
      g.fillStyle = 'rgba(90,70,50,0.55)'; // panache
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.arc(cx + k * 14, y0 + 40 - k * 6, 14 + k * 3, 0, Math.PI * 2);
        g.fill();
      }
    } else if (i === 4) {
      g.fillStyle = '#7e8a8a';
      g.fillRect(x0, ground, iw, ih);
      g.fillStyle = '#3a2814';
      g.beginPath();
      g.moveTo(x0 + 40, ground - 20);
      g.lineTo(x0 + iw - 30, ground - 20);
      g.lineTo(x0 + iw - 55, ground + 8);
      g.lineTo(x0 + 55, ground + 8);
      g.fill();
      g.fillRect(x0 + 80, ground - 40, 200, 20);
      for (let k = 0; k < 4; k++) {
        g.fillStyle = k % 2 ? '#3a2814' : '#8e2a1a';
        g.fillRect(x0 + 110 + k * 45, ground - 78, 22, 38);
      }
      g.fillStyle = 'rgba(80,70,60,0.4)';
      for (let k = 0; k < 4; k++) g.fillRect(x0 + 105 + k * 45 - k * 6, ground - 100 - k * 4, 30, 18);
    } else {
      g.fillStyle = '#7a6a50';
      g.fillRect(x0, ground, iw, ih);
      g.beginPath();
      g.arc(cx, y0 + 55, 40, 0, Math.PI * 2);
      g.fillStyle = '#8e2a1a';
      g.fill();
      g.strokeStyle = '#e9dcbc';
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.ellipse(cx, y0 + 55, Math.abs(k) * 14 + 2, 40, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = '#4a3018';
      g.beginPath();
      g.moveTo(cx - 30, y0 + 80);
      g.lineTo(cx - 12, y0 + 112);
      g.moveTo(cx + 30, y0 + 80);
      g.lineTo(cx + 12, y0 + 112);
      g.stroke();
      g.fillStyle = '#5a3e22';
      g.fillRect(cx - 14, y0 + 110, 28, 16);
    }
    g.restore();
    g.strokeStyle = '#6a4a26';
    g.lineWidth = 3;
    g.strokeRect(x0, y0, iw, ih);
    g.fillStyle = '#4a2e14';
    g.font = 'italic 24px "Segoe Script", Georgia, serif';
    g.textAlign = 'center';
    g.fillText(scenes[i % scenes.length], w / 2, h - 18);
    grain(g, w, h, 4000, 0.18);
  });
}
