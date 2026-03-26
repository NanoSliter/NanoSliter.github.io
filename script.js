// === CONFIG ===
const SERVER_URL = 'https://nanosliter.up.railway.app';
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let socket = io(SERVER_URL);

let player = null;
let allPlayers = {};
let foods = [];
let nuktes = [];
let powerUps = [];
let bots = [];
let friends = [];

// UI
const nicknameInput = document.getElementById('nickname');
const serverSelect = document.getElementById('serverSelect');
const shopBtn = document.getElementById('shopBtn');
const friendsBtn = document.getElementById('friendsBtn');
const shopModal = document.getElementById('shop');
const friendsModal = document.getElementById('friendsModal');

// --- Initialisierung ---
function joinGame() {
    const name = nicknameInput.value.trim() || 'Anonym';
    const serverId = parseInt(serverSelect.value);

    socket.emit('joinServer', { name, serverId });
}

// --- Socket Events ---
socket.on('initGame', (data) => {
    player = data.players[data.playerId];
    all = data.players;
    foods = data.foods;
    nuktes = data.nuktes;
    powerUps = data.powerUps;
    bots = data.bots;

    document.getElementById('startScreen').style.display = 'none';
    canvas.style.display = 'block';

    // Update UI
    updateUI();

    requestAnimationFrame(gameLoop);
});

socket.on('playerMoved', (data) => {
    if (allPlayers[data.id]) {
        allPlayers[data.id].x = data.x;
        allPlayers[data.id].y = data.y;
        allPlayers[data.id].angle = data.angle;
    }
});

socket.on('updatePlayer', (data) => {
    if (allPlayers[data.id]) {
        allPlayers[data.id] = { ...allPlayers[data.id], ...data };
        updateUI();
    }
});

// --- Game Loop ---
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Zeichne Hintergrund (Hexagon-Muster – optional)
    drawHexGrid();

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
        const p = allPlayers[id];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = id === socket.id ? '#00ffaa' : '#00aaff';
        ctx.fill();
    }

    requestAnimationFrame(gameLoop);
}

function drawHexGrid() {
    const size = 20;
    for (let x = -size; x < canvas.width + size; x += size * 1.5) {
        for (let y = -size; y < canvas.height + size; y += size * Math.sqrt(3)) {
            const offsetX = (Math.floor(y / (size * Math.sqrt(3))) % 2) * (size * 0.75);
            ctx.beginPath();
            ctx.moveTo(x + offsetX, y);
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const nx = x + offsetX + size * Math.cos(angle);
                const ny = y + size * Math.sin(angle);
                ctx.lineTo(nx, ny);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
            ctx.stroke();
        }
    }
}

// --- UI ---
function updateUI() {
    if (!player) return;
    document.getElementById('points').textContent = player.points || 0;
    document.getElementById('length').textContent = Math.round(player.size) || 5;
    document.getElementById('rank').textContent = player.rank || '?';
}

// --- Shop ---
function openShop() { shopModal.style.display = 'block'; }
function closeShop() { shopModal.style.display = 'none'; }
function buyUpgrade(type) {
    if (player.points >= 300) {
        socket.emit('upgrade', type);
        player.points -= 300;
        updateUI();
    }
}
function buyBot() {
    if (player.points >= 1000) {
        socket.emit('upgrade', 'bot');
        player.points -= 1000;
        updateUI();
    }
}
function buyPowerup(type) {
    if (player.points >= 800) {
        socket.emit('powerup', type);
        player.points -= 800;
        updateUI();
    }
}

// --- Freunde ---
function openFriends() { friendsModal.style.display = 'block'; }
function closeFriends() { friendsModal.style.display = 'none'; }
function addFriend() {
    const name = document.getElementById('friendSearch').value;
    if (name) {
        socket.emit('addFriend', name);
        alert('Freund angefragt!');
    }
}

// --- Steuerung ---
document.addEventListener('mousemove', (e) => {
    if (!player) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const dx = mouseX - player.x;
    const dy = mouseY - player.y;
    const angle = Math.atan2(dy, dx);

    player.angle = angle;
    socket.emit('move', { x: player.x, y: player.y, angle });
});

// --- Events ---
shopBtn.onclick = openShop;
friendsBtn.onclick = openFriends;
document.querySelector('.close').onclick = closeShop;
document.getElementById('friendsModal').querySelector('.close').onclick = closeFriends;

// --- Resize ---
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
