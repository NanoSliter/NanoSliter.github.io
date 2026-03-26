const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('../client')); // oder '.' wenn du alles im Hauptverzeichnis hast

// Globale Variablen
let games = {};
const SERVER_COUNT = 100;
const MAX_PLAYERS_PER_SERVER = 15;

// Initialisiere alle Server
for (let i = 0; i < SERVER_COUNT; i++) {
    games[i] = {
        players: {},
        foods: [],
        nuktes: [],
        bots: [],
        powerUps: [],
        lastFoodGen: Date.now(),
        lastPowerUpGen: Date.now()
    };

    // Generiere Start-Nahrung
    for (let j = 0; j < 200; j++) {
        games[i].foods.push({
            x: Math.random() * 1000 + 100,
            y: Math.random() * 600 + 100,
            id: j
        });
    }

    // Generiere Start-Power-Ups
    for (let j = 0; j < 5; j++) {
        games[i].powerUps.push({
            x: Math.random() * 1000 + 100,
            y: Math.random() * 600 + 100,
            type: ['speed', 'size', 'shield'][Math.floor(Math.random() * 3)],
            id: j
        });
    }
}

// Freundeslisten
let friendships = {};

// Hilfsfunktionen
function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function checkCollision(player, target) {
    return distance(player, target) < player.size + target.size;
}

// Socket.IO Logik
io.on('connection', (socket) => {
    console.log('Spieler verbunden:', socket.id);

    socket.on('joinServer', ({ name, serverId }) => {
        const game = games[serverId];
        if (!game || Object.keys(game.players).length >= MAX_PLAYERS_PER_SERVER) {
            socket.emit('serverFull');
            return;
        }

        // Neuen Spieler hinzufügen
        game.players[socket.id] = {
            id: socket.id,
            name: name,
            x: Math.random() * 800 + 100,
            y: Math.random() * 400 + 100,
            angle: 0,
            points: 0,
            size: 5,
            alive: true,
            upgrades: { speed: 1, size: 1, shield: false },
            friends: [],
            rank: 0
        };

        socket.join(`server-${serverId}`);
        socket.serverId = serverId;

        // Senden initialer Daten
        socket.emit('initGame', {
            playerId: socket.id,
            players: game.players,
            foods: game.foods,
            nuktes: game.nuktes,
            powerUps: game.powerUps
        });

        // Allen anderen Spieler melden
        socket.to(`server-${serverId}`).emit('playerJoined', game.players[socket.id]);
    });

    socket.on('move', (data) => {
        const game = games[socket.serverId];
        if (!game || !game.players[socket.id]) return;

        const player = game.players[socket.id];
        if (!player.alive) return;

        player.x = data.x;
        player.y = data.y;
        player.angle = data.angle;

        // Broadcast Bewegung
        socket.to(`server-${socket.serverId}`).emit('playerMoved', {
            id: socket.id,
            x: data.x,
            y: data.y,
            angle: data.angle
        });

        // Kollision mit Foods
        game.foods = game.foods.filter(food => {
            if (distance(player, food) < player.size) {
                player.points += 10;
                player.size += 0.2;
                return false;
            }
            return true;
        });

        // Kollision mit Nukten
        game.nuktes = game.nuktes.filter(nukte => {
            if (distance(player, nukte) < player.size) {
                player.points += 1;
                player.size += 0.05;
                return false;
            }
            return true;
        });

        // Kollision mit Power-Ups
        game.powerUps = game.powerUps.filter(powerUp => {
            if (distance(player, powerUp) < player.size) {
                if (powerUp.type === 'speed') player.upgrades.speed += 0.2;
                if (powerUp.type === 'size') player.upgrades.size += 0.5;
                if (powerUp.type === 'shield') player.upgrades.shield = true;
                setTimeout(() => {
                    if (player.upgrades.shield) player.upgrades.shield = false;
                }, 10000);
                return false;
            }
            return true;
        });

        // Kollision mit anderen Spielern
        for (const id in game.players) {
            const other = game.players[id];
            if (id !== socket.id && other.alive && !other.upgrades.shield && checkCollision(player, other)) {
                if (player.size > other.size * 1.1) {
                    // Spieler isst anderen
                    player.points += other.points;
                    player.size += other.size * 0.2;
                    other.alive = false;

                    // Erzeuge Nukte aus totem Spieler
                    for (let i = 0; i < other.points / 10; i++) {
                        game.nuktes.push({
                            x: other.x + Math.random() * 20 - 10,
                            y: other.y + Math.random() * 20 - 10
                        });
                    }

                    // Sende Tod an alle
                    io.to(`server-${socket.serverId}`).emit('playerDied', id);
                } else if (other.size > player.size * 1.1) {
                    // Spieler stirbt
                    player.alive = false;

                    for (let i = 0; i < player.points / 10; i++) {
                        game.nuktes.push({
                            x: player.x + Math.random() * 20 - 10,
                            y: player.y + Math.random() * 20 - 10
                        });
                    }

                    io.to(`server-${socket.serverId}`).emit('playerDied', socket.id);
                }
            }
        }
    });

    socket.on('upgrade', (type) => {
        const game = games[socket.serverId];
        const player = game.players[socket.id];
        if (!player) return;

        if (type === 'speed' && player.points >= 500) {
            player.points -= 500;
            player.upgrades.speed += 0.5;
        }
        if (type === 'size' && player.points >= 300) {
            player.points -= 300;
            player.upgrades.size += 1;
        }
        if (type === 'bot' && player.points >= 1000) {
            player.points -= 1000;
            game.bots.push({
                owner: socket.id,
                x: player.x,
                y: player.y,
                size: player.size * 0.5,
                points: 0
            });
        }
    });

    socket.on('powerup', (type) => {
        const game = games[socket.serverId];
        const player = game.players[socket.id];
        if (!player) return;

        if (type === 'shield' && player.points >= 800) {
            player.points -= 800;
            player.upgrades.shield = true;
            setTimeout(() => {
                player.upgrades.shield = false;
            }, 10000);
        }
    });

    socket.on('addFriend', (targetName) => {
        const game = games[socket.serverId];
        let targetId = null;

        for (const id in game.players) {
            if (game.players[id].name === targetName) {
                targetId = id;
                break;
            }
        }

        if (targetId) {
            game.players[socket.id].friends.push(targetId);
            socket.emit('friendAdded', targetName);
        } else {
            socket.emit('friendNotFound', targetName);
        }
    });

    socket.on('requestFriends', () => {
        const game = games[socket.serverId];
        const player = game.players[socket.id];
        if (!player) return;

        const friendList = player.friends.map(id => {
            const friend = game.players[id];
            return friend ? { id, name: friend.name, x: friend.x, y: friend.y } : null;
        }).filter(Boolean);

        socket.emit('friendLocations', friendList);
    });

    socket.on('disconnect', () => {
        const game = games[socket.serverId];
        if (game && game.players[socket.id]) {
            const player = game.players[socket.id];
            if (player.alive) {
                // Nukte bei Verbindungsende
                for (let i = 0; i < player.points / 10; i++) {
                    game.nuktes.push({
                        x: player.x + Math.random() * 20 - 10,
                        y: player.y + Math.random() * 20 - 10
                    });
                }
            }
            delete game.players[socket.id];
            io.to(`server-${socket.serverId}`).emit('playerLeft', socket.id);
        }
    });
});

// Periodische Generatoren
setInterval(() => {
    for (let i = 0; i < SERVER_COUNT; i++) {
        const game = games[i];

        // Neue Foods generieren
        if (Date.now() - game.lastFoodGen > 10000) {
            for (let j = 0; j < 5; j++) {
                game.foods.push({
                    x: Math.random() * 1000 + 100,
                    y: Math.random() * 600 + 100,
                    id: Date.now() + j
                });
            }
            game.lastFoodGen = Date.now();
        }

        // Neue Power-Ups generieren
        if (Date.now() - game.lastPowerUpGen > 30000) {
            game.powerUps.push({
                x: Math.random() * 1000 + 100,
                y: Math.random() * 600 + 100,
                type: ['speed', 'size', 'shield'][Math.floor(Math.random() * 3)],
                id: Date.now()
            });
            game.lastPowerUpGen = Date.now();
        }
    }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
