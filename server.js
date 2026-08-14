const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = {};

function generateRoles(playerCount) {
  let roles = [];
  let wolfCount = 1;
  if (playerCount >= 8) wolfCount = 2;
  if (playerCount >= 12) wolfCount = 3;

  for (let i = 0; i < wolfCount; i++) roles.push('Sói');
  roles.push('Tiên tri');
  roles.push('Bảo vệ');
  roles.push('Dân');
  roles.push('Dân');

  const optionalRoles = ['Phù thủy', 'Thợ Săn', 'Cupid', 'Thằng khờ'];
  const shuffledOptional = optionalRoles.sort(() => Math.random() - 0.5);

  while (roles.length < playerCount) {
    if (shuffledOptional.length > 0) {
      roles.push(shuffledOptional.pop());
    } else {
      roles.push('Dân');
    }
  }
  return roles.sort(() => Math.random() - 0.5);
}

// Kiểm tra điều kiện thắng (A, B, C, D)
function checkWinCondition(room, roomCode, foolEjectedId = null) {
  const alivePlayers = room.players.filter(p => p.isAlive);
  
  // D. Thằng khờ bị vote treo cổ
  if (foolEjectedId) {
    const foolPlayer = room.players.find(p => p.id === foolEjectedId);
    if (foolPlayer && foolPlayer.role === 'Thằng khờ') {
      endGame(roomCode, 'Thằng khờ chiến thắng');
      return true;
    }
  }

  // C. Cặp đôi Cupid sống đến khi còn số người tương ứng
  if (room.lovers.length === 2) {
    const loversAlive = room.lovers.every(id => {
      const p = room.players.find(pl => pl.id === id);
      return p && p.isAlive;
    });

    if (loversAlive) {
      const countedAlive = alivePlayers.filter(p => p.role !== 'Cupid');
      const wolvesAlive = alivePlayers.filter(p => p.role === 'Sói');
      if (countedAlive.length <= 4 && wolvesAlive.length <= 2) {
        endGame(roomCode, 'Phe Cupid chiến thắng');
        return true;
      }
    }
  }

  const wolves = alivePlayers.filter(p => p.role === 'Sói');
  const nonWolves = alivePlayers.filter(p => p.role !== 'Sói');

  // A. Toàn bộ Sói bị tiêu diệt -> Dân làng thắng
  if (wolves.length === 0) {
    endGame(roomCode, 'Dân làng chiến thắng');
    return true;
  }

  // B. Số Sói còn lại >= số người phe dân làng -> Sói thắng
  if (wolves.length >= nonWolves.length) {
    endGame(roomCode, 'Sói chiến thắng');
    return true;
  }

  return false;
}

function endGame(roomCode, winnerMessage) {
  const room = rooms[roomCode];
  if (!room) return;
  
  const rolesSummary = room.players.map(p => ({ name: p.name, role: p.role }));
  io.to(roomCode).emit('gameOver', {
    winnerMessage,
    rolesSummary
  });
}

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ playerName, roomCode }) => {
    socket.join(roomCode);
    socket.playerName = playerName;
    socket.roomCode = roomCode;

    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        hostId: socket.id,
        players: [],
        nightTurnIndex: 0,
        isFirstNight: true,
        protectedPreviousNight: null,
        wolfTarget: null,
        wolfVotes: {},
        witchPotions: { heal: true, poison: true },
        lovers: [],
        deadPlayers: new Set(),
        votes: {},
        nightReadyPlayers: new Set(),
        loversAckCount: 0
      };
    }

    const room = rooms[roomCode];
    if (!room.players.find(p => p.id === socket.id)) {
      room.players.push({
        id: socket.id,
        name: playerName,
        isHost: room.hostId === socket.id,
        isReady: false,
        isAlive: true,
        role: null
      });
    }

    io.to(roomCode).emit('updateLobby', {
      players: room.players,
      hostName: room.players.find(p => p.isHost)?.name
    });
  });

  socket.on('toggleReady', ({ isReady }) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) player.isReady = isReady;
    io.to(socket.roomCode).emit('updateLobby', {
      players: room.players,
      hostName: room.players.find(p => p.isHost)?.name
    });
  });

  socket.on('startGame', () => {
    const room = rooms[socket.roomCode];
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 4) {
      socket.emit('errorMessage', 'Cần tối thiểu 4 người chơi để bắt đầu!');
      return;
    }

    const assignedRoles = generateRoles(room.players.length);
    room.players.forEach((player, index) => {
      player.role = assignedRoles[index];
      player.isAlive = true;
    });

    room.players.forEach(player => {
      io.to(player.id).emit('receiveRole', { role: player.role, name: player.name });
    });
  });

  socket.on('restartGame', () => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    room.nightTurnIndex = 0;
    room.isFirstNight = true;
    room.protectedPreviousNight = null;
    room.wolfTarget = null;
    room.wolfVotes = {};
    room.witchPotions = { heal: true, poison: true };
    room.lovers = [];
    room.deadPlayers = new Set();
    room.votes = {};
    room.nightReadyPlayers = new Set();

    const assignedRoles = generateRoles(room.players.length);
    room.players.forEach((player, index) => {
      player.role = assignedRoles[index];
      player.isAlive = true;
    });

    room.players.forEach(player => {
      io.to(player.id).emit('receiveRole', { role: player.role, name: player.name });
    });
  });

  socket.on('requestStartNight', () => {
    const room = rooms[socket.roomCode];
    if (!room) return;

    room.nightReadyPlayers.add(socket.id);
    const alivePlayers = room.players.filter(p => p.isAlive);

    socket.emit('waitingForOthersToSleep');

    if (room.nightReadyPlayers.size >= alivePlayers.length) {
      room.nightReadyPlayers.clear();
      io.to(socket.roomCode).emit('allReadyForNightNotice');
      
      setTimeout(() => {
        room.nightTurnIndex = 0;
        room.wolfTarget = null;
        room.wolfVotes = {};
        processNextNightTurn(room, socket.roomCode);
      }, 10000);
    }
  });

  socket.on('cupidSelectLovers', ({ lover1Id, lover2Id }) => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    room.lovers = [lover1Id, lover2Id];
    room.loversAckCount = 0;

    const p1 = room.players.find(p => p.id === lover1Id);
    const p2 = room.players.find(p => p.id === lover2Id);
    if (p1 && p2) {
      io.to(p1.id).emit('wakeUpLovers', { partnerName: p2.name, role: p1.role });
      io.to(p2.id).emit('wakeUpLovers', { partnerName: p1.name, role: p2.role });
    }
  });

  socket.on('confirmLoverAck', () => {
    const room = rooms[socket.roomCode];
    if (!room) return;
    room.loversAckCount++;
    if (room.loversAckCount >= 2) {
      setTimeout(() => {
        scheduleNextNightTurn(room, socket.roomCode);
      }, 10000);
    }
  });

  socket.on('submitNightAction', (data) => {
    const room = rooms[socket.roomCode];
    if (!room) return;

    if (data.role === 'Bảo vệ') {
      room.protectedPreviousNight = data.targetId;
      scheduleNextNightTurn(room, socket.roomCode);
    } else if (data.role === 'Sói') {
      room.wolfVotes[socket.id] = data.targetId;
      const aliveWolves = room.players.filter(p => p.role === 'Sói' && p.isAlive);
      
      if (Object.keys(room.wolfVotes).length >= aliveWolves.length) {
        const chosenTargets = Object.values(room.wolfVotes);
        const allSame = chosenTargets.every(val => val === chosenTargets[0]);
        if (allSame && chosenTargets[0]) {
          room.wolfTarget = chosenTargets[0];
        } else {
          room.wolfTarget = null;
        }
        scheduleNextNightTurn(room, socket.roomCode);
      }
    } else if (data.role === 'Phù thủy') {
      if (data.useHeal && room.wolfTarget) {
        room.witchPotions.heal = false;
        room.wolfTarget = null;
      }
      if (data.poisonTargetId) {
        room.witchPotions.poison = false;
        room.deadPlayers.add(data.poisonTargetId);
      }
      if (!room.witchPotions.heal && !room.witchPotions.poison) {
        const witchPlayer = room.players.find(p => p.id === socket.id);
        if (witchPlayer) witchPlayer.role = 'Dân';
      }
      scheduleNextNightTurn(room, socket.roomCode);
    } else {
      scheduleNextNightTurn(room, socket.roomCode);
    }
  });

  // BỎ PHIẾU TREO CỔ BAN NGÀY
  socket.on('submitVote', ({ votedTargetId }) => {
    const room = rooms[socket.roomCode];
    if (!room) return;

    room.votes[socket.id] = votedTargetId;
    
    const targetPlayer = room.players.find(p => p.id === votedTargetId);
    socket.emit('voteSubmittedAck', {
      votedName: targetPlayer ? targetPlayer.name : null
    });

    const alivePlayers = room.players.filter(p => p.isAlive);
    if (Object.keys(room.votes).length >= alivePlayers.length) {
      const voteCounts = {};
      Object.values(room.votes).forEach(tId => {
        if (tId) voteCounts[tId] = (voteCounts[tId] || 0) + 1;
      });

      let maxVotes = 0;
      let eliminatedId = null;
      let isTie = false;

      for (const [tId, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count;
          eliminatedId = tId;
          isTie = false;
        } else if (count === maxVotes) {
          isTie = true;
        }
      }

      let eliminatedPlayer = null;
      if (!isTie && eliminatedId && maxVotes > 0) {
        eliminatedPlayer = room.players.find(p => p.id === eliminatedId);
      }

      // Kiểm tra Thằng khờ bị treo cổ
      if (eliminatedPlayer && checkWinCondition(room, socket.roomCode, eliminatedPlayer.id)) {
        room.votes = {};
        return;
      }

      const wolvesRemaining = room.players.filter(p => p.role === 'Sói' && p.isAlive).length;
      const totalWolves = room.players.filter(p => p.role === 'Sói').length;
      const remainingAlive = room.players.filter(p => p.isAlive).map(p => p.name);

      io.to(socket.roomCode).emit('voteSummaryResult', {
        eliminatedName: eliminatedPlayer ? eliminatedPlayer.name : null,
        wolvesRemainingMsg: `${wolvesRemaining}/${totalWolves}`,
        aliveList: remainingAlive
      });

      if (eliminatedPlayer) {
        const currentAliveList = room.players.filter(pl => pl.isAlive).map(pl => ({ id: pl.id, name: pl.name }));
        if (eliminatedPlayer.role === 'Thợ Săn') {
          io.to(eliminatedPlayer.id).emit('youAreDead', { isHunter: true, alivePlayers: currentAliveList });
        } else {
          eliminatedPlayer.isAlive = false;
          io.to(eliminatedPlayer.id).emit('youAreDead', { isHunter: false });
        }
      }

      room.votes = {};
      checkWinCondition(room, socket.roomCode);
    }
  });

  // Xử lý khi Thợ Săn thực hiện bắn người
  socket.on('hunterShoot', ({ targetId }) => {
    const room = rooms[socket.roomCode];
    if (!room) return;

    // 1. Đánh dấu Thợ Săn chính thức chết
    const hunterPlayer = room.players.find(p => p.id === socket.id);
    if (hunterPlayer) hunterPlayer.isAlive = false;

    // 2. Đánh dấu Người bị Thợ Săn chọn bắn cũng chết cùng lúc
    const targetPlayer = room.players.find(p => p.id === targetId);
    if (targetPlayer) {
      targetPlayer.isAlive = false;
      io.to(targetId).emit('youAreDead', { isHunter: targetPlayer.role === 'Thợ Săn' });
    }

    io.to(socket.roomCode).emit('playerKilledByHunter', { 
      hunterName: socket.playerName, 
      targetName: targetPlayer ? targetPlayer.name : 'không ai' 
    });

    checkWinCondition(room, socket.roomCode);
  });

  socket.on('disconnect', () => {
    const room = rooms[socket.roomCode];
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      io.to(socket.roomCode).emit('updateLobby', {
        players: room.players,
        hostName: room.players.find(p => p.isHost)?.name
      });
    }
  });
});

function scheduleNextNightTurn(room, roomCode) {
  room.nightTurnIndex++;
  processNextNightTurn(room, roomCode);
}

function processNextNightTurn(room, roomCode) {
  let turnOrder = ['Bảo vệ', 'Sói', 'Tiên tri', 'Phù thủy'];
  if (room.isFirstNight) {
    turnOrder = ['Cupid', 'Bảo vệ', 'Sói', 'Tiên tri', 'Phù thủy'];
  }

  if (room.nightTurnIndex >= turnOrder.length) {
    room.isFirstNight = false;
    if (room.wolfTarget && room.wolfTarget !== room.protectedPreviousNight) {
      room.deadPlayers.add(room.wolfTarget);
    }

    let finalDead = new Set(room.deadPlayers);
    room.deadPlayers.forEach(deadId => {
      if (room.lovers.includes(deadId)) {
        room.lovers.forEach(lId => finalDead.add(lId));
      }
    });

    finalDead.forEach(deadId => {
      const p = room.players.find(player => player.id === deadId);
      if (p) {
        const currentAliveList = room.players.filter(pl => pl.isAlive).map(pl => ({ id: pl.id, name: pl.name }));
        if (p.role === 'Thợ Săn') {
          io.to(deadId).emit('youAreDead', { isHunter: true, alivePlayers: currentAliveList });
        } else {
          p.isAlive = false;
          io.to(deadId).emit('youAreDead', { isHunter: false });
        }
      }
    });

    if (checkWinCondition(room, roomCode)) return;

    const alivePlayers = room.players.filter(p => p.isAlive).map(p => ({ id: p.id, name: p.name }));
    io.to(roomCode).emit('morningHasCome', { alivePlayers });
    return;
  }

  const currentRoleTurn = turnOrder[room.nightTurnIndex];

  if (currentRoleTurn === 'Sói') {
    const aliveWolves = room.players.filter(p => p.role === 'Sói' && p.isAlive);
    if (aliveWolves.length > 0) {
      const alivePlayers = room.players.filter(p => p.isAlive).map(p => ({ id: p.id, name: p.name }));
      aliveWolves.forEach(wolf => {
        io.to(wolf.id).emit('yourTurnToWakeUp', {
          role: 'Sói',
          playersList: alivePlayers
        });
      });
      return;
    }
  } else {
    const activePlayer = room.players.find(p => p.role === currentRoleTurn && p.isAlive);
    if (activePlayer) {
      const alivePlayers = room.players.filter(p => p.isAlive).map(p => ({ id: p.id, name: p.name, role: p.role }));
      const victimPlayer = room.players.find(p => p.id === room.wolfTarget);
      
      io.to(activePlayer.id).emit('yourTurnToWakeUp', {
        role: currentRoleTurn,
        playersList: alivePlayers,
        disabledTargetId: currentRoleTurn === 'Bảo vệ' ? room.protectedPreviousNight : null,
        victimName: victimPlayer ? victimPlayer.name : null,
        victimId: room.wolfTarget,
        witchPotions: room.witchPotions
      });
      return;
    }
  }

  room.nightTurnIndex++;
  processNextNightTurn(room, roomCode);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));