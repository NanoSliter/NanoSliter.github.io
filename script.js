const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let socket = io('https://nanosliter.up.railway.app'); // Dein Server

let player = null;
let allPlayers = {};
let foods = [];
let nuktes = [];
let bots = [];

// UI Elemente
const startScreen = document.getElementById('startScreen');
const ui = document.getElementById('ui');
const pointsEl = document.getElementById('points');
const lengthEl = document.getElementById('length');

// Server-Liste
document.getElementById('serverSelect').innerHTML = Array.from({ length: 10 }, (_, i) => `<option value="${i}">Server ${i + 1}</option>`).join('');

function joinGame() {
    const name = document.getElementById('playerName').value || 'Anonym';
    const serverId = parseInt(document.getElementById('serverSelect').value);
    socket.emit('joinServer', { name, serverId });
}

socket.on('initGame', (data) => {
    player = data.players[data.playerId];
    allPlayers = data.players;
    foods = data.foods;
    nuktes = data.nuktes;
    bots = data.bots;

    startScreen.style.display = 'none';
    canvas.style.display = 'block';
    ui.style.display = 'flex';

    requestAnimationFrame(gameLoop);
});

socket.on('playerMoved', (data) => {
    if (allPlayers[data.id]) {
        allPlayers[data.id].x = data.x;
        allPlayers[data.id].y = data.y;
    }
});

socket.on('updatePlayer', (data) => {
    if (allPlayers[data.id]) {
        allPlayers[data.id] = { ...allPlayers[data.id], ...data };
        if (data.id === socket.id) {
            player = allPlayers[data.id];
            pointsEl.textContent = player.points || 0;
            lengthEl.textContent = Math.round(player.size) || 5;
        }
    }
});

// --- Schlange mit Körper ---
function drawSnake(snake) {
    // Zeichne Segmente
    if (snake.segments) {
        for (let i = snake.segments.length - 1; i >= 0; i--) {
            const seg = snake.segments[i];
            ctx.beginPath();
            ctx.arc(seg.x, seg.y, seg.size || snake.size, 0, Math.PI * 2);
            ctx.fillStyle = i === 0 ? '#00ffaa' : '#00cc88';
            ctx.fill();
        }
    } else {
        // Falls keine Segmente -> Kreis (ältere Spieler)
        ctx.beginPath();
        ctx.arc(snake.x, snake.y, snake.size, 0, Math.PI * 2);
        ctx.fillStyle = snake.id === socket.id ? '#00ffaa' : '#00aaff';
        ctx.fill();
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Zeichne Foods
    foods.forEach(f => {
        ctx.beginPath();
        ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcc00';
        ctx.fill();
    });

    // Zeichne Nukte
    nuktes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6666';
        ctx.fill();
    });

    // Zeichne Spieler
    for (const id in allPlayers) {
        drawSnake(allPlayers[id]);
    }

    requestAnimationFrame(gameLoop);
}

// Steuerung
document.addEventListener('mousemove', (e) => {
    if (!player) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const angle = Math.atan2(my - player.y, mx - player.x);
    socket.emit('move', {
        x: player.x + Math.cos(angle) * 2,
        y: player.y + Math.sin(angle) * 2,
        angle
    });
});

// Shop
function openShop() { document.getElementById('shopModal').style.display = 'block'; }
function closeModal() { document.getElementById('shopModal').style.display = 'none'; }
function buyUpgrade(type) {
    socket.emit('upgrade', type);
    closeModal();
}
function buyBot() {
    socket.emit('upgrade', 'bot');
    closeModal();
}
function openFriends() {
    socket.emit('requestFriends');
}
