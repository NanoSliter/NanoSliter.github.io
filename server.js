const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('.')); // Server sendet Client-Dateien

// Globale Variablen
let games = {};
const SERVER_COUNT = 100;
const MAX_PLAYERS_PER_SERVER = 15;

for (let i = 0; i < SERVER_COUNT; i++) {
    games[i] = {
        players: {},
        foods: [],
        nuktes: [],
        bots: [],
        powerUps: []
    };

    for (let j = 0; j < 100; j++) {
        games[i].foods.push({
            x: Math.random() * 800,
            y: Math.random() * 600,
            id: j
        });
    }

    for (let j = 0; j < 5; j++) {
        games[i].powerUps.push({
            x: Math.random() * 800,
            y: Math.random() * 600,
            type: ['speed', 'size', 'shield'][Math.floor(Math.random() * 3)],
            id: j
        });
    }
}

io.on('connection', (socket) => {
    console.log('Neuer Spieler verbunden:', socket.id);

    socket.on('joinServer', ({ name, serverId }) => {
        const game = games[serverId];
        if (!game || Object.keys(game.players).length >= MAX_PLAYERS_PER_SERVER) {
            socket.emit('serverFull');
            return;
        }

        game.players[socket.id] = {
            name: name,
            x: Math.random() * 700 + 50,
            y: Math.random() * 500 + 50,
            angle: 0,
            points: 0,
            size: 5,
            alive: true,
            upgrades: { speed: 1, size: 1, shield: false },
            friends: []
        };

        socket.join(`server-${serverId}`);
        socket.serverId = serverId;

        socket.emit('initGame', {
            playerId: socket.id,
            players: game.players,
            foods: game.foods,
            nuktes: game.nuktes,
            powerUps: game.powerUps
        });
    });

    socket.on('move', (data) => {
        const game = games[socket.serverId];
        if (!game || !game.players[socket.id]) return;

        game.players[socket.id].x = data.x;
        game.players[socket.id].y = data.y;
        game.players[socket.id].angle = data.angle;

        socket.to(`server-${socket.serverId}`).emit('playerMoved', {
            id: socket.id,
            x: data.x,
            y: data.y,
            angle: data.angle
        });
    });

    socket.on('requestFriends', () => {
        const game = games[socket.serverId];
        const friendList = [];
        const currentPlayer = game.players[socket.id];

        for (const id in game.players) {
            if (currentPlayer.friends.includes(id)) {
                friendList.push({
                    id: id,
                    name: game.players[id].name,
                    x: game.players[id].x,
                    y: game.players[id].y
                });
            }
        }

        socket.emit('friendLocations', friendList);
    });

    socket.on('addFriend', (targetId) => {
        if (games[socket.serverId].players[socket.id]) {
            games[socket.serverId].players[socket.id].friends.push(targetId);
        }
    });

    socket.on('upgrade', (type) => {
        const game = games[socket.serverId];
        const player = game.players[socket.id];
        if (player.points >= 1000 && type === 'bot') {
            player.points -= 1000;
            game.bots.push({
                owner: socket.id,
                x: player.x,
                y: player.y,
                points: 0
            });
        }
    });

    socket.on('disconnect', () => {
        const game = games[socket.serverId];
        if (game && game.players[socket.id]) {
            const player = game.players[socket.id];
            if (player.alive) {
                for (let i = 0; i < player.points / 10; i++) {
                    game.nuktes.push({
                        x: player.x + Math.random() * 20 - 10,
                        y: player.y + Math.random() * 20 - 10
                    });
                }
            }
            delete game.players[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
