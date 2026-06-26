/* =======================================================
   냥트리스 (Nang_Tris) Core Game Engine & Realtime Sync
======================================================= */

// --- 1. 전역 상태 및 설정 ---
let supabaseClient = null;
let currentUser = null;
let currentActiveSection = 'auth-section';

// 랭킹 & 로비 갱신 주기 및 실시간 채널 관리
let roomsRealtimeChannel = null;
let gameRealtimeChannel = null;
let activeRoomId = null;
let isHost = false;
let currentRankingMode = 'single'; // 'single' 또는 'multi'

// 오디오 설정
let audioCtx = null;
let isMuted = false;
let bgmTimer = null;
let currentNoteIndex = 0;

// BGM 멜로디 (Fredoka 테마에 어울리는 귀여운 8비트 풍 음계)
const bgmNotes = [
    { f: 523.25, d: 0.5 }, { f: 587.33, d: 0.5 }, { f: 659.25, d: 0.5 }, { f: 698.46, d: 0.5 },
    { f: 783.99, d: 1.0 }, { f: 783.99, d: 1.0 },
    { f: 880.00, d: 0.5 }, { f: 880.00, d: 0.5 }, { f: 987.77, d: 0.5 }, { f: 1046.50, d: 0.5 },
    { f: 783.99, d: 2.0 },
    { f: 698.46, d: 0.5 }, { f: 698.46, d: 0.5 }, { f: 659.25, d: 0.5 }, { f: 659.25, d: 0.5 },
    { f: 587.33, d: 1.0 }, { f: 523.25, d: 1.0 },
    { f: 587.33, d: 0.5 }, { f: 659.25, d: 0.5 }, { f: 587.33, d: 0.5 }, { f: 493.88, d: 0.5 },
    { f: 523.25, d: 2.0 }
];

// --- 2. 테트리스 게임 룰 & 데이터 정의 ---
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 25; // 25px per cell (화면 높이 맞춤)

// 테트리미노 블록 형상 (SRS 규격 기준 중심축 포함)
const MINOS = {
    'I': [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    'O': [[1,1],[1,1]],
    'T': [[0,1,0],[1,1,1],[0,0,0]],
    'S': [[0,1,1],[1,1,0],[0,0,0]],
    'Z': [[1,1,0],[0,1,1],[0,0,0]],
    'J': [[1,0,0],[1,1,1],[0,0,0]],
    'L': [[0,0,1],[1,1,1],[0,0,0]]
};

// 게임 변수들
let isGameRunning = false;
let isGamePaused = false;
let isMultiplayMode = false;
let dropCounter = 0;
let dropInterval = 1000; // ms
let lastTime = 0;

// 내 게임 상태
const gameStateSelf = {
    grid: createGrid(),
    currentPiece: null,
    nextPieceQueue: [],
    heldPiece: null,
    hasHeldThisTurn: false,
    score: 0,
    lines: 0,
    level: 1,
    garbageQueue: [], // 상대에게 받은 장애물 대기열
    attackGauge: 0    // 전송할 공격 게이지
};

// 상대방 게임 상태
const gameStateOpp = {
    grid: createGrid(),
    score: 0,
    lines: 0,
    heldPiece: null,
    nextPiece: null,
    attackGauge: 0,
    isGameOver: false
};

// Canvas 인스턴스
let canvasGridSelf, ctxGridSelf;
let canvasNextSelf, ctxNextSelf;
let canvasHoldSelf, ctxHoldSelf;
let canvasGridOpp, ctxGridOpp;
let canvasNextOpp, ctxNextOpp;
let canvasHoldOpp, ctxHoldOpp;

// --- 3. 초기화 및 환경설정 로드 ---
document.addEventListener('DOMContentLoaded', async () => {
    // Canvas 바인딩
    canvasGridSelf = document.getElementById('canvas-grid-self');
    ctxGridSelf = canvasGridSelf.getContext('2d');
    canvasNextSelf = document.getElementById('canvas-next-self');
    ctxNextSelf = canvasNextSelf.getContext('2d');
    canvasHoldSelf = document.getElementById('canvas-hold-self');
    ctxHoldSelf = canvasHoldSelf.getContext('2d');

    canvasGridOpp = document.getElementById('canvas-grid-opp');
    ctxGridOpp = canvasGridOpp.getContext('2d');
    canvasNextOpp = document.getElementById('canvas-next-opp');
    ctxNextOpp = canvasNextOpp.getContext('2d');
    canvasHoldOpp = document.getElementById('canvas-hold-opp');
    ctxHoldOpp = canvasHoldOpp.getContext('2d');

    // Lucide 아이콘 초기화
    lucide.createIcons();

    // 1단계: Supabase 연결 설정 로딩
    try {
        const response = await fetch('/config');
        const config = await response.json();
        
        if (config.SUPABASE_URL && config.SUPABASE_KEY) {
            const { createClient } = window.supabase;
            supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
            console.log("Supabase Client initialized successfully!");
        } else {
            console.error("Supabase credentials not found in config.");
        }
    } catch (e) {
        console.error("Failed to load config: ", e);
    }

    // 2단계: 자동 로그인 검사 (Youns-pg 공유 세션)
    const storedUser = localStorage.getItem('youns_tr_user');
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
            showSection('lobby-section');
            onUserLoggedIn();
        } catch (e) {
            localStorage.removeItem('youns_tr_user');
        }
    } else {
        showSection('auth-section');
    }

    // 키보드 리스너 등록
    document.addEventListener('keydown', handleKeyDown);
});

// 섹션 전환 유틸리티
function showSection(sectionId) {
    document.querySelectorAll('.app-section').forEach(sec => {
        sec.classList.add('hidden');
    });
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.remove('hidden');
        currentActiveSection = sectionId;
    }
}

// --- 4. 사용자 인증 & 로그인 로직 ---
let authTabMode = 'login';

function switchAuthTab(mode) {
    authTabMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('nickname-group').style.display = mode === 'register' ? 'flex' : 'none';
    
    const submitBtn = document.getElementById('auth-submit-btn');
    if (mode === 'login') {
        submitBtn.innerHTML = '<span>로그인하고 고양이 만나기</span> <i data-lucide="arrow-right"></i>';
    } else {
        submitBtn.innerHTML = '<span>회원가입하고 집사되기</span> <i data-lucide="smile"></i>';
    }
    lucide.createIcons();
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!supabaseClient) {
        alert("데이터베이스 연결 설정이 완료되지 않았습니다.");
        return;
    }

    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const nickname = document.getElementById('auth-nickname').value.trim();

    try {
        if (authTabMode === 'login') {
            // 로그인 처리
            const { data, error } = await supabaseClient
                .from('tr_users')
                .select('*')
                .eq('username', username)
                .eq('password', password)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                alert("아이디 또는 비밀번호가 잘못되었습니다.");
                return;
            }

            currentUser = data;
        } else {
            // 회원가입 처리
            if (!nickname) {
                alert("닉네임을 입력해주세요!");
                return;
            }

            // 아이디 중복 확인
            const { data: existing } = await supabaseClient
                .from('tr_users')
                .select('id')
                .eq('username', username)
                .maybeSingle();

            if (existing) {
                alert("이미 사용중인 아이디입니다.");
                return;
            }

            // 유저 삽입
            const { data, error } = await supabaseClient
                .from('tr_users')
                .insert([{ username, password, nickname }])
                .select()
                .single();

            if (error) throw error;
            currentUser = data;
        }

        // 로그인 완료 세션 세팅
        localStorage.setItem('youns_tr_user', JSON.stringify(currentUser));
        showSection('lobby-section');
        onUserLoggedIn();
    } catch (err) {
        console.error("Auth Error:", err);
        alert("처리 중 에러가 발생했습니다: " + err.message);
    }
}

function handleLogout() {
    localStorage.removeItem('youns_tr_user');
    currentUser = null;
    stopBGM();
    showSection('auth-section');
}

// 로그인 완료 후 처리
function onUserLoggedIn() {
    document.getElementById('user-display-name').textContent = currentUser.nickname;
    document.getElementById('player-self-name').textContent = `${currentUser.nickname} (나)`;
    
    // 내 기록 카드 및 글로벌 랭킹 보드 로드
    loadMyRecord();
    loadRankings();
    
    // 실시간 방 데이터 바인딩
    loadRooms();
    subscribeRoomsRealtime();
}

// --- 5. 로비 & 방 관리 (Supabase Integration) ---
async function loadRooms() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('tr_rooms')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderRoomsList(data);
    } catch (e) {
        console.error("Failed to load rooms:", e);
    }
}

// 실시간 대기방 목록 테이블 렌더링
function renderRoomsList(rooms) {
    const listBody = document.getElementById('rooms-list');
    listBody.innerHTML = '';

    if (!rooms || rooms.length === 0) {
        listBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    🐾 개설된 방이 없습니다. 새 방을 직접 만들어보세요!
                </td>
            </tr>
        `;
        return;
    }

    rooms.forEach(room => {
        const isLocked = !!room.password;
        const totalPlayers = room.opponent_id ? 2 : 1;
        const statusText = room.status === 'waiting' ? '대기중' : '게임중';
        const statusClass = room.status === 'waiting' ? 'waiting' : 'playing';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <strong>${escapeHtml(room.title)}</strong> 
                ${isLocked ? '<i data-lucide="lock" style="width:14px;height:14px;color:#a78bfa;display:inline;vertical-align:middle;margin-left:4px;"></i>' : ''}
            </td>
            <td>${escapeHtml(room.creator_nickname)}</td>
            <td><span class="badge-status ${statusClass}">${statusText}</span></td>
            <td>${totalPlayers}/2</td>
            <td>
                <button type="button" class="btn btn-primary btn-sm" 
                    onclick="joinRoom('${room.id}', ${isLocked})"
                    ${totalPlayers >= 2 || room.status !== 'waiting' ? 'disabled' : ''}>
                    입장
                </button>
            </td>
        `;
        listBody.appendChild(row);
    });
    lucide.createIcons();
}

// 실시간 대기방 브로드캐스트 구독
function subscribeRoomsRealtime() {
    if (!supabaseClient) return;
    
    // 기존 채널 있으면 해제
    if (roomsRealtimeChannel) {
        supabaseClient.removeChannel(roomsRealtimeChannel);
    }

    roomsRealtimeChannel = supabaseClient.channel('rooms-lobby')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_rooms' }, () => {
            loadRooms(); // 변동 감지 시 새로고침
        })
        .subscribe();
}

// 방 만들기 관련 이벤트
function openCreateRoomModal() {
    document.getElementById('create-room-modal').classList.remove('hidden');
}

function closeCreateRoomModal() {
    document.getElementById('create-room-modal').classList.add('hidden');
}

function toggleRoomPwInput(checkbox) {
    const wrapper = document.getElementById('room-pw-wrapper');
    const input = document.getElementById('room-password');
    if (checkbox.checked) {
        wrapper.classList.remove('hidden');
        input.required = true;
    } else {
        wrapper.classList.add('hidden');
        input.required = false;
        input.value = '';
    }
}

async function handleCreateRoomSubmit(e) {
    e.preventDefault();
    if (!supabaseClient || !currentUser) return;

    const title = document.getElementById('room-title').value.trim();
    const usePw = document.getElementById('room-pw-toggle').checked;
    const password = usePw ? document.getElementById('room-password').value.trim() : null;

    if (usePw && !password) {
        alert("비밀번호를 입력해주세요!");
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('tr_rooms')
            .insert([{
                title,
                password,
                creator_id: currentUser.id,
                creator_nickname: currentUser.nickname,
                status: 'waiting'
            }])
            .select()
            .single();

        if (error) throw error;
        
        closeCreateRoomModal();
        activeRoomId = data.id;
        isHost = true;
        
        enterGameRoom(data);
    } catch (err) {
        console.error("Room creation error:", err);
        alert("방을 생성하는 데 실패했습니다: " + err.message);
    }
}

// 방 입장 관련 이벤트
async function joinRoom(roomId, isLocked) {
    if (isLocked) {
        document.getElementById('join-room-id').value = roomId;
        document.getElementById('join-room-password').value = '';
        document.getElementById('password-room-modal').classList.remove('hidden');
    } else {
        executeJoinRoom(roomId, null);
    }
}

function closePasswordRoomModal() {
    document.getElementById('password-room-modal').classList.add('hidden');
}

async function handlePasswordRoomSubmit(e) {
    e.preventDefault();
    const roomId = document.getElementById('join-room-id').value;
    const password = document.getElementById('join-room-password').value.trim();
    
    closePasswordRoomModal();
    executeJoinRoom(roomId, password);
}

async function executeJoinRoom(roomId, password) {
    if (!supabaseClient || !currentUser) return;

    try {
        // 방 정보 로드
        const { data: room, error: fetchErr } = await supabaseClient
            .from('tr_rooms')
            .select('*')
            .eq('id', roomId)
            .maybeSingle();

        if (fetchErr || !room) {
            alert("방이 존재하지 않거나 사라졌습니다.");
            return;
        }

        if (room.status !== 'waiting' || room.opponent_id) {
            alert("이미 풀방이거나 게임이 시작된 방입니다.");
            return;
        }

        // 비밀번호 대조
        if (room.password && room.password !== password) {
            alert("비밀번호가 올바르지 않습니다.");
            return;
        }

        // 상대 정보 삽입 업데이트
        const { data: updatedRoom, error: joinErr } = await supabaseClient
            .from('tr_rooms')
            .update({
                opponent_id: currentUser.id,
                opponent_nickname: currentUser.nickname
            })
            .eq('id', roomId)
            .select()
            .single();

        if (joinErr) throw joinErr;

        activeRoomId = roomId;
        isHost = false;
        enterGameRoom(updatedRoom);

    } catch (err) {
        console.error("Join Room Error: ", err);
        alert("방 입장에 실패했습니다: " + err.message);
    }
}

// 방 목록 새로고침
function refreshRooms() {
    loadRooms();
}

// --- 6. 랭킹 & 내 기록 바인딩 로직 ---
async function loadMyRecord() {
    if (!supabaseClient || !currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from('tr_rankings')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            document.getElementById('my-single-score').textContent = data.single_score.toLocaleString();
            document.getElementById('my-multi-score').textContent = data.multi_score.toLocaleString();
        } else {
            document.getElementById('my-single-score').textContent = '0';
            document.getElementById('my-multi-score').textContent = '0';
        }
    } catch (e) {
        console.error("My record loading failed:", e);
    }
}

async function loadRankings() {
    if (!supabaseClient) return;
    const rankingBody = document.getElementById('ranking-list-body');
    rankingBody.innerHTML = '<div class="empty-state"><i data-lucide="loader-2" class="spin"></i> 로딩중...</div>';
    lucide.createIcons();

    try {
        // tr_rankings 와 tr_users 조인하여 유저의 닉네임 가져옴
        const scoreCol = currentRankingMode === 'single' ? 'single_score' : 'multi_score';
        const dateCol = currentRankingMode === 'single' ? 'single_date' : 'multi_date';
        
        const { data, error } = await supabaseClient
            .from('tr_rankings')
            .select(`
                single_score,
                single_date,
                multi_score,
                multi_date,
                tr_users (
                    nickname
                )
            `)
            .gt(scoreCol, 0)
            .order(scoreCol, { ascending: false })
            .limit(10);

        if (error) throw error;
        renderRankings(data);
    } catch (e) {
        console.error("Rankings loading failed:", e);
        rankingBody.innerHTML = '<div class="empty-state">랭킹 데이터를 불러오는 데 실패했습니다.</div>';
    }
}

function renderRankings(ranks) {
    const rankingBody = document.getElementById('ranking-list-body');
    rankingBody.innerHTML = '';

    if (!ranks || ranks.length === 0) {
        rankingBody.innerHTML = '<div class="empty-state">등록된 랭킹 기록이 없습니다. 최초 기록을 남겨보세요!</div>';
        return;
    }

    ranks.forEach((item, index) => {
        const rank = index + 1;
        let medalHtml = rank;
        let rankClass = '';
        
        if (rank === 1) {
            medalHtml = '🥇';
            rankClass = 'rank-1st';
        } else if (rank === 2) {
            medalHtml = '🥈';
            rankClass = 'rank-2nd';
        } else if (rank === 3) {
            medalHtml = '🥉';
            rankClass = 'rank-3rd';
        }

        const nick = item.tr_users?.nickname || '무명집사';
        const score = currentRankingMode === 'single' ? item.single_score : item.multi_score;
        const dateStr = currentRankingMode === 'single' ? item.single_date : item.multi_date;
        const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '';

        const row = document.createElement('div');
        row.className = `rank-row ${rankClass}`;
        row.innerHTML = `
            <span class="rank-num">${medalHtml}</span>
            <span class="rank-name">${escapeHtml(nick)}</span>
            <span class="rank-score">${score.toLocaleString()}</span>
            <span class="rank-date">${formattedDate}</span>
        `;
        rankingBody.appendChild(row);
    });
}

function switchRankingTab(mode) {
    currentRankingMode = mode;
    document.getElementById('rank-tab-single').classList.toggle('active', mode === 'single');
    document.getElementById('rank-tab-multi').classList.toggle('active', mode === 'multi');
    loadRankings();
}

async function uploadHighScore(mode, score) {
    if (!supabaseClient || !currentUser) return;
    try {
        // 기존 최고 기록 가져오기
        const { data: record, error: getErr } = await supabaseClient
            .from('tr_rankings')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (getErr) throw getErr;

        const scoreCol = mode === 'single' ? 'single_score' : 'multi_score';
        const dateCol = mode === 'single' ? 'single_date' : 'multi_date';
        
        const now = new Date().toISOString();

        if (record) {
            // 새 점수가 기존 최고 점수보다 높을 때만 업데이트
            if (score > record[scoreCol]) {
                const updates = {};
                updates[scoreCol] = score;
                updates[dateCol] = now;

                const { error: updateErr } = await supabaseClient
                    .from('tr_rankings')
                    .update(updates)
                    .eq('user_id', currentUser.id);

                if (updateErr) throw updateErr;
            }
        } else {
            // 데이터가 없으면 새 레코드 삽입
            const insertData = { user_id: currentUser.id };
            insertData[scoreCol] = score;
            insertData[dateCol] = now;

            const { error: insertErr } = await supabaseClient
                .from('tr_rankings')
                .insert([insertData]);

            if (insertErr) throw insertErr;
        }

        // 로비 정보 업데이트
        loadMyRecord();
        loadRankings();
    } catch (e) {
        console.error("Failed to upload high score:", e);
    }
}

// --- 7. 오디오 8비트 신디사이저 & 줄 소거 "야옹" (Web Audio API) ---
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function toggleAudioMute() {
    isMuted = !isMuted;
    const icon = document.getElementById('audio-icon');
    if (isMuted) {
        icon.setAttribute('data-lucide', 'volume-x');
        stopBGM();
    } else {
        icon.setAttribute('data-lucide', 'volume-2');
        if (isGameRunning && !isGamePaused) {
            startBGM();
        }
    }
    lucide.createIcons();
}

function playMeowSound() {
    if (isMuted) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        
        // 젤리 핑크 톤 볼륨 엔벨로프
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        // 주파수 스윕 (Meow~ 소리 유도)
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(850, now + 0.07);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.28);
        osc.frequency.linearRampToValueAtTime(320, now + 0.35);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start(now);
        osc.stop(now + 0.35);
    } catch (e) {
        console.error("Audio error: ", e);
    }
}

function startBGM() {
    if (isMuted) return;
    try {
        initAudio();
        if (bgmTimer) return;
        
        const tempo = 135; // BPM
        const beatDuration = 60 / tempo;
        
        function playNextNote() {
            if (isMuted || !audioCtx) return;
            const note = bgmNotes[currentNoteIndex];
            const now = audioCtx.currentTime;
            const noteDuration = note.d * beatDuration;
            
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.f, now);
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.04, now + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + noteDuration - 0.02);
            
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.start(now);
            osc.stop(now + noteDuration);
            
            currentNoteIndex = (currentNoteIndex + 1) % bgmNotes.length;
            bgmTimer = setTimeout(playNextNote, noteDuration * 1000);
        }
        
        playNextNote();
    } catch (e) {
        console.error("BGM error:", e);
    }
}

function stopBGM() {
    if (bgmTimer) {
        clearTimeout(bgmTimer);
        bgmTimer = null;
    }
}

// --- 8. 테트리스 코어 게임 로직 ---

function createGrid() {
    return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
}

// 랜덤 조각 얻기
function getRandomPiece() {
    const types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    const type = types[Math.floor(Math.random() * types.length)];
    return {
        matrix: JSON.parse(JSON.stringify(MINOS[type])),
        type: type,
        x: Math.floor((BOARD_WIDTH - MINOS[type][0].length) / 2),
        y: 0
    };
}

// 홀드 또는 넥스트 캔버스 지우기
function clearCanvas(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 미노의 개별 파트(고양이 캐릭터 부위) 그리기
function drawCatCellPart(ctx, x, y, size, type, part, isGhost = false) {
    ctx.save();
    if (isGhost) {
        ctx.globalAlpha = 0.3; // 고스트 블록은 투명하게 처리
    }
    
    let primaryColor, secondaryColor;
    switch(type) {
        case 'I': primaryColor = '#60a5fa'; secondaryColor = '#2563eb'; break; // 날씬한 파란 고양이
        case 'O': primaryColor = '#fbbf24'; secondaryColor = '#d97706'; break; // 뚱뚱한 노란 고양이
        case 'T': primaryColor = '#c084fc'; secondaryColor = '#7c3aed'; break; // 졸린 보라 고양이
        case 'S': primaryColor = '#34d399'; secondaryColor = '#059669'; break; // 장난치는 초록 고양이
        case 'Z': primaryColor = '#f87171'; secondaryColor = '#dc2626'; break; // 화난 빨간 고양이
        case 'J': primaryColor = '#a78bfa'; secondaryColor = '#6d28d9'; break; // 윙크하는 연보라 고양이
        case 'L': primaryColor = '#fb923c'; secondaryColor = '#ea580c'; break; // 행복한 주황 고양이
        case 'G': primaryColor = '#9ca3af'; secondaryColor = '#4b5563'; break; // 돌 고양이 (장애물)
        default: primaryColor = '#ff8da1'; secondaryColor = '#e11d48';
    }

    // 1. 블록 기본 몸체 그리기 (둥글둥글한 사각형)
    ctx.fillStyle = primaryColor;
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, size - 2, size - 2, 5);
    ctx.fill();
    ctx.stroke();

    const cx = x + size / 2;
    const cy = y + size / 2;

    if (part === 'head') {
        // --- 1. 머리 블록: 귀, 깨어있는 귀여운 얼굴, 수염 ---
        ctx.fillStyle = primaryColor;
        // 왼쪽 귀
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 4);
        ctx.lineTo(x + 7, y + 0.5);
        ctx.lineTo(x + 9, y + 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 오른쪽 귀
        ctx.beginPath();
        ctx.moveTo(x + size - 2, y + 4);
        ctx.lineTo(x + size - 7, y + 0.5);
        ctx.lineTo(x + size - 9, y + 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 귀 안쪽 분홍 젤리 포인트
        ctx.fillStyle = '#ffb7c5';
        ctx.beginPath();
        ctx.moveTo(x + 3.5, y + 3.5);
        ctx.lineTo(x + 6, y + 1.5);
        ctx.lineTo(x + 7.5, y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + size - 3.5, y + 3.5);
        ctx.lineTo(x + size - 6, y + 1.5);
        ctx.lineTo(x + size - 7.5, y + 4);
        ctx.closePath();
        ctx.fill();

        // 얼굴 요소 드로잉
        ctx.fillStyle = '#120e24';
        ctx.strokeStyle = '#120e24';
        
        // 동그랗고 귀여운 눈
        ctx.beginPath();
        ctx.arc(cx - 3.5, cy - 1.5, 1.8, 0, Math.PI * 2);
        ctx.arc(cx + 3.5, cy - 1.5, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // 핑크 코 & w 입 모양
        ctx.strokeStyle = '#120e24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx - 1.2, cy + 1, 1.2, Math.PI, 0, true);
        ctx.arc(cx + 1.2, cy + 1, 1.2, Math.PI, 0, true);
        ctx.stroke();

        ctx.fillStyle = '#ff9ebe';
        ctx.beginPath();
        ctx.moveTo(cx - 1, cy - 0.8);
        ctx.lineTo(cx + 1, cy - 0.8);
        ctx.lineTo(cx, cy + 0.2);
        ctx.closePath();
        ctx.fill();

        // 볼 터치
        ctx.fillStyle = 'rgba(255, 141, 161, 0.4)';
        ctx.beginPath();
        ctx.arc(cx - 5.5, cy + 1, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 5.5, cy + 1, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // 수염
        ctx.strokeStyle = 'rgba(18, 14, 36, 0.35)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x + 2, cy); ctx.lineTo(x + 6, cy + 0.5);
        ctx.moveTo(x + 2, cy + 2); ctx.lineTo(x + 5.5, cy + 1.2);
        ctx.moveTo(x + size - 2, cy); ctx.lineTo(x + size - 6, cy + 0.5);
        ctx.moveTo(x + size - 2, cy + 2); ctx.lineTo(x + size - 5.5, cy + 1.2);
        ctx.stroke();

    } else if (part === 'tail') {
        // --- 2. 꼬리 블록: 위로 말려 올라간 꼬리와 몸통 줄무늬 ---
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(cx - 1, cy + 2);
        ctx.bezierCurveTo(cx - 5, cy - 6, cx + 6, cy - 10, cx + 4, cy - 14);
        ctx.stroke();

        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.arc(cx + 4, cy - 14, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // 몸통 줄무늬
        ctx.strokeStyle = 'rgba(18, 14, 36, 0.15)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + 3, cy - 2); ctx.lineTo(x + 7, cy + 2);
        ctx.moveTo(x + 4, cy + 2); ctx.lineTo(x + 8, cy + 6);
        ctx.stroke();

    } else if (part === 'body') {
        // --- 3. 몸통 블록: 둥근 줄무늬 패턴 ---
        ctx.strokeStyle = 'rgba(18, 14, 36, 0.15)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + 3, cy - 3); ctx.lineTo(x + 8, cy + 2);
        ctx.moveTo(x + size - 3, cy - 3); ctx.lineTo(x + size - 8, cy + 2);
        ctx.stroke();

    } else if (part === 'sleeping') {
        // --- 4. 자는 고양이 (안착해서 고정된 블록 상태) ---
        ctx.fillStyle = '#120e24';
        ctx.strokeStyle = '#120e24';
        ctx.lineWidth = 0.9;
        
        // 눈 감고 자는 눈 모양 (^ ^ 또는 감은 호)
        ctx.beginPath();
        ctx.arc(cx - 3.5, cy - 1.5, 1.5, 0, Math.PI, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 3.5, cy - 1.5, 1.5, 0, Math.PI, true);
        ctx.stroke();

        // 입 모양 (w)
        ctx.beginPath();
        ctx.arc(cx - 1.2, cy + 1, 1.2, Math.PI, 0, true);
        ctx.arc(cx + 1.2, cy + 1, 1.2, Math.PI, 0, true);
        ctx.stroke();

        ctx.fillStyle = '#ff9ebe';
        ctx.beginPath();
        ctx.moveTo(cx - 1, cy - 0.8);
        ctx.lineTo(cx + 1, cy - 0.8);
        ctx.lineTo(cx, cy + 0.2);
        ctx.closePath();
        ctx.fill();

        // 수염
        ctx.strokeStyle = 'rgba(18, 14, 36, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x + 2, cy); ctx.lineTo(x + 6, cy + 0.5);
        ctx.moveTo(x + size - 2, cy); ctx.lineTo(x + size - 6, cy + 0.5);
        ctx.stroke();

    } else if (part.startsWith('O_')) {
        // --- 5. O-Mino 전용 2x2 뚱뚱한 고양이 특수 매핑 ---
        const oType = part.split('_')[1];
        ctx.fillStyle = '#120e24';
        ctx.strokeStyle = '#120e24';

        if (oType === 'tl') {
            // 왼쪽 귀 & 왼쪽 눈
            ctx.fillStyle = primaryColor;
            ctx.strokeStyle = secondaryColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x + 2, y + 4); ctx.lineTo(x + 7, y + 0.5); ctx.lineTo(x + 9, y + 5);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            
            ctx.fillStyle = '#ffb7c5';
            ctx.beginPath();
            ctx.moveTo(x + 3.5, y + 3.5); ctx.lineTo(x + 6, y + 1.5); ctx.lineTo(x + 7.5, y + 4);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#120e24';
            ctx.beginPath();
            ctx.arc(cx + 2.5, cy + 1.5, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 141, 161, 0.4)';
            ctx.beginPath();
            ctx.arc(cx - 2, cy + 4.5, 2.5, 0, Math.PI * 2);
            ctx.fill();

        } else if (oType === 'tr') {
            // 오른쪽 귀 & 오른쪽 눈 & 코/입
            ctx.fillStyle = primaryColor;
            ctx.strokeStyle = secondaryColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x + size - 2, y + 4); ctx.lineTo(x + size - 7, y + 0.5); ctx.lineTo(x + size - 9, y + 5);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            
            ctx.fillStyle = '#ffb7c5';
            ctx.beginPath();
            ctx.moveTo(x + size - 3.5, y + 3.5); ctx.lineTo(x + size - 6, y + 1.5); ctx.lineTo(x + size - 7.5, y + 4);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#120e24';
            ctx.beginPath();
            ctx.arc(cx - 2.5, cy + 1.5, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 141, 161, 0.4)';
            ctx.beginPath();
            ctx.arc(cx + 2, cy + 4.5, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // 코와 입을 2x2 경계면(왼쪽 아래 구석) 부근에 그립니다.
            ctx.strokeStyle = '#120e24';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x - 1, y + size - 1, 1.5, Math.PI, 0, true);
            ctx.arc(x + 1, y + size - 1, 1.5, Math.PI, 0, true);
            ctx.stroke();

            ctx.fillStyle = '#ff9ebe';
            ctx.beginPath();
            ctx.moveTo(x - 1, y + size - 2.5);
            ctx.lineTo(x + 1, y + size - 2.5);
            ctx.lineTo(x, y + size - 1.5);
            ctx.closePath();
            ctx.fill();

        } else if (oType === 'bl') {
            // 귀여운 왼쪽 흰 양말 발
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = secondaryColor;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x + 7, y + size - 2.5, 4, 0, Math.PI, true);
            ctx.fill();
            ctx.stroke();

        } else if (oType === 'br') {
            // 오른쪽 양말 발 & wiggling 꼬리
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = secondaryColor;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x + size - 7, y + size - 2.5, 4, 0, Math.PI, true);
            ctx.fill();
            ctx.stroke();

            // 뚱뚱이 꼬리
            ctx.strokeStyle = secondaryColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x + size - 2, cy);
            ctx.bezierCurveTo(x + size + 5, cy - 3, x + size + 7, cy - 8, x + size + 3, cy - 12);
            ctx.stroke();
        }
    }

    ctx.restore();
}

// 레거시 지원용 래퍼 함수 ( landed 블록 렌더링용 )
function drawCatCell(ctx, x, y, size, type) {
    drawCatCellPart(ctx, x, y, size, type, 'sleeping');
}

// 활성 상태의 전체 미노를 하나의 온전한 고양이 형상으로 렌더링
function drawCoherentCatPiece(ctx, startX, startY, matrix, type, size, isGhost = false) {
    const cells = [];
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x]) {
                cells.push({ x, y });
            }
        }
    }
    if (cells.length === 0) return;

    // Y축 우선, X축 차선 오름차순 정렬 (좌상단에서 우하단 방향 배치 파악)
    cells.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

    if (type === 'O') {
        // O-Mino (2x2) 스페셜 뚱뚱냥이 매핑
        cells.forEach((cell, idx) => {
            const rx = startX + cell.x * size;
            const ry = startY + cell.y * size;
            let oType = 'tl';
            if (idx === 1) oType = 'tr';
            else if (idx === 2) oType = 'bl';
            else if (idx === 3) oType = 'br';
            
            drawCatCellPart(ctx, rx, ry, size, type, `O_${oType}`, isGhost);
        });
    } else {
        // 그 외 모든 미노 (I, T, S, Z, J, L)
        // 맨 첫 셀(좌상단)을 꼬리, 맨 마지막 셀(우하단)을 머리로 렌더링하고 나머지는 몸통으로 처리
        cells.forEach((cell, idx) => {
            const rx = startX + cell.x * size;
            const ry = startY + cell.y * size;
            let part = 'body';
            
            if (idx === 0) {
                part = 'tail';
            } else if (idx === cells.length - 1) {
                part = 'head';
            }
            
            drawCatCellPart(ctx, rx, ry, size, type, part, isGhost);
        });
    }
}

// 미노 형상 행렬 그리기 (Hold/Next용 - 1마리 완전한 고양이로 표현)
function drawPiecePreview(ctx, matrix, type, size = 16) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    
    // 미노 중심 맞추기용 오프셋 계산
    const offsetX = (80 - cols * size) / 2;
    const offsetY = (80 - rows * size) / 2;

    drawCoherentCatPiece(ctx, offsetX, offsetY, matrix, type, size, false);
}

// 메인 보드 그리드 및 가이드라인 그리기 (다이나믹 스케일 적용)
function drawGrid(ctx, grid, activePiece) {
    const targetW = BOARD_WIDTH * BLOCK_SIZE;
    const targetH = BOARD_HEIGHT * BLOCK_SIZE;

    ctx.fillStyle = '#141124'; // 밤하늘색 바둑판
    ctx.fillRect(0, 0, targetW, targetH);

    // 격자 보조선
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= BOARD_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, targetH);
        ctx.stroke();
    }
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(targetW, y * BLOCK_SIZE);
        ctx.stroke();
    }

    // 1. 바닥에 고정된 자는 고양이 블록들
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
            if (grid[y][x]) {
                drawCatCellPart(ctx, x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, grid[y][x], 'sleeping');
            }
        }
    }

    // 2. 떨어지고 있는 고양이 미노
    if (activePiece) {
        // 고스트 피스 위치 도출
        let ghostY = activePiece.y;
        while (!checkCollision(grid, activePiece.matrix, activePiece.x, ghostY + 1)) {
            ghostY++;
        }
        
        // 고스트 고양이 (투명 꼬리+머리 세트)
        drawCoherentCatPiece(ctx, activePiece.x * BLOCK_SIZE, ghostY * BLOCK_SIZE, activePiece.matrix, activePiece.type, BLOCK_SIZE, true);

        // 실제 하강 중인 고양이
        drawCoherentCatPiece(ctx, activePiece.x * BLOCK_SIZE, activePiece.y * BLOCK_SIZE, activePiece.matrix, activePiece.type, BLOCK_SIZE, false);
    }
}

// 충돌 테스트
function checkCollision(grid, matrix, offsetIdxX, offsetIdxY) {
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x]) {
                const targetX = offsetIdxX + x;
                const targetY = offsetIdxY + y;
                
                // 외곽 범위 벗어나거나 쌓인 블록이 있으면 충돌
                if (targetX < 0 || targetX >= BOARD_WIDTH || targetY >= BOARD_HEIGHT) {
                    return true;
                }
                
                if (targetY >= 0 && grid[targetY][targetX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// 고정하기
function mergePiece(grid, activePiece) {
    for (let y = 0; y < activePiece.matrix.length; y++) {
        for (let x = 0; x < activePiece.matrix[y].length; x++) {
            if (activePiece.matrix[y][x]) {
                const targetY = activePiece.y + y;
                if (targetY >= 0) {
                    grid[targetY][activePiece.x + x] = activePiece.type;
                }
            }
        }
    }
}

// 줄 지우기 처리
function checkLines(grid) {
    let linesCleared = 0;
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (grid[y].every(cell => cell !== 0)) {
            // 한 줄 통째로 지우기
            grid.splice(y, 1);
            grid.unshift(Array(BOARD_WIDTH).fill(0));
            linesCleared++;
            y++; // 지워진 줄만큼 당겨졌으므로 재조사
        }
    }
    return linesCleared;
}

// 미노 회전 처리 (벽차기 Wall Kick 포함)
function rotatePiece(activePiece, dir) {
    const matrix = activePiece.matrix;
    const n = matrix.length;
    const rotated = Array.from({ length: n }, () => Array(n).fill(0));
    
    // 행렬 돌리기
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (dir > 0) {
                rotated[x][n - 1 - y] = matrix[y][x];
            } else {
                rotated[n - 1 - x][y] = matrix[y][x];
            }
        }
    }

    // 벽 충돌 극복 처리 (우측, 좌측, 상단 순차 킥 테스트)
    const kicks = [0, -1, 1, -2, 2];
    for (let dx of kicks) {
        if (!checkCollision(gameStateSelf.grid, rotated, activePiece.x + dx, activePiece.y)) {
            activePiece.matrix = rotated;
            activePiece.x += dx;
            return;
        }
    }
}

// --- 9. 사용자 조작 인풋 핸들러 ---
function handleKeyDown(e) {
    if (!isGameRunning || isGamePaused) return;

    // 게임 조작 키 입력 시 브라우저 스크롤 등의 기본 동작을 방지합니다.
    const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'ShiftLeft', 'ShiftRight'];
    if (controlKeys.includes(e.code)) {
        e.preventDefault();
    }

    switch(e.code) {
        case 'ArrowLeft':
            moveActivePiece(-1);
            break;
        case 'ArrowRight':
            moveActivePiece(1);
            break;
        case 'ArrowDown':
            moveActivePieceDown();
            break;
        case 'ArrowUp':
            rotatePiece(gameStateSelf.currentPiece, 1);
            syncGameStateToOpponent();
            break;
        case 'KeyZ':
            rotatePiece(gameStateSelf.currentPiece, -1);
            syncGameStateToOpponent();
            break;
        case 'Space':
            hardDropActivePiece();
            break;
        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight':
            holdActivePiece();
            break;
        case 'KeyP':
            if (!isMultiplayMode) {
                toggleGamePause();
            }
            break;
    }
}

// 미노 좌우 이동
function moveActivePiece(dir) {
    const piece = gameStateSelf.currentPiece;
    if (!checkCollision(gameStateSelf.grid, piece.matrix, piece.x + dir, piece.y)) {
        piece.x += dir;
        syncGameStateToOpponent();
    }
}

// 미노 아래로 강제 이동 (소프트 드롭)
function moveActivePieceDown() {
    const piece = gameStateSelf.currentPiece;
    if (!checkCollision(gameStateSelf.grid, piece.matrix, piece.x, piece.y + 1)) {
        piece.y++;
        dropCounter = 0;
        syncGameStateToOpponent();
    } else {
        lockPieceAndNext();
    }
}

// 하드 드롭
function hardDropActivePiece() {
    const piece = gameStateSelf.currentPiece;
    let dy = 0;
    while (!checkCollision(gameStateSelf.grid, piece.matrix, piece.x, piece.y + 1)) {
        piece.y++;
        dy++;
    }
    // 하드 드롭 시 스코어 약간 추가 가산
    gameStateSelf.score += dy * 2;
    lockPieceAndNext();
}

// 홀드 교환
function holdActivePiece() {
    if (gameStateSelf.hasHeldThisTurn) return;
    
    const current = gameStateSelf.currentPiece;
    const held = gameStateSelf.heldPiece;
    
    if (held) {
        // 서로 맞바꿈
        gameStateSelf.currentPiece = {
            matrix: JSON.parse(JSON.stringify(MINOS[held.type])),
            type: held.type,
            x: Math.floor((BOARD_WIDTH - MINOS[held.type][0].length) / 2),
            y: 0
        };
        gameStateSelf.heldPiece = { type: current.type };
    } else {
        // 신규 홀드
        gameStateSelf.heldPiece = { type: current.type };
        gameStateSelf.currentPiece = gameStateSelf.nextPieceQueue.shift();
        if (gameStateSelf.nextPieceQueue.length < 3) {
            gameStateSelf.nextPieceQueue.push(getRandomPiece());
        }
    }
    
    gameStateSelf.hasHeldThisTurn = true;
    
    // 홀드 캔버스 리드로우
    clearCanvas(canvasHoldSelf, ctxHoldSelf);
    drawPiecePreview(ctxHoldSelf, MINOS[gameStateSelf.heldPiece.type], gameStateSelf.heldPiece.type, 18);
    
    // 넥스트 캔버스 리드로우
    drawNextQueue();
    
    syncGameStateToOpponent();
}

// 고정 및 다음 세션 준비
function lockPieceAndNext() {
    mergePiece(gameStateSelf.grid, gameStateSelf.currentPiece);
    
    // 줄 소거 확인
    const lines = checkLines(gameStateSelf.grid);
    if (lines > 0) {
        playMeowSound();
        gameStateSelf.lines += lines;
        
        // 테트리스 표준 점수 가산식 (소프트/하드 보너스 제외)
        const scoreTable = [0, 100, 300, 500, 800];
        gameStateSelf.score += scoreTable[lines] * gameStateSelf.level;
        
        // 레벨업 (10줄당)
        gameStateSelf.level = Math.floor(gameStateSelf.lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (gameStateSelf.level - 1) * 100);

        // 멀티플레이어 경쟁전: 장애물 전송 발송 (2줄:1, 3줄:2, 4줄:4)
        if (isMultiplayMode && lines >= 2) {
            let garbageCount = 1;
            if (lines === 3) garbageCount = 2;
            if (lines === 4) garbageCount = 4;
            
            sendGarbageToOpponent(garbageCount);
        }
    }
    
    // UI 스태츠 동기화
    updateStatsUI();

    // 턴 초기화
    gameStateSelf.hasHeldThisTurn = false;
    
    // 다음 조각 배치
    gameStateSelf.currentPiece = gameStateSelf.nextPieceQueue.shift();
    if (gameStateSelf.nextPieceQueue.length < 3) {
        gameStateSelf.nextPieceQueue.push(getRandomPiece());
    }
    
    // 게임 오버 조건 검사 (생성 시부터 충돌)
    if (checkCollision(gameStateSelf.grid, gameStateSelf.currentPiece.matrix, gameStateSelf.currentPiece.x, gameStateSelf.currentPiece.y)) {
        handleGameOver();
        return;
    }
    
    // 장애물(가비지 줄) 대기열 수령 확인 및 추가
    applyQueuedGarbage();
    
    drawNextQueue();
    syncGameStateToOpponent();
}

// 장애물 줄 실제 보드 하단에 밀어넣기
function applyQueuedGarbage() {
    if (gameStateSelf.garbageQueue.length === 0) return;
    
    const linesCount = gameStateSelf.garbageQueue.reduce((acc, val) => acc + val, 0);
    gameStateSelf.garbageQueue = []; // 대기열 비움
    
    // 윗줄 밀어내기
    for (let i = 0; i < linesCount; i++) {
        gameStateSelf.grid.shift();
        
        // 랜덤 구멍 뚫린 한 줄 생성
        const holeCol = Math.floor(Math.random() * BOARD_WIDTH);
        const garbageRow = Array(BOARD_WIDTH).fill('G');
        garbageRow[holeCol] = 0; // 구멍
        gameStateSelf.grid.push(garbageRow);
    }
    
    // 게이지 UI 업데이트
    updateGarbageGauge('self', 0);
}

// UI 텍스트 스태츠 동기화
function updateStatsUI() {
    document.getElementById('stat-score-self').textContent = gameStateSelf.score;
    document.getElementById('stat-lines-self').textContent = gameStateSelf.lines;
    document.getElementById('stat-level-self').textContent = gameStateSelf.level;
}

// Next 큐 렌더링
function drawNextQueue() {
    clearCanvas(canvasNextSelf, ctxNextSelf);
    // 1등/2등 대기열 나란히 세로 드로우
    const next1 = gameStateSelf.nextPieceQueue[0];
    const next2 = gameStateSelf.nextPieceQueue[1];
    
    drawPiecePreview(ctxNextSelf, MINOS[next1.type], next1.type, 18);
    // 두번째 미노는 캔버스 하단 오프셋에 드로우
    ctxNextSelf.save();
    ctxNextSelf.translate(0, 80);
    drawPiecePreview(ctxNextSelf, MINOS[next2.type], next2.type, 14);
    ctxNextSelf.restore();
}

// 게임 오버 유도
async function handleGameOver() {
    isGameRunning = false;
    stopBGM();
    
    // 오버레이 노출
    const title = document.getElementById('overlay-title');
    const subtitle = document.getElementById('overlay-subtitle');
    
    document.getElementById('overlay-score').textContent = gameStateSelf.score;
    document.getElementById('overlay-lines').textContent = gameStateSelf.lines;
    
    if (isMultiplayMode) {
        // 멀티플레이어는 기권/패배 브로드캐스트 전송
        broadcastGameOver();
        
        title.textContent = "DEFEAT";
        title.style.color = "#f87171"; // Red
        subtitle.textContent = "아쉽게 패배했다웅... 다음엔 이겨보자옹!";
        
        // 멀티 최고 스코어 랭킹업 로드
        await uploadHighScore('multi', gameStateSelf.score);
    } else {
        title.textContent = "GAME OVER";
        title.style.color = "#ff8da1";
        subtitle.textContent = "수고했다옹! 기여운 고양이와 다시 해보자옹!";
        
        // 싱글 최고 스코어 랭킹업 로드
        await uploadHighScore('single', gameStateSelf.score);
    }
    
    document.getElementById('game-overlay').classList.remove('hidden');
}

// 싱글 플레이 일시 정지
function toggleGamePause() {
    isGamePaused = !isGamePaused;
    if (isGamePaused) {
        stopBGM();
        // 일시정지 오버레이 활용 (다시 시작용 등)
        document.getElementById('overlay-title').textContent = "PAUSED";
        document.getElementById('overlay-subtitle').textContent = "P키를 눌러 계속 플레이하세요.";
        document.getElementById('overlay-btn-restart').classList.add('hidden');
        document.getElementById('game-overlay').classList.remove('hidden');
    } else {
        document.getElementById('game-overlay').classList.add('hidden');
        document.getElementById('overlay-btn-restart').classList.remove('hidden');
        startBGM();
    }
}

// --- 10. 메인 루프 (RequestAnimationFrame) ---
function gameLoop(time = 0) {
    if (!isGameRunning) return;
    if (isGamePaused) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        moveActivePieceDown();
    }

    // 내 보드 그리기
    drawGrid(ctxGridSelf, gameStateSelf.grid, gameStateSelf.currentPiece);
    
    requestAnimationFrame(gameLoop);
}

// --- 11. 실시간 멀티플레이어 네트워크 엔진 (Supabase Realtime) ---

function enterGameRoom(room) {
    showSection('game-section');
    
    // UI 레이아웃 설정
    document.getElementById('game-room-title').textContent = room.title;
    
    // 초기화
    resetLocalGameState();
    
    // 상대방 화면 초기화
    clearOpponentPanel();

    if (room.id) {
        // 1:1 멀티플레이 모드 돌입 (방장 대기 또는 참가 즉시)
        isMultiplayMode = true;
        document.getElementById('game-mode-badge').textContent = 'BATTLE';
        document.getElementById('player-panel-opponent').classList.remove('hidden');
        document.getElementById('multiplay-controls').classList.remove('hidden');
        
        if (room.opponent_id) {
            document.getElementById('player-opp-name').textContent = isHost ? room.opponent_nickname : room.creator_nickname;
        } else {
            document.getElementById('player-opp-name').textContent = '상대 대기중...';
        }
        
        // 준비 상태 메세지 및 채널 연결
        updateMultiplayStatus();
        subscribeGameChannel(room.id);
        
        if (isHost) {
            // 방장인 경우 상대가 들어와 동기화 신호를 주기 전까지 대기
            document.getElementById('btn-start-game').disabled = !room.opponent_id;
        }
    } else {
        // 싱글플레이 모드 돌입
        isMultiplayMode = false;
        document.getElementById('game-mode-badge').textContent = 'SINGLE';
        document.getElementById('player-panel-opponent').classList.add('hidden');
        document.getElementById('multiplay-controls').classList.add('hidden');
        
        // 싱글 게임 즉시 개시
        initSingleGameStart();
    }
}

function clearOpponentPanel() {
    clearCanvas(canvasGridOpp, ctxGridOpp);
    clearCanvas(canvasHoldOpp, ctxHoldOpp);
    clearCanvas(canvasNextOpp, ctxNextOpp);
    document.getElementById('opponent-disconnected-overlay').classList.add('hidden');
    document.getElementById('stat-score-opp').textContent = '0';
    document.getElementById('stat-lines-opp').textContent = '0';
    updateGarbageGauge('opp', 0);
}

function resetLocalGameState() {
    gameStateSelf.grid = createGrid();
    gameStateSelf.currentPiece = null;
    gameStateSelf.heldPiece = null;
    gameStateSelf.hasHeldThisTurn = false;
    gameStateSelf.score = 0;
    gameStateSelf.lines = 0;
    gameStateSelf.level = 1;
    gameStateSelf.garbageQueue = [];
    gameStateSelf.attackGauge = 0;
    
    gameStateSelf.nextPieceQueue = [getRandomPiece(), getRandomPiece(), getRandomPiece()];
    
    dropInterval = 1000;
    dropCounter = 0;
    lastTime = 0;
    isGamePaused = false;
    
    clearCanvas(canvasHoldSelf, ctxHoldSelf);
    clearCanvas(canvasNextSelf, ctxNextSelf);
    updateStatsUI();
    updateGarbageGauge('self', 0);
}

// 멀티플레이 상태메세지 갱신
function updateMultiplayStatus() {
    const btn = document.getElementById('btn-start-game');
    const msg = document.getElementById('multiplay-status-text');

    if (isHost) {
        btn.disabled = false;
        msg.textContent = "방장입니다. 준비되셨으면 시작 버튼을 눌러주세요!";
    } else {
        btn.disabled = true; // 방장만 시작 가능
        msg.textContent = "방장이 게임을 시작하기를 기다리는 중...";
    }
}

// 1:1 실시간 채널 구독
function subscribeGameChannel(roomId) {
    if (!supabaseClient) return;

    if (gameRealtimeChannel) {
        supabaseClient.removeChannel(gameRealtimeChannel);
    }

    gameRealtimeChannel = supabaseClient.channel(`nangtris_play_${roomId}`)
        .on('broadcast', { event: 'game-sync' }, ({ payload }) => {
            handleOpponentSync(payload);
        })
        .on('broadcast', { event: 'garbage-attack' }, ({ payload }) => {
            handleGarbageAttack(payload);
        })
        .on('broadcast', { event: 'game-over' }, () => {
            handleOpponentLoss();
        })
        .on('broadcast', { event: 'game-start-signal' }, () => {
            runGameStartCountdown();
        })
        .on('broadcast', { event: 'player-left' }, () => {
            // 게스트 유저가 방을 나감
            clearOpponentPanel();
            document.getElementById('player-opp-name').textContent = '상대 대기중...';
            if (isHost) {
                document.getElementById('btn-start-game').disabled = true;
                document.getElementById('multiplay-status-text').textContent = '상대방이 방을 나갔습니다. 대기 중...';
            }
        })
        .on('broadcast', { event: 'host-left' }, () => {
            // 호스트 유저(방장)가 방을 나감
            alert('방장이 방을 폭파하고 나갔습니다. 로비로 이동합니다.');
            exitToLobby();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("Game Realtime Channel connected!");
                // 내가 방에 나중에 들어온 2P 유저면, 1P(호스트)에게 내 참가 정보를 전달하기 위해 노티
                if (!isHost) {
                    syncGameStateToOpponent();
                }
            }
        });
}

// 상대방 화면 동기화 패킷 처리
function handleOpponentSync(payload) {
    if (payload.nickname) {
        document.getElementById('player-opp-name').textContent = payload.nickname;
    }
    if (!isGameRunning && payload.isReadySync && isHost) {
        // 호스트에서 2P 연결 수립됨을 감지
        document.getElementById('btn-start-game').disabled = false;
        if (payload.nickname) {
            document.getElementById('multiplay-status-text').textContent = `${payload.nickname}님이 입장하셨습니다! 게임을 시작해주세요.`;
        }
    }
    
    gameStateOpp.grid = payload.grid;
    gameStateOpp.score = payload.score;
    gameStateOpp.lines = payload.lines;
    gameStateOpp.heldPiece = payload.heldPiece;
    gameStateOpp.nextPiece = payload.nextPiece;
    gameStateOpp.attackGauge = payload.attackGauge;
    
    // 상대 스태츠 드로우
    document.getElementById('stat-score-opp').textContent = payload.score;
    document.getElementById('stat-lines-opp').textContent = payload.lines;

    // 상대 게이지 그리기
    updateGarbageGauge('opp', payload.attackGauge);

    // 상대 캔버스 드로우
    drawGrid(ctxGridOpp, payload.grid, null); // 넥스트 미노 등은 사이드 패널에 드로우
    
    // 상대 홀드 피스 드로우
    clearCanvas(canvasHoldOpp, ctxHoldOpp);
    if (payload.heldPiece) {
        drawPiecePreview(ctxHoldOpp, MINOS[payload.heldPiece.type], payload.heldPiece.type, 18);
    }
    
    // 상대 넥스트 피스 드로우
    clearCanvas(canvasNextOpp, ctxNextOpp);
    if (payload.nextPiece) {
        drawPiecePreview(ctxNextOpp, MINOS[payload.nextPiece.type], payload.nextPiece.type, 18);
    }
}

// 상대 공격 정보 처리
function handleGarbageAttack(payload) {
    // 대기열에 쌓고 게이지 갱신
    gameStateSelf.garbageQueue.push(payload.lines);
    const sum = gameStateSelf.garbageQueue.reduce((acc, val) => acc + val, 0);
    updateGarbageGauge('self', sum);
    
    // 알림음
    playMeowSound();
}

// 상대방 사망 처리 -> 내 승리
function handleOpponentLoss() {
    isGameRunning = false;
    stopBGM();
    
    const title = document.getElementById('overlay-title');
    const subtitle = document.getElementById('overlay-subtitle');
    
    title.textContent = "VICTORY";
    title.style.color = "#ffd166"; // Gold
    title.style.textShadow = "0 0 15px rgba(255, 209, 102, 0.4)";
    subtitle.textContent = "야옹! 경쟁 승리! 훌륭한 고양이 집사다옹!";
    
    document.getElementById('overlay-score').textContent = gameStateSelf.score;
    document.getElementById('overlay-lines').textContent = gameStateSelf.lines;
    
    document.getElementById('game-overlay').classList.remove('hidden');
    
    // 랭킹 스코어 업데이트
    uploadHighScore('multi', gameStateSelf.score);
}

// 게이지 바 그래픽 표현
function updateGarbageGauge(player, size) {
    const percent = Math.min(100, (size / 10) * 100); // 10줄 차면 꽉 찬다
    const bar = document.getElementById(`garbage-gauge-${player}`);
    if (bar) {
        bar.style.height = `${percent}%`;
    }
}

// 내 상태 상대에게 전송 (브로드캐스트)
function syncGameStateToOpponent() {
    if (!gameRealtimeChannel) return;
    
    const packet = {
        nickname: currentUser ? currentUser.nickname : '집사',
        grid: gameStateSelf.grid,
        score: gameStateSelf.score,
        lines: gameStateSelf.lines,
        heldPiece: gameStateSelf.heldPiece,
        nextPiece: gameStateSelf.nextPieceQueue[0] ? { type: gameStateSelf.nextPieceQueue[0].type } : null,
        attackGauge: gameStateSelf.garbageQueue.reduce((acc, val) => acc + val, 0),
        isReadySync: true
    };

    gameRealtimeChannel.send({
        type: 'broadcast',
        event: 'game-sync',
        payload: packet
    });
}

// 장애물 줄 발송 (공격)
function sendGarbageToOpponent(lines) {
    if (!gameRealtimeChannel) return;
    
    gameRealtimeChannel.send({
        type: 'broadcast',
        event: 'garbage-attack',
        payload: { lines: lines }
    });
}

// 사망 노티 발송
function broadcastGameOver() {
    if (!gameRealtimeChannel) return;
    
    gameRealtimeChannel.send({
        type: 'broadcast',
        event: 'game-over',
        payload: {}
    });
}

// 호스트가 게임 시작 신호 발송
function requestStartGame() {
    if (!gameRealtimeChannel || !isHost) return;

    // 대기방 DB 상태를 playing 으로 업데이트
    if (supabaseClient && activeRoomId) {
        supabaseClient.from('tr_rooms')
            .update({ status: 'playing' })
            .eq('id', activeRoomId)
            .then();
    }

    gameRealtimeChannel.send({
        type: 'broadcast',
        event: 'game-start-signal',
        payload: {}
    });

    // 나 자신도 카운트다운 시작
    runGameStartCountdown();
}

// 카운트다운 가동
function runGameStartCountdown() {
    document.getElementById('multiplay-controls').classList.add('hidden');
    const cd = document.getElementById('game-start-countdown');
    cd.classList.remove('hidden');
    
    let count = 3;
    cd.textContent = count;
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            cd.textContent = count;
        } else {
            clearInterval(interval);
            cd.classList.add('hidden');
            
            // 실 게임 시동!
            startGameExecution();
        }
    }, 1000);
}

// --- 12. 게임 퀵 플레이어 진입 함수들 ---

function startSingleGame() {
    enterGameRoom({ title: '싱글 플레이 모드' });
}

function initSingleGameStart() {
    runGameStartCountdown();
}

function startGameExecution() {
    resetLocalGameState();
    
    // 조각 던지기
    gameStateSelf.currentPiece = getRandomPiece();
    drawNextQueue();
    
    isGameRunning = true;
    startBGM();
    
    requestAnimationFrame(gameLoop);
}

function restartCurrentGame() {
    document.getElementById('game-overlay').classList.add('hidden');
    if (isMultiplayMode) {
        // 호스트인 경우에만 재시작 트리거
        if (isHost) {
            requestStartGame();
        }
    } else {
        initSingleGameStart();
    }
}

async function exitToLobby() {
    isGameRunning = false;
    stopBGM();
    
    document.getElementById('game-overlay').classList.add('hidden');
    showSection('lobby-section');

    // 멀티룸 퇴장 처리
    if (activeRoomId && supabaseClient) {
        try {
            // 상대방에게 퇴장 노티 전송
            if (gameRealtimeChannel) {
                gameRealtimeChannel.send({
                    type: 'broadcast',
                    event: isHost ? 'host-left' : 'player-left',
                    payload: {}
                });
            }

            if (isHost) {
                // 방장이면 방 파괴
                await supabaseClient.from('tr_rooms').delete().eq('id', activeRoomId);
            } else {
                // 게스트면 opponent 비우기
                await supabaseClient.from('tr_rooms')
                    .update({ opponent_id: null, opponent_nickname: null })
                    .eq('id', activeRoomId);
            }
        } catch (e) {
            console.error("Room exit cleanup error:", e);
        }
    }

    if (gameRealtimeChannel) {
        supabaseClient.removeChannel(gameRealtimeChannel);
        gameRealtimeChannel = null;
    }
    
    activeRoomId = null;
    isMultiplayMode = false;
    
    // 로비 정보 갱신
    loadRooms();
    loadRankings();
}

// --- 13. 기타 유틸리티 함수 ---
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}
