const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Phục vụ các file tĩnh trong thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Quản lý dữ liệu các phòng chơi
const rooms = {};

// Thứ tự gọi ban đêm
const NIGHT_ORDER = ['Cupid', 'Bảo vệ', 'Thợ săn', 'Tiên tri', 'Sói', 'Phù thủy'];

// Thuật toán phân vai tự động (6 - 12 người)
function assignRoles(playerList) {
    const total = playerList.length;
    let roles = [];

    if (total >= 6 && total <= 7) {
        roles = ['Sói', 'Bảo vệ', 'Tiên tri'];
        while (roles.length < total) roles.push('Dân');
    } else if (total >= 8 && total <= 10) {
        roles = ['Sói', 'Sói', 'Tiên tri', 'Bảo vệ', 'Dân', 'Dân'];
        const optional = ['Phù thủy', 'Thằng khờ', 'Thợ săn', 'Dân'];
        while (roles.length < total) {
            const randIndex = Math.floor(Math.random() * optional.length);
            roles.push(optional[randIndex]);
        }
    } else if (total >= 11 && total <= 12) {
        roles = ['Sói', 'Sói', 'Tiên tri', 'Bảo vệ', 'Dân', 'Dân'];
        const optional = ['Cupid', 'Thằng khờ', 'Thợ săn', 'Phù thủy', 'Dân'];
        while (roles.length < total) {
            const randIndex = Math.floor(Math.random() * optional.length);
            roles.push(optional[randIndex]);
        }
    }
    // Trộn ngẫu nhiên
    return roles.sort(() => Math.random() - 0.5);
}

// Kiểm tra điều kiện thắng
function checkWinCondition(room, causeOfDeath) {
    const alivePlayers = room.players.filter(p => p.isAlive);
    const aliveWolves = alivePlayers.filter(p => p.role === 'Sói');
    const aliveOthers = alivePlayers.filter(p => p.role !== 'Sói');

    // 1. Thằng khờ thắng khi bị vote chết ban ngày
    if (causeOfDeath === 'vote' && room.lastVotedPlayer && room.lastVotedPlayer.role === 'Thằng khờ') {
        return { gameOver: true, winner: 'THẰNG KHỜ THẮNG!' };
    }

    // 2. Cặp đôi Cupid thắng (Nếu chỉ còn 2 người sống và là cặp đôi)
    if (alivePlayers.length === 2 && room.couple && room.couple.length === 2) {
        const isCoupleAlive = room.couple.every(id => {
            const p = room.players.find(pl => pl.id === id);
            return p && p.isAlive;
        });
        if (isCoupleAlive) return { gameOver: true, winner: 'PHE CUPID / CẶP ĐÔI THẮNG!' };
    }

    // 3. Phe Dân làng thắng (Sói chết hết)
    if (aliveWolves.length === 0) {
        return { gameOver: true, winner: 'DÂN LÀNG THẮNG!' };
    }

    // 4. Phe Sói thắng (Số Sói >= Số người phe khác còn sống)
    if (aliveWolves.length >= aliveOthers.length) {
        return { gameOver: true, winner: 'SÓI THẮNG!' };
    }

    return { gameOver: false };
}

// Lắng nghe kết nối Socket.io
io.on('connection', (socket) => {
    console.log('Người chơi kết nối:', socket.id);

    // Xử lý tạo phòng / vào phòng...
    socket.on('joinRoom', ({ roomId, playerName }) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = {
                id: roomId,
                host: socket.id,
                players: [],
                nightCount: 0,
                couple: [],
                witchMedicines: { heal: true, poison: true },
                nightActions: {}
            };
        }
        
        const room = rooms[roomId];
        room.players.push({
            id: socket.id,
            name: playerName,
            role: '',
            isAlive: true,
            protectedLastNight: false
        });

        io.to(roomId).emit('updatePlayerList', room.players);
    });

    // Bắt đầu game & Phân vai
    socket.on('startGame', (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        const roles = assignRoles(room.players);
        room.players.forEach((player, index) => {
            player.role = roles[index];
            io.to(player.id).emit('receiveRole', { role: player.role });
        });
    });

    socket.on('disconnect', () => {
        console.log('Người chơi ngắt kết nối:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại port ${PORT}`);
});