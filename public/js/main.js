const socket = io();

let currentRoomId = '';
let myPlayerName = '';
let isHost = false;

// Phần tử HTML
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameMasoiScreen = document.getElementById('game-masoi-screen');

const btnJoin = document.getElementById('btn-join');
const inputName = document.getElementById('player-name');
const inputRoom = document.getElementById('room-id');

const displayRoomId = document.getElementById('display-room-id');
const playerCount = document.getElementById('player-count');
const playerList = document.getElementById('player-list');
const hostControls = document.getElementById('host-controls');
const waitingMsg = document.getElementById('waiting-msg');

// Bấm nút Vào / Tạo Phòng
btnJoin.addEventListener('click', () => {
    myPlayerName = inputName.value.trim();
    currentRoomId = inputRoom.value.trim();

    if (!myPlayerName || !currentRoomId) {
        alert('Vui lòng nhập đầy đủ tên và mã phòng cậu ơi!');
        return;
    }

    // Gửi sự kiện lên Server
    socket.emit('joinRoom', { roomId: currentRoomId, playerName: myPlayerName });

    // Đổi màn hình sang Sảnh chờ
    loginScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    displayRoomId.textContent = currentRoomId;
});

// Nhận danh sách người chơi mới nhất từ Server
socket.on('updatePlayerList', (players) => {
    playerCount.textContent = players.length;
    playerList.innerHTML = '';

    players.forEach((p, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${p.name} ${p.id === socket.id ? '(Bạn)' : ''}`;
        playerList.appendChild(li);
    });

    // Kiểm tra xem mình có phải Chủ phòng (người vào đầu tiên) không
    if (players.length > 0 && players[0].id === socket.id) {
        isHost = true;
        hostControls.classList.remove('hidden');
        waitingMsg.classList.add('hidden');
    }
});

// Hàm chọn game dành cho Chủ phòng
function selectGame(gameType) {
    if (gameType === 'masoi') {
        const total = parseInt(playerCount.textContent);
        if (total < 6 || total > 12) {
            alert('Game Ma Sói cần từ 6 đến 12 người chơi cậu nha!');
            return;
        }
        socket.emit('startGame', currentRoomId);
    }
}