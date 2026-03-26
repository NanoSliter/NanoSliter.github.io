const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
.use(express.static('.'));

// Globale Spieleinstellungen
let games = {};
const SERVER_COUNT = 10;
const MAX_PLAYERS_PER_SERVER = 15;

// Initialisiere alle Server
for (let i = 0; i < SERVER_COUNT; i++) {
    games[i] = {
        players: {},
        foods: [],
        nuktes: [],
        bots: [],
        lastFoodGen: Date.now()
    };

    // Start-Nahrung
    for (let j = 0; j < 200; j++) {
        games[i].foods.push({
            x: Math.random() * 1000 + 100,
            y: Math.random() * 500 + 50,
            id: j
        });
    }
}

// Verbindungshandler
io.on('connection', (socket) => {
    console.log('Spieler verbunden:', socket.id);

    socket.on('joinServer', ({ name, serverId }) => {
        const game = games[serverId];
        if (!game || Object.keys(game.players).length >= MAX_PLAYERS_PER_SERVER) {
            socket.emit('serverFull');
            return;
        }

        // Neuer Spieler mit Schlange
        game.players[socket.id] = {
            id: socket.id,
            name: name,
            x: Math.random() * 800 + 100,
            y: Math.random() * 400 + 100,
            angle: 0,
            points: 0,
            size: 5,
            alive: true,
            upgrades: { speed: 1, size: 1 },
            segments: [{ x: 400, y: 300, size: 5 }]
        };

        // Erzeuge Anfangssegmente
        for (let i = 1; i < 5; i++) {
            game.players[socket.id].segments.push({
                x: 400 - i * 5,
                y: 300,
                size: 5 - i * 0.2
            });
        }

        socket.joinId}`);
        socket.serverId = serverId;

        socket.emit('initGame', {
            playerId: socket.id,
            players: game.players,
            foods: game.foods,
            nuktes: game.nuktes,
            bots: game.bots
        });
    });

    socket.on('move', (data) => {
        const game = games[socket.serverId];
        if (!game || !game.players[socket.id]) return;

        const player = game.players[socket.id];
        player.x = data.x;
        player.y = data.y;
        player.angle = data.angle;

        // Update Segmente (nachziehen)
        const head = player.segments[0];
        head.x = player.x;
        head.y = player.ylet i = 1; i < player.segments.length; i++) {
            const curr = player.segments[i];
            const prev = player.segments[i - 1];
            const dx = prev.x - curr.x;
            const dy = prev;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 2) {
                curr.x += dx * 0.7;
                curr.y += dy * 0.7;
            }
        }

        socket.to(`server-${socket.serverId}`).emit('playerMoved', {
            id: socket.id,
            x: data.x,
            y: data.y,
            angle: data.angle
        });
    });

    socket.on('upgrade', (type) => {
        const game = games[socket.serverId];
        const player = game.players[socket.id];
        if (!player) return;

        if (type === 'size' && player.points >= 300) {
            player.points -= 300;
            player.size += 1;
            player.segments.push({
                x: player.segments[player.segments.length - 1].x,
                y: player.segments[player.segments.length - 1].y,
                size: player.size - player.segments.length * 0.1
            });
        }
        if (type === 'speed' && player.points >= 500) {
            player.points -= 500;
            player.upgrades.speed += 0.5;
        }
        if (type === 'bot' && player.points >= 1000) {
            player.points -= 1000;
            game.bots.push({
                owner: socket.id,
                x: player.x,
                y: player.y,
                size: player.size * 0.5
            });
        }

        socket.emit('updatePlayer', { id: socket.id, points: player.points, size: player.size });
    });

    socket.on('requestFriends', () => {
        socket.emit('friendLocations', []);
    });

    socket.on('disconnect', () => {
        const game = games[socket.serverId];
        if (game && game.players[socket.id]) {
            delete game.players[socket.id];
        }
    });
});

// Food-Generator
setInterval(() => {
    for (let i = 0; i < SERVER_COUNT; i++) {
        if (Date.now() - games[i].lastFoodGen > 10000) {
            games[i].foods.push({
                x: Math.random() * 1000 + 100,
                y: Math.random() * 500 + 50,
                id: Date.now()
            });
            games[i].lastFoodGen = Date.now();
        }
    }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
