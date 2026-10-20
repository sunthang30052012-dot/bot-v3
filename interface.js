// File: interface.js - Web Panel + trình duyệt tự vẽ 3D ký tự và radar
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function getHtmlPage(config, botStatus, currentXYZ, fps) {
  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Minecraft Bot Ultimate Control Panel</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #121212; color: #fff; margin: 0; padding: 20px; display: flex; justify-content: center; }
            .wrapper { display: grid; grid-template-columns: 380px 1fr; gap: 20px; background: #1e1e1e; padding: 25px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); align-items: start; max-width: 1250px; width: 100%; box-sizing: border-box; }
            .panel, .card { background: #252525; padding: 18px; border-radius: 10px; box-sizing: border-box; }
            .right { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
            .row2 { display: grid; grid-template-columns: 340px 1fr; gap: 20px; }
            h1, h3 { color: #4CAF50; margin-top: 0; margin-bottom: 10px; }
            h1 { font-size: 22px; }
            .status-box { background: #1a1a1a; padding: 10px; border-radius: 8px; margin-bottom: 15px; border-left: 5px solid #4CAF50; font-size: 14px; }
            .status-box p { margin: 3px 0; }
            .btn { background: #4CAF50; color: white; border: none; padding: 9px 12px; margin: 3px; font-size: 13px; font-weight: bold; border-radius: 5px; cursor: pointer; width: 46%; }
            .btn:hover { background: #45a049; }
            .btn-danger { background: #f44336; }
            .btn-warning { background: #ff9800; }
            .btn-active { background: #00bcd4 !important; }
            .btn-small { width: auto; padding: 5px 10px; margin: 0; font-size: 12px; }
            .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
            .form-grid label { font-size: 11px; color: #aaa; display: flex; flex-direction: column; gap: 2px; }
            .form-grid .full { grid-column: 1 / -1; }
            input[type="text"], input[type="password"], input[type="number"], select { padding: 7px; border-radius: 5px; border: 1px solid #444; background: #111; color: white; font-size: 13px; box-sizing: border-box; width: 100%; }
            .wasd-wrapper { display: grid; grid-template-columns: repeat(3, 45px); grid-template-rows: repeat(2, 45px); gap: 6px; justify-content: center; margin: 10px 0; }
            .wasd-btn { background: #333; color: white; border: 2px solid #555; font-size: 15px; font-weight: bold; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
            .wasd-btn:active { background: #4CAF50; }
            .ctrl { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-size: 12px; margin-bottom: 8px; color: #ccc; }
            .ctrl select { width: auto; }
            canvas { display: block; background: #000; border: 1px solid #444; border-radius: 8px; touch-action: none; cursor: grab; }
            #view { width: 100%; height: auto; }
            #radar { width: 100%; max-width: 340px; height: auto; }
            .hint { font-size: 11px; color: #888; margin-top: 6px; }
            .chat-log { background: #000; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #00ff00; padding: 10px; border-radius: 8px; overflow-y: auto; height: 250px; text-align: left; white-space: pre-wrap; border: 1px solid #444; }
            .input-group { display: flex; margin-top: 10px; gap: 5px; }
            .input-group input { flex: 1; }
            @media (max-width: 1000px) { .wrapper { grid-template-columns: 1fr; } .row2 { grid-template-columns: 1fr; } }
        </style>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const FPS = ${fps};
            const socket = io();

            // ---------- Trạng thái ----------
            let snap = null;        // dữ liệu block quanh bot
            let pose = null;        // vị trí + hướng nhìn + thực thể
            let camYaw = 0, camPitch = 0;
            let follow = true;      // true = camera theo hướng nhìn của bot
            let syncLook = false;   // true = kéo chuột thì bot quay đầu thật
            let fov = 80;
            let W = 100, H = 34;    // số ký tự ngang/dọc của màn hình 3D
            let frames = 0, poses = 0;

            socket.on('statusUpdate', (data) => {
                document.getElementById('status').innerText = data.status;
                document.getElementById('xyz').innerText = data.xyz;
                const randBtn = document.getElementById('btn-rand');
                if (data.isRandomMoving) { randBtn.classList.add('btn-active'); randBtn.innerText = "🛑 Tắt Chạy Tự Động"; }
                else { randBtn.classList.remove('btn-active'); randBtn.innerText = "🎲 Bật Chạy Tự Động"; }
            });
            socket.on('minecraftChat', (msg) => {
                const log = document.getElementById('chatLog');
                if (log.innerText.length > 20000) log.innerText = log.innerText.slice(-10000);
                log.innerText += msg + '\\n';
                log.scrollTop = log.scrollHeight;
            });
            socket.on('snap', (s) => {
                if (!s) { snap = null; return; }
                snap = { ox: s.ox, oy: s.oy, oz: s.oz, sx: s.sx, sy: s.sy, sz: s.sz, grid: new Uint8Array(s.data) };
            });
            socket.on('pose', (p) => { pose = p; poses++; });
            socket.on('botOff', () => { snap = null; pose = null; });

            async function sendAction(endpoint, data) {
                await fetch('/api/' + endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data || {})
                });
            }
            function sendChat() {
                const input = document.getElementById('chatInput');
                if (input.value) { sendAction('chat', { text: input.value }); input.value = ''; }
            }
            function val(id) { return document.getElementById(id).value; }
            function startBot() {
                sendAction('start', {
                    host: val('cfgHost'), port: val('cfgPort'), username: val('cfgUser'),
                    version: val('cfgVer'), auth: val('cfgAuth'), loginPass: val('cfgPass')
                });
            }

            // ---------- Màu và ký tự ----------
            const BASE = [null,
                [150,150,155], [134,96,67], [95,159,53], [219,207,163], [102,81,51], [162,130,78],
                [58,125,30], [50,90,220], [250,120,20], [235,245,250], [190,190,190]];
            const GLY = [' ', '=', ',', '.', ':', '|', '+', '%', '~', '!', '*', '#'];
            const RAMP = '@#%*+=-:.';
            const FACE = [0.85, 1.0, 0.7, 0.5]; // mặt x, mặt trên, mặt z, mặt dưới
            const colorCache = {};
            function colorOf(cls, face, shade) {
                const key = cls * 100 + face * 10 + shade;
                let c = colorCache[key];
                if (!c) {
                    const b = BASE[cls];
                    const k = FACE[face] * (1 - 0.6 * shade / 7);
                    c = 'rgb(' + Math.round(b[0] * k) + ',' + Math.round(b[1] * k) + ',' + Math.round(b[2] * k) + ')';
                    colorCache[key] = c;
                }
                return c;
            }
            const bgCache = {};
            function bgOf(cls) {
                let c = bgCache[cls];
                if (!c) { const b = BASE[cls]; c = 'rgba(' + b[0] + ',' + b[1] + ',' + b[2] + ',0.30)'; bgCache[cls] = c; }
                return c;
            }
            function entColor(t) { return t === 0 ? '#4fc3f7' : (t === 1 ? '#ff5252' : '#ffd54f'); }
            function entChar(t) { return t === 0 ? 'P' : (t === 1 ? 'M' : 'm'); }

            // ---------- Bắn tia qua lưới block (DDA) ----------
            const MAXD = 18;
            let hitCls = 0, hitT = 0, hitFace = 0;
            function cast(ex, ey, ez, dx, dy, dz, maxT) {
                const g = snap.grid, ox = snap.ox, oy = snap.oy, oz = snap.oz;
                const sx = snap.sx, sy = snap.sy, sz = snap.sz;
                let x = Math.floor(ex), y = Math.floor(ey), z = Math.floor(ez);
                const stx = dx > 0 ? 1 : -1, sty = dy > 0 ? 1 : -1, stz = dz > 0 ? 1 : -1;
                const tdx = dx !== 0 ? Math.abs(1 / dx) : 1e30;
                const tdy = dy !== 0 ? Math.abs(1 / dy) : 1e30;
                const tdz = dz !== 0 ? Math.abs(1 / dz) : 1e30;
                let tmx = dx > 0 ? (x + 1 - ex) * tdx : (ex - x) * tdx;
                let tmy = dy > 0 ? (y + 1 - ey) * tdy : (ey - y) * tdy;
                let tmz = dz > 0 ? (z + 1 - ez) * tdz : (ez - z) * tdz;
                if (dx === 0) tmx = 1e30;
                if (dy === 0) tmy = 1e30;
                if (dz === 0) tmz = 1e30;
                let t = 0, face = 0;
                for (let i = 0; i < 200; i++) {
                    const gx = x - ox, gy = y - oy, gz = z - oz;
                    if (gx < 0 || gx >= sx || gy < 0 || gy >= sy || gz < 0 || gz >= sz) return false;
                    const v = g[(gy * sz + gz) * sx + gx];
                    if (v) { hitCls = v; hitT = t; hitFace = face; return true; }
                    if (tmx < tmy && tmx < tmz) { x += stx; t = tmx; tmx += tdx; face = 0; }
                    else if (tmy < tmz) { y += sty; t = tmy; tmy += tdy; face = dy > 0 ? 3 : 1; }
                    else { z += stz; t = tmz; tmz += tdz; face = 2; }
                    if (t > maxT) return false;
                }
                return false;
            }

            // ---------- Canvas ----------
            const vc = document.getElementById('view');
            const rc = document.getElementById('radar');
            const vg = vc.getContext('2d');
            const rg = rc.getContext('2d');
            let lastSizeKey = '';
            let depth = new Float32Array(W * H);

            function ensureSize() {
                const dpr = window.devicePixelRatio || 1;
                const cssW = vc.clientWidth || 600;
                const rcW = rc.clientWidth || 300;
                const key = cssW + '|' + rcW + '|' + W + '|' + H + '|' + dpr;
                if (key === lastSizeKey) return;
                lastSizeKey = key;
                vc.width = Math.round(cssW * dpr);
                vc.height = Math.round(cssW * dpr * (H * 2 / W));
                rc.width = Math.round(rcW * dpr);
                rc.height = rc.width;
                if (depth.length !== W * H) depth = new Float32Array(W * H);
            }

            function renderView() {
                const cw = vc.width / W, ch = vc.height / H;
                vg.setTransform(1, 0, 0, 1, 0, 0);
                vg.fillStyle = '#000';
                vg.fillRect(0, 0, vc.width, vc.height);
                vg.textAlign = 'center';
                vg.textBaseline = 'middle';
                if (!snap || !pose) {
                    vg.fillStyle = '#00ff00';
                    vg.font = 'bold ' + Math.round(cw * 1.6) + 'px monospace';
                    vg.fillText('Bot chưa bật hoặc chưa vào game...', vc.width / 2, vc.height / 2);
                    return;
                }
                if (follow) { camYaw = pose.yaw; camPitch = pose.pitch; }

                const sy_ = Math.sin(camYaw), cy_ = Math.cos(camYaw);
                const sp = Math.sin(camPitch), cp = Math.cos(camPitch);
                const bfx = -sy_ * cp, bfy = sp, bfz = -cy_ * cp;   // hướng nhìn
                const brx = cy_, brz = -sy_;                         // bên phải
                const bux = sy_ * sp, buy = cp, buz = cy_ * sp;      // hướng lên
                const tanH = Math.tan(fov * Math.PI / 360);
                const tanV = tanH * (vc.height / vc.width);
                const ex = pose.x, ey = pose.y + 1.62, ez = pose.z;

                vg.font = 'bold ' + Math.round(cw / 0.6) + 'px "Courier New", monospace';
                let lastColor = '';
                for (let r = 0; r < H; r++) {
                    const ny = (1 - (r + 0.5) / H * 2) * tanV;
                    for (let c = 0; c < W; c++) {
                        const nx = ((c + 0.5) / W * 2 - 1) * tanH;
                        let dx = bfx + nx * brx + ny * bux;
                        let dy = bfy + ny * buy;
                        let dz = bfz + nx * brz + ny * buz;
                        const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
                        dx *= inv; dy *= inv; dz *= inv;
                        if (cast(ex, ey, ez, dx, dy, dz, MAXD)) {
                            depth[r * W + c] = hitT;
                            let g;
                            if (hitCls === 8) g = '~';
                            else if (hitCls === 9) g = '!';
                            else g = RAMP[Math.min(RAMP.length - 1, Math.floor(hitT / MAXD * RAMP.length))];
                            const col = colorOf(hitCls, hitFace, Math.min(7, Math.floor(hitT / MAXD * 8)));
                            if (col !== lastColor) { vg.fillStyle = col; lastColor = col; }
                            vg.fillText(g, (c + 0.5) * cw, (r + 0.5) * ch);
                        } else {
                            depth[r * W + c] = 1e9;
                        }
                    }
                }

                // Vẽ mob và người chơi
                for (const e of pose.ents) {
                    const evx = e[0] - ex, evy = e[1] + 0.9 - ey, evz = e[2] - ez;
                    const zf = evx * bfx + evy * bfy + evz * bfz;
                    if (zf < 0.5) continue;
                    const xr = evx * brx + evz * brz;
                    const yu = evx * bux + evy * buy + evz * buz;
                    const ecol = (xr / zf / tanH + 1) / 2 * W;
                    const erow = (1 - yu / zf / tanV) / 2 * H;
                    const ci = Math.floor(ecol), ri = Math.floor(erow);
                    if (ci < 0 || ci >= W || ri < 0 || ri >= H) continue;
                    const dist = Math.sqrt(evx * evx + evy * evy + evz * evz);
                    if (dist > depth[ri * W + ci] + 0.5) continue; // bị tường che
                    const hh = Math.max(1, Math.min(10, Math.round(1.8 / (zf * tanV) * H / 2)));
                    const ww = Math.max(1, Math.min(6, Math.round(0.6 / (zf * tanH) * W / 2)));
                    const r0 = Math.round(erow - hh / 2), c0 = Math.round(ecol - ww / 2);
                    vg.fillStyle = entColor(e[3]);
                    const glyph = entChar(e[3]);
                    for (let rr = 0; rr < hh; rr++) {
                        for (let cc = 0; cc < ww; cc++) {
                            const R2 = r0 + rr, C2 = c0 + cc;
                            if (R2 < 0 || R2 >= H || C2 < 0 || C2 >= W) continue;
                            vg.fillText(glyph, (C2 + 0.5) * cw, (R2 + 0.5) * ch);
                        }
                    }
                    if (e[3] === 0 && e[4]) vg.fillText(e[4], ecol * cw, (r0 - 0.8) * ch);
                }

                // Tâm ngắm + thông tin góc
                vg.fillStyle = 'rgba(255,255,255,0.85)';
                vg.fillText('+', vc.width / 2, vc.height / 2);
                vg.textAlign = 'left';
                vg.textBaseline = 'top';
                vg.font = Math.round(cw * 1.5) + 'px monospace';
                vg.fillStyle = 'rgba(0,255,0,0.85)';
                vg.fillText((follow ? 'THEO BOT' : 'CAMERA TỰ DO') + '  FOV ' + Math.round(fov), cw, ch * 0.3);
            }

            const RR = 11; // radar: 23 x 23 ô
            function renderRadar() {
                const N = RR * 2 + 1;
                const cell = rc.width / N;
                rg.setTransform(1, 0, 0, 1, 0, 0);
                rg.fillStyle = '#000';
                rg.fillRect(0, 0, rc.width, rc.height);
                rg.textAlign = 'center';
                rg.textBaseline = 'middle';
                if (!snap || !pose) return;

                const cyv = Math.cos(camYaw), syv = Math.sin(camYaw);
                const by = Math.floor(pose.y) - snap.oy;
                rg.font = 'bold ' + Math.round(cell * 0.9) + 'px "Courier New", monospace';

                for (let j = 0; j < N; j++) {
                    for (let i = 0; i < N; i++) {
                        const u = i - RR, v = RR - j; // u: sang phải, v: phía trước
                        const wx = Math.floor(pose.x + u * cyv - v * syv) - snap.ox;
                        const wz = Math.floor(pose.z - u * syv - v * cyv) - snap.oz;
                        if (wx < 0 || wx >= snap.sx || wz < 0 || wz >= snap.sz) continue;
                        let cls = 0, dyv = 0;
                        for (let gy = Math.min(snap.sy - 1, by + 3); gy >= Math.max(0, by - 4); gy--) {
                            const q = snap.grid[(gy * snap.sz + wz) * snap.sx + wx];
                            if (q) { cls = q; dyv = gy - by; break; }
                        }
                        if (!cls) continue;
                        const wall = dyv >= 1 && cls !== 8;
                        rg.fillStyle = bgOf(cls);
                        rg.fillRect(i * cell, j * cell, cell, cell);
                        rg.fillStyle = wall ? '#ffffff' : colorOf(cls, 1, 0);
                        rg.fillText(wall ? '#' : GLY[cls], (i + 0.5) * cell, (j + 0.5) * cell);
                    }
                }

                // Mob, người chơi
                for (const e of pose.ents) {
                    const ddx = e[0] - pose.x, ddz = e[2] - pose.z;
                    const u = ddx * cyv - ddz * syv;
                    const v = -ddx * syv - ddz * cyv;
                    const i = RR + Math.round(u), j = RR - Math.round(v);
                    if (i < 0 || i >= N || j < 0 || j >= N) continue;
                    rg.fillStyle = entColor(e[3]);
                    rg.fillRect(i * cell + 1, j * cell + 1, cell - 2, cell - 2);
                    rg.fillStyle = '#000';
                    rg.fillText(entChar(e[3]), (i + 0.5) * cell, (j + 0.5) * cell);
                }

                // Bot ở giữa
                rg.fillStyle = '#ffeb3b';
                rg.fillRect(RR * cell, RR * cell, cell, cell);
                rg.fillStyle = '#000';
                rg.fillText('@', (RR + 0.5) * cell, (RR + 0.5) * cell);

                // Vùng đang nhìn thấy (hai vạch) và hướng Bắc
                const rcx = rc.width / 2, rcy = rc.height / 2;
                const a = fov * Math.PI / 360;
                const L = RR * cell;
                rg.strokeStyle = 'rgba(255,255,255,0.55)';
                rg.lineWidth = 1;
                rg.beginPath();
                rg.moveTo(rcx, rcy);
                rg.lineTo(rcx - Math.sin(a) * L, rcy - Math.cos(a) * L);
                rg.moveTo(rcx, rcy);
                rg.lineTo(rcx + Math.sin(a) * L, rcy - Math.cos(a) * L);
                rg.stroke();
                const k = (RR - 0.3) * cell;
                rg.fillStyle = '#ff5252';
                rg.font = 'bold ' + Math.round(cell * 1.2) + 'px monospace';
                rg.fillText('N', rcx + syv * k, rcy - cyv * k);
            }

            function frame() {
                if (document.hidden) return;
                ensureSize();
                renderView();
                renderRadar();
                frames++;
            }
            setInterval(frame, Math.round(1000 / FPS));
            setInterval(() => {
                document.getElementById('stats').innerText =
                    'Vẽ: ' + frames + ' khung/s  |  Dữ liệu bot: ' + poses + '/s';
                frames = 0; poses = 0;
            }, 1000);

            // ---------- Tương tác: kéo để xoay, lăn để zoom ----------
            let lastLook = 0;
            function sendLook(force) {
                const now = Date.now();
                if (!force && now - lastLook < 80) return;
                lastLook = now;
                sendAction('look', { yaw: camYaw, pitch: camPitch });
            }
            function attachDrag(c) {
                let dragging = false, lx = 0, ly = 0;
                c.addEventListener('pointerdown', (e) => {
                    dragging = true; lx = e.clientX; ly = e.clientY;
                    c.setPointerCapture(e.pointerId);
                    c.style.cursor = 'grabbing';
                });
                c.addEventListener('pointermove', (e) => {
                    if (!dragging) return;
                    const dx = e.clientX - lx, dy = e.clientY - ly;
                    lx = e.clientX; ly = e.clientY;
                    follow = false;
                    camYaw -= dx * 0.006;
                    camPitch -= dy * 0.006;
                    camPitch = Math.max(-1.45, Math.min(1.45, camPitch));
                    if (syncLook) sendLook(false);
                });
                const end = () => {
                    if (!dragging) return;
                    dragging = false;
                    c.style.cursor = 'grab';
                    if (syncLook) sendLook(true);
                };
                c.addEventListener('pointerup', end);
                c.addEventListener('pointercancel', end);
                c.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    fov = Math.max(40, Math.min(110, fov + e.deltaY * 0.05));
                }, { passive: false });
            }
            attachDrag(vc);
            attachDrag(rc);

            function followBot() { follow = true; }
            function setSync(v) { syncLook = v; }
            function setQuality(v) {
                const q = v.split('x');
                W = parseInt(q[0], 10); H = parseInt(q[1], 10);
            }

            // Phím W A S D + Space
            const keyMap = { w: 'forward', a: 'left', s: 'back', d: 'right', ' ': 'jump' };
            let lastMove = 0;
            document.addEventListener('keydown', (e) => {
                const tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
                const dir = keyMap[e.key.toLowerCase()];
                if (!dir) return;
                e.preventDefault();
                const now = Date.now();
                if (now - lastMove < 120) return;
                lastMove = now;
                sendAction('move', { dir: dir });
            });
        </script>
    </head>
    <body>
        <div class="wrapper">
            <div class="panel">
                <h1>🎮 PANEL ĐIỀU KHIỂN</h1>
                <div class="status-box">
                    <p>🟢 Trạng thái: <span id="status">${esc(botStatus)}</span></p>
                    <p>📍 Tọa độ (XYZ): <span id="xyz">${esc(currentXYZ)}</span></p>
                </div>

                <h3>🌐 SERVER &amp; TÀI KHOẢN</h3>
                <div class="form-grid">
                    <label>IP / Tên miền server<input type="text" id="cfgHost" value="${esc(config.host)}"></label>
                    <label>Cổng<input type="number" id="cfgPort" value="${esc(config.port)}"></label>
                    <label>Tên tài khoản<input type="text" id="cfgUser" value="${esc(config.username)}"></label>
                    <label>Phiên bản (trống = tự dò)<input type="text" id="cfgVer" value="${esc(config.version)}" placeholder="vd: 1.20.1"></label>
                    <label>Kiểu đăng nhập
                        <select id="cfgAuth">
                            <option value="offline" ${config.auth === 'offline' ? 'selected' : ''}>Offline (server crack)</option>
                            <option value="microsoft" ${config.auth === 'microsoft' ? 'selected' : ''}>Microsoft (acc thật)</option>
                        </select>
                    </label>
                    <label>Mật khẩu /login (tùy chọn)<input type="password" id="cfgPass" autocomplete="off"></label>
                </div>
                <button class="btn" onclick="startBot()">🔌 Kết nối / Đổi server</button>
                <button class="btn btn-danger" onclick="sendAction('stop')">❌ Ngắt kết nối</button>

                <h3 style="margin-top:14px;">⚡ HỆ THỐNG VƯỢT ẢI</h3>
                <button class="btn btn-warning" onclick="sendAction('open-menu')">⏰ Mở Menu Đồng Hồ</button>
                <button class="btn btn-warning" onclick="sendAction('click-kingsmp')">🧱 Chọn ô 24 KingSMP</button>
                <button class="btn" onclick="sendAction('tpaccept')">🛸 Đồng ý /tpaccept</button>
                <button id="btn-rand" class="btn" onclick="sendAction('toggle-random')">🎲 Bật Chạy Tự Động</button>

                <h3 style="margin-top:14px;">🕹️ DI CHUYỂN WASD</h3>
                <div class="wasd-wrapper">
                    <div></div>
                    <button class="wasd-btn" onclick="sendAction('move', {dir: 'forward'})">W</button>
                    <div></div>
                    <button class="wasd-btn" onclick="sendAction('move', {dir: 'left'})">A</button>
                    <button class="wasd-btn" onclick="sendAction('move', {dir: 'back'})">S</button>
                    <button class="wasd-btn" onclick="sendAction('move', {dir: 'right'})">D</button>
                </div>
                <button class="btn" style="width:120px; display:block; margin:0 auto;" onclick="sendAction('move', {dir: 'jump'})">🦘 Nhảy (Space)</button>
                <div class="hint">Trên máy tính có thể bấm phím W A S D và Space.</div>
            </div>

            <div class="right">
                <div class="card">
                    <h3>👁️ GÓC NHÌN NGƯỜI CHƠI (mô phỏng 3D)</h3>
                    <div class="ctrl">
                        <span>Độ nét:
                            <select id="quality" onchange="setQuality(this.value)">
                                <option value="72x25">Thấp</option>
                                <option value="100x34" selected>Vừa</option>
                                <option value="140x48">Nét cao</option>
                            </select>
                        </span>
                        <label><input type="checkbox" onchange="setSync(this.checked)"> Bot nhìn theo camera</label>
                        <button class="btn btn-small" onclick="followBot()">🎯 Theo bot</button>
                        <span id="stats">...</span>
                    </div>
                    <canvas id="view"></canvas>
                    <div class="hint">Kéo chuột (hoặc vuốt) để xoay camera, lăn chuột để zoom. Radar xoay theo camera.</div>
                </div>

                <div class="row2">
                    <div class="card">
                        <h3>🗺️ RADAR (xoay theo camera)</h3>
                        <canvas id="radar"></canvas>
                        <div class="hint">@ bạn · P người · M quái · m động vật · # tường · N hướng Bắc</div>
                    </div>
                    <div class="card">
                        <h3>💬 KHUNG XEM CHAT GAME</h3>
                        <div id="chatLog" class="chat-log">--- Hệ thống chat sẵn sàng ---&#13;</div>
                        <div class="input-group">
                            <input type="text" id="chatInput" placeholder="Nhập lệnh hoặc chat..." onkeydown="if(event.key==='Enter') sendChat()">
                            <button class="btn" style="margin:0; width:60px;" onclick="sendChat()">Gửi</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}
module.exports = { getHtmlPage };
