// ============================================================
// UNO MENTIROSO
//
// SETUP (one-time):
//   1. Go to https://console.firebase.google.com
//   2. Create a new project (any name, e.g. "unomentiroso")
//   3. Add a Web App (+) → copy the firebaseConfig object
//   4. Paste the values below
//   5. In the project console:
//      - Firestore Database → Create database → Start in test mode
//      - Authentication → Get started → Anonymous → Enable
// ============================================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDD88huoZNmnG8HKPb0aYYFUl5L_-tjVzQ",
  authDomain:        "unomentiroso-b5742.firebaseapp.com",
  projectId:         "unomentiroso-b5742",
  storageBucket:     "unomentiroso-b5742.firebasestorage.app",
  messagingSenderId: "771588309649",
  appId:             "1:771588309649:web:f2e1f4450a2975f1d7f530"
};

// ============================================================
// CONSTANTS
// ============================================================

const COLORS  = ['red', 'yellow', 'green', 'blue'];
const NUMBERS = ['0','1','2','3','4','5','6','7','8','9'];
const ACTIONS = ['skip','reverse','draw2'];
const WILDS   = ['wild','wild4'];
const ALL_VALUES = [...NUMBERS, ...ACTIONS, ...WILDS];

const VALUE_LABEL = {
  '0':'0','1':'1','2':'2','3':'3','4':'4',
  '5':'5','6':'6','7':'7','8':'8','9':'9',
  skip:'⊘', reverse:'↺', draw2:'+2', wild:'C', wild4:'+4'
};
const COLOR_NAME = { red:'Rojo', yellow:'Amarillo', green:'Verde', blue:'Azul', black:'Comodín' };

function wildCenterHTML(value) {
  const label = value === 'wild4' ? '+4' : '';
  return `<span class="wild-quad">\
<span class="wq r"></span><span class="wq b"></span>\
<span class="wq y"></span><span class="wq g"></span>\
</span>${label ? `<span class="wild-extra-label">${label}</span>` : ''}`;
}

// ============================================================
// DECK
// ============================================================

function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    // 0: one normal copy, one liar copy
    deck.push({ color, value: '0', liar: false });
    deck.push({ color, value: '0', liar: true });
    // 1–9: one normal copy, one liar copy each
    for (const v of ['1','2','3','4','5','6','7','8','9']) {
      deck.push({ color, value: v, liar: false });
      deck.push({ color, value: v, liar: true });
    }
    // Action cards: all liar cards
    for (const a of ACTIONS) {
      deck.push({ color, value: a, liar: true });
      deck.push({ color, value: a, liar: true });
    }
  }
  // Wild = normal (played face-up, pick a color); wild4 = liar card
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'black', value: 'wild',  liar: false });
    deck.push({ color: 'black', value: 'wild4', liar: true });
  }
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// FIREBASE INIT
// ============================================================

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();

let localUid  = null;
let localName = null;
let currentRoomId = null;
let roomUnsub     = null;
let roomState     = null;

// Ephemeral play state (never stored in Firestore)
let selectedCardIdx = null;
let selectedActualCard = null;
let claimColor = null;
let claimValue = null;
let unoAlertTimeout = null;
let currentUnoCallRequired = null;
let unoCallClearPending = false;
let sevenSwapMode = null; // 'normal' | 'liar' | null
let drawnCardState = null; // { cardIdx, canPlay } — set after drawing, cleared when turn ends

function isLiarCard(card) {
  return card && card.liar === true;
}

function isActualPlayable(card, state) {
  if (!state || !card) return false;
  if (card.value === 'wild') return true;
  return card.color === state.topColor || card.value === state.topValue;
}

// ============================================================
// INIT — sign in anonymously, restore session
// ============================================================

async function init() {
  try {
    await auth.signInAnonymously();
    localUid = auth.currentUser.uid;
  } catch (e) {
    console.error('Auth failed:', e);
  }

  const savedRoom = sessionStorage.getItem('roomId');
  const savedName = sessionStorage.getItem('playerName');
  if (savedRoom && savedName && localUid) {
    localName = savedName;
    await tryRejoin(savedRoom);
  }
}

init();

// ============================================================
// HELPERS
// ============================================================

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const LOG_COLOR_HEX = { red:'#C81515', yellow:'#D4A800', green:'#189A20', blue:'#1040B8' };
const LOG_WILD_COLORS = ['#C81515','#D4A800','#189A20','#1040B8'];
const LOG_VALUE_PAT = '[0-9⊘↺C]|\\+[24]';

function colorizeLog(msg) {
  let s = esc(msg);
  s = s.replace(new RegExp(`Comodín(?:\\s+(${LOG_VALUE_PAT}))?`, 'g'), (_, val) => {
    const rain = 'Comodín'.split('').map((ch, i) =>
      `<span style="color:${LOG_WILD_COLORS[i % 4]};font-weight:700">${ch}</span>`
    ).join('');
    return val ? rain + `<b> ${val}</b>` : rain;
  });
  s = s.replace(new RegExp(`(Rojo|Amarillo|Verde|Azul)(?:\\s+(${LOG_VALUE_PAT}))?`, 'g'), (_, name, val) => {
    const key = Object.entries(COLOR_NAME).find(([, v]) => v === name)?.[0];
    const hex = LOG_COLOR_HEX[key] || '#fff';
    return `<span class="log-color-${key}" style="color:${hex};font-weight:700">${name}${val ? ' '+val : ''}</span>`;
  });
  return s;
}

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function addLog(log, msg) {
  if (!msg) return log || [];
  return [...(log || []), msg].slice(-20);
}

function isMyTurn(state) {
  if (!state?.players?.length) return false;
  return state.players[state.currentPlayerIndex]?.id === localUid;
}

function nextPlayerIndex(state) {
  const n = state.players.length;
  return ((state.currentPlayerIndex + state.direction) % n + n) % n;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function showLandingError(msg) {
  const el = document.getElementById('landing-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

// ============================================================
// LANDING
// ============================================================

function showJoin() {
  document.getElementById('join-form').classList.toggle('hidden');
}

async function handleCreate() {
  const name = document.getElementById('player-name').value.trim();
  if (!name) { showLandingError('Escribe tu nombre primero'); return; }
  if (!localUid) { showLandingError('Aún conectando… intenta de nuevo'); return; }
  localName = name;

  const roomId = genRoomCode();
  await db.collection('rooms').doc(roomId).set({
    status: 'lobby',
    hostId: localUid,
    players: [{ id: localUid, name, cardCount: 0 }],
    currentPlayerIndex: 0,
    direction: 1,
    topColor: null,
    topValue: null,
    prevTopColor: null,
    prevTopValue: null,
    lastPlayerId: null,
    lastActualCard: null,
    lastClaimedCard: null,
    challengeOpen: false,
    hands: {},
    drawPile: [],
    log: [],
    winner: null,
    winnerName: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });

  currentRoomId = roomId;
  sessionStorage.setItem('roomId', roomId);
  sessionStorage.setItem('playerName', name);
  subscribeToRoom(roomId);
  showScreen('lobby');
}

async function handleJoin() {
  const name = document.getElementById('player-name').value.trim();
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!name) { showLandingError('Escribe tu nombre primero'); return; }
  if (code.length !== 6) { showLandingError('Introduce el código de sala de 6 caracteres'); return; }
  if (!localUid) { showLandingError('Aún conectando… intenta de nuevo'); return; }

  const snap = await db.collection('rooms').doc(code).get();
  if (!snap.exists) { showLandingError('Sala no encontrada'); return; }
  const data = snap.data();
  if (data.status !== 'lobby') { showLandingError('La partida ya comenzó'); return; }
  if (data.players.length >= 10) { showLandingError('Sala llena (máximo 10)'); return; }

  if (!data.players.find(p => p.id === localUid)) {
    await db.collection('rooms').doc(code).update({
      players: firebase.firestore.FieldValue.arrayUnion({ id: localUid, name, cardCount: 0 })
    });
  }

  localName = name;
  currentRoomId = code;
  sessionStorage.setItem('roomId', code);
  sessionStorage.setItem('playerName', name);
  subscribeToRoom(code);
  showScreen('lobby');
}

async function tryRejoin(roomId) {
  try {
    const snap = await db.collection('rooms').doc(roomId).get();
    if (!snap.exists) { sessionStorage.clear(); return; }
    const data = snap.data();
    if (!data.players.find(p => p.id === localUid)) { sessionStorage.clear(); return; }
    currentRoomId = roomId;
    subscribeToRoom(roomId);
    if (data.status === 'lobby') showScreen('lobby');
    else if (data.status === 'playing') showScreen('game');
    else if (data.status === 'ended') showScreen('winner');
  } catch (_) { sessionStorage.clear(); }
}

function copyCode() {
  navigator.clipboard.writeText(currentRoomId).catch(() => {});
  const btn = document.querySelector('.btn-copy');
  btn.textContent = '¡Copiado!';
  setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
}

// ============================================================
// ROOM SUBSCRIPTION
// ============================================================

function subscribeToRoom(roomId) {
  if (roomUnsub) roomUnsub();
  roomUnsub = db.collection('rooms').doc(roomId).onSnapshot(snap => {
    if (!snap.exists) return;
    roomState = snap.data();
    onRoomUpdate(roomState);
  });
}

function onRoomUpdate(state) {
  if (state.status === 'lobby') {
    showScreen('lobby');
    renderLobby(state);
  } else if (state.status === 'playing') {
    showScreen('game');
    renderGame(state);
  } else if (state.status === 'ended') {
    showScreen('winner');
    document.getElementById('winner-name').textContent = state.winnerName || '?';
  }
}

// ============================================================
// LOBBY RENDER
// ============================================================

function renderLobby(state) {
  document.getElementById('lobby-code').textContent = currentRoomId;

  document.getElementById('player-list').innerHTML = state.players.map(p =>
    `<div class="player-item ${p.id === localUid ? 'me' : ''}">
      ${p.id === state.hostId ? '👑 ' : ''}${esc(p.name)}
    </div>`
  ).join('');

  const isHost = state.hostId === localUid;
  const canStart = state.players.length >= 2;
  const startBtn = document.getElementById('start-btn');
  const waitMsg  = document.getElementById('waiting-msg');

  startBtn.classList.toggle('hidden', !isHost);
  waitMsg.classList.toggle('hidden', isHost);

  if (isHost) {
    startBtn.disabled = !canStart;
    startBtn.textContent = canStart ? 'Iniciar partida' : 'Esperando jugadores…';
  }
}

// ============================================================
// START GAME — host deals cards
// ============================================================

async function handleStart() {
  if (!roomState || roomState.players.length < 2) return;

  const deck   = shuffle(createDeck());
  const players = roomState.players;
  const hands  = {};
  let idx = 0;

  for (const p of players) {
    hands[p.id] = deck.slice(idx, idx + 7);
    idx += 7;
  }

  // First card must not be a Wild
  let startCard = deck[idx++];
  while (WILDS.includes(startCard.value)) startCard = deck[idx++];

  const playersWithCounts = players.map(p => ({ ...p, cardCount: 7 }));

  await db.collection('rooms').doc(currentRoomId).update({
    status: 'playing',
    players: playersWithCounts,
    currentPlayerIndex: 0,
    direction: 1,
    topColor: startCard.color,
    topValue: startCard.value,
    prevTopColor: startCard.color,
    prevTopValue: startCard.value,
    lastPlayerId: null,
    lastActualCard: null,
    lastClaimedCard: null,
    challengeOpen: false,
    hands,
    drawPile: deck.slice(idx),
    log: [`¡Partida iniciada! ${esc(players[0].name)} va primero.`],
    winner: null,
    winnerName: null,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ============================================================
// GAME RENDER
// ============================================================

function renderGame(state) {
  if (!isMyTurn(state)) drawnCardState = null;
  renderTopCard(state);
  renderOpponents(state);
  renderStatus(state);
  renderUnoAlert(state);
  renderChallengeArea(state);
  renderHand(state);
  renderLog(state);
  renderUnoCallOverlay(state);
  renderSevenSwapOverlay(state);
  renderTurnActions(state);

  const myTurn = isMyTurn(state) && !state.challengeOpen;
  const canDraw = myTurn && drawnCardState === null;
  document.getElementById('draw-pile-area').style.opacity = canDraw ? '1' : '0.5';
}

function renderTurnActions(state) {
  const myTurn = isMyTurn(state) && !state.challengeOpen;
  const passBtn = document.getElementById('pass-btn');
  passBtn.classList.toggle('hidden', !myTurn);
  if (myTurn) passBtn.disabled = drawnCardState === null;
}

function renderUnoAlert(state) {
  const alertEl = document.getElementById('uno-alert');

  if (state?.unoAlert) {
    alertEl.classList.remove('hidden');
    alertEl.innerHTML = `<span>${esc(state.unoAlert)}</span>`;

    if (!unoAlertTimeout) {
      unoAlertTimeout = setTimeout(async () => {
        unoAlertTimeout = null;
        if (!roomState || !roomState.unoAlert) return;
        await db.collection('rooms').doc(currentRoomId).update({
          unoAlert: firebase.firestore.FieldValue.delete()
        });
      }, 3000);
    }
  } else {
    alertEl.classList.add('hidden');
    alertEl.textContent = '';
    if (unoAlertTimeout) {
      clearTimeout(unoAlertTimeout);
      unoAlertTimeout = null;
    }
  }
}

function renderUnoCallOverlay(state) {
  const overlay = document.getElementById('uno-call-overlay');
  const req = state.unoCallRequired;

  if (!req || state.challengeOpen) {
    overlay.classList.add('hidden');
    currentUnoCallRequired = null;
    return;
  }

  const reqPlayer = state.players.find(p => p.id === req.playerId);
  if (!reqPlayer || reqPlayer.cardCount !== 1) {
    overlay.classList.add('hidden');
    currentUnoCallRequired = null;
    if (!unoCallClearPending) {
      unoCallClearPending = true;
      db.collection('rooms').doc(currentRoomId).update({
        unoCallRequired: firebase.firestore.FieldValue.delete()
      }).catch(() => {}).then(() => { unoCallClearPending = false; });
    }
    return;
  }

  currentUnoCallRequired = req;
  const label = document.getElementById('uno-call-label');
  const btn   = document.getElementById('uno-call-btn');

  if (req.playerId === localUid) {
    label.textContent = '¡Solo te queda 1 carta!';
    btn.textContent   = '¡GRITA UNO!';
  } else {
    label.textContent = `¡${req.playerName} tiene 1 carta!`;
    btn.textContent   = `GRITARLE UNO A ${req.playerName.toUpperCase()}`;
  }

  overlay.classList.remove('hidden');
}

async function handleUnoCallBtn() {
  const req = currentUnoCallRequired;
  if (!req || !roomState) return;

  document.getElementById('uno-call-overlay').classList.add('hidden');
  currentUnoCallRequired = null;

  if (req.playerId === localUid) {
    const log = addLog(roomState.log, `${localName} grita ¡UNO! 🎴`);
    await db.collection('rooms').doc(currentRoomId).update({
      unoCallRequired: firebase.firestore.FieldValue.delete(),
      log,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    const state = roomState;
    let { hands, players, drawPile } = state;
    const { drawn, newDrawPile } = takeCards(drawPile, 2);
    hands   = { ...hands, [req.playerId]: [...(hands[req.playerId] || []), ...drawn] };
    players = players.map(p =>
      p.id === req.playerId ? { ...p, cardCount: hands[p.id].length } : p
    );
    const log = addLog(state.log,
      `🚨 ${localName} le gritó UNO a ${req.playerName}. ${req.playerName} roba 2 cartas.`
    );
    await db.collection('rooms').doc(currentRoomId).update({
      hands,
      players,
      drawPile: newDrawPile,
      unoCallRequired: firebase.firestore.FieldValue.delete(),
      log,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

function renderTopCard(state) {
  const el = document.getElementById('top-card');
  el.className = 'card ' + (state.topColor || 'red');
  const lbl = VALUE_LABEL[state.topValue] || '?';
  const isWild = WILDS.includes(state.topValue);
  el.innerHTML = isWild
    ? `<span class="card-label tl">${lbl}</span>${wildCenterHTML(state.topValue)}<span class="card-label br">${lbl}</span>`
    : `<span class="card-label tl">${lbl}</span><span class="card-label center">${lbl}</span><span class="card-label br">${lbl}</span>`;
}

function renderOpponents(state) {
  const row = document.getElementById('opponents-row');
  const others = state.players.filter(p => p.id !== localUid);

  row.innerHTML = others.map(p => {
    const isCurrent = state.players[state.currentPlayerIndex]?.id === p.id;
    const nextIdx = nextPlayerIndex(state);
    const isNext = state.players[nextIdx]?.id === p.id;
    const miniCards = Array(Math.min(p.cardCount, 12)).fill(0)
      .map(() => `<div class="card-back mini"></div>`).join('');
    return `<div class="opponent ${isCurrent && !state.challengeOpen ? 'active-player' : ''}
                                  ${isNext && state.challengeOpen ? 'active-player' : ''}">
      <div class="opponent-name">${esc(p.name)}</div>
      <div class="opponent-cards">${miniCards}</div>
      <div class="opponent-count">${p.cardCount}🃏</div>
    </div>`;
  }).join('');
}

function renderStatus(state) {
  const el = document.getElementById('game-status');
  const current = state.players[state.currentPlayerIndex];

  const myTurn = isMyTurn(state);
  el.classList.toggle('my-turn', myTurn && !state.challengeOpen);

  if (state.challengeOpen && state.lastClaimedCard) {
    const lp = state.players.find(p => p.id === state.lastPlayerId);
    const c  = state.lastClaimedCard;
    el.textContent = `${lp?.name || '?'} jugó — dice ${COLOR_NAME[c.color]} ${VALUE_LABEL[c.value]}`;
  } else if (myTurn) {
    el.textContent = '✨ ¡Tu turno! Elige una carta.';
  } else {
    el.textContent = `Turno de ${current?.name || '?'}`;
  }
}

function renderChallengeArea(state) {
  const area = document.getElementById('challenge-area');
  const txt  = document.getElementById('challenge-text');

  const nextIdx = nextPlayerIndex(state);
  const isNextPlayer = state.players[nextIdx]?.id === localUid;
  const showChallenge = state.challengeOpen &&
    state.lastPlayerId !== localUid &&
    isNextPlayer;

  area.classList.toggle('hidden', !showChallenge);

  if (showChallenge && state.lastClaimedCard) {
    const c  = state.lastClaimedCard;
    const lp = state.players.find(p => p.id === state.lastPlayerId);
    txt.textContent =
      `${lp?.name || '?'} dice que jugó ${COLOR_NAME[c.color]} ${VALUE_LABEL[c.value]}. ¿Lo crees?`;
  }
}

function renderHand(state) {
  const handEl = document.getElementById('player-hand');
  const myHand = state.hands?.[localUid] || [];
  const myTurn = isMyTurn(state) && !state.challengeOpen;
  const inDrawMode = myTurn && drawnCardState !== null;

  handEl.innerHTML = myHand.map((card, i) => {
    let isPlayable, onclick, extraClass = '';
    if (inDrawMode) {
      const isDrawn = i === drawnCardState.cardIdx;
      isPlayable = isDrawn && drawnCardState.canPlay;
      onclick = isPlayable ? `selectCard(${i})` : '';
      if (isDrawn) extraClass = ' drawn-fresh';
    } else {
      isPlayable = myTurn;
      onclick = myTurn ? `selectCard(${i})` : '';
    }
    const lbl = VALUE_LABEL[card.value];
    const isWild = WILDS.includes(card.value);
    const centerHTML = isWild ? wildCenterHTML(card.value) : `<span class="card-label center">${lbl}</span>`;
    return `<div class="card ${card.color} ${isLiarCard(card) ? 'liar' : ''}${isPlayable ? ' playable' : ''}${extraClass}"
      data-index="${i}"
      onclick="${onclick}"
    >
      <span class="card-label tl">${lbl}</span>
      ${centerHTML}
      <span class="card-label br">${lbl}</span>
    </div>`;
  }).join('');

  if (inDrawMode) {
    document.getElementById('hand-label').textContent = drawnCardState.canPlay
      ? '¡Carta robada jugable! Juégala o pasa.'
      : 'Carta robada no es jugable. Pasa el turno.';
  } else {
    document.getElementById('hand-label').textContent =
      myTurn ? 'Tu turno — haz clic en una carta para jugar' : `Tu mano (${myHand.length})`;
  }

  document.getElementById('uno-btn').classList.add('hidden');
}

function renderLog(state) {
  const el = document.getElementById('game-log');
  el.innerHTML = [...(state.log || [])].reverse()
    .map(msg => {
      const cls = msg.includes('¡Descubierto!') ? ' log-lie'
                : msg.includes('dijo la verdad') ? ' log-truth'
                : '';
      return `<div class="log-entry${cls}">${colorizeLog(msg)}</div>`;
    })
    .join('');
  el.scrollTop = 0;
}

// ============================================================
// CARD SELECTION — opens claim dialog
// ============================================================

async function selectCard(index) {
  if (!roomState) return;
  const myHand = roomState.hands?.[localUid] || [];
  const card = myHand[index];
  if (!card) return;

  if (drawnCardState !== null && (index !== drawnCardState.cardIdx || !drawnCardState.canPlay)) return;

  if (card.value !== 'wild' && !isLiarCard(card) && !isActualPlayable(card, roomState)) {
    alert('No puedes jugar esta carta boca arriba. Elige otra o roba.');
    return;
  }

  selectedCardIdx = index;
  selectedActualCard = card;
  claimColor = card.color === 'black' ? roomState.topColor || 'red' : card.color;
  claimValue = card.value;

  const preview = document.getElementById('actual-card-preview');
  const _lbl = VALUE_LABEL[card.value];
  const _isWild = WILDS.includes(card.value);
  const _centerHTML = _isWild ? wildCenterHTML(card.value) : `<span class="card-label center" style="font-size:1.2rem">${_lbl}</span>`;
  preview.innerHTML = `<div class="card ${card.color} ${isLiarCard(card) ? 'liar' : ''}" style="width:50px;height:75px;margin:0 auto">
    <span class="card-label tl">${_lbl}</span>
    ${_centerHTML}
    <span class="card-label br">${_lbl}</span>
  </div>`;

  if (card.value === 'wild' || isLiarCard(card)) {
    renderClaimPicker();
    document.getElementById('claim-dialog').classList.remove('hidden');
  } else if (card.value === '7') {
    document.getElementById('claim-dialog').classList.add('hidden');
    showSevenSwapDialog('normal');
  } else {
    document.getElementById('claim-dialog').classList.add('hidden');
    await playNormalCard(card, index);
    selectedCardIdx = null;
    selectedActualCard = null;
  }
}

function renderClaimPicker() {
  document.getElementById('claim-color-picker').innerHTML = COLORS.map(c =>
    `<button class="color-btn ${c} ${claimColor === c ? 'selected' : ''}"
      onclick="setClaimColor('${c}')" title="${COLOR_NAME[c]}"></button>`
  ).join('');

  const values = selectedActualCard?.value === 'wild' ? ['wild'] : ALL_VALUES;
  document.getElementById('claim-value-picker').innerHTML = values.map(v => {
    const disabled = selectedActualCard?.value === 'wild' && v !== 'wild';
    return `<button class="value-btn ${claimValue === v ? 'selected' : ''}${disabled ? ' disabled' : ''}"
      onclick="setClaimValue('${v}')"${disabled ? ' disabled' : ''}>${VALUE_LABEL[v]}</button>`;
  }).join('');
}

function setClaimColor(color) { claimColor = color; renderClaimPicker(); }
function setClaimValue(value) {
  if (selectedActualCard?.value === 'wild' && value !== 'wild') return;
  if (selectedActualCard && !isLiarCard(selectedActualCard) && selectedActualCard.value !== 'wild') return;
  claimValue = value;
  if (WILDS.includes(value) && claimColor === null) claimColor = 'red';
  renderClaimPicker();
}

function cancelPlay() {
  selectedCardIdx = null;
  selectedActualCard = null;
  document.getElementById('claim-dialog').classList.add('hidden');
}

async function confirmPlay() {
  if (selectedCardIdx === null || !claimColor || !claimValue) return;
  const myHand = roomState?.hands?.[localUid] || [];
  const actualCard = myHand[selectedCardIdx];
  if (!actualCard) return;

  if (actualCard.value === 'wild' || isLiarCard(actualCard)) {
    const isWild = WILDS.includes(claimValue);
    const claimedCard = { color: isWild ? claimColor : claimColor, value: claimValue };

    if (!isClaimPlayable(claimedCard, roomState)) {
      alert(
        `¡Ese anuncio no es válido!\n\n` +
        `Carta superior: ${COLOR_NAME[roomState.topColor]} ${VALUE_LABEL[roomState.topValue]}\n\n` +
        `Tu carta debe coincidir por color o valor, o ser un Comodín.`
      );
      return;
    }

    document.getElementById('claim-dialog').classList.add('hidden');
    await doPlayCard(actualCard, claimedCard, selectedCardIdx);
  } else {
    document.getElementById('claim-dialog').classList.add('hidden');
    await playNormalCard(actualCard, selectedCardIdx, claimColor);
  }

  selectedCardIdx = null;
  selectedActualCard = null;
}

function passHands(hands, players, direction) {
  const newHands = {};
  const order = players.map(p => p.id);
  const n = order.length;
  for (let i = 0; i < n; i++) {
    const fromId = order[i];
    const toId = order[((i + direction) % n + n) % n];
    newHands[toId] = hands[fromId];
  }
  return newHands;
}

// ============================================================
// SEVEN SWAP
// ============================================================

function showSevenSwapDialog(mode) {
  sevenSwapMode = mode;
  const state = roomState;
  const others = state.players.filter(p => p.id !== localUid);
  document.getElementById('seven-swap-player-list').innerHTML = others.map(p =>
    `<button class="btn btn-secondary" style="width:100%;padding:.6rem"
      onclick="pickSevenSwapTarget('${p.id}')">
      ${esc(p.name)} (${p.cardCount} cartas)
    </button>`
  ).join('');
  document.getElementById('seven-swap-cancel-row').classList.toggle('hidden', mode === 'liar');
  document.getElementById('seven-swap-dialog').classList.remove('hidden');
}

function cancelSevenSwap() {
  document.getElementById('seven-swap-dialog').classList.add('hidden');
  sevenSwapMode = null;
  selectedCardIdx = null;
  selectedActualCard = null;
}

async function pickSevenSwapTarget(targetId) {
  const mode = sevenSwapMode;
  sevenSwapMode = null;
  document.getElementById('seven-swap-dialog').classList.add('hidden');
  if (mode === 'normal') {
    await playNormalCardWithSwap(selectedActualCard, selectedCardIdx, targetId);
    selectedCardIdx = null;
    selectedActualCard = null;
  } else {
    await executeSevenSwap(targetId);
  }
}

async function playNormalCardWithSwap(actualCard, cardIndex, targetId) {
  const state = roomState;
  const myHand = [...(state.hands?.[localUid] || [])];
  const handAfterPlay = myHand.filter((_, i) => i !== cardIndex);
  const won = handAfterPlay.length === 0;

  let log = addLog(state.log,
    `${localName} jugó ${COLOR_NAME[actualCard.color]} ${VALUE_LABEL[actualCard.value]} boca arriba.`
  );

  const newHands = { ...state.hands, [localUid]: handAfterPlay };
  let players = state.players.map(p =>
    p.id === localUid ? { ...p, cardCount: handAfterPlay.length } : p
  );

  if (!won) {
    const targetName = state.players.find(p => p.id === targetId)?.name || '?';
    newHands[localUid] = newHands[targetId] || [];
    newHands[targetId] = handAfterPlay;
    players = players.map(p => ({ ...p, cardCount: (newHands[p.id] || []).length }));
    log = addLog(log, `${localName} intercambió manos con ${targetName}.`);
  }

  const myFinalHand = newHands[localUid];
  const update = {
    players,
    hands: newHands,
    topColor: actualCard.color,
    topValue: actualCard.value,
    currentPlayerIndex: nextPlayerIndex(state),
    challengeOpen: false,
    lastActualCard: null,
    lastClaimedCard: null,
    sevenSwapPending: firebase.firestore.FieldValue.delete(),
    log,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  };

  update.unoCallRequired = (!won && myFinalHand.length === 1)
    ? { playerId: localUid, playerName: localName }
    : firebase.firestore.FieldValue.delete();

  if (won) {
    update.status = 'ended';
    update.winner = localUid;
    update.winnerName = localName;
  }

  await db.collection('rooms').doc(currentRoomId).update(update);
}

async function executeSevenSwap(targetId) {
  const state = roomState;
  const pending = state.sevenSwapPending;
  if (!pending || pending.chooserId !== localUid) return;

  let { hands, players } = state;
  const targetName = players.find(p => p.id === targetId)?.name || '?';
  const chooserHand = hands[localUid] || [];
  const targetHand  = hands[targetId]  || [];

  hands   = { ...hands, [localUid]: targetHand, [targetId]: chooserHand };
  players = players.map(p => ({ ...p, cardCount: (hands[p.id] || []).length }));

  const log = addLog(state.log, `${localName} intercambió manos con ${targetName}.`);

  await db.collection('rooms').doc(currentRoomId).update({
    hands,
    players,
    currentPlayerIndex: pending.nextPlayerIndex,
    sevenSwapPending: firebase.firestore.FieldValue.delete(),
    log,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function renderSevenSwapOverlay(state) {
  const pending = state.sevenSwapPending;
  if (!pending || pending.chooserId !== localUid) {
    if (sevenSwapMode === 'liar') {
      document.getElementById('seven-swap-dialog').classList.add('hidden');
      sevenSwapMode = null;
    }
    return;
  }
  if (sevenSwapMode !== 'liar') {
    showSevenSwapDialog('liar');
  }
}

async function playNormalCard(actualCard, cardIndex, chosenColor = null) {
  const state = roomState;
  const myHand = [...(state.hands?.[localUid] || [])];
  const newHand = myHand.filter((_, i) => i !== cardIndex);
  const won = newHand.length === 0;

  let topColor = actualCard.color;
  let topValue = actualCard.value;
  let log = addLog(state.log,
    `${localName} jugó ${COLOR_NAME[actualCard.color]} ${VALUE_LABEL[actualCard.value]} boca arriba.`
  );

  const newHands = { ...state.hands, [localUid]: newHand };
  let players = state.players.map(p =>
    p.id === localUid ? { ...p, cardCount: newHand.length } : p
  );

  if (actualCard.value === 'wild') {
    topColor = chosenColor || 'red';
    log = addLog(log, `${localName} eligió el color ${COLOR_NAME[topColor]}.`);
  }

  if (actualCard.value === '0') {
    const passedHands = passHands(newHands, state.players, state.direction);
    Object.assign(newHands, passedHands);
    players = players.map(p => ({ ...p, cardCount: (newHands[p.id] || []).length }));
    log = addLog(log, 'Todos pasan su mano en la dirección actual.');
  }

  const update = {
    players,
    hands: newHands,
    topColor,
    topValue,
    currentPlayerIndex: nextPlayerIndex(state),
    challengeOpen: false,
    lastActualCard: null,
    lastClaimedCard: null,
    log,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  };

  update.unoCallRequired = (newHand.length === 1 && !won)
    ? { playerId: localUid, playerName: localName }
    : firebase.firestore.FieldValue.delete();

  if (won) {
    update.status = 'ended';
    update.winner = localUid;
    update.winnerName = localName;
  }

  await db.collection('rooms').doc(currentRoomId).update(update);
}

function isClaimPlayable(claimed, state) {
  if (WILDS.includes(claimed.value)) return true;
  return claimed.color === state.topColor || claimed.value === state.topValue;
}

// ============================================================
// PLAY CARD
// ============================================================

async function doPlayCard(actualCard, claimedCard, cardIndex) {
  const state = roomState;
  const myHand  = [...(state.hands?.[localUid] || [])];
  const newHand = myHand.filter((_, i) => i !== cardIndex);
  const won     = newHand.length === 0;

  const newHands = { ...state.hands, [localUid]: newHand };
  const players  = state.players.map(p =>
    p.id === localUid ? { ...p, cardCount: newHand.length } : p
  );

  const log = addLog(state.log,
    `${localName} jugó una carta boca abajo y dijo ${COLOR_NAME[claimedCard.color]} ${VALUE_LABEL[claimedCard.value]}.`
  );

  const update = {
    players,
    hands: newHands,
    lastPlayerId: localUid,
    lastActualCard: actualCard,
    lastClaimedCard: claimedCard,
    prevTopColor: state.topColor,
    prevTopValue: state.topValue,
    challengeOpen: !won,
    unoCallRequired: (newHand.length === 1 && !won)
      ? { playerId: localUid, playerName: localName }
      : firebase.firestore.FieldValue.delete(),
    log,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (won) {
    update.status = 'ended';
    update.winner = localUid;
    update.winnerName = localName;
    update.topColor = claimedCard.color;
    update.topValue = claimedCard.value;
  }

  await db.collection('rooms').doc(currentRoomId).update(update);
}

// ============================================================
// CHALLENGE
// ============================================================

async function handleChallenge() {
  const state = roomState;
  if (!state?.challengeOpen || !state.lastActualCard || !state.lastClaimedCard) return;

  const actual  = state.lastActualCard;
  const claimed = state.lastClaimedCard;
  const liar    = state.players.find(p => p.id === state.lastPlayerId);
  const isLie   = actual.color !== claimed.color || actual.value !== claimed.value;

  let { hands, players, drawPile } = state;
  let log = state.log;

  if (isLie) {
    // El mentiroso roba 1 carta, la jugada se cancela y pasa el turno
    const { drawn, newDrawPile } = takeCards(drawPile, 1);
    hands = { ...hands, [state.lastPlayerId]: [...(hands[state.lastPlayerId] || []), ...drawn] };
    players = players.map(p =>
      p.id === state.lastPlayerId ? { ...p, cardCount: hands[p.id].length } : p
    );
    log = addLog(log,
      `🚨 ¡Descubierto! ${liar?.name} mintió (era ${COLOR_NAME[actual.color]} ${VALUE_LABEL[actual.value]}). Robó ${drawn.length}.`
    );

    await db.collection('rooms').doc(currentRoomId).update({
      hands,
      players,
      drawPile: newDrawPile,
      topColor: state.prevTopColor,
      topValue: state.prevTopValue,
      challengeOpen: false,
      lastActualCard: null,
      lastClaimedCard: null,
      currentPlayerIndex: nextPlayerIndex(state),
      log,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    });

  } else {
    // Honesto: el desafiante roba 1 carta y se aplica el efecto
    const { drawn, newDrawPile } = takeCards(drawPile, 1);
    hands = { ...hands, [localUid]: [...(hands[localUid] || []), ...drawn] };
    players = players.map(p =>
      p.id === localUid ? { ...p, cardCount: hands[p.id].length } : p
    );
    log = addLog(log,
      `✓ ${liar?.name} dijo la verdad (${COLOR_NAME[actual.color]} ${VALUE_LABEL[actual.value]}). ${localName} roba ${drawn.length}.`
    );

    const advanced = applyEffectsAndAdvance({ ...state, hands, players, drawPile: newDrawPile });
    log = addLog(log, advanced.logExtra);

    await db.collection('rooms').doc(currentRoomId).update({
      ...advanced.changes,
      challengeOpen: false,
      lastActualCard: null,
      lastClaimedCard: null,
      log,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

// ============================================================
// BELIEVE
// ============================================================

async function handleBelieve() {
  const state = roomState;
  if (!state?.challengeOpen) return;

  const lp = state.players.find(p => p.id === state.lastPlayerId);
  const advanced = applyEffectsAndAdvance(state);
  const log = addLog(
    addLog(state.log, `${localName} confía en ${lp?.name}.`),
    advanced.logExtra
  );

  await db.collection('rooms').doc(currentRoomId).update({
    ...advanced.changes,
    challengeOpen: false,
    lastActualCard: null,
    lastClaimedCard: null,
    log,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ============================================================
// APPLY EFFECTS + ADVANCE TURN
// Resolves the claimed card's effect and returns the new state.
// `state.currentPlayerIndex` = the player who just played.
// ============================================================

function applyEffectsAndAdvance(state) {
  const claimed = state.lastClaimedCard;
  let { players, hands, drawPile, direction, currentPlayerIndex } = state;
  const n = players.length;

  let topColor = claimed.color;
  let topValue = claimed.value;
  let logExtra = '';

  const nextIdx = ((currentPlayerIndex + direction) % n + n) % n;
  let newIdx    = nextIdx;

  switch (claimed.value) {

    case '7': {
      const chooser = players[currentPlayerIndex];
      return {
        changes: {
          topColor, topValue, direction,
          currentPlayerIndex,
          players, hands, drawPile,
          sevenSwapPending: {
            chooserId: chooser.id,
            chooserName: chooser.name,
            nextPlayerIndex: nextIdx
          }
        },
        logExtra: `${chooser.name} elige con quién intercambiar manos.`
      };
    }

    case '0': {
      const passedHands = passHands(hands, players, direction);
      hands = { ...hands, ...passedHands };
      players = players.map(p => ({ ...p, cardCount: (hands[p.id] || []).length }));
      logExtra = 'Todos pasan su mano en la dirección actual.';
      newIdx = nextIdx;
      break;
    }

    case 'skip': {
      logExtra = `${players[nextIdx]?.name} pierde su turno.`;
      newIdx   = ((nextIdx + direction) % n + n) % n;
      break;
    }

    case 'reverse': {
      direction = -direction;
      if (n === 2) {
        // Con 2 jugadores, Reverse = Skip: el mismo jugador juega de nuevo
        logExtra = `${players[nextIdx]?.name} pierde su turno (reverse).`;
        newIdx   = currentPlayerIndex;
      } else {
        logExtra = '¡Dirección invertida!';
        newIdx   = ((currentPlayerIndex + direction) % n + n) % n;
      }
      break;
    }

    case 'draw2': {
      const tid = players[nextIdx].id;
      const { drawn, newDrawPile } = takeCards(drawPile, 2);
      drawPile = newDrawPile;
      hands    = { ...hands, [tid]: [...(hands[tid] || []), ...drawn] };
      players  = players.map(p => p.id === tid ? { ...p, cardCount: hands[p.id].length } : p);
      logExtra = `${players[nextIdx]?.name} roba 2 y pierde su turno.`;
      newIdx   = ((nextIdx + direction) % n + n) % n;
      break;
    }

    case 'wild4': {
      const tid = players[nextIdx].id;
      const { drawn, newDrawPile } = takeCards(drawPile, 4);
      drawPile = newDrawPile;
      hands    = { ...hands, [tid]: [...(hands[tid] || []), ...drawn] };
      players  = players.map(p => p.id === tid ? { ...p, cardCount: hands[p.id].length } : p);
      logExtra = `${players[nextIdx]?.name} roba 4 y pierde su turno.`;
      newIdx   = ((nextIdx + direction) % n + n) % n;
      break;
    }
  }

  return {
    changes: { topColor, topValue, direction, currentPlayerIndex: newIdx, players, hands, drawPile },
    logExtra
  };
}

// ============================================================
// DRAW CARD
// ============================================================

async function handleDraw() {
  const state = roomState;
  if (!isMyTurn(state) || state.challengeOpen) return;
  if (drawnCardState !== null) return;

  const { drawn, newDrawPile } = takeCards(state.drawPile, 1);
  const newHand  = [...(state.hands?.[localUid] || []), ...drawn];
  const newHands = { ...state.hands, [localUid]: newHand };
  const players  = state.players.map(p =>
    p.id === localUid ? { ...p, cardCount: newHand.length } : p
  );

  const drawnCard = newHand[newHand.length - 1];
  const canPlay = !!(drawnCard && (
    drawnCard.value === 'wild' ||
    isLiarCard(drawnCard) ||
    isActualPlayable(drawnCard, state)
  ));
  drawnCardState = { cardIdx: newHand.length - 1, canPlay };

  await db.collection('rooms').doc(currentRoomId).update({
    hands: newHands,
    drawPile: newDrawPile,
    players,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function handlePassTurn() {
  const state = roomState;
  if (!isMyTurn(state) || state.challengeOpen || drawnCardState === null) return;

  const hadDrawn = drawnCardState !== null;
  drawnCardState = null;

  const logMsg = hadDrawn
    ? `${localName} robó una carta y pasó.`
    : `${localName} pasó su turno.`;

  await db.collection('rooms').doc(currentRoomId).update({
    currentPlayerIndex: nextPlayerIndex(state),
    unoCallRequired: firebase.firestore.FieldValue.delete(),
    log: addLog(state.log, logMsg),
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ============================================================
// TAKE CARDS FROM DRAW PILE (reshuffle fresh deck if empty)
// ============================================================

function takeCards(drawPile, count) {
  let pile = [...(drawPile || [])];
  if (pile.length < count) pile = [...pile, ...shuffle(createDeck())];
  const drawn = pile.splice(0, count);
  return { drawn, newDrawPile: pile };
}

// ============================================================
// UNO CALL
// ============================================================

async function callUno() {
  if (currentUnoCallRequired) {
    await handleUnoCallBtn();
    return;
  }
  const state = roomState;
  if (!state) return;

  const myHand = state.hands?.[localUid] || [];
  const targets = state.players.filter(p => p.id !== localUid && p.cardCount === 1);

  if (myHand.length === 1) {
    const log = addLog(state.log, `${localName} dice ¡UNO! 🎴`);
    await db.collection('rooms').doc(currentRoomId).update({
      log,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    });
    return;
  }

  if (targets.length === 0) {
    const log = addLog(state.log, `${localName} intenta atrapar UNO pero no hay nadie con una carta.`);
    await db.collection('rooms').doc(currentRoomId).update({
      log,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    });
    return;
  }

  let { hands, players, drawPile } = state;
  let log = state.log;

  for (const target of targets) {
    const { drawn, newDrawPile } = takeCards(drawPile, 2);
    drawPile = newDrawPile;
    hands = { ...hands, [target.id]: [...(hands[target.id] || []), ...drawn] };
    players = players.map(p =>
      p.id === target.id ? { ...p, cardCount: hands[p.id].length } : p
    );
    log = addLog(log,
      `🚨 ${localName} atrapó a ${target.name} con una carta. ${target.name} roba 2 cartas.`
    );
  }

  const targetNames = targets
    .map(t => (t.name && t.name.trim()) ? t.name.trim() : 'el jugador')
    .join(', ');
  const unoAlert = `GRITARLE UNO a ${targetNames}!`;

  await db.collection('rooms').doc(currentRoomId).update({
    hands,
    players,
    drawPile,
    log,
    unoAlert,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ============================================================
// BACK TO LOBBY
// ============================================================

async function backToLobby() {
  if (!roomState) return;
  await db.collection('rooms').doc(currentRoomId).update({
    status: 'lobby',
    winner: null,
    winnerName: null,
    hands: {},
    drawPile: [],
    log: [],
    challengeOpen: false,
    lastActualCard: null,
    lastClaimedCard: null,
    players: roomState.players.map(p => ({ ...p, cardCount: 0 }))
  });
}
