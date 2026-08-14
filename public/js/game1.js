// Dữ liệu hình ảnh và hướng dẫn từng chức năng
const ROLE_DATA = {
    'Tiên tri': {
        img: 'Tiên tri.jpe',
        desc: 'Mỗi đêm khi thức dậy bạn sẽ được chọn 1 người chơi bất kỳ để xem người đó có phải dân làng hay không. Sống sót đến cuối và giành chiến thắng cùng dân làng.'
    },
    'Sói': {
        img: 'Sói.jpe',
        desc: 'Mỗi đêm bạn sẽ được chọn giết 1 người chơi bất kỳ. Sống sót đến cuối khi bạn giết được hết dân làng.'
    },
    'Thợ săn': {
        img: 'Thợ Săn.jpe',
        desc: 'Mỗi đêm bạn được lựa chọn 1 người để đặt bẫy, nếu bạn chết người bị đặt bẫy cũng sẽ chết với bạn, bẫy có hiệu lực đến khi trời sáng. Sống sót đến cuối và giành chiến thắng cùng dân làng.'
    },
    'Bảo vệ': {
        img: 'Bảo vệ.jpe',
        desc: 'Bạn sẽ được lựa chọn bảo vệ 1 người vào mỗi đêm, có thể bảo vệ chính mình, không lựa cùng 1 người liên tiếp 2 đêm. Người bạn lựa chọn bảo vệ sẽ không chết vì sói và thuốc của phù thủy. Sống sót đến cuối và giành chiến thắng cùng dân làng.'
    },
    'Phù thủy': {
        img: 'Phù thủy.jpe',
        desc: 'Bạn có 2 lọ thuốc, 1 dùng để cứu sống 1 để giết người chơi khác. Sống sót đến cuối và giành chiến thắng cùng dân làng.'
    },
    'Cupid': {
        img: 'Thần tềnh iu.jpe',
        desc: 'Ở đêm đầu tiên, bạn sẽ chọn 2 người chơi bất kỳ để se duyên họ thành một cặp đôi. Nếu một trong hai người chết, người còn lại cũng sẽ chết theo. Mục tiêu của bạn là giúp cặp đôi sống sót!'
    },
    'Thằng khờ': {
        img: 'Thằng khờ.jpe',
        desc: 'Bạn là phe thứ 3, cố gắng để mọi người biểu quyết bạn thì bạn sẽ thắng, nếu bị giết bởi sói thì vẫn thua.'
    },
    'Dân': {
        img: 'Dân.jpe',
        desc: 'Cố gắng sống sót đến cuối và nhận ra được sói.'
    }
};

const roleImg = document.getElementById('role-img');
const roleTitle = document.getElementById('role-title');
const roleDesc = document.getElementById('role-desc');
const btnStartFirstNight = document.getElementById('btn-start-first-night');

// Nhận vai trò từ Server và hiển thị Thẻ Bài
socket.on('receiveRole', ({ role }) => {
    // Chuyển từ Sảnh chờ sang Màn hình Game Ma Sói
    lobbyScreen.classList.add('hidden');
    gameMasoiScreen.classList.remove('hidden');

    const data = ROLE_DATA[role] || ROLE_DATA['Dân'];
    roleImg.src = data.img;
    roleTitle.textContent = role;
    roleDesc.textContent = data.desc;

    // Chỉ chủ phòng mới thấy nút "Bắt đầu đêm đầu tiên"
    if (!isHost) {
        btnStartFirstNight.classList.add('hidden');
    }
});

// Bấm nút bắt đầu đêm đầu tiên
btnStartFirstNight.addEventListener('click', () => {
    btnStartFirstNight.classList.add('hidden');
    socket.emit('startNight', currentRoomId);
});

// Nhận lệnh rung điện thoại từ Server
socket.on('triggerVibrate', (pattern) => {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern || [200, 100, 200]);
    }
});

// Nhận lệnh phát âm thanh "Sáng.mp3"
socket.on('playMorningAudio', () => {
    const audio = document.getElementById('audio-sang');
    if (audio) {
        audio.play().catch(e => console.log('Chặn tự động phát âm thanh:', e));
    }
});