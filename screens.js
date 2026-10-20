// File: screens.js - Màn hình mô phỏng 3D góc nhìn + Radar nhìn từ trên xuống

// ---------- MÀN HÌNH 1: GÓC NHÌN NGƯỜI CHƠI (bắn tia bằng ký tự) ----------
const VIEW_W = 56;
const VIEW_H = 20;
const FOV_H = 80 * Math.PI / 180;
const FOV_V = FOV_H * (VIEW_H / VIEW_W) * 2;
const MAX_DIST = 15;
const STEP = 0.35;
const WALL_CHARS = '@#%*=-:.';
const FLOOR_CHARS = '%*+=-:,.';

function shade(chars, dist) {
  const i = Math.min(chars.length - 1, Math.floor((dist / MAX_DIST) * chars.length));
  return chars[i];
}

function renderView(b) {
  if (!b || !b.entity) return 'Bot chưa vào game...';
  const eye = b.entity.position.offset(0, 1.62, 0);
  const yaw = b.entity.yaw;
  const pitch = b.entity.pitch;
  const lines = [];

  for (let r = 0; r < VIEW_H; r++) {
    const rp = pitch + (0.5 - (r + 0.5) / VIEW_H) * FOV_V;
    const cp = Math.cos(rp);
    const dy = Math.sin(rp);
    let line = '';

    for (let c = 0; c < VIEW_W; c++) {
      const a = ((c + 0.5) / VIEW_W - 0.5) * FOV_H;
      const ry = yaw - a;
      const dx = -Math.sin(ry) * cp;
      const dz = -Math.cos(ry) * cp;

      let ch = ' ';
      let pfx = Math.floor(eye.x), pfy = Math.floor(eye.y), pfz = Math.floor(eye.z);

      for (let d = STEP; d <= MAX_DIST; d += STEP) {
        const blk = b.blockAt(eye.offset(dx * d, dy * d, dz * d));
        if (!blk) continue;

        const fx = Math.floor(eye.x + dx * d);
        const fy = Math.floor(eye.y + dy * d);
        const fz = Math.floor(eye.z + dz * d);

        if (blk.name.includes('water')) { ch = '~'; break; }
        if (blk.name.includes('lava')) { ch = '!'; break; }
        if (blk.boundingBox === 'block') {
          const isFlatFace = (fy !== pfy && fx === pfx && fz === pfz);
          ch = isFlatFace ? shade(FLOOR_CHARS, d) : shade(WALL_CHARS, d);
          break;
        }
        pfx = fx; pfy = fy; pfz = fz;
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// ---------- MÀN HÌNH 2: RADAR NHÌN TỪ TRÊN XUỐNG ----------
const RADIUS = 8;

function blockChar(name) {
  if (name.includes('water')) return '~';
  if (name.includes('lava')) return '!';
  if (name.includes('leaves')) return '%';
  if (name.includes('log') || name.includes('wood')) return '|';
  if (name.includes('sand')) return ':';
  if (name.includes('snow') || name.includes('ice')) return '*';
  if (name.includes('grass') || name.includes('fern')) return '.';
  if (name.includes('dirt') || name.includes('path') || name.includes('mud')) return ',';
  if (name.includes('stone') || name.includes('deepslate') || name.includes('ore')) return '=';
  return '+';
}

function topBlock(b, base, dx, dz) {
  for (let dy = 3; dy >= -4; dy--) {
    const blk = b.blockAt(base.offset(dx, dy, dz));
    if (blk && blk.name !== 'air' && blk.name !== 'cave_air' && blk.name !== 'void_air') {
      return { block: blk, dy };
    }
  }
  return null;
}

function facing(yaw) {
  const deg = ((yaw * 180) / Math.PI + 360) % 360;
  const dirs = ['Bắc', 'Tây', 'Nam', 'Đông'];
  return dirs[Math.round(deg / 90) % 4];
}

function renderRadar(b) {
  if (!b || !b.entity) return 'Bot chưa vào game...';
  const base = b.entity.position.floored();

  const marks = new Map();
  for (const id in b.entities) {
    const e = b.entities[id];
    if (!e || e === b.entity || !e.position) continue;
    const dx = Math.floor(e.position.x) - base.x;
    const dz = Math.floor(e.position.z) - base.z;
    if (Math.abs(dx) > RADIUS || Math.abs(dz) > RADIUS) continue;
    if (e.type === 'player') marks.set(dx + ',' + dz, 'P');
    else if (e.type === 'mob' || e.type === 'hostile') marks.set(dx + ',' + dz, 'M');
  }

  const lines = [];
  for (let dz = -RADIUS; dz <= RADIUS; dz++) {
    const row = [];
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      let ch;
      if (dx === 0 && dz === 0) ch = '@';
      else if (marks.has(dx + ',' + dz)) ch = marks.get(dx + ',' + dz);
      else {
        const t = topBlock(b, base, dx, dz);
        if (!t) ch = ' ';
        else if (t.dy >= 1 && !t.block.name.includes('water')) ch = '#';
        else ch = blockChar(t.block.name);
      }
      row.push(ch);
    }
    lines.push(row.join(' '));
  }

  const header = 'Hướng nhìn: ' + facing(b.entity.yaw) + '  |  Bắc ↑\n';
  const legend = '\n@ Bot  P Người  M Mob  # Tường  . Cỏ  , Đất  = Đá  ~ Nước  ! Dung nham  | Gỗ  % Lá  : Cát';
  return header + lines.join('\n') + legend;
}

module.exports = { renderView, renderRadar };
