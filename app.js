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
  skip:'⊘', reverse:'↺', draw2:'+2', wild:'W', wild4:'+4'
};
const COLOR_NAME = { red:'Red', yellow:'Yellow', green:'Green', blue:'Blue', black:'Wild' };

// ============================================================
// DECK
// ============================================================

function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    deck.push({ color, value: '0' });
    for (const v of [...['1','2','3','4','5','6','7','8','9'], ...ACTIONS]) {
      deck.push({ color, value: v });
      deck.push({ color, value: v });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'black', value: 'wild' });
    deck.push({ color: 'black', value: 'wild4' });
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
let claimColor = null;
let claimValue = null;

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
  if (!name) { showLandingError('Enter your name first'); return; }
  if (!localUid) { showLandingError('Still connecting… try again'); return; }
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
  if (!name) { showLandingError('Enter your name first'); return; }
  if (code.length !== 6) { showLandingError('Enter the 6-character room code'); return; }
  if (!localUid) { showLandingError('Still connecting… try again'); return; }

  const snap = await db.collection('rooms').doc(code).get();
  if (!snap.exists) { showLandingError('Room not found'); return; }
  const data = snap.data();
  if (data.status !== 'lobby') { showLandingError('Game already started'); return; }
  if (data.players.length >= 10) { showLandingError('Room is full (max 10)'); return; }

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
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
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
    startBtn.textContent = canStart ? 'Start Game' : 'Waiting for players…';
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
    log: [`Game started! ${esc(players[0].name)} goes first.`],
    winner: null,
    winnerName: null,
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ============================================================
// GAME RENDER
// ============================================================

function renderGame(state) {
  renderTopCard(state);
  renderOpponents(state);
  renderStatus(state);
  renderChallengeArea(state);
  renderHand(state);
  renderLog(state);

  // Draw pile cursor
  const myTurn = isMyTurn(state) && !state.challengeOpen;
  document.getElementById('draw-pile-area').style.opacity = myTurn ? '1' : '0.5';
}

function renderTopCard(state) {
  const el = document.getElementById('top-card');
  el.className = 'card ' + (state.topColor || 'red');
  const lbl = VALUE_LABEL[state.topValue] || '?';
  el.innerHTML = `<span class="card-label tl">${lbl}</span>
    <span class="card-label center">${lbl}</span>
    <span class="card-label br">${lbl}</span>`;
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

  if (state.challengeOpen && state.lastClaimedCard) {
    const lp = state.players.find(p => p.id === state.lastPlayerId);
    const c  = state.lastClaimedCard;
    el.textContent = `${lp?.name || '?'} played — claiming ${COLOR_NAME[c.color]} ${VALUE_LABEL[c.value]}`;
  } else if (isMyTurn(state)) {
    el.textContent = '✨ Your turn! Pick a card to play.';
  } else {
    el.textContent = `${current?.name || '?'}'s turn`;
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
      `${lp?.name || '?'} claims they played ${COLOR_NAME[c.color]} ${VALUE_LABEL[c.value]}. Believe it?`;
  }
}

function renderHand(state) {
  const handEl = document.getElementById('player-hand');
  const myHand = state.hands?.[localUid] || [];
  const myTurn = isMyTurn(state) && !state.challengeOpen;

  handEl.innerHTML = myHand.map((card, i) =>
    `<div class="card ${card.color} ${myTurn ? 'playable' : ''}"
      data-index="${i}"
      onclick="${myTurn ? `selectCard(${i})` : ''}"
    >
      <span class="card-label tl">${VALUE_LABEL[card.value]}</span>
      <span class="card-label center">${VALUE_LABEL[card.value]}</span>
      <span class="card-label br">${VALUE_LABEL[card.value]}</span>
    </div>`
  ).join('');

  document.getElementById('hand-label').textContent =
    myTurn ? 'Your turn — click a card to play' : `Your hand (${myHand.length})`;

  document.getElementById('uno-btn').classList.toggle('hidden', myHand.length !== 1);
}

function renderLog(state) {
  const el = document.getElementById('game-log');
  el.innerHTML = [...(state.log || [])].reverse().slice(0, 2)
    .map(msg => `<div class="log-entry">${esc(msg)}</div>`)
    .join('');
}

// ============================================================
// CARD SELECTION — opens claim dialog
// ============================================================

function selectCard(index) {
  if (!roomState) return;
  const myHand = roomState.hands?.[localUid] || [];
  const card = myHand[index];
  if (!card) return;

  selectedCardIdx = index;
  // Default claim: the card's own identity
  claimColor = card.color === 'black' ? 'red' : card.color;
  claimValue = card.value;

  // Show actual card preview
  const preview = document.getElementById('actual-card-preview');
  preview.innerHTML = `<div class="card ${card.color}" style="width:50px;height:75px;margin:0 auto">
    <span class="card-label tl">${VALUE_LABEL[card.value]}</span>
    <span class="card-label center" style="font-size:1.2rem">${VALUE_LABEL[card.value]}</span>
    <span class="card-label br">${VALUE_LABEL[card.value]}</span>
  </div>`;

  renderClaimPicker();
  document.getElementById('claim-dialog').classList.remove('hidden');
}

function renderClaimPicker() {
  document.getElementById('claim-color-picker').innerHTML = COLORS.map(c =>
    `<button class="color-btn ${c} ${claimColor === c ? 'selected' : ''}"
      onclick="setClaimColor('${c}')" title="${COLOR_NAME[c]}"></button>`
  ).join('');

  document.getElementById('claim-value-picker').innerHTML = ALL_VALUES.map(v =>
    `<button class="value-btn ${claimValue === v ? 'selected' : ''}"
      onclick="setClaimValue('${v}')">${VALUE_LABEL[v]}</button>`
  ).join('');
}

function setClaimColor(color) { claimColor = color; renderClaimPicker(); }
function setClaimValue(value) {
  claimValue = value;
  // Wilds use the chosen color, not 'black'
  if (WILDS.includes(value) && claimColor === null) claimColor = 'red';
  renderClaimPicker();
}

function cancelPlay() {
  selectedCardIdx = null;
  document.getElementById('claim-dialog').classList.add('hidden');
}

async function confirmPlay() {
  if (selectedCardIdx === null || !claimColor || !claimValue) return;
  const myHand = roomState?.hands?.[localUid] || [];
  const actualCard = myHand[selectedCardIdx];
  if (!actualCard) return;

  const isWild = WILDS.includes(claimValue);
  const claimedCard = { color: isWild ? claimColor : claimColor, value: claimValue };

  if (!isClaimPlayable(claimedCard, roomState)) {
    alert(
      `That claim isn't valid!\n\n` +
      `Current top card: ${COLOR_NAME[roomState.topColor]} ${VALUE_LABEL[roomState.topValue]}\n\n` +
      `Your claim must match by color or value, or be a Wild.`
    );
    return;
  }

  document.getElementById('claim-dialog').classList.add('hidden');
  await doPlayCard(actualCard, claimedCard, selectedCardIdx);
  selectedCardIdx = null;
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
    `${localName} played a card face-down, claiming ${COLOR_NAME[claimedCard.color]} ${VALUE_LABEL[claimedCard.value]}.`
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
    // Liar draws 2, top card reverts, turn goes to challenger (next player)
    const { drawn, newDrawPile } = takeCards(drawPile, 2);
    hands = { ...hands, [state.lastPlayerId]: [...(hands[state.lastPlayerId] || []), ...drawn] };
    players = players.map(p =>
      p.id === state.lastPlayerId ? { ...p, cardCount: hands[p.id].length } : p
    );
    log = addLog(log,
      `🚨 CAUGHT! ${liar?.name} lied (was ${COLOR_NAME[actual.color]} ${VALUE_LABEL[actual.value]}). Drew ${drawn.length}.`
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
    // Honest: challenger draws 2, claimed effects apply
    const { drawn, newDrawPile } = takeCards(drawPile, 2);
    hands = { ...hands, [localUid]: [...(hands[localUid] || []), ...drawn] };
    players = players.map(p =>
      p.id === localUid ? { ...p, cardCount: hands[p.id].length } : p
    );
    log = addLog(log,
      `✓ ${liar?.name} was honest (${COLOR_NAME[actual.color]} ${VALUE_LABEL[actual.value]}). ${localName} draws ${drawn.length}.`
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
    addLog(state.log, `${localName} believes ${lp?.name}.`),
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

    case 'skip': {
      logExtra = `${players[nextIdx]?.name} is skipped!`;
      newIdx   = ((nextIdx + direction) % n + n) % n;
      break;
    }

    case 'reverse': {
      direction = -direction;
      if (n === 2) {
        // With 2 players, Reverse = Skip: same player goes again
        logExtra = `${players[nextIdx]?.name} is skipped (reverse)!`;
        newIdx   = currentPlayerIndex;
      } else {
        logExtra = 'Direction reversed!';
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
      logExtra = `${players[nextIdx]?.name} draws 2 and is skipped!`;
      newIdx   = ((nextIdx + direction) % n + n) % n;
      break;
    }

    case 'wild4': {
      const tid = players[nextIdx].id;
      const { drawn, newDrawPile } = takeCards(drawPile, 4);
      drawPile = newDrawPile;
      hands    = { ...hands, [tid]: [...(hands[tid] || []), ...drawn] };
      players  = players.map(p => p.id === tid ? { ...p, cardCount: hands[p.id].length } : p);
      logExtra = `${players[nextIdx]?.name} draws 4 and is skipped!`;
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

  const { drawn, newDrawPile } = takeCards(state.drawPile, 1);
  const newHand  = [...(state.hands?.[localUid] || []), ...drawn];
  const newHands = { ...state.hands, [localUid]: newHand };
  const players  = state.players.map(p =>
    p.id === localUid ? { ...p, cardCount: newHand.length } : p
  );
  const nxt = nextPlayerIndex(state);
  const log = addLog(state.log, `${localName} drew a card and passed.`);

  await db.collection('rooms').doc(currentRoomId).update({
    hands: newHands,
    drawPile: newDrawPile,
    players,
    currentPlayerIndex: nxt,
    log,
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
  if (!roomState) return;
  const log = addLog(roomState.log, `${localName} says UNO! 🎴`);
  await db.collection('rooms').doc(currentRoomId).update({
    log,
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
