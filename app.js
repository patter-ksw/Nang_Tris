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
let currentBgmStep = 0;
let lobbyBgmTimer = null;
let currentLobbyBgmStep = 0;
let masterGain = null;
let noiseBuffer = null;
let delayNode = null;
let delayFeedback = null;
let lastMelFreq = 0;

// 각 스테이지별 8비트 Chiptune BGM 트랙 정의 (멜로디 + 베이스 + 드럼 구성)
// 32스텝 루프, 각 스텝은 8분음표 기준
const STAGE_BGM = {
    1: { // 1스테이지: 밝고 귀여운 아기 고양이 테마 (C Major, 신나는 8비트 스퀘어 리드)
        tempo: 110,
        synthType: 'square',
        melody: [
            523.25, 0, 659.25, 0, 783.99, 0, 880.00, 0,
            698.46, 0, 880.00, 0, 783.99, 0, 0, 0,
            783.99, 0, 880.00, 0, 987.77, 0, 1046.50, 0,
            880.00, 0, 783.99, 0, 523.25, 0, 0, 0
        ],
        bass: [
            130.81, 130.81, 164.81, 164.81, 174.61, 174.61, 196.00, 196.00,
            174.61, 174.61, 196.00, 196.00, 130.81, 130.81, 130.81, 130.81,
            196.00, 196.00, 220.00, 220.00, 246.94, 246.94, 261.63, 261.63,
            220.00, 220.00, 196.00, 196.00, 130.81, 130.81, 130.81, 130.81
        ],
        drums: {
            kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
            hihat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
        }
    },
    2: { // 2스테이지: 따뜻하고 재지한 식빵 굽는 고양이 테마 (F Pentatonic, 부드러운 하모니 리드)
        tempo: 130,
        synthType: 'triangle-harmony',
        melody: [
            349.23, 0, 440.00, 0, 523.25, 523.25, 587.33, 0,
            523.25, 0, 440.00, 0, 392.00, 0, 349.23, 0,
            392.00, 0, 440.00, 0, 392.00, 0, 293.66, 0,
            349.23, 0, 0, 0, 0, 0, 0, 0
        ],
        bass: [
            87.31, 87.31, 87.31, 87.31, 116.54, 116.54, 116.54, 116.54,
            130.81, 130.81, 130.81, 130.81, 87.31, 87.31, 87.31, 87.31,
            130.81, 130.81, 130.81, 130.81, 98.00, 98.00, 98.00, 98.00,
            87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31, 87.31
        ],
        drums: {
            kick:  [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
            snare: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
        }
    },
    3: { // 3스테이지: 긴장감 넘치는 사냥 나선 고양이 테마 (A Minor, 와와 필터 스윕 톱니파 리드)
        tempo: 150,
        synthType: 'sawtooth-sweep',
        melody: [
            440.00, 493.88, 523.25, 0, 587.33, 659.25, 698.46, 0,
            659.25, 0, 587.33, 0, 523.25, 0, 493.88, 0,
            440.00, 0, 523.25, 0, 659.25, 0, 783.99, 0,
            698.46, 0, 587.33, 0, 440.00, 0, 0, 0
        ],
        bass: [
            110.00, 110.00, 110.00, 110.00, 146.83, 146.83, 146.83, 146.83,
            164.81, 164.81, 164.81, 164.81, 110.00, 110.00, 110.00, 110.00,
            110.00, 110.00, 130.81, 130.81, 164.81, 164.81, 196.00, 196.00,
            174.61, 174.61, 146.83, 146.83, 110.00, 110.00, 110.00, 110.00
        ],
        drums: {
            kick:  [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
            hihat: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
        }
    },
    4: { // 4스테이지: 몽환적이고 스페이시한 우주 고양이 테마 (C Lydian Arpeggio, 딜레이 사인파 글라이딩 리드)
        tempo: 170,
        synthType: 'space-glide',
        melody: [
            523.25, 659.25, 783.99, 987.77, 1174.66, 987.77, 783.99, 659.25,
            587.33, 739.99, 880.00, 1108.73, 1318.51, 1108.73, 880.00, 739.99,
            523.25, 659.25, 783.99, 987.77, 1174.66, 987.77, 783.99, 659.25,
            587.33, 739.99, 880.00, 1108.73, 1318.51, 0, 0, 0
        ],
        bass: [
            65.41, 0, 65.41, 0, 65.41, 0, 65.41, 0,
            73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0,
            65.41, 0, 65.41, 0, 65.41, 0, 65.41, 0,
            73.42, 0, 73.42, 0, 73.42, 0, 73.42, 0
        ],
        drums: {
            kick:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            hihat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
        }
    }
};

// 웰컴 로비 전용 BGM: 경쾌하고 신나는 8비트 비트 (C Major)
const LOBBY_BGM = {
    tempo: 124,
    synthType: 'square',
    melody: [
        523.25, 0, 587.33, 0, 659.25, 0, 523.25, 0,
        659.25, 0, 698.46, 0, 783.99, 0, 0, 0,
        783.99, 880.00, 783.99, 698.46, 659.25, 0, 523.25, 0,
        587.33, 0, 392.00, 0, 523.25, 0, 0, 0
    ],
    bass: [
        130.81, 0, 130.81, 0, 164.81, 0, 164.81, 0,
        174.61, 0, 174.61, 0, 196.00, 0, 196.00, 0,
        196.00, 0, 196.00, 0, 130.81, 0, 130.81, 0,
        146.83, 0, 98.00, 0, 130.81, 0, 130.81, 0
    ],
    drums: {
        kick:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    }
};

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
let gameLoopId = null;
let countdownIntervalId = null;

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
    attackGauge: 0,   // 전송할 공격 게이지
    stage: 1,         // 현재 스테이지
    stageLines: 0     // 현재 스테이지에서 지운 줄 수 (30줄 목표)
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

    // 첫 사용자 상호작용시 로비 BGM 시작 시도
    const startAudioOnInteraction = () => {
        if (currentActiveSection === 'auth-section' || currentActiveSection === 'lobby-section') {
            startLobbyBGM();
        }
        document.removeEventListener('click', startAudioOnInteraction);
        document.removeEventListener('keydown', startAudioOnInteraction);
        document.removeEventListener('touchstart', startAudioOnInteraction);
    };
    document.addEventListener('click', startAudioOnInteraction);
    document.addEventListener('keydown', startAudioOnInteraction);
    document.addEventListener('touchstart', startAudioOnInteraction);
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
    
    // 섹션 전환에 따른 BGM 상태 제어
    if (sectionId === 'auth-section' || sectionId === 'lobby-section') {
        stopBGM();
        startLobbyBGM();
    } else if (sectionId === 'game-section') {
        stopLobbyBGM();
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

            // 유저 삽입 (name 컬럼이 NOT NULL이므로 nickname과 동일하게 채워줍니다)
            const { data, error } = await supabaseClient
                .from('tr_users')
                .insert([{ username, password, nickname, name: nickname }])
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
    const displayName = currentUser.nickname || currentUser.username;
    document.getElementById('user-display-name').textContent = displayName;
    document.getElementById('player-self-name').textContent = `${displayName} (나)`;
    
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
    if (window.innerWidth <= 1024) {
        alert("멀티플레이는 PC 환경에서만 플레이할 수 있습니다 🐱");
        return;
    }
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
                creator_nickname: currentUser.nickname || currentUser.username,
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
    if (window.innerWidth <= 1024) {
        alert("멀티플레이는 PC 환경에서만 플레이할 수 있습니다 🐱");
        return;
    }
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
                opponent_nickname: currentUser.nickname || currentUser.username
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
    
    // 마스터 게인 설정 (전체 볼륨 밸런스 조정 및 클리핑 방지)
    if (!masterGain) {
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0.75, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
    }
    
    // 공간감 이펙터 (딜레이/에코) 체인 설정
    if (!delayNode) {
        delayNode = audioCtx.createDelay(1.0);
        delayFeedback = audioCtx.createGain();
        delayNode.delayTime.value = 0.22; // 0.22초 딜레이 타임
        delayFeedback.gain.value = 0.32;  // 피드백 볼륨 (잔향 강도)
        
        delayNode.connect(delayFeedback);
        delayFeedback.connect(delayNode);
        
        delayNode.connect(masterGain);
    }
    
    // 노이즈 버퍼 생성 (Chiptune 스네어, 하이햇 드럼 음색용)
    if (!noiseBuffer) {
        const bufferSize = audioCtx.sampleRate * 1.0; // 1초 분량
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }
}

function toggleAudioMute() {
    isMuted = !isMuted;
    const icon = document.getElementById('audio-icon');
    if (isMuted) {
        icon.setAttribute('data-lucide', 'volume-x');
        stopBGM();
        stopLobbyBGM();
    } else {
        icon.setAttribute('data-lucide', 'volume-2');
        if (isGameRunning && !isGamePaused) {
            startBGM();
        } else if (currentActiveSection === 'auth-section' || currentActiveSection === 'lobby-section') {
            startLobbyBGM();
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
        gainNode.connect(masterGain || audioCtx.destination);
        
        osc.start(now);
        osc.stop(now + 0.35);
    } catch (e) {
        console.error("Audio error: ", e);
    }
}

// 절차적 드럼 음색 합성기 함수군
function playKick(time) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);
        
        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        
        osc.connect(gain);
        gain.connect(masterGain || audioCtx.destination);
        
        osc.start(time);
        osc.stop(time + 0.1);
    } catch (e) {
        console.error("Kick synth error:", e);
    }
}

function playSnare(time) {
    if (!audioCtx || !noiseBuffer) return;
    try {
        // 1. 노이즈 스냅 성분
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        filter.Q.value = 1.2;
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.18, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        
        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain || audioCtx.destination);
        
        // 2. 피치 스윕 바디 톤 성분 (중저음 타격감 향상)
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, time);
        osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);
        
        oscGain.gain.setValueAtTime(0.15, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        
        osc.connect(oscGain);
        oscGain.connect(masterGain || audioCtx.destination);
        
        noiseSource.start(time);
        noiseSource.stop(time + 0.12);
        osc.start(time);
        osc.stop(time + 0.08);
    } catch (e) {
        console.error("Snare synth error:", e);
    }
}

function playHihat(time) {
    if (!audioCtx || !noiseBuffer) return;
    try {
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7500;
        
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        
        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain || audioCtx.destination);
        
        noiseSource.start(time);
        noiseSource.stop(time + 0.04);
    } catch (e) {
        console.error("Hihat synth error:", e);
    }
}

function startBGM() {
    if (isMuted) return;
    try {
        initAudio();
        if (bgmTimer) return;
        
        function playNextStep() {
            if (isMuted || !audioCtx || !isGameRunning || isGamePaused) return;
            
            // 스테이지 번호 1~4 범위 매핑
            const currentStageNum = isMultiplayMode ? 1 : (((gameStateSelf.stage - 1) % 4) + 1);
            const track = STAGE_BGM[currentStageNum];
            
            // 스테이지에 따라 갈수록 템포가 빨라지도록 동적 계산 (최대 240 bpm 제한)
            let dynamicTempo = 110 + (gameStateSelf.stage - 1) * 15;
            if (dynamicTempo > 240) dynamicTempo = 240;
            
            const stepDuration = 60 / dynamicTempo / 2; // 8분음표 간격 (초 단위)
            const now = audioCtx.currentTime;
            
            // 1. 드럼 파트 (Kick, Snare, Hihat 순차 재생)
            if (track.drums) {
                if (track.drums.kick && track.drums.kick[currentBgmStep] === 1) {
                    playKick(now);
                }
                if (track.drums.snare && track.drums.snare[currentBgmStep] === 1) {
                    playSnare(now);
                }
                if (track.drums.hihat && track.drums.hihat[currentBgmStep] === 1) {
                    playHihat(now);
                }
            }
            
            // 2. 멜로디 파트 (스테이지 신디사이저 타입별 분기)
            const melFreq = track.melody[currentBgmStep];
            if (melFreq > 0) {
                if (track.synthType === 'square') {
                    // 클래식 8비트 패미컴 펄스파 리드
                    const oscMel = audioCtx.createOscillator();
                    const gainMel = audioCtx.createGain();
                    
                    oscMel.type = 'square';
                    oscMel.frequency.setValueAtTime(melFreq, now);
                    
                    gainMel.gain.setValueAtTime(0, now);
                    gainMel.gain.linearRampToValueAtTime(0.04, now + 0.01);
                    gainMel.gain.exponentialRampToValueAtTime(0.001, now + stepDuration - 0.015);
                    
                    oscMel.connect(gainMel);
                    gainMel.connect(masterGain || audioCtx.destination);
                    if (delayNode) gainMel.connect(delayNode);
                    
                    oscMel.start(now);
                    oscMel.stop(now + stepDuration);
                } 
                else if (track.synthType === 'triangle-harmony') {
                    // 삼각파 + 5도 화음(Perfect 5th) 추가하여 풍성한 재즈 톤
                    const oscMel = audioCtx.createOscillator();
                    const gainMel = audioCtx.createGain();
                    oscMel.type = 'triangle';
                    oscMel.frequency.setValueAtTime(melFreq, now);
                    
                    gainMel.gain.setValueAtTime(0, now);
                    gainMel.gain.linearRampToValueAtTime(0.05, now + 0.02);
                    gainMel.gain.exponentialRampToValueAtTime(0.001, now + stepDuration - 0.01);
                    
                    oscMel.connect(gainMel);
                    gainMel.connect(masterGain || audioCtx.destination);
                    if (delayNode) gainMel.connect(delayNode);
                    
                    oscMel.start(now);
                    oscMel.stop(now + stepDuration);
                    
                    // 화음 보이스
                    const oscHarm = audioCtx.createOscillator();
                    const gainHarm = audioCtx.createGain();
                    oscHarm.type = 'triangle';
                    oscHarm.frequency.setValueAtTime(melFreq * 1.5, now);
                    
                    gainHarm.gain.setValueAtTime(0, now);
                    gainHarm.gain.linearRampToValueAtTime(0.025, now + 0.025);
                    gainHarm.gain.exponentialRampToValueAtTime(0.001, now + stepDuration - 0.01);
                    
                    oscHarm.connect(gainHarm);
                    gainHarm.connect(masterGain || audioCtx.destination);
                    if (delayNode) gainHarm.connect(delayNode);
                    
                    oscHarm.start(now);
                    oscHarm.stop(now + stepDuration);
                }
                else if (track.synthType === 'sawtooth-sweep') {
                    // 아날로그 느낌의 톱니파 + 로우패스 필터 컷오프 스윕
                    const oscMel = audioCtx.createOscillator();
                    const gainMel = audioCtx.createGain();
                    const filterMel = audioCtx.createBiquadFilter();
                    
                    oscMel.type = 'sawtooth';
                    oscMel.frequency.setValueAtTime(melFreq, now);
                    
                    filterMel.type = 'lowpass';
                    filterMel.Q.value = 4.5;
                    filterMel.frequency.setValueAtTime(1600, now);
                    filterMel.frequency.exponentialRampToValueAtTime(650, now + stepDuration - 0.02);
                    
                    gainMel.gain.setValueAtTime(0, now);
                    gainMel.gain.linearRampToValueAtTime(0.03, now + 0.01);
                    gainMel.gain.exponentialRampToValueAtTime(0.001, now + stepDuration - 0.01);
                    
                    oscMel.connect(filterMel);
                    filterMel.connect(gainMel);
                    gainMel.connect(masterGain || audioCtx.destination);
                    if (delayNode) gainMel.connect(delayNode);
                    
                    oscMel.start(now);
                    oscMel.stop(now + stepDuration);
                }
                else if (track.synthType === 'space-glide') {
                    // 우주적 느낌의 사인파 + 포르타멘토 피치 글라이드
                    const oscMel = audioCtx.createOscillator();
                    const gainMel = audioCtx.createGain();
                    
                    oscMel.type = 'sine';
                    const prevFreq = lastMelFreq > 0 ? lastMelFreq : melFreq;
                    oscMel.frequency.setValueAtTime(prevFreq, now);
                    oscMel.frequency.exponentialRampToValueAtTime(melFreq, now + 0.08); // 80ms 글라이드
                    
                    gainMel.gain.setValueAtTime(0, now);
                    gainMel.gain.linearRampToValueAtTime(0.05, now + 0.03);
                    gainMel.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.4);
                    
                    oscMel.connect(gainMel);
                    gainMel.connect(masterGain || audioCtx.destination);
                    if (delayNode) gainMel.connect(delayNode);
                    
                    oscMel.start(now);
                    oscMel.stop(now + stepDuration * 1.4);
                    
                    lastMelFreq = melFreq;
                }
            }
            
            // 3. 베이스 파트 (저음부 악기 스타일 매핑)
            const bassFreq = track.bass[currentBgmStep];
            if (bassFreq > 0) {
                const oscBass = audioCtx.createOscillator();
                const gainBass = audioCtx.createGain();
                
                if (currentStageNum === 2 || currentStageNum === 4) {
                    oscBass.type = 'sine';
                } else if (currentStageNum === 3) {
                    oscBass.type = 'sawtooth';
                } else {
                    oscBass.type = 'triangle';
                }
                
                oscBass.frequency.setValueAtTime(bassFreq, now);
                
                let connectedNode = gainBass;
                if (currentStageNum === 3) {
                    const bassFilter = audioCtx.createBiquadFilter();
                    bassFilter.type = 'lowpass';
                    bassFilter.frequency.setValueAtTime(220, now);
                    oscBass.connect(bassFilter);
                    bassFilter.connect(gainBass);
                } else {
                    oscBass.connect(gainBass);
                }
                
                gainBass.gain.setValueAtTime(0, now);
                if (currentStageNum === 2) {
                    gainBass.gain.linearRampToValueAtTime(0.06, now + 0.02);
                    gainBass.gain.exponentialRampToValueAtTime(0.001, now + stepDuration - 0.01);
                } else if (currentStageNum === 3) {
                    gainBass.gain.linearRampToValueAtTime(0.045, now + 0.01);
                    gainBass.gain.exponentialRampToValueAtTime(0.001, now + stepDuration - 0.005);
                } else {
                    gainBass.gain.linearRampToValueAtTime(0.04, now + 0.02);
                    gainBass.gain.exponentialRampToValueAtTime(0.001, now + stepDuration - 0.02);
                }
                
                gainBass.connect(masterGain || audioCtx.destination);
                
                oscBass.start(now);
                oscBass.stop(now + stepDuration);
            }
            
            currentBgmStep = (currentBgmStep + 1) % track.melody.length;
            bgmTimer = setTimeout(playNextStep, stepDuration * 1000);
        }
        
        playNextStep();
    } catch (e) {
        console.error("BGM error:", e);
    }
}

function stopBGM() {
    if (bgmTimer) {
        clearTimeout(bgmTimer);
        bgmTimer = null;
    }
    lastMelFreq = 0; // 글라이드 리셋
}

function startLobbyBGM() {
    if (isMuted) return;
    try {
        initAudio();
        if (lobbyBgmTimer) return;
        
        function playNextLobbyStep() {
            if (isMuted || !audioCtx || (currentActiveSection !== 'auth-section' && currentActiveSection !== 'lobby-section')) {
                stopLobbyBGM();
                return;
            }
            
            const track = LOBBY_BGM;
            const stepDuration = 60 / track.tempo / 2; // 8분음표 간격 (초 단위)
            const now = audioCtx.currentTime;
            
            // 1. 드럼 파트
            if (track.drums) {
                if (track.drums.kick && track.drums.kick[currentLobbyBgmStep] === 1) {
                    playKick(now);
                }
                if (track.drums.snare && track.drums.snare[currentLobbyBgmStep] === 1) {
                    playSnare(now);
                }
                if (track.drums.hihat && track.drums.hihat[currentLobbyBgmStep] === 1) {
                    playHihat(now);
                }
            }
            
            // 2. 멜로디 파트
            const melFreq = track.melody[currentLobbyBgmStep];
            if (melFreq > 0) {
                const oscMel = audioCtx.createOscillator();
                const gainMel = audioCtx.createGain();
                
                oscMel.type = 'square';
                oscMel.frequency.setValueAtTime(melFreq, now);
                
                gainMel.gain.setValueAtTime(0, now);
                gainMel.gain.linearRampToValueAtTime(0.04, now + 0.01);
                gainMel.gain.exponentialRampToValueAtTime(0.001, now + stepDuration - 0.015);
                
                oscMel.connect(gainMel);
                gainMel.connect(masterGain || audioCtx.destination);
                if (delayNode) gainMel.connect(delayNode);
                
                oscMel.start(now);
                oscMel.stop(now + stepDuration);
            }
            
            // 3. 베이스 파트
            const bassFreq = track.bass[currentLobbyBgmStep];
            if (bassFreq > 0) {
                const oscBass = audioCtx.createOscillator();
                const gainBass = audioCtx.createGain();
                
                oscBass.type = 'triangle';
                oscBass.frequency.setValueAtTime(bassFreq, now);
                
                oscBass.connect(gainBass);
                gainBass.gain.setValueAtTime(0, now);
                gainBass.gain.linearRampToValueAtTime(0.04, now + 0.02);
                gainBass.gain.exponentialRampToValueAtTime(0.001, now + stepDuration - 0.02);
                
                gainBass.connect(masterGain || audioCtx.destination);
                
                oscBass.start(now);
                oscBass.stop(now + stepDuration);
            }
            
            currentLobbyBgmStep = (currentLobbyBgmStep + 1) % track.melody.length;
            lobbyBgmTimer = setTimeout(playNextLobbyStep, stepDuration * 1000);
        }
        
        playNextLobbyStep();
    } catch (e) {
        console.error("Lobby BGM error:", e);
    }
}

function stopLobbyBGM() {
    if (lobbyBgmTimer) {
        clearTimeout(lobbyBgmTimer);
        lobbyBgmTimer = null;
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
    // 채팅 입력 창이 포커스된 경우 키보드 게임 조작 방지
    if (document.activeElement && document.activeElement.id === 'battle-chat-input') {
        return;
    }
    
    if (!isGameRunning || isGamePaused) return;

    // 게임 조작 키 입력 시 브라우저 스크롤 등의 기본 동작을 방지합니다.
    const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'ShiftLeft', 'ShiftRight', 'Enter', 'NumpadEnter'];
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
        case 'Enter':
        case 'NumpadEnter':
            if (isMultiplayMode && gameStateSelf.attackGauge >= 1) {
                triggerManualAttack();
            }
            break;
    }
}

// 모바일 가상 패드 터치 액션 처리
function handleMobileAction(action) {
    if (!isGameRunning) return;
    if (isGamePaused && action !== 'pause') return;

    switch(action) {
        case 'left':
            moveActivePiece(-1);
            break;
        case 'right':
            moveActivePiece(1);
            break;
        case 'down':
            moveActivePieceDown();
            break;
        case 'rot-left':
            rotatePiece(gameStateSelf.currentPiece, -1);
            syncGameStateToOpponent();
            break;
        case 'rot-right':
            rotatePiece(gameStateSelf.currentPiece, 1);
            syncGameStateToOpponent();
            break;
        case 'hard-drop':
            hardDropActivePiece();
            break;
        case 'hold':
            holdActivePiece();
            break;
        case 'attack':
            if (isMultiplayMode && gameStateSelf.attackGauge >= 1) {
                triggerManualAttack();
            }
            break;
        case 'pause':
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

        // 멀티플레이어 경쟁전: 어택 게이지 증가 및 공격 처리
        if (isMultiplayMode && lines > 0) {
            gameStateSelf.attackGauge += lines;
            
            // 10개까지 쌓이면 자동으로 상대쪽에 어택 (10줄 공격 후 게이지에서 10 차감)
            if (gameStateSelf.attackGauge >= 10) {
                sendGarbageToOpponent(10);
                gameStateSelf.attackGauge -= 10;
                playMeowSound(); // 어택 알림음
            }
            
            updateGarbageGauge('self', gameStateSelf.attackGauge);
        }

        // 싱글플레이어 모드: 스테이지 진행 검사 (30줄 클리어 시 스테이지 클리어)
        if (!isMultiplayMode) {
            gameStateSelf.stageLines += lines;
            if (gameStateSelf.stageLines >= 30) {
                updateStatsUI();
                triggerStageClear();
                return; // 다음 조각 배치를 중단하고 스테이지 클리어 화면으로 이동
            }
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
    playGameOverSound(); // 실망한 효과음 재생
    
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
        
        // 멀티 보드 결과 오버레이 표시 (나: 패배, 상대: 승리)
        showBoardResult('self', false);
        showBoardResult('opp', true);
        
        // 멀티 최고 스코어 랭킹업 로드
        await uploadHighScore('multi', gameStateSelf.score);
        
        // 방장(호스트)인 경우 게임 종료 시 대기방 DB 상태를 waiting으로 변경 (로비에서 대기중으로 리매치 가능하게)
        if (isHost && supabaseClient && activeRoomId) {
            supabaseClient.from('tr_rooms').update({ status: 'waiting' }).eq('id', activeRoomId).then();
        }
    } else {
        title.textContent = "GAME OVER";
        title.style.color = "#ff8da1";
        subtitle.textContent = "수고했다옹! 기여운 고양이와 다시 해보자옹!";
        
        // 싱글 최고 스코어 랭킹업 로드
        await uploadHighScore('single', gameStateSelf.score);
    }
    
    // 게임 오버레이 고양이 눈을 우는 눈(ㅠ)으로 변경하고 슬픈 애니메이션 클래스 주입
    const leftEye = document.querySelector('#game-overlay .dancing-cat .eye.left');
    const rightEye = document.querySelector('#game-overlay .dancing-cat .eye.right');
    if (leftEye && rightEye) {
        leftEye.textContent = "ㅠ";
        rightEye.textContent = "ㅠ";
    }
    const cat = document.querySelector('#game-overlay .dancing-cat');
    if (cat) {
        cat.classList.remove('somersault', 'sad');
        void cat.offsetWidth; // Reflow 트리거
        cat.classList.add('sad');
    }

    // overlay-btn-restart 복원
    const restartBtn = document.getElementById('overlay-btn-restart');
    if (isMultiplayMode) {
        if (isHost) {
            restartBtn.innerHTML = `<i data-lucide="rotate-ccw"></i> 다시 시작`;
            restartBtn.onclick = restartCurrentGame;
            restartBtn.classList.remove('hidden');
        } else {
            restartBtn.classList.add('hidden'); // 게스트는 방장의 시작 대기
        }
    } else {
        restartBtn.innerHTML = `<i data-lucide="rotate-ccw"></i> 다시 시작`;
        restartBtn.onclick = restartCurrentGame;
        restartBtn.classList.remove('hidden');
    }
    lucide.createIcons();
    
    document.getElementById('game-overlay').classList.remove('hidden');
}

// 싱글플레이어 스테이지 클리어 연출 및 로직
function triggerStageClear() {
    isGameRunning = false;
    stopBGM();
    
    // "야옹" 소리를 먼저 내고, 320ms 후에 신나는 승리 팡파레 음악 연주!
    playMeowSound();
    setTimeout(playStageClearFanfare, 320);
    
    const title = document.getElementById('overlay-title');
    const subtitle = document.getElementById('overlay-subtitle');
    
    title.textContent = `STAGE ${gameStateSelf.stage} CLEAR!`;
    title.style.color = "#ffd166"; // Gold
    subtitle.textContent = "야옹! 고양이가 너무 기뻐서 공중제비를 돕니다! 🐈💨";
    
    document.getElementById('overlay-score').textContent = gameStateSelf.score;
    document.getElementById('overlay-lines').textContent = gameStateSelf.lines;
    
    // 게임 오버레이 고양이 눈 모양을 신나는 눈(^)으로 복원
    const leftEye = document.querySelector('#game-overlay .dancing-cat .eye.left');
    const rightEye = document.querySelector('#game-overlay .dancing-cat .eye.right');
    if (leftEye && rightEye) {
        leftEye.textContent = "^";
        rightEye.textContent = "^";
    }
    
    // 게임 오버레이 고양이 공중제비 애니메이션 트리거
    const cat = document.querySelector('#game-overlay .dancing-cat');
    if (cat) {
        cat.classList.remove('somersault', 'sad');
        void cat.offsetWidth; // Reflow 트리거
        cat.classList.add('somersault');
    }
    
    // 다음 스테이지 버튼으로 임시 변환
    const restartBtn = document.getElementById('overlay-btn-restart');
    restartBtn.innerHTML = `<i data-lucide="arrow-right-circle"></i> 다음 스테이지 시작 (Stage ${gameStateSelf.stage + 1}) 🐾`;
    restartBtn.onclick = startNextStage;
    restartBtn.classList.remove('hidden');
    lucide.createIcons();
    
    document.getElementById('game-overlay').classList.remove('hidden');
}

// 다음 스테이지 시작 처리
function startNextStage() {
    document.getElementById('game-overlay').classList.add('hidden');
    
    // 애니메이션 및 눈 복원 (게임 오버레이 기준)
    const cat = document.querySelector('#game-overlay .dancing-cat');
    if (cat) {
        cat.classList.remove('somersault', 'sad');
    }
    const leftEye = document.querySelector('#game-overlay .dancing-cat .eye.left');
    const rightEye = document.querySelector('#game-overlay .dancing-cat .eye.right');
    if (leftEye && rightEye) {
        leftEye.textContent = "^";
        rightEye.textContent = "^";
    }
    
    gameStateSelf.stage++;
    gameStateSelf.stageLines = 0; // 누적 라인 초기화
    
    // 보너스 보상: 고양이가 발톱으로 긁어서 맨 아래 3줄을 깎아줍니다!
    cleanBottomRows(3);
    
    // 음악 재생용 스텝 리셋
    currentBgmStep = 0;
    
    // 스테이지별 고정 속도 적용 (스테이지가 높을수록 빨라짐)
    const speedTable = [1000, 1000, 800, 650, 500, 380, 280, 200, 120, 90];
    dropInterval = speedTable[gameStateSelf.stage] || 80;
    
    // 카운트다운을 표시하고 재개
    runGameStartCountdown(true);
}

// 보드 바닥 줄 청소 보상
function cleanBottomRows(count) {
    for (let i = 0; i < count; i++) {
        gameStateSelf.grid.pop();
        gameStateSelf.grid.unshift(Array(BOARD_WIDTH).fill(0));
    }
    playMeowSound();
}

// 8비트 승리 팡파레 음악 합성
function playStageClearFanfare() {
    if (isMuted) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        
        // 8비트 풍의 신나는 C Major 아르페지오 & 스케일 팡파레 (8음 구성)
        const notes = [
            523.25,  // C5
            659.25,  // E5
            783.99,  // G5
            1046.50, // C6
            880.00,  // A5
            987.77,  // B5
            1046.50, // C6
            1318.51  // E6
        ];
        
        const noteDuration = 0.12;
        
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + idx * noteDuration);
            
            gainNode.gain.setValueAtTime(0, now + idx * noteDuration);
            gainNode.gain.linearRampToValueAtTime(0.06, now + idx * noteDuration + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * noteDuration + noteDuration * 1.5);
            
            osc.connect(gainNode);
            gainNode.connect(masterGain || audioCtx.destination);
            if (delayNode) gainNode.connect(delayNode);
            
            osc.start(now + idx * noteDuration);
            osc.stop(now + idx * noteDuration + noteDuration * 1.5);
        });
        
        // 피날레 파워 화음 (C6, E6, G6)
        const finaleStart = now + notes.length * noteDuration;
        const finaleNotes = [1046.50, 1318.51, 1567.98];
        finaleNotes.forEach((freq, fIdx) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = fIdx === 2 ? 'square' : 'triangle';
            osc.frequency.setValueAtTime(freq, finaleStart);
            
            gainNode.gain.setValueAtTime(0, finaleStart);
            gainNode.gain.linearRampToValueAtTime(0.05, finaleStart + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, finaleStart + 1.2);
            
            osc.connect(gainNode);
            gainNode.connect(masterGain || audioCtx.destination);
            if (delayNode) gainNode.connect(delayNode);
            
            osc.start(finaleStart);
            osc.stop(finaleStart + 1.2);
        });
    } catch (e) {
        console.error("Fanfare audio error:", e);
    }
}

// 게임오버 시 실망한 효과음 합성 (G3 -> F3 -> Eb3 -> C3 하향 진행 및 피치 슬라이드)
function playGameOverSound() {
    if (isMuted) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        
        // 침울하고 슬픈 단조 멜로디 하행 (8스텝)
        const notes = [
            261.63, // C4
            311.13, // Eb4
            392.00, // G4
            349.23, // F4
            311.13, // Eb4
            293.66, // D4
            261.63, // C4
            196.00  // G3 (축 쳐지는 느낌)
        ];
        
        const noteDuration = 0.25; // 느린 단조 템포
        
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = 'sawtooth';
            
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(350, now + idx * noteDuration);
            
            osc.frequency.setValueAtTime(freq, now + idx * noteDuration);
            if (idx === notes.length - 1) {
                osc.frequency.exponentialRampToValueAtTime(80, now + idx * noteDuration + 0.6);
            }
            
            gainNode.gain.setValueAtTime(0, now + idx * noteDuration);
            gainNode.gain.linearRampToValueAtTime(0.06, now + idx * noteDuration + 0.03);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * noteDuration + (idx === notes.length - 1 ? 0.8 : 0.35));
            
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(masterGain || audioCtx.destination);
            
            osc.start(now + idx * noteDuration);
            osc.stop(now + idx * noteDuration + (idx === notes.length - 1 ? 0.8 : 0.35));
        });
        
        // 배경에 깔리는 슬프고 무거운 지속음 (C2 저음)
        const bassOsc = audioCtx.createOscillator();
        const bassGain = audioCtx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(65.41, now);
        
        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(0.08, now + 0.1);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + notes.length * noteDuration + 0.5);
        
        bassOsc.connect(bassGain);
        bassGain.connect(masterGain || audioCtx.destination);
        
        bassOsc.start(now);
        bassOsc.stop(now + notes.length * noteDuration + 0.5);
    } catch (e) {
        console.error("GameOver audio error:", e);
    }
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
    if (!isGameRunning) {
        gameLoopId = null;
        return;
    }
    if (isGamePaused) {
        gameLoopId = requestAnimationFrame(gameLoop);
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
    
    gameLoopId = requestAnimationFrame(gameLoop);
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
        
        // 모바일 가상 패드에 어택 버튼 표시
        const mobileAttackBtn = document.getElementById('btn-mobile-attack');
        if (mobileAttackBtn) mobileAttackBtn.classList.remove('hidden');
        
        // 멀티플레이 채팅창 표시 및 초기화
        const chatContainer = document.getElementById('battle-chat-container');
        if (chatContainer) {
            chatContainer.classList.remove('hidden');
            const chatLog = document.getElementById('battle-chat-messages');
            if (chatLog) {
                chatLog.innerHTML = '<div class="chat-system">채팅방에 연결되었습니다. 매너 채팅 부탁드린다옹! 🐾</div>';
            }
        }
        
        if (room.opponent_id) {
            document.getElementById('player-opp-name').textContent = isHost ? room.opponent_nickname : room.creator_nickname;
        } else {
            document.getElementById('player-opp-name').textContent = '상대 대기중...';
        }
        
        // 준비 상태 메세지 및 채널 연결
        updateMultiplayStatus();
        subscribeGameChannel(room.id);
        // 방장인 경우 대기방 시작 버튼 노출 및 활성화 제어 (헤더 내 배치)
        const startBtn = document.getElementById('btn-start-game');
        if (startBtn) {
            if (isHost) {
                startBtn.classList.remove('hidden');
                startBtn.disabled = !room.opponent_id;
            } else {
                startBtn.classList.add('hidden');
            }
        }
    } else {
        // 싱글플레이 모드 돌입
        isMultiplayMode = false;
        document.getElementById('game-mode-badge').textContent = 'SINGLE';
        document.getElementById('player-panel-opponent').classList.add('hidden');
        document.getElementById('multiplay-controls').classList.add('hidden');
        
        // 모바일 가상 패드에 어택 버튼 숨김
        const mobileAttackBtn = document.getElementById('btn-mobile-attack');
        if (mobileAttackBtn) mobileAttackBtn.classList.add('hidden');
        
        // 시작 버튼 숨김
        const startBtn = document.getElementById('btn-start-game');
        if (startBtn) startBtn.classList.add('hidden');
        
        // 멀티플레이 채팅창 숨김
        const chatContainer = document.getElementById('battle-chat-container');
        if (chatContainer) {
            chatContainer.classList.add('hidden');
        }
        
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
    gameStateSelf.stage = 1;         // 스테이지 리셋
    gameStateSelf.stageLines = 0;    // 스테이지 지운 라인 리셋
    
    gameStateSelf.nextPieceQueue = [getRandomPiece(), getRandomPiece(), getRandomPiece()];
    
    dropInterval = 1000;
    dropCounter = 0;
    lastTime = 0;
    isGamePaused = false;
    
    clearCanvas(canvasHoldSelf, ctxHoldSelf);
    clearCanvas(canvasNextSelf, ctxNextSelf);
    updateStatsUI();
    updateGarbageGauge('self', 0);
    hideBoardResults(); // 보드 결과 오버레이 숨기기
}

// 멀티플레이 상태메세지 갱신
function updateMultiplayStatus() {
    const btn = document.getElementById('btn-start-game');
    const msg = document.getElementById('multiplay-status-text');

    if (isHost) {
        if (btn) btn.disabled = false;
        if (msg) msg.textContent = "방장입니다. 준비되셨으면 시작 버튼을 눌러주세요!";
        appendChatMessage("시스템", "방장입니다. 준비되셨으면 상단의 [시작] 버튼을 클릭해 게임을 진행해달라옹! 🐾", false, true);
    } else {
        if (btn) btn.disabled = true; // 방장만 시작 가능
        if (msg) msg.textContent = "방장이 게임을 시작하기를 기다리는 중...";
        appendChatMessage("시스템", "방장이 게임을 시작하기를 기다리는 중이다옹... 🐾", false, true);
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
        .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
            appendChatMessage(payload.sender, payload.text, false);
        })
        .on('broadcast', { event: 'player-left' }, () => {
            // 게스트 유저가 방을 나감
            clearOpponentPanel();
            document.getElementById('player-opp-name').textContent = '상대 대기중...';
            if (isHost) {
                document.getElementById('btn-start-game').disabled = true;
                document.getElementById('multiplay-status-text').textContent = '상대방이 방을 나갔습니다. 대기 중...';
                appendChatMessage("시스템", "상대방이 방을 나갔습니다. 대기 중... 🐾", false, true);
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
            appendChatMessage("시스템", `${payload.nickname}님이 입장하셨습니다! 게임을 시작해달라옹! 🐾`, false, true);
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
    
    // 멀티 보드 결과 오버레이 표시 (나: 승리, 상대: 패배)
    showBoardResult('self', true);
    showBoardResult('opp', false);
    
    // 방장(호스트)인 경우 게임 종료 시 대기방 DB 상태를 waiting으로 변경 (로비에서 대기중으로 리매치 가능하게)
    if (isHost && supabaseClient && activeRoomId) {
        supabaseClient.from('tr_rooms').update({ status: 'waiting' }).eq('id', activeRoomId).then();
    }
    
    // 다시 시작 버튼 노출 제어 (방장에게만 노출)
    const restartBtn = document.getElementById('overlay-btn-restart');
    if (restartBtn) {
        if (isHost) {
            restartBtn.innerHTML = `<i data-lucide="rotate-ccw"></i> 다시 시작`;
            restartBtn.onclick = restartCurrentGame;
            restartBtn.classList.remove('hidden');
        } else {
            restartBtn.classList.add('hidden'); // 게스트는 대기함
        }
        lucide.createIcons();
    }
    
    document.getElementById('game-overlay').classList.remove('hidden');
    
    // 랭킹 스코어 업데이트
    uploadHighScore('multi', gameStateSelf.score);
}

// 개별 보드 결과 오버레이 제어 (승리/패배 고양이 춤/눈물 연출)
function showBoardResult(player, isWin) {
    const overlay = document.getElementById(`board-result-${player}`);
    if (!overlay) return;
    
    const title = overlay.querySelector('.result-title');
    const cat = overlay.querySelector('.dancing-cat');
    const leftEye = overlay.querySelector('.eye.left');
    const rightEye = overlay.querySelector('.eye.right');
    
    overlay.classList.remove('hidden', 'win', 'lose');
    
    if (isWin) {
        overlay.classList.add('win');
        if (title) title.textContent = "WIN 👑";
        if (leftEye && rightEye) {
            leftEye.textContent = "^";
            rightEye.textContent = "^";
        }
        if (cat) {
            cat.classList.remove('sad', 'somersault');
        }
    } else {
        overlay.classList.add('lose');
        if (title) title.textContent = "LOSE ㅠ";
        if (leftEye && rightEye) {
            leftEye.textContent = "ㅠ";
            rightEye.textContent = "ㅠ";
        }
        if (cat) {
            cat.classList.remove('somersault');
            cat.classList.add('sad'); // 우는 고양이 CSS 애니메이션 적용
        }
    }
}

function hideBoardResults() {
    const selfOverlay = document.getElementById('board-result-self');
    const oppOverlay = document.getElementById('board-result-opp');
    if (selfOverlay) selfOverlay.classList.add('hidden');
    if (oppOverlay) oppOverlay.classList.add('hidden');
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
        nickname: currentUser ? (currentUser.nickname || currentUser.username) : '집사',
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

// 수동 어택 개시 (엔터키 또는 모바일 ATTACK 버튼 클릭)
function triggerManualAttack() {
    if (!isMultiplayMode || !isGameRunning || isGamePaused) return;
    if (gameStateSelf.attackGauge < 1) return;
    
    const linesToSend = gameStateSelf.attackGauge;
    sendGarbageToOpponent(linesToSend);
    
    gameStateSelf.attackGauge = 0;
    updateGarbageGauge('self', 0);
    syncGameStateToOpponent();
    
    // 공격 효과음
    playMeowSound();
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
function runGameStartCountdown(isNextStage = false) {
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
    }
    document.getElementById('game-overlay').classList.add('hidden'); // 카운트다운 시작 시 승패 오버레이 숨김
    document.getElementById('multiplay-controls').classList.add('hidden');
    const cd = document.getElementById('game-start-countdown');
    cd.classList.remove('hidden');
    
    let count = 3;
    cd.textContent = count;
    
    countdownIntervalId = setInterval(() => {
        count--;
        if (count > 0) {
            cd.textContent = count;
        } else {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
            cd.classList.add('hidden');
            
            if (isNextStage) {
                resumeGameAfterStageClear();
            } else {
                // 실 게임 시동!
                startGameExecution();
            }
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
    
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    dropCounter = 0;
    lastTime = performance.now();
    gameLoopId = requestAnimationFrame(gameLoop);
}

function resumeGameAfterStageClear() {
    if (!gameStateSelf.currentPiece) {
        gameStateSelf.currentPiece = getRandomPiece();
    }
    drawNextQueue();
    
    isGameRunning = true;
    startBGM();
    
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    dropCounter = 0;
    lastTime = performance.now();
    gameLoopId = requestAnimationFrame(gameLoop);
}

function restartCurrentGame() {
    document.getElementById('game-overlay').classList.add('hidden');
    
    // 고양이 애니메이션 및 눈 상태 복원 (게임 오버레이 기준)
    const cat = document.querySelector('#game-overlay .dancing-cat');
    if (cat) {
        cat.classList.remove('somersault', 'sad');
    }
    const leftEye = document.querySelector('#game-overlay .dancing-cat .eye.left');
    const rightEye = document.querySelector('#game-overlay .dancing-cat .eye.right');
    if (leftEye && rightEye) {
        leftEye.textContent = "^";
        rightEye.textContent = "^";
    }
    
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
    
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }
    document.getElementById('game-start-countdown').classList.add('hidden');
    
    document.getElementById('game-overlay').classList.add('hidden');
    
    // 멀티플레이 채팅창 숨김
    const chatContainer = document.getElementById('battle-chat-container');
    if (chatContainer) {
        chatContainer.classList.add('hidden');
    }
    
    // 시작 버튼 숨김
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
        startBtn.classList.add('hidden');
    }
    
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

// --- 14. 멀티플레이어 배틀 실시간 채팅 함수 ---
function sendBattleChatMessage(e) {
    if (e) e.preventDefault();
    if (!gameRealtimeChannel) return;
    
    const input = document.getElementById('battle-chat-input');
    const text = input.value.trim();
    if (!text) return;
    
    // 내 메시지를 화면에 출력
    appendChatMessage(currentUser.nickname || currentUser.username, text, true);
    
    // 상대에게 브로드캐스트 전송
    gameRealtimeChannel.send({
        type: 'broadcast',
        event: 'chat-message',
        payload: {
            sender: currentUser.nickname || currentUser.username,
            text: text
        }
    });
    
    input.value = '';
}

function appendChatMessage(sender, text, isSelf, isSystem = false) {
    const log = document.getElementById('battle-chat-messages');
    if (!log) return;
    
    const msgDiv = document.createElement('div');
    if (isSystem) {
        msgDiv.className = 'chat-msg chat-system';
    } else {
        msgDiv.className = isSelf ? 'chat-msg self' : 'chat-msg opp';
    }
    
    if (!isSystem) {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'chat-sender';
        nameSpan.textContent = `${sender}: `;
        msgDiv.appendChild(nameSpan);
    }
    
    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    textSpan.textContent = text;
    
    msgDiv.appendChild(textSpan);
    log.appendChild(msgDiv);
    
    // 항상 최하단 스크롤
    log.scrollTop = log.scrollHeight;
}
