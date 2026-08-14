const ROLE_DATA = {
    'Tiên tri': { img: 'Tiên tri.jpe', desc: 'Mỗi đêm khi thức dậy bạn sẽ được chọn 1 người chơi bất kỳ để xem người đó có phải dân làng hay không. Sống sót đến cuối và giành chiến thắng cùng dân làng.' },
    'Sói': { img: 'Sói.jpe', desc: 'Mỗi đêm bạn sẽ được chọn giết 1 người chơi bất kỳ. Sống sót đến cuối khi bạn giết được hết dân làng.' },
    'Thợ săn': { img: 'Thợ săn.jpe', desc: 'Mỗi đêm bạn được lựa chọn 1 người để đặt bẫy, nếu bạn chết người bị đặt bẫy cũng sẽ chết với bạn, bẫy có hiệu lực đến khi trời sáng. Sống sót đến cuối và giành chiến thắng cùng dân làng.' },
    'Bảo vệ': { img: 'Bảo vệ.jpe', desc: 'Bạn sẽ được lựa chọn bảo vệ 1 người vào mỗi đêm, có thể bảo vệ chính mình, không lựa cùng 1 người liên tiếp 2 đêm. Người bạn lựa chọn bảo vệ sẽ không chết vì sói và thuốc của phù thủy.' },
    'Phù thủy': { img: 'Phù thủy.jpe', desc: 'Bạn có 2 lọ thuốc, 1 dùng để cứu sống 1 để giết người chơi khác. Sống sót đến cuối và giành chiến thắng cùng dân làng.' },
    'Cupid': { img: 'Thần tềnh iu.jpe', desc: 'Hãy chọn 2 người chơi để ghép cặp và trở thành phe thứ 3.' },
    'Thằng khờ': { img: 'Thằng khờ.jpe', desc: 'Bạn là phe thứ 3, cố gắng để mọi người biểu quyết bạn thì bạn sẽ thắng, nếu bị giết bởi sói thì vẫn thua.' },
    'Dân': { img: 'Dân.jpe', desc: 'Cố gắng sống sót đến cuối và nhận ra được sói.' }
};

let myRole = '';
let selectedTargets = [];

// 1. Nhận vai trò ban đầu
socket.on('receiveRole', ({ role }) => {
    myRole = role;
    const data = ROLE_DATA[role] || ROLE_DATA['Dân'];

    document.getElementById('reveal-player-name').textContent = `"${myPlayerName}" - ${role}`;
    document.getElementById('reveal-role-img').src = data.img;
    document.getElementById('reveal-role-desc').textContent = data.desc;

    if (isHost) {
        document.getElementById('btn-start-first-night').classList.remove('hidden');
        document.getElementById('waiting-first-night-msg').classList.add('hidden');
    }

    showScreen('screen-role-reveal');
});

// Chủ phòng bấm bắt đầu đêm đầu tiên
document.getElementById('btn-start-first-night').addEventListener('click', () => {
    socket.emit('startNight', currentRoomId);
});

// 2. Nhận lượt hành động ban đêm
socket.on('startNightTurn', ({ activeRole, alivePlayers, extraData }) => {
    showScreen('screen-night-action');
    document.getElementById('night-player-header').textContent = `"${myPlayerName}" - ${activeRole}`;
    
    const selector = document.getElementById('night-target-selector');
    selector.innerHTML = '';
    selectedTargets = [];

    // Render danh sách chọn người chơi
    alivePlayers.forEach(p => {
        const item = document.createElement('div');
        item.className = 'target-item';
        item.textContent = p.name;
        item.onclick = () => handleTargetSelect(item, p.id, activeRole);
        selector.appendChild(item);
    });

    document.getElementById('btn-night-confirm').classList.remove('hidden');
});

function handleTargetSelect(element, targetId, role) {
    if (role === 'Cupid') {
        // Cupid chọn 2 người
        if (selectedTargets.includes(targetId)) {
            selectedTargets = selectedTargets.filter(id => id !== targetId);
            element.classList.remove('selected');
        } else if (selectedTargets.length < 2) {
            selectedTargets.push(targetId);
            element.classList.add('selected');
        }
    } else {
        // Các vai còn lại chọn 1 người
        document.querySelectorAll('#night-target-selector .target-item').forEach(el => el.classList.remove('selected'));
        selectedTargets = [targetId];
        element.classList.add('selected');
    }
}

// Bấm nút Xác nhận lượt đêm
document.getElementById('btn-night-confirm').addEventListener('click', () => {
    socket.emit('submitNightAction', { roomId: currentRoomId, targets: selectedTargets });
    document.getElementById('btn-night-confirm').classList.add('hidden');
});

// 3. Thông báo Buổi Sáng
socket.on('startDayPhase', ({ deadNames, wolvesLeft, alivePlayers }) => {
    const audio = document.getElementById('audio-sang');
    if (audio) audio.play().catch(e => console.log(e));

    showScreen('screen-day');
    document.getElementById('day-header').textContent = `"${myPlayerName}" - Tiến hành thảo luận`;
    document.getElementById('wolves-left-count').textContent = `${wolvesLeft}/2`;
    
    const msgEl = document.getElementById('day-status-msg');
    msgEl.textContent = deadNames.length > 0 ? `Đêm qua có ${deadNames.length} người chết: ${deadNames.join(', ')}` : 'Đêm qua không có ai chết!';

    // Render danh sách Vote ban ngày
    const selector = document.getElementById('day-target-selector');
    selector.innerHTML = '';
    selectedTargets = [];

    alivePlayers.forEach(p => {
        const item = document.createElement('div');
        item.className = 'target-item';
        item.textContent = p.name;
        item.onclick = () => {
            document.querySelectorAll('#day-target-selector .target-item').forEach(el => el.classList.remove('selected'));
            selectedTargets = [p.id];
            item.classList.add('selected');
        };
        selector.appendChild(item);
    });

    document.getElementById('btn-vote-confirm').classList.remove('hidden');
    if (isHost) document.getElementById('btn-no-vote').classList.remove('hidden');
});

// Bấm Vote
document.getElementById('btn-vote-confirm').addEventListener('click', () => {
    if (selectedTargets.length === 0) return alert('Hãy chọn 1 người chơi!');
    socket.emit('submitVote', { roomId: currentRoomId, targetId: selectedTargets[0] });
    document.getElementById('btn-vote-confirm').classList.add('hidden');
});

// 4. Màn hình MÌNH BỊ CHẾT
socket.on('youAreDead', () => {
    showScreen('screen-dead');
});

// 5. Màn hình KẾT THÚC GAME
socket.on('gameOver', ({ winner, allRoles }) => {
    showScreen('screen-game-over');
    document.getElementById('winner-title').textContent = winner;

    const listEl = document.getElementById('game-over-role-list');
    listEl.innerHTML = '';
    allRoles.forEach((p, idx) => {
        const li = document.createElement('li');
        li.textContent = `${idx + 1}. "${p.name}" - ${p.role}`;
        listEl.appendChild(li);
    });

    if (isHost) {
        document.getElementById('btn-play-again').classList.remove('hidden');
        document.getElementById('btn-finish-room').classList.remove('hidden');
    }
});