// File: screens.js - Chụp dữ liệu block + vị trí gửi cho trình duyệt tự vẽ
const R = 16;     // bán kính ngang
const DOWN = 8;   // số block phía dưới chân
const UP = 8;     // số block phía trên chân
const SX = R * 2 + 1;
const SZ = R * 2 + 1;
const SY = DOWN + UP + 1;

// 0 = trống, 1 đá, 2 đất, 3 cỏ, 4 cát, 5 gỗ thân, 6 ván gỗ,
// 7 lá, 8 nước, 9 dung nham, 10 tuyết/băng, 11 block khác
function classify(b) {
  if (!b) return 0;
  const n = b.name;
  if (n === 'air' || n === 'cave_air' || n === 'void_air') return 0;
  if (n === 'water') return 8;
  if (n === 'lava') return 9;
  if (b.boundingBox !== 'block') return 0; // cỏ dại, hoa, đuốc... coi như trống
  if (n.includes('leaves')) return 7;
  if (n === 'grass_block') return 3;
  if (n.includes('plank')) return 6;
  if (n.includes('log') || n.includes('wood')) return 5;
  if (n.includes('sand')) return 4;
  if (n.includes('snow') || n.includes('ice')) return 10;
  if (n.includes('dirt') || n.includes('path') || n.includes('mud') ||
      n.includes('farmland') || n.includes('podzol') || n.includes('mycelium') || n.includes('clay')) return 2;
  if (n.includes('stone') || n.includes('deepslate') || n.includes('andesite') ||
      n.includes('granite') || n.includes('diorite') || n.includes('bedrock') ||
      n.includes('_ore') || n.includes('tuff') || n.includes('basalt')) return 1;
  return 11;
}

function takeSnapshot(bot) {
  if (!bot || !bot.entity) return null;
  const p = bot.entity.position;
  const ox = Math.floor(p.x) - R;
  const oy = Math.floor(p.y) - DOWN;
  const oz = Math.floor(p.z) - R;
  const data = Buffer.alloc(SX * SY * SZ);
  const pt = p.clone();
  for (let y = 0; y < SY; y++) {
    for (let z = 0; z < SZ; z++) {
      for (let x = 0; x < SX; x++) {
        pt.x = ox + x;
        pt.y = oy + y;
        pt.z = oz + z;
        data[(y * SZ + z) * SX + x] = classify(bot.blockAt(pt, false));
      }
    }
  }
  return { ox, oy, oz, sx: SX, sy: SY, sz: SZ, data };
}

const r2 = (v) => Math.round(v * 100) / 100;

// Vị trí + hướng nhìn + thực thể xung quanh (gửi 27 lần/giây nên làm gọn)
function getPose(bot) {
  if (!bot || !bot.entity) return null;
  const p = bot.entity.position;
  const ents = [];
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || e === bot.entity || !e.position) continue;
    const dx = e.position.x - p.x;
    const dz = e.position.z - p.z;
    if (dx * dx + dz * dz > 400 || Math.abs(e.position.y - p.y) > 16) continue;
    let t = -1;
    if (e.type === 'player') t = 0;
    else if (e.type === 'hostile') t = 1;
    else if (e.type === 'mob' || e.type === 'animal' || e.type === 'passive' || e.type === 'living') t = 2;
    if (t < 0) continue;
    ents.push([r2(e.position.x), r2(e.position.y), r2(e.position.z), t, e.username || '']);
    if (ents.length >= 40) break;
  }
  return { x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(bot.entity.yaw), pitch: r2(bot.entity.pitch), ents };
}

module.exports = { takeSnapshot, getPose };
