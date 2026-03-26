<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Nano Sliter — P2P mit GitHub Gist</title>
    <style>
        body { margin:0; background:#050815; font:sans-serif; overflow:hidden; height:100vh; }
        #start { position:absolute; top:0; left:0; w:100%; h:10%; display:flex; flex-direction:column; justify-content:center; align-items:center; background:rgba(0,0,0,0.8); }
        input, button { width:300px; padding:12px; margin:8px; border:1px solid #00f3ff; background:#000; color:white; border-radius:6px; }
        button { background:#00f3ff; color:black; border:none; cursor:pointer; }
        #game { display:none; }
        #ui { position:absolute; top:20px; left:20px; color:#00f3ff; text-shadow:0 0 5px #00f3ff; }
    </style>
</head>
<body>
    <div id="start">
        <h1>🐍 Nano Sliter v6 — P2P</h1>
        <input id="nick" placeholder="Name" value="Spieler">
        <input id="room" placeholder="Raum (z.B. lobby1)" value="lobby1">
        <button onclick="join()">Spielen</button>
    </div>
    <canvas id="game" width="1200" height="800"></canvas>
    <div id="ui">Punkte: <span id="pts">0</span> | Länge: <span id="len">5</span></div>

    <!-- SimplePeer -->
    <script src="https://cdn.jsdelivr.net/npm/simple-peer@9.11.1/min.js"></script>
    <script>
        const GIST_ID = '1554e3f0ee9787d8b415c41d8125ebe1'; // 🔁 ERSETZE MIT DEINER GIST-ID!
        const canvas = document.getElementById('game');
        const ctx = canvas.getContext('2d');
        const pts = document.getElementById('pts');
        const len = document.getElementById('len');
        const start = document.getElementById('start');

        let roomId, nickname, playerId, player, peers = {}, others = {};

        async function getGist() {
            const res = await fetch(`https://api.github.com/gists/${GIST_ID}`);
            const json = await res.json();
            return JSON.parse(json.files['nanosliter-signaling.json'].content);
        }

        async function updateGist(data) {
            const gist = await getGist();
            gist.rooms[roomId] = data;
            await fetch(`https://api.github.com/gists/${GIST_ID}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    files: {
                        'nanosliter-signaling.json': {
                            content: JSON.stringify(gist, null, 2)
                        }
                    }
                })
            });
        }

        function join() {
            nickname = document.getElementById('nick').value || 'Anonym';
            roomId = document.getElementById('room').value.trim() || 'lobby1';
            playerId = Math.random().toString(36).substr(2, 9);

            start.style.display = 'none';
            canvas.style.display = 'block';

            player = {
                id: playerId,
                name: nickname,
                x: 600, y: 400,
                size: 5,
                points: 0,
                segments: [],
                speed: 3,
                angle: 0,
                alive: true
            };
            for (let i = 0; i < 5; i++) {
                player.segments.push({ x: 600 - i*5, y: 400, size: 5 - i*0.3 });
            }

            // Registriere dich im Raum
            getGist().then(gist => {
                if (!gist.rooms[roomId]) gist.rooms[roomId] = { players: {} };
                gist.rooms[roomId].players[playerId] = { ...player };
                return updateGist(gist.rooms[roomId]);
            });

            // Lade andere Spieler
            setInterval(async () => {
                const gist = await getGist();
                others = {};
                if (gist.rooms[roomId]?.players) {
                    for (const id in gist.rooms[roomId].players) {
                        if (id !== playerId) others[id] = gist.rooms[roomId].players[id];
                    }
                }
            }, 2000);

            // Game Loop
            setInterval(sendUpdate, 100);
            drawLoop();
        }

        function sendUpdate() {
            if (!player) return;
            const head = player.segments[0];
            head.x += Math.cos(player.angle) * player.speed;
            head.y += Math.sin(player.angle) * player.speed;

            for (let i = 1; i < player.segments.length; i++) {
                const curr = player.segments[i];
                const prev = player.segments[i-1];
                const dx = prev.x - curr.x;
                const dy = prev.y - curr.y;
                const d = Math.sqrt(dx*dx + dy*dy);
                if (d > 2) {
                    curr.x += dx * 0.7;
                    curr.y += dy * 0.7;
                }
            }

            // Aktualisiere Gist
            getGist().then(gist => {
                if (gist.rooms[roomId]?.players) {
                    gist.rooms[roomId].players[playerId] = {
                        x: head.x,
                        y: head.y,
                        segments: player.segments,
                        points: player.points,
                        size: player.size
                    };
                    updateGist(gist.rooms[roomId]);
                }
            });
        }

        function drawLoop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Hex-Hintergrund
            ctx.strokeStyle = 'rgba(0,243,255,0.02)';
            ctx.lineWidth = 1;
            const size = 25;
            for (let x = -size; x < canvas.width; x += size * 1.5) {
                for (let y = -size; y < canvas.height; y += size * Math.sqrt(3)) {
                    const ox = (Math.floor(y / (size * Math.sqrt(3))) % 2) * (size * 0.75);
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const a = (i * Math.PI) / 3;
                        const nx = x + ox + size * Math.cos(a);
                        const ny = y + size * Math.sin(a);
                        if (i === 0) ctx.moveTo(nx, ny);
                        else ctx.lineTo(nx, ny);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
            }

            // Eigene Schlange
            if (player) {
                for (let i = player.segments.length - 1; i >= 0; i--) {
                    const seg = player.segments[i];
                    ctx.beginPath();
                    ctx.arc(seg.x, seg.y, seg.size || player.size, 0, Math.PI * 2);
                    ctx.fillStyle = i === 0 ? '#00ffaa' : '#00cc88';
                    ctx.fill();
                }
                pts.textContent = Math.floor(player.points);
                len.textContent = player.segments.length;
            }

            // Andere
            for (const id in others) {
                const p = others[id];
                if (p.segments {
                    for (let i = p.segments.length - 1; i >= 0; i--) {
                        const seg = p.segments[i];
                        ctx.beginPath();
                        ctx.arc(seg.x, seg.y, seg.size || p.size, 0, Math.PI * 2);
                        ctx.fillStyle = i === 0 ? '#00aaff' : '#0088ff';
                        ctx.fill();
                    }
                }
            }

            requestAnimationFrame(drawLoop);
        }

        canvas.addEventListener('mousemove', (e) => {
            if (!player) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            player.angle = Math.atan2(my - player.segments[0].y, mx - player.segments[0].x);
        });
    </script>
</body>
</html>
