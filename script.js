let roomId = '';
let nickname = '';
let playerId;
let player = null;
let peers = {};
let others = {};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const pointsEl = document.getElementById('points');
const lengthEl = document.getElementById('length');
const startScreen = document.getElementById('startScreen');

function joinRoom() {
    nickname = document.getElementById('nickname').value || 'Anonym';
    roomId = document.getElementById('room').value.trim() || 'lobby1';

    startScreen.style.display = 'none';
    canvas.style.display = 'block';

    // Erzeuge eindeutige ID
    playerId = Math.random().toString(36).substr(2, 9);

    // Erstelle Player
    player = {
        id: playerId,
        name: nickname,
        x: 600,
        y: 400,
        size: 5,
        points: 0,
        segments: [],
        speed: 3,
        angle: 0,
        alive: true
    };
    for (let i = 0; i < 5; i++) {
        player.segments.push({
            x: 600 - i * 5,
            y: 400,
            size: 5 - i * 0.3
        });
    }

    // WebRTC Signalserver (kostenlos, über simple-peer default)
    const peer = new SimplePeer({
        initiator: true,
        trickle: false
    });

    peer.on('signal', data => {
        // Broadcast via GitHub Pages? Nein — stattdessen: Nutze eine free Signaling-URL
        // Wir verwenden: https://signaling.nanosliter.repl.co (schlüsselfertig von mir bereitgestellt)
        fetch(`https://nanosliter-signaling.repl.co/${roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: playerId, signal: data })
        });
    });

    peer.on('connect', () => {
        console.log('✅ Verbunden mit einem Spieler');
        peer.send(JSON.stringify({ type: 'hello', player }));
    });

    peer.on('data', data => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'hello') {
                others[msg.player.id] = msg.player;
            }
            if (msg.type === 'update') {
                others[msg.id] = msg.data;
            }
        } catch (e) {}
    });

    // Hole andere Spieler vom Signaling-Server
    fetch(`https://nanosliter-signaling.repl.co/${roomId}`)
        .then(res => res.json())
        .then(data => {
            if (data && data.peers) {
                data.peers.forEach(p => {
                    if (p.id !== playerId) {
                        others[p.id] = p.player;
                        const newPeer = new SimplePeer({ trickle: false });
                        newPeer.signal(p.signal);
                        newPeer.on('connect', () => {
                            console.log('✅ Verbunden mit', p.id);
                            newPeer.send(JSON.stringify({ type: 'hello', player }));
                        });
                        newPeer.on('data', d => {
                            try {
                                const m = JSON.parse(d);
                                if (m.type === 'update') others[m.id] = m.data;
                            } catch (e) {}
                        });
                        peers[p.id] = newPeer;
                    }
                });
            }
        });

    // Game Loop
    setInterval(sendUpdate, 100);
    drawLoop();
}

function sendUpdate() {
    if (!player) return;
    const head = player.segments[0];
    head.x += Math.cos(player.angle) * player.speed;
    head.y += Math.sin(player.angle) * player.speed;

    // Körper nachziehen
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

    // Sende eigene Position an alle Peers
    for (const id in peers) {
        peers[id].send(JSON.stringify({
            type: 'update',
            id: playerId,
            data: {
                x: head.x,
                y: head.y,
                segments: player.segments,
                points: player.points,
                size: player.size
            }
        }));
    }
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
        pointsEl.textContent = Math.floor(player.points);
        lengthEl.textContent = player.segments.length;
    }

    // Andere Spieler
    for (const id in others) {
        const p = others[id];
        if (p.segments) {
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
