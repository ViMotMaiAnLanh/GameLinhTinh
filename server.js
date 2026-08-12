const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Trỏ Express vào thư mục public để đọc file tĩnh (index.html, CSS, JS...)
app.use(express.static(path.join(__dirname, "public")));

// Trả về file index.html từ trong thư mục public khi vào trang chủ
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("Có người kết nối mới:", socket.id);

  // 1. TẠO PHÒNG
  socket.on("createRoom", (playerName) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

    rooms[roomId] = {
      host: socket.id,
      players: [
        {
          id: socket.id,
          name: playerName
        }
      ]
    };

    socket.join(roomId);

    // Gửi phản hồi về cho Chủ phòng
    socket.emit("roomCreated", {
      roomId: roomId,
      players: rooms[roomId].players,
      isHost: true
    });

    console.log(`[TẠO PHÒNG] ${playerName} đã tạo phòng ${roomId}`);
  });

  // 2. THAM GIA PHÒNG
  socket.on("joinRoom", ({ roomId, playerName }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit("joinError", "Mã phòng không tồn tại!");
      return;
    }

    const alreadyJoined = room.players.some((player) => player.id === socket.id);
    if (alreadyJoined) return;

    room.players.push({
      id: socket.id,
      name: playerName
    });

    socket.join(roomId);

    // Cập nhật danh sách người chơi cho TẤT CẢ mọi người trong phòng
    io.to(roomId).emit("playersUpdated", {
      players: room.players,
      hostId: room.host
    });

    console.log(`[VÀO PHÒNG] ${playerName} đã tham gia phòng ${roomId}`);
  });

  // 3. BẮT ĐẦU GAME
  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];

    if (room && room.host === socket.id) {
      io.to(roomId).emit("gameStarted");
      console.log(`[START GAME] Phòng ${roomId} bắt đầu chơi!`);
    }
  });

  // 4. XỬ LÝ KHI CÓ NGƯỜI THOÁT
  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.findIndex((p) => p.id === socket.id);

      if (index !== -1) {
        room.players.splice(index, 1);

        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
          // Nếu chủ phòng thoát, chuyển quyền Host cho người tiếp theo
          if (room.host === socket.id) {
            room.host = room.players[0].id;
          }

          io.to(roomId).emit("playersUpdated", {
            players: room.players,
            hostId: room.host
          });
        }
        break;
      }
    }
  });
});

// Lấy Port tự động do Render cấp khi chạy Online, nếu chạy local thì mới dùng 3000
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại cổng: ${PORT}`);
});