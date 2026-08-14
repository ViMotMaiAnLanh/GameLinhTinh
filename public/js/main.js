const socket = io();
let myName = '';
let myRole = null;
let isDead = false;
let isReadyState = false;
let selectedPlayerId = null;
let selectedVoteTargetId = null;
let selectedHunterTargetId = null;
let useWitchHeal = false;
let poisonTargetId = null;
let isHost = false;

// Hàm hỗ trợ rung điện thoại (chỉ Android / thiết bị có hỗ trợ API Vibrate)
function triggerVibrate() {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([400, 150, 400]);
    } catch (e) {
      console.log("Không thể rung:", e);
    }
  }
}

function goToScreen(screenId) {
  if (isDead && screenId !== 'screen-end' && screenId !== 'screen-1') {
    screenId = 'screen-dead';
  }
  document.querySelectorAll('.screen-section').forEach(el => el.classList.remove('active'));
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) targetScreen.classList.add('active');
}

function joinRoom() {
  const nameInput = document.getElementById('player-name-input')?.value.trim();
  const roomInput = document.getElementById('room-code-input')?.value.trim();
  if (!nameInput || !roomInput) {
    alert("Vui lòng nhập đầy đủ Tên và Mã phòng!");
    return;
  }
  myName = nameInput;
  socket.emit('joinRoom', { playerName: nameInput, roomCode: roomInput });
  goToScreen('screen-2');
}

function toggleReady() {
  isReadyState = !isReadyState;
  socket.emit('toggleReady', { isReady: isReadyState });
  const readyBtn = document.getElementById('btn-ready');
  if (readyBtn) {
    readyBtn.innerText = isReadyState ? 'Hủy Sẵn Sàng' : 'Sẵn sàng';
    readyBtn.style.backgroundColor = isReadyState ? '#7f8c8d' : '#2ecc71';
  }
}

socket.on('updateLobby', (data) => {
  const { players, hostName } = data;
  const me = players.find(p => p.id === socket.id);
  if (me) isHost = me.isHost;

  const roomTitle = document.getElementById('lobby-title');
  if (roomTitle) roomTitle.innerText = `Chủ phòng - ${hostName || '...'}`;

  const readyCount = players.filter(p => p.isReady).length;
  const readyBox = document.getElementById('ready-count');
  if (readyBox) readyBox.innerText = `${readyCount}/${players.length}`;

  const playerListContainer = document.getElementById('player-list');
  if (playerListContainer) {
    let htmlContent = `<strong>Người đang tham gia:</strong><br>`;
    players.forEach((p, index) => {
      const hostText = p.isHost ? ' - CHỦ PHÒNG' : '';
      const readyText = p.isReady ? ' (Đã sẵn sàng)' : '';
      htmlContent += `${index + 1}. "${p.name}"${hostText}${readyText}<br>`;
    });
    playerListContainer.innerHTML = htmlContent;
  }
});

function startGame() {
  socket.emit('startGame');
}

socket.on('errorMessage', (msg) => alert(msg));

socket.on('receiveRole', (data) => {
  myRole = data.role;
  myName = data.name;
  isDead = false;

  const roleTitle = document.getElementById('role-title');
  if (roleTitle) roleTitle.innerText = `"${data.name}" - ${myRole.toUpperCase()}`;
  const roleImg = document.getElementById('role-card-img');
  if (roleImg) roleImg.src = `${encodeURIComponent(myRole)}.jpe`;
  goToScreen('screen-4');
});

function requestStartNight() {
  if (isDead) {
    goToScreen('screen-dead');
    return;
  }
  socket.emit('requestStartNight');
}

socket.on('waitingForOthersToSleep', () => {
  const sleepNameBox = document.getElementById('sleep-player-name');
  if (sleepNameBox) sleepNameBox.innerText = `“${myName}”`;
  const sleepStatus = document.getElementById('sleep-status-text');
  if (sleepStatus) sleepStatus.innerText = "Tiếp tục ngủ và đợi\nkết thúc đêm";
  goToScreen('screen-sleep');
});

socket.on('allReadyForNightNotice', () => {});

socket.on('wakeUpLovers', (data) => {
  triggerVibrate(); // Chỉ rung khi tới lượt Cặp đôi
  const titleBox = document.getElementById('lover-result-title');
  if (titleBox) titleBox.innerText = `“${myName}” - ${data.role || myRole}`;
  const partnerBox = document.getElementById('lover-partner-name');
  if (partnerBox) partnerBox.innerText = data.partnerName;
  goToScreen('screen-lover-result');
});

function confirmLoverAndSleep() {
  socket.emit('confirmLoverAck');
  goToSleepScreen();
}

socket.on('yourTurnToWakeUp', (data) => {
  if (isDead) return;
  selectedPlayerId = null;
  useWitchHeal = false;
  poisonTargetId = null;

  goToScreen('screen-night-action');
  triggerVibrate(); // Chỉ rung khi tới lượt chức năng thức dậy

  const actionTitle = document.getElementById('action-title');
  if (actionTitle) actionTitle.innerText = `Lượt của: ${data.role.toUpperCase()}`;
  const targetListContainer = document.getElementById('target-player-list');
  const witchBox = document.getElementById('witch-options');
  const finishBtn = document.getElementById('btn-finish-turn');

  if (witchBox) witchBox.style.display = 'none';
  if (targetListContainer) targetListContainer.innerHTML = '';
  if (finishBtn) finishBtn.style.display = 'block';

  if (data.role === 'Cupid') {
    let selectedLovers = [];
    alert("💘 Cupid chọn 2 người để ghép thành Cặp Đôi!");
    data.playersList.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'btn player-opt';
      btn.innerText = p.name;
      btn.onclick = () => {
        if (selectedLovers.includes(p.id)) {
          selectedLovers = selectedLovers.filter(id => id !== p.id);
          btn.style.backgroundColor = '#cccccc';
        } else if (selectedLovers.length < 2) {
          selectedLovers.push(p.id);
          btn.style.backgroundColor = '#e74c3c';
        }
        if (selectedLovers.length === 2) {
          socket.emit('cupidSelectLovers', { lover1Id: selectedLovers[0], lover2Id: selectedLovers[1] });
          goToSleepScreen();
        }
      };
      targetListContainer.appendChild(btn);
    });
  } 
  else if (data.role === 'Phù thủy') {
    if (witchBox) {
      witchBox.style.display = 'block';
      let html = '';
      if (data.victimName) {
        html += `<p style="margin-bottom:8px;">Đêm nay <b>${data.victimName}</b> bị Sói cắn!</p>`;
        if (data.witchPotions.heal) {
          html += `<button class="btn" id="btn-heal" onclick="toggleHeal()" style="background:#2ecc71; margin-bottom:8px;">Dùng Bình Cứu</button><br>`;
        }
      } else {
        html += `<p style="margin-bottom:8px;">Đêm nay không ai bị Sói cắn.</p>`;
      }
      
      if (data.witchPotions.poison) {
        html += `<p style="font-size:12px; margin-top:5px;">Chọn 1 người bên dưới nếu muốn Dùng Bình Độc:</p>`;
      }
      witchBox.innerHTML = html;
    }

    if (data.witchPotions.poison) {
      data.playersList.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'btn player-opt';
        btn.innerText = p.name;
        btn.onclick = () => {
          document.querySelectorAll('.player-opt').forEach(b => b.style.backgroundColor = '#cccccc');
          btn.style.backgroundColor = '#e74c3c';
          poisonTargetId = p.id;
        };
        targetListContainer.appendChild(btn);
      });
    }
  } 
  else {
    data.playersList.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'btn player-opt';
      btn.innerText = p.name;

      if (data.disabledTargetId === p.id) {
        btn.disabled = true;
        btn.innerText += ' (Đã bảo vệ đêm trước)';
      } else {
        btn.onclick = () => {
          document.querySelectorAll('.player-opt').forEach(b => b.style.backgroundColor = '#cccccc');
          btn.style.backgroundColor = '#f1c40f';
          selectedPlayerId = p.id;

          if (data.role === 'Tiên tri') {
            const isWolf = p.role === 'Sói';
            showSeerResult(p.name, isWolf);
          }
        };
      }
      targetListContainer.appendChild(btn);
    });
  }
});

function showSeerResult(targetName, isWolf) {
  const seerTitle = document.getElementById('seer-result-title');
  if (seerTitle) seerTitle.innerText = `“${myName}” - Tiên tri`;
  const seerText = document.getElementById('seer-result-text');
  if (seerText) {
    seerText.innerText = `${targetName} - ${isWolf ? 'là sói' : 'không phải sói'}`;
  }
  goToScreen('screen-seer-result');
}

function confirmSeerAndSleep() {
  socket.emit('submitNightAction', {
    role: 'Tiên tri',
    targetId: selectedPlayerId
  });
  goToSleepScreen();
}

function toggleHeal() {
  useWitchHeal = !useWitchHeal;
  const btnHeal = document.getElementById('btn-heal');
  if (btnHeal) {
    btnHeal.innerText = useWitchHeal ? 'Đã chọn Cứu' : 'Dùng Bình Cứu';
    btnHeal.style.backgroundColor = useWitchHeal ? '#f1c40f' : '#2ecc71';
  }
}

function finishNightTurn() {
  socket.emit('submitNightAction', {
    role: myRole,
    targetId: selectedPlayerId,
    useHeal: useWitchHeal,
    poisonTargetId: poisonTargetId
  });
  goToSleepScreen();
}

function goToSleepScreen() {
  const sleepNameBox = document.getElementById('sleep-player-name');
  if (sleepNameBox) sleepNameBox.innerText = `“${myName}”`;
  const sleepStatus = document.getElementById('sleep-status-text');
  if (sleepStatus) sleepStatus.innerText = "Tiếp tục ngủ và đợi\nkết thúc đêm";
  goToScreen('screen-sleep');
}

// KHI TRỜI SÁNG (KẾT THÚC ĐÊM) -> MỚI PHÁT FILE ÂM THANH
socket.on('morningHasCome', (data) => {
  const bellAudio = document.getElementById('morning-bell');
  if (bellAudio) {
    bellAudio.currentTime = 0;
    bellAudio.play().catch(e => console.log("Cần tương tác màn hình để phát âm thanh:", e));
  }

  if (isDead) {
    goToScreen('screen-dead');
    return;
  }

  selectedVoteTargetId = null;
  const headerName = document.getElementById('vote-header-name');
  if (headerName) headerName.innerText = `“${myName}”`;

  const voteContainer = document.getElementById('vote-target-container');
  if (voteContainer && data.alivePlayers) {
    voteContainer.innerHTML = '';
    data.alivePlayers.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'btn vote-opt-btn';
      btn.innerText = p.name;
      btn.onclick = () => {
        document.querySelectorAll('.vote-opt-btn').forEach(b => b.style.backgroundColor = '#cccccc');
        btn.style.backgroundColor = '#e74c3c';
        selectedVoteTargetId = p.id;
      };
      voteContainer.appendChild(btn);
    });
  }
  goToScreen('screen-day-vote');
});

function confirmVoteAction() {
  if (!selectedVoteTargetId) {
    alert("Vui lòng nhấp chọn 1 người chơi để bỏ phiếu!");
    return;
  }
  socket.emit('submitVote', { votedTargetId: selectedVoteTargetId });
}

function submitNoVote() {
  socket.emit('submitVote', { votedTargetId: null });
}

socket.on('voteSubmittedAck', (data) => {
  const waitName = document.getElementById('vote-wait-name');
  if (waitName) waitName.innerText = `“${myName}”`;

  const waitChoiceBtn = document.getElementById('vote-wait-choice-btn');
  if (waitChoiceBtn) {
    if (data.votedName) {
      waitChoiceBtn.innerText = data.votedName;
    } else {
      waitChoiceBtn.innerText = "Phiếu trắng";
    }
  }
  goToScreen('screen-vote-waiting');
});

socket.on('voteSummaryResult', (data) => {
  if (isDead) {
    goToScreen('screen-dead');
    return;
  }

  const headerTitle = document.getElementById('summary-header-title');
  if (headerTitle) headerTitle.innerText = `“${myName}” - Tổng kết ngày`;

  const ejectedText = document.getElementById('summary-ejected-text');
  if (ejectedText) {
    if (data.eliminatedName) {
      ejectedText.innerText = `“${data.eliminatedName}” - đã bị treo cổ`;
    } else {
      ejectedText.innerText = "Không ai bị treo cổ";
    }
  }

  const wolfCountText = document.getElementById('summary-wolf-count');
  if (wolfCountText) wolfCountText.innerText = data.wolvesRemainingMsg;

  const aliveListContainer = document.getElementById('summary-alive-list');
  if (aliveListContainer && data.aliveList) {
    let html = '';
    data.aliveList.forEach((name, idx) => {
      html += `${idx + 1}. “${name}”<br>`;
    });
    aliveListContainer.innerHTML = html;
  }

  goToScreen('screen-day-summary');
});

// NHẬN THÔNG BÁO BỊ CHẾT VÀ KÍCH HOẠT KỸ NĂNG THỢ SĂN
socket.on('youAreDead', (data) => {
  if (data && data.isHunter) {
    selectedHunterTargetId = null;
    const hunterHeader = document.getElementById('hunter-header-title');
    if (hunterHeader) hunterHeader.innerText = `“${myName}” - Thợ săn`;

    const hunterContainer = document.getElementById('hunter-target-container');
    if (hunterContainer && data.alivePlayers) {
      hunterContainer.innerHTML = '';
      data.alivePlayers.forEach(p => {
        if (p.id !== socket.id) {
          const btn = document.createElement('button');
          btn.className = 'btn hunter-opt-btn';
          btn.innerText = p.name;
          btn.style.backgroundColor = '#d1c7c7';
          btn.onclick = () => {
            document.querySelectorAll('.hunter-opt-btn').forEach(b => b.style.backgroundColor = '#d1c7c7');
            btn.style.backgroundColor = '#e74c3c';
            selectedHunterTargetId = p.id;
          };
          hunterContainer.appendChild(btn);
        }
      });
    }
    goToScreen('screen-hunter-action');
  } else {
    isDead = true;
    goToScreen('screen-dead');
  }
});

function confirmHunterShot() {
  if (!selectedHunterTargetId) {
    alert("Vui lòng chọn 1 người chơi để bắn!");
    return;
  }
  
  socket.emit('hunterShoot', { targetId: selectedHunterTargetId });
  isDead = true;
  goToScreen('screen-dead');
}

socket.on('gameOver', (data) => {
  const endHeader = document.getElementById('end-header-title');
  if (endHeader) {
    endHeader.innerText = isHost ? `“${myName}” - chủ phòng` : `“${myName}”`;
  }

  const winnerTitle = document.getElementById('end-winner-title');
  if (winnerTitle) winnerTitle.innerText = data.winnerMessage;

  const rolesListContainer = document.getElementById('end-roles-list');
  if (rolesListContainer && data.rolesSummary) {
    let html = '';
    data.rolesSummary.forEach((item, idx) => {
      html += `${idx + 1}. “${item.name}” - ${item.role}<br>`;
    });
    rolesListContainer.innerHTML = html;
  }

  goToScreen('screen-end');
});

function restartGame() {
  socket.emit('restartGame');
}

function exitGame() {
  window.location.reload();
}