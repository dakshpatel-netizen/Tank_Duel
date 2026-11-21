import type { MapId, MapSizeId } from '../../shared/config';
import { buildMap } from '../../shared/maps/index';
import type { MapDefinition } from '../../shared/types';

const thumbCache = new Map<string, string>();

// Renders a 640x360 stylized top-down map preview directly from map data (Section 16 & 30.2)
export function renderMapThumbnailDataUrl(mapId: MapId, size: MapSizeId = 'medium'): string {
  const key = `${mapId}_${size}`;
  const cached = thumbCache.get(key);
  if (cached) return cached;

  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const map = buildMap(mapId, size);
  drawMapTopDown(ctx, map, 640, 360, true);
  const url = canvas.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}

export function drawMapTopDown(
  ctx: CanvasRenderingContext2D,
  map: MapDefinition,
  width: number,
  height: number,
  showDetails: boolean
): void {
  // Background matched to surrounding biome terrain
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, showDetails ? map.palette.groundAccent : '#0C122D');
  grad.addColorStop(1, showDetails ? map.palette.fog : '#182452');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const padPx = showDetails ? 18 : 6;
  const availW = width - padPx * 2;
  const availH = height - padPx * 2;
  const scale = Math.min(availW / map.width, availH / map.depth);
  const ox = width * 0.5;
  const oz = height * 0.5;

  const tx = (x: number) => ox + x * scale;
  const tz = (z: number) => oz + z * scale;

  // Arena floor
  const fw = map.width * scale;
  const fd = map.depth * scale;
  ctx.save();
  ctx.fillStyle = map.palette.ground;
  ctx.fillRect(ox - fw * 0.5, oz - fd * 0.5, fw, fd);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  const step = 20 * scale;
  for (let gx = ox - fw * 0.5; gx <= ox + fw * 0.5; gx += step) {
    ctx.beginPath();
    ctx.moveTo(gx, oz - fd * 0.5);
    ctx.lineTo(gx, oz + fd * 0.5);
    ctx.stroke();
  }
  for (let gz = oz - fd * 0.5; gz <= oz + fd * 0.5; gz += step) {
    ctx.beginPath();
    ctx.moveTo(ox - fw * 0.5, gz);
    ctx.lineTo(ox + fw * 0.5, gz);
    ctx.stroke();
  }

  // Twin bases red/blue halves tint
  if (map.id === 'twin_bases') {
    ctx.fillStyle = 'rgba(255, 77, 94, 0.18)';
    ctx.fillRect(ox - fw * 0.5, oz - fd * 0.5, fw * 0.44, fd);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.18)';
    ctx.fillRect(ox + fw * 0.06, oz - fd * 0.5, fw * 0.44, fd);
  }

  // Crater hill center glow
  if (map.id === 'crater_hill') {
    const cg = ctx.createRadialGradient(ox, oz, 2, ox, oz, 30 * scale);
    cg.addColorStop(0, 'rgba(255, 110, 40, 0.55)');
    cg.addColorStop(1, 'rgba(255, 110, 40, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(ox, oz, 30 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Terrain zones (ice, mud, speed pads)
  for (const z of map.zones) {
    if (z.type === 'ice') {
      ctx.fillStyle = 'rgba(147, 225, 255, 0.72)';
      ctx.beginPath();
      ctx.arc(tx(z.x), tz(z.z), (z.r ?? 20) * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (z.type === 'mud') {
      ctx.fillStyle = 'rgba(84, 58, 34, 0.78)';
      ctx.beginPath();
      ctx.arc(tx(z.x), tz(z.z), (z.r ?? 8) * scale, 0, Math.PI * 2);
      ctx.fill();
    } else if (z.type === 'speed_pad' && z.w && z.d) {
      ctx.fillStyle = '#00E5C3';
      ctx.fillRect(tx(z.x - z.w * 0.5), tz(z.z - z.d * 0.5), z.w * scale, z.d * scale);
    }
  }

  // Walls & Containers
  for (const w of map.walls) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(tx(w.x - w.w * 0.5) + 2, tz(w.z - w.d * 0.5) + 2, w.w * scale, w.d * scale);
    ctx.fillStyle = w.kind === 'container' ? '#334155' : w.kind === 'hedge' ? '#1E4620' : map.palette.wallColor;
    ctx.fillRect(tx(w.x - w.w * 0.5), tz(w.z - w.d * 0.5), Math.max(2, w.w * scale), Math.max(2, w.d * scale));
  }

  // Rocks
  for (const r of map.rocks) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.arc(tx(r.x) + 2, tz(r.z) + 2, r.r * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = map.palette.rockColor;
    ctx.beginPath();
    ctx.arc(tx(r.x), tz(r.z), r.r * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trees
  for (const t of map.trees) {
    ctx.fillStyle = 'rgba(30, 95, 42, 0.85)';
    ctx.beginPath();
    ctx.arc(tx(t.x), tz(t.z), Math.max(2, 1.8 * scale), 0, Math.PI * 2);
    ctx.fill();
  }

  if (showDetails) {
    // Crates & Barrels
    ctx.fillStyle = '#B47B44';
    for (const c of map.crates) {
      ctx.fillRect(tx(c.x) - 2, tz(c.z) - 2, 4, 4);
    }
    ctx.fillStyle = '#FF4D6D';
    for (const b of map.barrels) {
      ctx.beginPath();
      ctx.arc(tx(b.x), tz(b.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Power pads
    for (const p of map.pads) {
      ctx.fillStyle = '#FFC83D';
      ctx.fillRect(tx(p.x) - 3, tz(p.z) - 3, 6, 6);
    }

    // Spawns
    for (const sp of map.spawns) {
      ctx.strokeStyle = '#00E5C3';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tx(sp.x), tz(sp.z), 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // CTF bases or Hill spots
    if (map.ctfBases) {
      ctx.fillStyle = '#FF4D5E';
      ctx.beginPath();
      ctx.arc(tx(map.ctfBases.red.flagX), tz(map.ctfBases.red.flagZ), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.arc(tx(map.ctfBases.blue.flagX), tz(map.ctfBases.blue.flagZ), 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Perimeter border
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox - fw * 0.5, oz - fd * 0.5, fw, fd);
  ctx.restore();
}
