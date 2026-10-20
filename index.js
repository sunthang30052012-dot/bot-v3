// File: index.js - Bot + Web Server
const mineflayer = require('mineflayer');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const ui = require('./interface');
const { renderView, renderRadar } = require('./screens');

app.use(express.json());

const config = {
  host: 'kingmc.vn',
  username: 'ipttdup',
  version: '1.20.1'
};

let bot = null;
let farmInterval = null;
let randomMoveInterval = null;
let xyzInterval = null;
let screenInterval = null;
let botStatus = "Chưa kết nối";
let currentXYZ = "X: 0 | Y: 0 | Z: 0";
let isRandomMoving = false;

app.get('/', (req, res) => {
  res.send(ui.getHtmlPage(config, botStatus, currentXYZ));
});

io.on('connection', (socket) => {
  socket.emit('statusUpdate', { status: botStatus, xyz: currentXYZ, isRandomMoving: isRandomMoving });
});

setInterval(() => {
  io.emit('statusUpdate', { status: botStatus, xyz: currentXYZ, isRandomMoving: isRandomMoving });
}, 1500);

function clearBotIntervals() {
  clearInterval(farmInterval);
  clearInterval(randomMoveInterval);
  clearInterval(xyzInterval);
  clearInterval(screenInterval);
}

function connectBot() {
  if (bot) return;
  botStatus = "Đang kết nối vào máy chủ...";

  bot = mineflayer.createBot({
    host: config.host,
    username: config.username,
    version: config.version
  });

  bot.on('login', () => {
    botStatus = "Đang ở Sảnh chờ Lobby (Hãy gõ lệnh đăng nhập)";
  });

  bot.on('spawn', () => {
    clearBotIntervals();

    xyzInterval = setInterval(() => {
      if (bot && bot.entity && bot.entity.position) {
        const pos = bot.entity.position;
        currentXYZ = `X: ${Math.round(pos.x)} | Y: ${Math.round(pos.y)} | Z: ${Math.round(pos.z)}`;
        if (Math.round(pos.z) > 40 || Math.round(pos.x) > 10) {
          botStatus = "Đã vào thế giới chính cụm KingSMP thành công! 🎉";
        }
      }
    }, 1000);

    screenInterval = setInterval(() => {
      try {
        io.emit('viewUpdate', renderView(bot));
        io.emit('radarUpdate', renderRadar(bot));
      } catch (e) {
        io.emit('viewUpdate', 'Lỗi màn hình: ' + e.message);
      }
    }, 1200);

    farmInterval = setInterval(() => {
      if (bot && bot.entity) {
        const target = bot.nearestEntity((entity) => entity.type === 'mob');
        if (target) bot.attack(target);
      }
    }, 1000);
  });

  bot.on('message', (jsonMsg) => {
    io.emit('minecraftChat', jsonMsg.toString());
  });

  bot.on('windowOpen', () => { botStatus = "Menu Đồng hồ đã mở! Sẵn sàng click ô 24."; });
  bot.on('error', (err) => { botStatus = "Lỗi hệ thống: " + err.message; });
  bot.on('end', () => {
    botStatus = "Bot đã ngắt kết nối.";
    bot = null;
    isRandomMoving = false;
    clearBotIntervals();
    io.emit('viewUpdate', 'Bot chưa bật hoặc chưa vào game...');
    io.emit('radarUpdate', 'Bot chưa bật hoặc chưa vào game...');
  });
}

app.post('/api/start', (req, res) => { connectBot(); res.sendStatus(200); });
app.post('/api/stop', (req, res) => { if (bot) bot.quit(); res.sendStatus(200); });
app.post('/api/chat', (req, res) => { if (bot) bot.chat(req.body.text); res.sendStatus(200); });
app.post('/api/tpaccept', (req, res) => { if (bot) bot.chat('/tpaccept'); res.sendStatus(200); });

app.post('/api/move', (req, res) => {
  if (bot && bot.entity) {
    const dir = req.body.dir;
    if (dir === 'jump') {
      bot.setControlState('jump', true);
      setTimeout(() => { if (bot) bot.setControlState('jump', false); }, 400);
    } else {
      bot.setControlState(dir, true);
      setTimeout(() => { if (bot) bot.setControlState(dir, false); }, 500);
    }
  }
  res.sendStatus(200);
});

app.post('/api/toggle-random', (req, res) => {
  if (!bot) return res.sendStatus(200);
  isRandomMoving = !isRandomMoving;
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
  } else {
    clearInterval(randomMoveInterval);
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
