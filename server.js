const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["https://nanosliter.github.io", "http://localhost:5173"],
        methods: ["GET", "POST"]
    }
});

// Serve static files from current directory
app.use(express.static('.'));

// Game data
let games = {};
const SERVER_COUNT = 10;
const MAX_PLAYERS_PER_SERVER = 15;

// Initialize servers
for (let i = 0; i < SERVER_COUNT; i++) {
    games[i] = {
        players: {},
        foods: [],
        nuktes: [],
        bots: [],
        lastFoodGen: Date.now()
    };

    // Add initial food
    for (let j = 0; j < 200; j++) {
        games[i].foods.push({
            x: Math.random() * 1000 + 100,
            y: Math.random() * 500 + 50,
            id: j
        });
    }
}

// Helper: distance
function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

io.on('connection', (socket) => {
    console.log('✅ Spieler verbunden:', socket.id);

    socket.on('joinServer', ({ name, serverId }) => {
        const game = games[serverId];
        if (!game || Object.keys(game.players).length >= MAX_PLAYERS_PER_SERVER) {
            socket.emit('serverFull');
            return;
        }

        // Create player with snake segments
        const =        for (let i = 0; i < 5; i++) {
            segments.push({
                x: Math.random() * 800 + 100,
                y: Math.random() * 400 + 100,
                size: 5 - i * 0.3
            });
        }

        game.players[socket.id] = {
            id: socket.id,
            name: name || 'Anonym',
            x: segments[0].x,
            y: segments[0].y,
            angle: 0,
            points: 0,
            size: 5,
            alive: true,
            upgrades: { speed: 1, size: 1 },
            segments: segments
        };

        socket.join(`server-${serverId}`);
        socket.serverId = serverId;

        socket.emit('initGame', {
            playerId: socket.id,
            players: game.players,
            foods: game.foods,
            nuktes: game.nuktes,
            bots: game.bots
        });

        console.log(`🎮 Spieler ${name} joined server ${serverId}`);
    });

    socket.on('move', (data) => {
        const game = games[socket.serverId];
        if (!game || !game.players[socket.id]) return;

        const player = game.players[socket.id];
        if (!player.alive) return;

        player.x = data.x;
        player.y = data.y;
        player.angle = data.angle;

        // Update head segment
        if (player.segments.length > 0) {
            player.segments[0].x = player.x;
            player.segments[0].y = player.y;
        }

        // Pull body segments
        for (let i = 1; i < player.segments.length; i++) {
            const curr = player.segments[i];
            const prev = player.segments[i - 1];
            const dx = prev.x - curr.x;
            const dy = prev.y - curr.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 2) {
                curr.x += dx * 0.7;
                curr.y += dy * 0.7;
            }
        }

        // Broadcast
        socket.to(`server-${socket.serverId}`).emit('playerMoved', {
            id: socket.id,
            x: data.x,
            y: data.y,
            angle: data.angle
        });

        // Check food collision
        game.foods = game.foods.filter(food => {
            if (dist(player, food) < player.size + 4) {
                player.points += 10;
                player.size += 02;
                player.segments.push({
                    x: player.segments[player.segments.length - 1].x,
                    y: player.segments[player.segments.length - 1].y,
                    size: Math.max(1, player.size - player.segments.length * 0.1)
                });
                return false;
            }
            return true;
        });

        // Check nukte collision
        game.nuktes = game.nuktes.filter(nukte => {
            if (dist(player, nukte) < player.size + 2) {
                player.points += 1;
                player.size += 0.05;
                return false;
            }
            return true;
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
                size: Math.max(1, player.size - player.segments.length * 0.1)
            });
            socket.emit('updatePlayer', { points: player.points, size: player.size });
        }
        if (type === 'speed' && player.points >= 500) {
            player.points -= 500;
            player.upgrades.speed += 0.5;
            socket.emit('updatePlayer', { points: player.points });
        }
        if (type === 'bot' && player.points >= 1000) {
            player.points -= 1000;
            game.bots.push({
                owner: socket.id,
                x: player.x,
                y: player.y,
                size: player.size * 0.5
            });
            socket.emit('updatePlayer', { points: player.points });
        }
    });

    socket.on('disconnect', () => {
        const game = games[socket.serverId];
        if (game && game.players[socket.id]) {
            const player = game.players[socket.id];
            if (player.alive) {
                // Drop nuktes on death
                for (let i = 0; i < Math.floor(player.points / 10); i++) {
                    game.nuktes.push({
                        x: player.x + (Math.random() - 0.5) * 20,
                        y: player.y + (Math.random() - 0.5) * 20
                    });
                }
            }
            delete game.players[socket.id];
            console.log(`💀 Spieler ${socket.id} disconnected`);
        }
    });
});

// Auto-generate food
setInterval(() => {
    for (let i = 0; i < SERVER_COUNT; i++) {
        const game = games[i];
        if (Date.now() - game.lastFoodGen > 10000) {
            game.foods.push({
                x: Math.random() * 1000 + 100,
                y: Math.random() * 500 + 50,
                id: Date.now()
            });
            game.lastFoodGen = Date.now();
        }
    }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
});
