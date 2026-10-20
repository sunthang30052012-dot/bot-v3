// File: interface.js - Giao diện Web Panel
function getHtmlPage(config, botStatus, currentXYZ) {
  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Minecraft Bot Ultimate Control Panel</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #121212; color: #fff; margin: 0; padding: 20px; display: flex; justify-content: center; }
            .wrapper { display: grid; grid-template-columns: 450px 450px; gap: 20px; background: #1e1e1e; padding: 25px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); align-items: start; max-width: 950px; width: 100%; box-sizing: border-box; }
            .panel { background: #252525; padding: 20px; border-radius: 10px; box-sizing: border-box; }
            .right-container { display: flex; flex-direction: column; gap: 20px; box-sizing: border-box; }
            .chat-container, .view-container { background: #252525; padding: 15px; border-radius: 10px; box-sizing: border-box; }
            h1, h3 { color: #4CAF50; margin-top: 0; margin-bottom: 10px; }
            .status-box { background: #1a1a1a; padding: 10px; border-radius: 8px; margin-bottom: 15px; border-left: 5px solid #4CAF50; text-align: left; font-size: 14px; }
            .status-box p { margin: 3px 0; }
            .btn { background: #4CAF50; color: white; border: none; padding: 9px 12px; margin: 3px; font-size: 13px; font-weight: bold; border-radius: 5px; cursor: pointer; width: 46%; }
            .btn:hover { background: #45a049; }
            .btn-danger { background: #f44336; }
            .btn-warning { background: #ff9800; }
            .btn-active { background: #00bcd4 !important; }
            .wasd-wrapper { display: grid; grid-template-columns: repeat(3, 45px); grid-template-rows: repeat(2, 45px); gap: 6px; justify-content: center; margin: 10px 0; }
            .wasd-btn { background: #333; color: white; border: 2px solid #555; font-size: 15px; font-weight: bold; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
            .wasd-btn:active { background: #4CAF50; }
            .screen { background: #000; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #00ff00; padding: 8px; border-radius: 8px; text-align: center; white-space: pre; border: 1px solid #444; overflow-x: auto; }
            .view-screen { font-size: 11px; line-height: 1.05; }
            .radar-screen { font-size: 13px; line-height: 1.25; }
            .chat-log { background: #000; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #00ff00; padding: 10px; border-radius: 8px; overflow-y: auto; height: 140px; text-align: left; white-space: pre-wrap; border: 1px solid #444; }
            .input-group { display: flex; margin-top: 10px; gap: 5px; }
            input[type="text"] { flex: 1; padding: 8px; border-radius: 5px; border: 1px solid #444; background: #111; color: white; }
            @media (max-width: 950px) { .wrapper { grid-template-columns: 1fr; } }
        </style>
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            socket.on('statusUpdate', (data) => {
                document.getElementById('status').innerText = data.status;
                document.getElementById('xyz').innerText = data.xyz;
                const randBtn = document.getElementById('btn-rand');
                if (data.isRandomMoving) { randBtn.classList.add('btn-active'); randBtn.innerText = "🛑 Tắt Chạy Tự Động"; }
                else { randBtn.classList.remove('btn-active'); randBtn.innerText = "🎲 Bật Chạy Tự Động"; }
            });
            socket.on('minecraftChat', (msg) => {
                const log = document.getElementById('chatLog');
                log.innerText += msg + '\\n';
                log.scrollTop = log.scrollHeight;
            });
            socket.on('viewUpdate', (text) => {
                document.getElementById('viewDisplay').innerText = text;
            });
            socket.on('radarUpdate', (text) => {
                document.getElementById('radarDisplay').innerText = text;
            });
            async function sendAction(endpoint, data = {}) {
                await fetch('/api/' + endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
            function sendChat() {
                const input = document.getElementById('chatInput');
                if (input.value) { sendAction('chat', { text: input.value }); input.value = ''; }
            }
        </script>
    </head>
    <body>
        <div class="wrapper">
            <div class="panel">
                <h1>🎮 PANEL ĐIỀU KHIỂN</h1>
                <div class="status-box">
                    <p>🟢 Trạng thái: <span id="status">${botStatus}</span></p>
                    <p>📍 Tọa độ (XYZ): <span id="xyz">${currentXYZ}</span></p>
                </div>
                <h3>⚡ HỆ THỐNG VƯỢT ẢI</h3>
                <button class="btn" onclick="sendAction('start')">🔌 Kết nối Bot</button>
                <button class="btn btn-danger" onclick="sendAction('stop')">❌ Ngắt kết nối</button>
                <button class="btn btn-warning" onclick="sendAction('open-menu')">⏰ Mở Menu Đồng Hồ</button>
                <button class="btn btn-warning" onclick="sendAction('click-kingsmp')">🧱 Chọn ô 24 KingSMP</button>
                <button class="btn" onclick="sendAction('tpaccept')">🛸 Đồng ý /tpaccept</button>
                <button id="btn-rand" class="btn" onclick="sendAction('toggle-random')">🎲 Bật Chạy Tự Động</button>

                <h3>🕹️ DI CHUYỂN WASD</h3>
                <div class="wasd-wrapper">
                    <div></div>
                    <button class="wasd-btn" onclick="sendAction('move', {dir: 'forward'})">W</button>
                    <div></div>
                    <button class="wasd-btn" onclick="sendAction('move', {dir: 'left'})">A</button>
                    <button class="wasd-btn" onclick="sendAction('move', {dir: 'back'})">S</button>
                    <button class="wasd-btn" onclick="sendAction('move', {dir: 'right'})">D</button>
                </div>
                <button class="btn" style="width:120px; display:block; margin:0 auto;" onclick="sendAction('move', {dir: 'jump'})">🦘 Nhảy (Space)</button>
            </div>

            <div class="right-container">
                <div class="view-container">
                    <h3>👁️ GÓC NHÌN NGƯỜI CHƠI (mô phỏng 3D)</h3>
                    <div id="viewDisplay" class="screen view-screen">Bot chưa bật hoặc chưa vào game...</div>
                </div>
                <div class="view-container">
                    <h3>🗺️ RADAR NHÌN TỪ TRÊN XUỐNG</h3>
                    <div id="radarDisplay" class="screen radar-screen">Bot chưa bật hoặc chưa vào game...</div>
                </div>
                <div class="chat-container">
                    <h3>💬 KHUNG XEM CHAT GAME</h3>
                    <div id="chatLog" class="chat-log">--- Hệ thống chat sẵn sàng ---&#13;</div>
                    <div class="input-group">
                        <input type="text" id="chatInput" placeholder="Nhập lệnh hoặc chat..." onkeydown="if(event.key==='Enter') sendChat()">
                        <button class="btn" style="margin:0; width:60px;" onclick="sendChat()">Gửi</button>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}
module.exports = { getHtmlPage };
