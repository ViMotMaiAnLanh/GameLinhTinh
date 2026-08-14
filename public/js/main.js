const socket = io();

let currentRoomId = '';
let myPlayerName = '';
let isHost = false;
let isReady = false;

// Quản lý chuyển đổi các màn hình
function showScreen(screenId) {
    const screens = [
        'screen-login', 'screen-lobby', 'screen-role-reveal', 
        'screen-night-action', 'screen-day', 'screen-day-summary', 
        'screen-dead', 'screen-game-over'
    ];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// Bấm nút Vào / Tạo phòng
document.getElementById('btn-join').addEventListener('click', () => {
    myPlayerName = document.getElementById('player-name').value.trim();
    currentRoomId = document.getElementById('room-id').value.trim();

    if (!myPlayerName || !currentRoomId) {
        alert('Cậu vui lòng nhập đầy đủ Tên và Mã phòng nha!');
        return;
    }

    socket.emit('joinRoom', { roomId: currentRoomId, playerName: myPlayerName });
    document.getElementById('lobby-room-title').textContent = `Mã phòng: ${currentRoomId}`;
    showScreen('screen-lobby');
});

// Nhận danh sách người chơi từ Server
socket.on('updatePlayerList', ({ players, readyCount }) => {
    const listEl = document.getElementById('lobby-player-list');
    listEl.innerHTML = '';

    players.forEach((p, idx) => {
        const li = document.createElement('li');
        let text = `${idx + 1}. "${p.name}"`;
        if (p.isHost) text += ' - CHỦ PHÒNG';
        if (p.isReady) text += ' (Đã Sẵn Sàng)';
        li.textContent = text;
        listEl.appendChild(li);
    });

    document.getElementById('ready-count').textContent = `${readyCount}/${players.length}`;

    // Kiểm tra nếu mình là Chủ phòng
    const me = players.find(p => p.id === socket.id);
    if (me && me.isHost) {
        isHost = true;
        document.getElementById('host-game-select').classList.remove('hidden');
        document.getElementById('btn-ready').classList.add('hidden');
        document.getElementById('btn-start-game').classList.remove('hidden');
    }
});

// Bấm Sẵn sàng
document.getElementById('btn-ready').addEventListener('click', () => {
    isReady = !isReady;
    const btn = document.getElementById('btn-ready');
    btn.textContent = isReady ? 'Hủy Sẵn Sàng' : 'Sẵn sàng';
    btn.className = isReady ? 'btn secondary-btn' : 'btn success-btn';
    socket.emit('toggleReady', { roomId: currentRoomId, isReady });
});

// Chủ phòng bấm chọn Game 1
function selectGame(gameType) {
    if (gameType === 'masoi') {
        socket.emit('selectGame', { roomId: currentRoomId, gameType: 'masoi' });
    }
}

// Chủ phòng bấm Bắt đầu game
document.getElementById('btn-start-game').addEventListener('click', () => {
    socket.emit('requestStartGame', currentRoomId);
});