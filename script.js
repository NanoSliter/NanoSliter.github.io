// Tausche diese Adresse gegen deine echte Server-URL aus, wenn du ihn hochgeladen hast!
const SERVER_URL = 'nanoslitergithubio-production.up.railway.app'; // Beispiel

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let socket = io(SERVER_URL); // Verbindung mit externem Server
let player = null;
let allPlayers = {};
let foods = [];
let nuktes = [];
let powerUps = [];
let bots = [];
let friends = [];

// Startbildschirm
document.getElementById('serverSelect').innerHTML = Array.from({ length: 100 }, (_, i) => `<option value="${i}">Server ${i}</option>`).join('');

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
    powerUps = data.powerUps;
    bots = data.bots;

    document.getElementById('startScreen').style.display = 'none';
    canvas.style.display = 'block';

    requestAnimationFrame(gameLoop);
});

socket.on('playerMoved', (data) => {
    if (allPlayers[data.id]) {
        allPlayers[data.id].x = data.x;
        allPlayers[data.id].y = data.y;
        allPlayers[data.id].angle = data.angle;
    }
});

socket.on('friendLocations', (data) => {
    friends = data;
});

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Zeichne Foods
    foods.forEach(f => {
        ctx.beginPath();
        ctx.arc(f.x, f.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcc00';
        ctx.fill();
    });

    // Zeichne Power-Ups
    powerUps.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#00ccff';
        ctx.fill();
    });

    // Zeichne Spieler
    for (const id in allPlayers) {
        const p = allPlayers[id];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = id === socket.id ? '#00ff00' : '#00aaff';
        ctx.fill();
    }

    // Zeichne Nukte
    nuktes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6666';
        ctx.fill();
    });

    // Freundespositionen anzeigen
    friends.forEach(f => {
        ctx.beginPath();
        ctx.arc(f.x, f.y, 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffff00';
        ctx.stroke();
    });

    requestAnimationFrame(gameLoop);
}

// Bewegung
document.addEventListener('mousemove', (e) => {
    if (!player) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const angle = Math.atan2(mouseY - player.y, mouseX - player.x);

    player.angle = angle;
    socket.emit('move', {
        x: player.x,
        y: player.y,
        angle: angle
    });
});
