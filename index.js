// File: index.js - Bot + Web Server (27 khung/giây, đổi server/acc trên web)
const mineflayer = require('mineflayer');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const ui = require('./interface');
const { takeSnapshot, getPose } = require('./screens');

app.use(express.json());
process.on('uncaughtException', (e) => console.log('[LOI]', e.message));

const FPS = 27;

const config = {
  host: 'kingmc.vn',
  port: 25565,
  username: 'ipttdup',
  version: '1.20.1', // để trống = tự dò phiên bản
  auth: 'offline'    // offline | microsoft
};
let loginPass = '';  // chỉ giữ trong bộ nhớ, không gửi ra trang web

let bot = null;
let farmInterval = null;
let randomMoveInterval = null;
let xyzInterval = null;
let poseInterval = null;
let snapInterval = null;
let botStatus = "Chưa kết nối";
let currentXYZ = "X: 0 | Y: 0 | Z: 0";
let isRandomMoving = false;
let lastSnap = null;
const moveTimers = {};

app.get('/', (req, res) => {
  res.send(ui.getHtmlPage(config, botStatus, currentXYZ, FPS));
});

io.on('connection', (socket) => {
  socket.emit('statusUpdate', { status: botStatus, xyz: currentXYZ, isRandomMoving: isRandomMoving });
  if (lastSnap) socket.emit('snap', lastSnap);
});

setInterval(() => {
  io.emit('statusUpdate', { status: botStatus, xyz: currentXYZ, isRandomMoving: isRandomMoving });
}, 1500);

function clearBotIntervals() {
  clearInterval(farmInterval);
  clearInterval(randomMoveInterval);
  clearInterval(xyzInterval);
  clearInterval(poseInterval);
  clearInterval(snapInterval);
}

function sendSnapshot() {
  if (!bot || io.engine.clientsCount === 0) return;
  try {
    const s = takeSnapshot(bot);
    if (!s) return;
    if (lastSnap && lastSnap.ox === s.ox && lastSnap.oy === s.oy && lastSnap.oz === s.oz &&
        lastSnap.data.equals(s.data)) return; // không đổi thì khỏi gửi
    lastSnap = s;
    io.emit('snap', s);
  } catch (e) { /* bỏ qua */ }
}

function stopBot() {
  clearBotIntervals();
  isRandomMoving = false;
  if (bot) {
    const old = bot;
    bot = null;
    try { old.quit(); } catch (e) {}
    try { old.end(); } catch (e) {}
  }
  lastSnap = null;
  botStatus = "Bot đã ngắt kết nối.";
  io.emit('botOff');
}

function connectBot() {
  if (bot) return;
  botStatus = "Đang kết nối vào " + config.host + ":" + config.port + " ...";

  const opts = {
    host: config.host,
    port: config.port,
    username: config.username,
    auth: config.auth
  };
  if (config.version) opts.version = config.version;
  if (config.auth === 'microsoft') {
    opts.profilesFolder = './auth-cache';
    opts.onMsaCode = (data) => {
      botStatus = "Chờ đăng nhập Microsoft (xem khung chat bên dưới)";
      io.emit('minecraftChat', '[MICROSOFT] ' + data.message);
    };
  }

  let b;
  try {
    b = mineflayer.createBot(opts);
  } catch (e) {
    botStatus = "Không tạo được bot: " + e.message;
    return;
  }
  bot = b;

  b.on('login', () => {
    if (bot !== b) return;
    botStatus = "Đang ở Sảnh chờ Lobby (Hãy gõ lệnh đăng nhập)";
  });

  b.on('spawn', () => {
    if (bot !== b) return;
    clearBotIntervals();

    // Tự /login nếu bạn có nhập mật khẩu trong form
    if (loginPass && !b._autoLoginDone) {
      b._autoLoginDone = true;
      setTimeout(() => { if (bot === b) b.chat('/login ' + loginPass); }, 2500);
    }

    xyzInterval = setInterval(() => {
      if (bot === b && b.entity && b.entity.position) {
        const pos = b.entity.position;
        currentXYZ = `X: ${Math.round(pos.x)} | Y: ${Math.round(pos.y)} | Z: ${Math.round(pos.z)}`;
        if (Math.round(pos.z) > 40 || Math.round(pos.x) > 10) {
          botStatus = "Đã vào thế giới chính cụm KingSMP thành công! 🎉";
        }
      }
    }, 1000);

    // Vị trí + hướng nhìn: 27 lần/giây
    poseInterval = setInterval(() => {
      if (bot !== b || io.engine.clientsCount === 0) return;
      const pose = getPose(b);
      if (pose) io.volatile.emit('pose', pose);
    }, Math.round(1000 / FPS));

    // Dữ liệu block: 2 lần/giây (trình duyệt tự vẽ từ dữ liệu này)
    snapInterval = setInterval(sendSnapshot, 500);
    setTimeout(sendSnapshot, 800);

    farmInterval = setInterval(() => {
      if (bot === b && b.entity) {
        const target = b.nearestEntity((entity) => entity.type === 'mob');
        if (target) b.attack(target);
      }
    }, 1000);
  });

  b.on('message', (jsonMsg) => {
    io.emit('minecraftChat', jsonMsg.toString());
  });

  b.on('kicked', (reason) => {
    io.emit('minecraftChat', '[KICK] ' + (typeof reason === 'string' ? reason : JSON.stringify(reason)));
  });

  b.on('windowOpen', () => { if (bot === b) botStatus = "Menu Đồng hồ đã mở! Sẵn sàng click ô 24."; });
  b.on('error', (err) => { if (bot === b) botStatus = "Lỗi hệ thống: " + err.message; });
  b.on('end', () => {
    if (bot !== b) return;
    bot = null;
    isRandomMoving = false;
    clearBotIntervals();
    lastSnap = null;
    botStatus = "Bot đã ngắt kết nối.";
    io.emit('botOff');
  });
}

// ---------- API ----------
app.post('/api/start', (req, res) => {
  const body = req.body || {};
  let host = String(body.host || '').trim();
  const m = host.match(/^(.+):(\d+)$/); // cho phép gõ ip:port
  let port = parseInt(body.port, 10);
  if (m) { host = m[1]; port = parseInt(m[2], 10); }
  if (host) config.host = host;
  config.port = (port > 0 && port < 65536) ? port : 25565;
  const username = String(body.username || '').trim();
  if (username) config.username = username;
  config.version = String(body.version || '').trim();
  config.auth = body.auth === 'microsoft' ? 'microsoft' : 'offline';
  loginPass = String(body.loginPass || '');

  if (bot) {
    stopBot();
    setTimeout(connectBot, 1500);
  } else {
    connectBot();
  }
  res.sendStatus(200);
});

app.post('/api/stop', (req, res) => { stopBot(); res.sendStatus(200); });
app.post('/api/chat', (req, res) => { if (bot && req.body.text) bot.chat(String(req.body.text)); res.sendStatus(200); });
app.post('/api/tpaccept', (req, res) => { if (bot) bot.chat('/tpaccept'); res.sendStatus(200); });

app.post('/api/look', (req, res) => {
  const yaw = Number(req.body.yaw);
  const pitch = Number(req.body.pitch);
  if (bot && bot.entity && isFinite(yaw) && isFinite(pitch)) {
    bot.look(yaw, Math.max(-1.5, Math.min(1.5, pitch)), true).catch(() => {});
  }
  res.sendStatus(200);
});

app.post('/api/move', (req, res) => {
  if (bot && bot.entity) {
    const dir = req.body.dir;
    if (['forward', 'back', 'left', 'right', 'jump'].includes(dir)) {
      clearTimeout(moveTimers[dir]);
      bot.setControlState(dir, true);
      moveTimers[dir] = setTimeout(() => { if (bot) bot.setControlState(dir, false); }, dir === 'jump' ? 400 : 500);
    }
  }
  res.sendStatus(200);
});

app.post('/api/toggle-random', (req, res) => {
  if (!bot) return res.sendStatus(200);
  isRandomMoving = !isRandomMoving;
  clearInterval(randomMoveInterval);
  if (isRandomMoving) {
    randomMoveInterval = setInterval(() => {
      if (bot && bot.entity) {
        const yaw = (Math.random() * 360) * (Math.PI / 180);
        const pitch = ((Math.random() * 40) - 20) * (Math.PI / 180);
        bot.look(yaw, pitch, true);
        const moves = ['forward', 'back', 'left', 'right', 'jump'];
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        bot.setControlState(randomMove, true);
        setTimeout(() => { if (bot) bot.setControlState(randomMove, false); }, 400);
      }
    }, 4000);
  }
  res.sendStatus(200);
});

app.post('/api/open-menu', (req, res) => {
  if (bot) { bot.setQuickBarSlot(4); setTimeout(() => { if (bot) bot.activateItem(); }, 1000); }
  res.sendStatus(200);
});

app.post('/api/click-kingsmp', (req, res) => {
  if (bot) bot.clickWindow(24, 0, 0).catch(e => console.log(e.message));
  res.sendStatus(200);
});

http.listen(process.env.PORT || 3000, () => { console.log('Web server san sang.'); });
