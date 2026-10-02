/**
 * Generates high quality realistic e-commerce product sample photos for instant 1-click testing.
 */

export interface SampleProduct {
  id: string;
  name: string;
  type: string;
  category: string;
  generate: () => Promise<File>;
}

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: 'sample-keychain',
    name: 'owl-keychain.png',
    type: 'Metal Keychain',
    category: 'Jewelry / Metal',
    generate: async () => {
      const res = await fetch('/samples/owl-keychain.png');
      const blob = await res.blob();
      return new File([blob], 'owl-keychain.png', { type: 'image/png' });
    },
  },
  {
    id: 'sample-sneaker',
    name: 'streetwear-sneaker.png',
    type: 'Sneakers',
    category: 'Footwear',
    generate: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d')!;

      // Studio white/light gray cyclorama background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1000);
      bgGrad.addColorStop(0, '#f8fafc');
      bgGrad.addColorStop(0.7, '#f1f5f9');
      bgGrad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1000, 1000);

      // Studio floor gradient shadow
      const floorGrad = ctx.createRadialGradient(500, 720, 50, 500, 720, 420);
      floorGrad.addColorStop(0, 'rgba(15, 23, 42, 0.25)');
      floorGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.08)');
      floorGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = floorGrad;
      ctx.beginPath();
      ctx.ellipse(500, 720, 380, 80, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sneaker Sole (Rubber bottom)
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(180, 680);
      ctx.bezierCurveTo(240, 710, 760, 710, 820, 660);
      ctx.bezierCurveTo(840, 640, 820, 600, 790, 600);
      ctx.bezierCurveTo(650, 620, 320, 620, 180, 650);
      ctx.closePath();
      ctx.fill();

      // Sole tread accents
      ctx.fillStyle = '#f97316'; // vibrant orange accent
      ctx.beginPath();
      ctx.ellipse(720, 650, 60, 18, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(280, 670, 70, 16, -0.05, 0, Math.PI * 2);
      ctx.fill();

      // Sneaker Upper (Dark Obsidian & Cyan mesh)
      const upperGrad = ctx.createLinearGradient(200, 300, 800, 700);
      upperGrad.addColorStop(0, '#0f172a');
      upperGrad.addColorStop(0.5, '#1e293b');
      upperGrad.addColorStop(1, '#0284c7');
      ctx.fillStyle = upperGrad;
      ctx.beginPath();
      ctx.moveTo(190, 650);
      ctx.bezierCurveTo(200, 520, 300, 480, 380, 450);
      ctx.bezierCurveTo(450, 360, 520, 320, 620, 340);
      ctx.bezierCurveTo(720, 360, 760, 440, 790, 600);
      ctx.bezierCurveTo(650, 620, 350, 620, 190, 650);
      ctx.closePath();
      ctx.fill();

      // Sneaker Collar & Tongue
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(560, 350, 80, 35, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Laces (Fine straps & details)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      const laceCoords = [
        [440, 470, 480, 430],
        [470, 450, 510, 410],
        [500, 430, 540, 390],
        [530, 410, 570, 370],
      ];
      for (const [x1, y1, x2, y2] of laceCoords) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Dynamic Swoosh logo
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(340, 560);
      ctx.quadraticCurveTo(520, 580, 680, 460);
      ctx.quadraticCurveTo(540, 530, 420, 520);
      ctx.closePath();
      ctx.fill();

      // Brand Typography
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('AIR RUNNER PRO', 360, 645);

      ctx.restore();

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      return new File([blob], 'streetwear-sneaker.png', { type: 'image/png' });
    },
  },
  {
    id: 'sample-cosmetics',
    name: 'luxury-fragrance.png',
    type: 'Cosmetics',
    category: 'Beauty',
    generate: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d')!;

      // Soft pastel studio backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, 1000, 1000);
      bgGrad.addColorStop(0, '#fdf4ff');
      bgGrad.addColorStop(1, '#fae8ff');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1000, 1000);

      // Pedestal
      ctx.fillStyle = '#e9d5ff';
      ctx.beginPath();
      ctx.ellipse(500, 760, 260, 40, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glass Bottle Body
      ctx.save();
      const glassGrad = ctx.createLinearGradient(350, 300, 650, 700);
      glassGrad.addColorStop(0, 'rgba(216, 180, 254, 0.9)');
      glassGrad.addColorStop(0.5, 'rgba(192, 132, 252, 0.95)');
      glassGrad.addColorStop(1, 'rgba(147, 51, 234, 0.9)');
      ctx.fillStyle = glassGrad;
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetY = 15;

      // Rounded rectangle bottle
      const x = 360, y = 380, w = 280, h = 340, r = 24;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();

      // Glass shine highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(385, 410, 28, 280);

      // Gold Nozzle & Neck
      ctx.fillStyle = '#eab308';
      ctx.fillRect(470, 320, 60, 60);

      // Gold Metallic Cap
      const capGrad = ctx.createLinearGradient(440, 200, 560, 320);
      capGrad.addColorStop(0, '#fef08a');
      capGrad.addColorStop(0.5, '#ca8a04');
      capGrad.addColorStop(1, '#854d0e');
      ctx.fillStyle = capGrad;
      ctx.fillRect(440, 200, 120, 120);

      // Product label text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px serif';
      ctx.fillText('LUMIÈRE NOIRE', 500, 530);
      ctx.font = '14px sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText('EAU DE PARFUM', 500, 560);
      ctx.fillText('100 ML • 3.4 FL. OZ', 500, 600);

      ctx.restore();

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      return new File([blob], 'luxury-fragrance.png', { type: 'image/png' });
    },
  },
  {
    id: 'sample-smartwatch',
    name: 'chronos-smartwatch.png',
    type: 'Electronics',
    category: 'Accessories',
    generate: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d')!;

      // Neutral light gray studio backdrop
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, 1000, 1000);

      // Studio soft ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.beginPath();
      ctx.ellipse(500, 780, 240, 50, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      // Watch Strap (Top and bottom silicone strap)
      const strapGrad = ctx.createLinearGradient(420, 100, 580, 900);
      strapGrad.addColorStop(0, '#0284c7');
      strapGrad.addColorStop(1, '#0369a1');
      ctx.fillStyle = strapGrad;

      // Top strap
      ctx.beginPath();
      ctx.roundRect(430, 120, 140, 280, 16);
      ctx.fill();

      // Bottom strap with pin holes
      ctx.beginPath();
      ctx.roundRect(430, 580, 140, 300, 16);
      ctx.fill();

      // Strap holes
      ctx.fillStyle = '#0f172a';
      for (let sy = 620; sy <= 820; sy += 35) {
        ctx.beginPath();
        ctx.ellipse(500, sy, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Titanium Watch Casing
      const caseGrad = ctx.createRadialGradient(480, 480, 50, 500, 500, 200);
      caseGrad.addColorStop(0, '#475569');
      caseGrad.addColorStop(0.8, '#1e293b');
      caseGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = caseGrad;
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 10;
      ctx.beginPath();
      ctx.arc(500, 500, 190, 0, Math.PI * 2);
      ctx.fill();

      // Crown button
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(690, 475, 20, 50);

      // OLED Screen
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(500, 500, 165, 0, Math.PI * 2);
      ctx.fill();

      // Screen UI display
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
      ctx.fillText('10:42', 500, 490);

      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('7,840 STEPS', 500, 540);

      ctx.fillStyle = '#f43f5e';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('♥ 72 BPM', 500, 575);

      ctx.restore();

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      return new File([blob], 'chronos-smartwatch.png', { type: 'image/png' });
    },
  },
];
