// ============================================================
// EXTRAS — game additions on top of app.js (UPGRADE-PLAN.md)
//
// Loaded after app.js; it uses app.js globals (roomState, localUid, db, FX, t…).
// app.js calls into here through a few hooks, all guarded with `typeof`:
//   afterGameRender(state, firstDraw) — end of every renderGame()
//   seatFaceHTML(state, player)       — inside renderOpponents()
//   afterClaimPicker()                — end of renderClaimPicker()
//   renderLobbyExtras(state, isHost)  — inside renderLobby()
//   afterWinnerRender(state)          — end of renderWinner()
//   onFxEvents(events, prev, cur)     — fx.js, after it worked out what happened
// ============================================================

// ============================================================
// R2 — faces on every seat
// Each player has a face that shows how they're doing: thinking on their turn,
// nervous while their face-down card waits for the vote, shocked when caught,
// smug when proven right, cocky at 1–2 cards, worried with a huge hand.
// ============================================================

addStrings({
  'mood.happy': ['Tranquilo', 'Relaxed'], 'mood.thinking': ['Pensando', 'Thinking'],
  'mood.bluff': ['¿Mentirá?', 'Bluffing?'], 'mood.caught': ['¡Pillado!', 'Caught!'],
  'mood.smug': ['Satisfecho', 'Smug'], 'mood.oops': ['Ups', 'Oops'],
  'mood.annoyed': ['Molesto', 'Annoyed'], 'mood.cocky': ['Casi gana', 'Almost there'],
  'mood.worried': ['Preocupado', 'Worried']
});

const FACE_INK = '#1b1030';
const FACE_PARTS = {
  happy:    `<circle cx="14" cy="17" r="2.2"/><circle cx="26" cy="17" r="2.2"/><path d="M14 25q6 5 12 0" fill="none" stroke="${FACE_INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  thinking: `<circle cx="15" cy="15" r="2.2"/><circle cx="27" cy="15" r="2.2"/><path d="M11 11l6-1.5M23 9.5l6 1.5" stroke="${FACE_INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M17 26h6" stroke="${FACE_INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  bluff:    `<circle cx="11" cy="17" r="3.4" fill="#fff"/><circle cx="23" cy="17" r="3.4" fill="#fff"/><circle cx="13" cy="17" r="1.6"/><circle cx="25" cy="17" r="1.6"/><path d="M14 26h11" stroke="${FACE_INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M32 8c1.6 2.4 2.4 3.8 2.4 5a2.4 2.4 0 0 1-4.8 0c0-1.2.8-2.6 2.4-5z" fill="#7fd3ff"/>`,
  caught:   `<circle cx="14" cy="16" r="3.6" fill="#fff"/><circle cx="26" cy="16" r="3.6" fill="#fff"/><circle cx="14" cy="16" r="1.5"/><circle cx="26" cy="16" r="1.5"/><ellipse cx="20" cy="27" rx="3.2" ry="4"/><circle cx="9" cy="23" r="2.4" fill="#ff6b6b" opacity=".6"/><circle cx="31" cy="23" r="2.4" fill="#ff6b6b" opacity=".6"/>`,
  smug:     `<path d="M11 17h6M23 17h6" stroke="${FACE_INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M13 24q8 5 14-2" fill="none" stroke="${FACE_INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M22 12l7-2" stroke="${FACE_INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  oops:     `<circle cx="14" cy="17" r="2.2"/><circle cx="26" cy="17" r="2.2"/><path d="M10 11l6 2M30 11l-6 2" stroke="${FACE_INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M14 27q3-3 6 0t6 0" fill="none" stroke="${FACE_INK}" stroke-width="2" stroke-linecap="round"/>`,
  annoyed:  `<path d="M10 13l7 2.5M30 13l-7 2.5" stroke="${FACE_INK}" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="18" r="2"/><circle cx="26" cy="18" r="2"/><path d="M14 28q6-4 12 0" fill="none" stroke="${FACE_INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  cocky:    `<circle cx="14" cy="17" r="2.2"/><path d="M23 17h6" stroke="${FACE_INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M11 11l6-1M23 10l6 2" stroke="${FACE_INK}" stroke-width="1.8" stroke-linecap="round"/><path d="M12 23q8 7 16 0z" fill="#fff" stroke="${FACE_INK}" stroke-width="1.8" stroke-linejoin="round"/>`,
  worried:  `<path d="M10 14l6-2M30 14l-6-2" stroke="${FACE_INK}" stroke-width="1.8" stroke-linecap="round"/><circle cx="14" cy="18" r="2.2"/><circle cx="26" cy="18" r="2.2"/><path d="M14 28q6-5 12 0" fill="none" stroke="${FACE_INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M33 9c1.6 2.4 2.4 3.8 2.4 5a2.4 2.4 0 0 1-4.8 0c0-1.2.8-2.6 2.4-5z" fill="#7fd3ff"/>`
};

// Each player keeps the same skin colour (from their name)
function faceHue(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}
function faceSVG(mood, name, size = 34) {
  const hue = faceHue(name);
  return `<svg class="seat-face face-${mood}" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="hsl(${hue} 60% 66%)" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>
    <circle cx="13" cy="10" r="4" fill="#fff" opacity=".25"/>
    <g fill="${FACE_INK}">${FACE_PARTS[mood] || FACE_PARTS.happy}</g>
  </svg>`;
}
function seatMood(state, p) {
  const m = FX.moodOf(p.id);
  if (m) return m;
  if (state.challengeOpen && state.lastPlayerId === p.id) return 'bluff';
  if (p.cardCount > 0 && p.cardCount <= 2) return 'cocky';
  if (p.cardCount >= 12) return 'worried';
  if (state.players[state.currentPlayerIndex]?.id === p.id && !state.challengeOpen) return 'thinking';
  return 'happy';
}
function seatFaceHTML(state, p) {
  const mood = seatMood(state, p);
  return `<span class="seat-face-wrap" title="${esc(t('mood.' + mood))}">${faceSVG(mood, p.name)}</span>`;
}

// ============================================================
// B2 — "Tu turno" moment + optional turn timer
// B3 — danger alert when someone gets down to 2 cards
// B5 — hand badges (honest play / bluff only / can't play)
// ============================================================

addStrings({
  'look.lieTag':     ['Mentira', 'Lie'],
  'turn.yours':      ['¡Tu turno!', 'Your turn!'],
  'turn.yoursSub':   ['Elige una carta o roba', 'Pick a card or draw'],
  'danger.other':    ['¡{name} está a 2 cartas!', '{name} is 2 cards away!'],
  'danger.otherSub': ['Pon atención a sus mentiras', 'Watch out for their lies'],
  'danger.me':       ['¡Te quedan 2 cartas!', 'You have 2 cards left!'],
  'danger.meSub':    ['No olvides gritar UNO', "Don't forget to shout UNO"],
  'timer.label':     ['Tiempo por turno', 'Time per turn'],
  'timer.off':       ['Sin límite', 'No limit'],
  'timer.s':         ['{n} s', '{n} s'],
  'timer.desc':      ['Si se acaba: robas 1 y pasas. En una votación, cuenta como "Lo creo".', 'When time runs out you draw 1 and pass. In a vote, it counts as "I believe it".'],
  'timer.log':       ['⏰ {name} se quedó sin tiempo: robó una carta y pasó.', '⏰ {name} ran out of time: drew a card and passed.'],
  'badge.ok':        ['Jugable', 'Playable'],
  'badge.bluff':     ['Solo mintiendo', 'Bluff only'],
  'badge.no':        ['No se puede', "Can't play"]
});

let _wasMyTurn = null;
let _countSeen = {};       // pid -> cards on the previous draw
let _myMaxCards = 0;       // most cards I held this game (for the "comeback" badge)

function afterGameRender(state, firstDraw) {
  const myTurn = isMyTurn(state) && !state.challengeOpen && !state.wildChallenge && !state.sevenSwapPending;

  // B2: my turn just started
  if (!firstDraw && myTurn && _wasMyTurn === false) {
    FX.enqueue(async () => {
      if (!isMyTurn(roomState) || roomState.challengeOpen) return;
      FX.play('turn');
      FX.buzz([30, 50, 30]);
      const hand = document.getElementById('player-hand');
      hand?.classList.add('hand-lift');
      setTimeout(() => hand?.classList.remove('hand-lift'), 900);
      await FX.banner(t('turn.yours'), t('turn.yoursSub'), 'turn', 850);
    });
  }
  _wasMyTurn = myTurn;

  // B3: someone got down to 2 cards
  for (const p of state.players) {
    const before = _countSeen[p.id];
    if (!firstDraw && before !== undefined && before > 2 && p.cardCount === 2) {
      const me = p.id === localUid, name = p.name;
      FX.enqueue(async () => {
        FX.play('danger');
        if (!me) FX.buzz([40, 60, 40]);
        await FX.banner(me ? t('danger.me') : t('danger.other', { name }), me ? t('danger.meSub') : t('danger.otherSub'), 'danger', 1100);
      });
    }
    _countSeen[p.id] = p.cardCount;
  }
  _myMaxCards = Math.max(_myMaxCards, (state.hands?.[localUid] || []).length);

  renderMyFace(state);
  markHandBadges(state);
  fitHand();
  updateTurnTimer(state);
  updateMenuDot(state);
  if (typeof LOCAL_GAME !== 'undefined' && LOCAL_GAME) { if (typeof tutorialRender === 'function') tutorialRender(state); return; }
  listenThrows();
}

function resetGameExtras() {
  _wasMyTurn = null;
  _countSeen = {};
  _myMaxCards = 0;
  _timer = { key: null, start: 0, fired: false };
}

// My own face next to "Tu mano"
function renderMyFace(state) {
  const label = document.getElementById('hand-label');
  if (!label) return;
  let el = document.getElementById('my-face');
  if (!el) {
    el = document.createElement('span');
    el.id = 'my-face';
    el.className = 'my-face';
    label.before(el);
  }
  const me = state.players.find(p => p.id === localUid);
  if (me) el.innerHTML = seatFaceHTML(state, me);
}

// B5: little badge on each hand card on my turn
function markHandBadges(state) {
  const myTurn = isMyTurn(state) && !state.challengeOpen && !state.wildChallenge;
  const hand = state.hands?.[localUid] || [];
  document.querySelectorAll('#player-hand .card[data-index]').forEach(el => {
    el.querySelector('.hand-badge')?.remove();
    el.classList.remove('cant-play');
    if (!myTurn) return;
    const c = hand[+el.dataset.index];
    if (!c) return;
    const honest = c.value === 'wild' || isActualPlayable(c, state);
    const kind = honest ? 'ok' : isLiarCard(c) ? 'bluff' : 'no';
    const b = document.createElement('span');
    b.className = `hand-badge hb-${kind}`;
    b.title = t('badge.' + kind);
    // New look: honest cards glow gold (badge hidden by look.css), bluff-only cards
    // get a small "Mentira" tag with the "?" speech bubble, unplayable ones dim with ✕
    if (kind === 'bluff') b.innerHTML = `${CARD_SVG.bubble}<span>${t('look.lieTag')}</span>`;
    else b.textContent = kind === 'ok' ? '✓' : '✕';
    el.appendChild(b);
    if (kind === 'no') el.classList.add('cant-play');
  });
}

// Y1: the whole hand fits on screen — cards overlap as needed and form a slight fan
// (no more scrolling sideways to find a card)
function fitHand() {
  const hand = document.getElementById('player-hand');
  const cards = [...(hand?.querySelectorAll('.card[data-index]') || [])];
  if (!hand || !cards.length) return;
  hand.classList.add('fitted');
  const n = cards.length, w = cards[0].offsetWidth || 60;
  const avail = hand.clientWidth - 8;
  const overlap = n > 1 ? Math.min(w * 0.72, Math.max(0, (n * w - avail) / (n - 1) + 2)) : 0;
  // New look (LOOK-PLAN step 6): a deeper curve, like holding the cards in your hand
  const fan = n > 1 ? Math.min(5, 34 / n) : 0;
  const k = Math.min(1.6, 70 / (n * n));
  hand.style.setProperty('--overlap', overlap + 'px');
  hand.style.setProperty('--fan', fan + 'deg');
  cards.forEach((el, i) => {
    const off = i - (n - 1) / 2;
    el.style.setProperty('--i', i);
    el.style.setProperty('--n', n);
    el.style.setProperty('--lift', (off * off * k).toFixed(1) + 'px');
  });
}
window.addEventListener('resize', () => { if (roomState?.status === 'playing') fitHand(); });

// ---- Turn timer ----
// Every device times the turn from the moment it saw it start (no extra data is saved).
// Only the player whose turn it is acts when time runs out: draw 1 and pass, or — in a
// "¿Lo crees?" vote — count as "Lo creo". Bots are never timed.
const TURN_TIMER_OPTIONS = [0, 30, 60];
let _timer = { key: null, start: 0, fired: false };
let _timerTick = null;

function timerPhase(state) {
  if (state.status !== 'playing' || !state.turnTimer) return null;
  if (state.wildChallenge || state.sevenSwapPending) return null;
  if (state.challengeOpen) return 'vote';
  return 'turn';
}
function timeLeft(state) {
  const phase = timerPhase(state);
  if (!phase) return null;
  return state.turnTimer * 1000 - (Date.now() - _timer.start);
}
function updateTurnTimer(state) {
  let bar = document.getElementById('turn-timer');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'turn-timer';
    bar.className = 'turn-timer hidden';
    bar.innerHTML = '<span class="tt-fill"></span><b class="tt-secs"></b>';
    document.getElementById('game-status')?.after(bar);
  }
  const phase = timerPhase(state);
  // a new turn or vote: restart the clock (a vote keeps going while people vote)
  const key = phase === 'vote' ? `vote|${state.lastPlayerId}|${state.prevTopValue}|${state.lastClaimedCard?.value}` : phase ? `turn|${state.currentPlayerIndex}|${state.topColor}|${state.topValue}|${state.direction}` : null;
  if (key !== _timer.key) _timer = { key, start: Date.now(), fired: false };
  bar.classList.toggle('hidden', !phase);
  if (phase && !_timerTick) _timerTick = setInterval(timerTick, 250);
  if (!phase && _timerTick) { clearInterval(_timerTick); _timerTick = null; }
  if (phase) timerTick();
}
function timerTick() {
  const state = roomState;
  const bar = document.getElementById('turn-timer');
  const left = state ? timeLeft(state) : null;
  if (left === null || !bar) { clearInterval(_timerTick); _timerTick = null; return; }
  const total = state.turnTimer * 1000;
  const secs = Math.max(0, Math.ceil(left / 1000));
  bar.querySelector('.tt-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`;
  bar.querySelector('.tt-secs').textContent = secs + ' s';
  bar.classList.toggle('low', left < 10000);
  const phase = timerPhase(state);
  const meActing = phase === 'turn' ? isMyTurn(state)
    : state.lastPlayerId !== localUid && !(state.challengeBelieves || []).includes(localUid)
      && state.players.some(p => p.id === localUid && !p.disconnected);
  bar.classList.toggle('mine', meActing);
  if (meActing && secs <= 5 && secs > 0 && bar.dataset.tick !== `${_timer.key}|${secs}`) {
    bar.dataset.tick = `${_timer.key}|${secs}`;
    FX.play('tick');
  }
  if (!meActing || left > 0 || _timer.fired) return;
  _timer.fired = true;
  if (phase === 'vote') { handleBelieve(); return; }
  timeoutDrawAndPass();
}
async function timeoutDrawAndPass() {
  const state = roomState;
  if (!isMyTurn(state) || state.challengeOpen || state.wildChallenge) return;
  closeAllPlayDialogs();
  if (drawnCardState !== null) { await handlePassTurn(); return; }
  const { drawn, newDrawPile } = takeCards(state.drawPile, 1);
  const newHand = [...(state.hands?.[localUid] || []), ...drawn];
  await db.collection('rooms').doc(currentRoomId).update({
    hands: { ...state.hands, [localUid]: newHand },
    drawPile: newDrawPile,
    players: state.players.map(p => p.id === localUid ? { ...p, cardCount: newHand.length } : p),
    currentPlayerIndex: nextPlayerIndex(state),
    unoCallRequired: firebase.firestore.FieldValue.delete(),
    // always saved in Spanish like every log line (translateLog shows it in English)
    log: addLog(state.log, I18N.es['timer.log'].replace('{name}', localName)),
    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
  });
}
// Close the claim / 7-swap windows if the clock ran out while one was open
function closeAllPlayDialogs() {
  ['claim-dialog', 'seven-swap-dialog'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  selectedCardIdx = null;
  selectedActualCard = null;
}

async function handleSetTurnTimer(sec) {
  if (!roomState || roomState.status !== 'lobby' || roomState.hostId !== localUid) return;
  if (!TURN_TIMER_OPTIONS.includes(sec)) return;
  await db.collection('rooms').doc(currentRoomId).update({ turnTimer: sec, lastActivity: firebase.firestore.FieldValue.serverTimestamp() });
}

// ============================================================
// B5 — the claim window says whether what you declare is the truth or a lie,
// and in-game warning windows replace the browser's alert()
// ============================================================

addStrings({
  'claim.truth':   ['✓ Verdad', '✓ Truth'],
  'claim.lie':     ['🤥 Mentira', '🤥 Lie'],
  'claim.invalid': ['✕ No vale sobre esta carta', "✕ Doesn't match the top card"],
  'claim.truthTip':['Si te acusan, el que acusa roba 1.', 'If someone accuses you, they draw 1.'],
  'claim.lieTip':  ['Si te pillan, recuperas la carta y robas 1.', "If you're caught, you take the card back and draw 1."],
  'notice.ok':     ['Entendido', 'Got it'],
  'notice.cantTitle': ['No puedes jugarla boca arriba', "You can't play it face up"],
  'notice.cantBody':  ['Esta carta normal no coincide en color ni número con el descarte. Elige otra o roba.', "This normal card doesn't match the top card's colour or number. Pick another or draw."],
  'notice.badClaimTitle': ['Ese anuncio no es válido', "That claim isn't valid"],
  'notice.badClaimBody':  ['Carta superior: {top}. Lo que anuncies debe coincidir en color o valor, o ser un Comodín +4.', 'Top card: {top}. What you declare must match its colour or value, or be a Wild +4.']
});

function afterClaimPicker() {
  const actual = selectedActualCard;
  const dialog = document.getElementById('claim-dialog');
  if (!actual || !dialog) return;
  let el = document.getElementById('claim-truth');
  if (!el) {
    el = document.createElement('div');
    el.id = 'claim-truth';
    el.className = 'claim-truth';
    dialog.querySelector('.claim-btns')?.before(el);
  }
  if (!isLiarCard(actual) || !claimColor || !claimValue) { el.innerHTML = ''; return; }
  const claimed = { color: claimColor, value: claimValue };
  const lie = actual.value !== claimed.value || (actual.color !== 'black' && actual.color !== claimed.color);
  const valid = isClaimPlayable(claimed, roomState);
  el.className = `claim-truth ${!valid ? 'invalid' : lie ? 'lie' : 'truth'}`;
  el.innerHTML = !valid ? t('claim.invalid')
    : `<b>${lie ? t('claim.lie') : t('claim.truth')}</b><span>${lie ? t('claim.lieTip') : t('claim.truthTip')}</span>`;
}

// A one-button in-game warning (uses the existing confirm window)
async function showNotice(icon, title, msg) {
  const cancel = document.getElementById('draw-confirm-cancel');
  cancel.classList.add('hidden');
  await showDrawConfirm('yellow', icon, title, msg, t('notice.ok'));
  cancel.classList.remove('hidden');
}

// ============================================================
// B4 — hold a card (or hover it on a computer) to see it big with its rule
// ============================================================

addStrings({
  'zoom.normal':  ['Carta normal: se juega boca arriba y debe coincidir en color o número.', 'Normal card: played face up, must match the colour or number.'],
  'zoom.liar':    ['Carta mentirosa: se juega boca abajo y anuncias la carta que quieras. Puedes mentir. Si te pillan, la recuperas y robas 1.', "Liar card: played face down and you announce any card you like. You may lie. If you're caught, you take it back and draw 1."],
  'zoom.v.0':     ['0: todos pasan su mano en el sentido del juego.', '0: everyone passes their hand in the direction of play.'],
  'zoom.v.7':     ['7: cambias tu mano con la de otro jugador.', '7: swap your hand with another player.'],
  'zoom.v.skip':  ['Salto: el siguiente pierde su turno.', 'Skip: the next player loses their turn.'],
  'zoom.v.reverse': ['Cambio de sentido.', 'Reverses the direction.'],
  'zoom.v.draw2': ['+2: el siguiente roba 2 y pierde su turno.', '+2: the next player draws 2 and loses their turn.'],
  'zoom.v.wild':  ['Comodín: se juega siempre boca arriba. Empieza el desafío del comodín y eliges color.', 'Wild: always played face up. Starts the wild card challenge and you pick a colour.'],
  'zoom.v.wild4': ['Comodín +4: el siguiente roba 4 y pierde su turno.', 'Wild +4: the next player draws 4 and loses their turn.']
});

function zoomText(card) {
  const base = card.value === 'wild' ? '' : t(isLiarCard(card) ? 'zoom.liar' : 'zoom.normal');
  const extra = I18N.es['zoom.v.' + card.value] ? t('zoom.v.' + card.value) : '';
  return [base, extra].filter(Boolean).join(' ');
}

let _zoomEl = null, _zoomTimer = null, _zoomSwallowClick = false;
function showZoom(cardEl) {
  const card = (roomState?.hands?.[localUid] || [])[+cardEl.dataset.index];
  if (!card) return;
  hideZoom();
  _zoomEl = document.createElement('div');
  _zoomEl.className = 'card-zoom';
  _zoomEl.innerHTML = `<div class="zoom-card">${buildCardHTML(card)}</div><p>${esc(zoomText(card))}</p>`;
  document.body.appendChild(_zoomEl);
  const r = cardEl.getBoundingClientRect(), zr = _zoomEl.getBoundingClientRect();
  _zoomEl.style.left = Math.max(8, Math.min(innerWidth - zr.width - 8, r.left + r.width / 2 - zr.width / 2)) + 'px';
  _zoomEl.style.top  = (r.top - zr.height - 12 > 8 ? r.top - zr.height - 12 : Math.min(innerHeight - zr.height - 8, r.bottom + 12)) + 'px';
  FX.play('select');
}
function hideZoom() { clearTimeout(_zoomTimer); _zoomEl?.remove(); _zoomEl = null; }

(function setupZoom() {
  const isCard = e => e.target.closest?.('#player-hand .card[data-index]');
  let sx = 0, sy = 0, clicked = null;
  document.addEventListener('pointerdown', e => {
    const el = isCard(e);
    if (!el || e.pointerType === 'mouse') return;
    sx = e.clientX; sy = e.clientY;
    clearTimeout(_zoomTimer);
    _zoomTimer = setTimeout(() => { showZoom(el); _zoomSwallowClick = true; FX.buzz(15); }, 450);
  });
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) clearTimeout(_zoomTimer);
  });
  ['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, e => {
    if (e.pointerType !== 'mouse') { clearTimeout(_zoomTimer); if (_zoomEl) setTimeout(hideZoom, 80); }
  }));
  // A long-press must not also play the card; a normal click hides the zoom
  document.addEventListener('click', e => {
    const el = isCard(e);
    if (_zoomSwallowClick && el) { e.stopPropagation(); e.preventDefault(); }
    else if (el) { hideZoom(); clicked = el.dataset.index; }
    _zoomSwallowClick = false;
  }, true);
  document.addEventListener('contextmenu', e => { if (isCard(e)) e.preventDefault(); });
  document.addEventListener('mouseover', e => {
    const el = isCard(e);
    if (!el || el.dataset.index === clicked) return;
    clearTimeout(_zoomTimer);
    _zoomTimer = setTimeout(() => {
      const now = document.querySelector(`#player-hand .card[data-index="${el.dataset.index}"]`);
      if (now?.matches(':hover') && el.dataset.index !== clicked) showZoom(now);
    }, 700);
  });
  document.addEventListener('mouseout', e => {
    const el = isCard(e);
    if (el && !e.relatedTarget?.closest?.(`#player-hand .card[data-index="${el.dataset.index}"]`)) { hideZoom(); clicked = null; }
  });
})();

// ============================================================
// B6 — settings menu in the game's top bar (+ rules window)
// ============================================================

addStrings({
  'menu.game': ['Partida', 'Game'], 'menu.end': ['Votar para terminar la partida', 'Vote to end the game'],
  'menu.sound': ['Sonido', 'Sound'], 'menu.music': ['Música de fondo', 'Background music'],
  'menu.sfx': ['Efectos de sonido', 'Sound effects'], 'menu.volume': ['Volumen', 'Volume'],
  'menu.notif': ['Avisos cuando es tu turno', 'Alerts when it is your turn'],
  'menu.shared': ['Música compartida', 'Shared music'], 'menu.screen': ['Pantalla', 'Display'],
  'menu.vibrate': ['Vibración', 'Vibration'], 'menu.calm': ['Modo calma (menos movimiento)', 'Calm mode (less motion)'],
  'menu.colorblind': ['Símbolos para daltónicos', 'Colour-blind symbols'], 'menu.lang': ['Idioma', 'Language'],
  'menu.title': ['Ajustes', 'Settings']
});

function toggleGameMenu(e) {
  e?.stopPropagation();
  const menu = document.getElementById('game-menu');
  const open = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !open);
  document.getElementById('menu-btn')?.setAttribute('aria-expanded', String(open));
  if (open) syncMenu();
}
function closeGameMenu() {
  document.getElementById('game-menu')?.classList.add('hidden');
  document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', e => {
  const menu = document.getElementById('game-menu');
  if (!menu || menu.classList.contains('hidden')) return;
  const row = e.target.closest('.menu-row');
  if (row && menu.contains(row)) {
    if (!e.target.closest('button, input')) { row.querySelector('button')?.click(); return; }
    if (e.target.closest('#spotify-btn, #lastfm-btn, #end-game-btn')) closeGameMenu();
    return;
  }
  if (!menu.contains(e.target) && !e.target.closest('#menu-btn')) closeGameMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeGameMenu(); hideZoom(); closeRules(); } });

function toggleFxPref(key) {
  FX.setPref(key, !FX.prefs[key]);
  if (key === 'sfx' && FX.prefs.sfx) FX.play('pop');
  if (key === 'vibrate' && FX.prefs.vibrate) FX.buzz(40);
  syncMenu();
}
function setFxVolume(v) {
  FX.setPref('vol', Math.max(0, Math.min(1, v / 100)));
  clearTimeout(setFxVolume._t);
  setFxVolume._t = setTimeout(() => FX.play('pop'), 120);
}
function syncMenu() {
  for (const key of ['sfx', 'vibrate', 'calm', 'colorblind']) {
    document.getElementById(`${key}-toggle-btn`)?.setAttribute('aria-pressed', String(!!FX.prefs[key]));
  }
  const vol = document.getElementById('sfx-volume');
  if (vol) { vol.value = Math.round(FX.prefs.vol * 100); vol.disabled = !FX.prefs.sfx; }
  if (!navigator.vibrate) document.getElementById('vibrate-toggle-btn')?.closest('.menu-row')?.classList.add('hidden');
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('selected', b.dataset.lang === LANG));
}
function updateMenuDot(state) {
  const votes = state.endVotes || [];
  document.getElementById('menu-dot')?.classList.toggle('hidden', !(votes.length && !votes.includes(localUid)));
}

function openRules()  { document.getElementById('rules-modal')?.classList.remove('hidden'); }
function closeRules() { document.getElementById('rules-modal')?.classList.add('hidden'); }
function rulesBackdropClick(e) { if (e.target.id === 'rules-modal') closeRules(); }

// Redraw whatever is on screen in the new language
document.addEventListener('langchange', () => {
  syncMenu();
  updateStatsLink();
  const s = roomState;
  if (!s) return;
  if (s.status === 'lobby') renderLobby(s);
  else if (s.status === 'playing') renderGame(s);
  else if (s.status === 'ended') renderWinner(s);
});

// ============================================================
// G4 — match stats (counted by the host) + awards + room score
// R6 — winner celebration
// G5 — my stats and badges (saved on this device)
// ============================================================

addStrings({
  'win.series':   ['Marcador de la sala', 'Room score'],
  'win.points':   ['Puntos (gana quien llegue a {n})', 'Points (first to {n} wins)'],
  'win.gain':     ['+{n} puntos por las cartas que quedaron', '+{n} points for the cards left over'],
  'win.match':    ['🏆 ¡{name} gana la partida completa!', '🏆 {name} wins the match!'],
  'win.matchSub': ['Llegó a {n} puntos. La próxima partida empieza de cero.', 'Reached {n} points. The next game starts from zero.'],
  'win.awards':   ['Premios de la partida', 'Match awards'],
  'win.newBadge': ['¡Nueva insignia!', 'New badge!'],
  'win.cards':    ['{n} cartas', '{n} cards'],
  'win.standings':['Cartas que quedaron', 'Cards left'],
  'aw.liar':      ['Mentiroso profesional', 'Professional liar'], 'aw.liarWhy': ['{n} mentiras sin que lo pillen', '{n} lies got away with'],
  'aw.detective': ['Detective', 'Detective'],               'aw.detectiveWhy': ['pilló a {n} mentirosos', 'caught {n} liars'],
  'aw.pinocho':   ['Nariz de madera', 'Wooden nose'],       'aw.pinochoWhy': ['lo pillaron {n} veces', 'caught {n} times'],
  'aw.paranoid':  ['Desconfiado', 'Paranoid'],              'aw.paranoidWhy': ['{n} acusaciones fallidas', '{n} wrong accusations'],
  'aw.collector': ['Coleccionista', 'Card collector'],      'aw.collectorWhy': ['robó {n} cartas', 'drew {n} cards'],
  'aw.honest':    ['Corazón de oro', 'Heart of gold'],      'aw.honestWhy': ['{n} cartas boca abajo, todas verdad', '{n} face-down cards, all true'],

  'stats.open': ['Tus estadísticas e insignias', 'Your stats and badges'], 'stats.title': ['Tus estadísticas', 'Your stats'],
  'stats.games': ['Partidas', 'Games'], 'stats.wins': ['Victorias', 'Wins'], 'stats.rate': ['% victorias', 'Win rate'],
  'stats.streak': ['Mejor racha', 'Best streak'], 'stats.lies': ['Mentiras', 'Lies told'],
  'stats.gotAway': ['Sin pillar', 'Got away'], 'stats.catches': ['Pillados', 'Liars caught'], 'stats.caught': ['Te pillaron', 'You got caught'],
  'stats.badges': ['Insignias', 'Badges'], 'stats.local': ['Se guardan en este dispositivo.', 'Saved on this device.'],
  'stats.close': ['Cerrar', 'Close'], 'stats.none': ['Juega una partida para empezar.', 'Play a game to get started.'],

  'b.first': ['Primera victoria', 'First win'],             'b.firstWhy': ['Gana una partida', 'Win a game'],
  'b.poker': ['Cara de póker', 'Poker face'],              'b.pokerWhy': ['Gana tras mentir 3 veces sin que te pillen', 'Win after 3 lies without being caught'],
  'b.detective': ['Detective', 'Detective'],               'b.detectiveWhy': ['Pilla a 3 mentirosos en una partida', 'Catch 3 liars in one game'],
  'b.honest': ['Honrado', 'Honest'],                       'b.honestWhy': ['Gana sin decir ni una mentira', 'Win without telling a single lie'],
  'b.comeback': ['Remontada', 'Comeback'],                 'b.comebackWhy': ['Gana después de tener 12 cartas o más', 'Win after holding 12 or more cards'],
  'b.hunter': ['Cazador de UNO', 'UNO hunter'],            'b.hunterWhy': ['Pilla a alguien que no gritó UNO', "Catch someone who didn't shout UNO"],
  'b.streak': ['Racha de 3', 'Hat trick'],                 'b.streakWhy': ['Gana 3 partidas seguidas', 'Win 3 games in a row'],
  'b.bigliar': ['Gran mentiroso', 'Master bluffer'],        'b.bigliarWhy': ['Sal impune de 25 mentiras en total', 'Get away with 25 lies in total'],
  'b.veteran': ['Veterano', 'Veteran'],                    'b.veteranWhy': ['Juega 10 partidas', 'Play 10 games'],
  'b.legend': ['Leyenda', 'Legend'],                       'b.legendWhy': ['Gana 10 partidas', 'Win 10 games']
});

const isLieCard = (actual, claimed) => !!actual && !!claimed &&
  (actual.value !== claimed.value || (actual.color !== 'black' && actual.color !== claimed.color));

// The host counts what happens and saves it on the room (stats.<pid>.<count>), so every
// player sees the same awards. Increments are atomic, so they never clash with moves.
let _seriesSavedFor = null;
function onFxEvents(events, prev, cur) {
  if (cur.hostId !== localUid || (typeof LOCAL_GAME !== 'undefined' && LOCAL_GAME)) return;
  const add = {};
  const inc = (pid, key, n = 1) => { if (!pid) return; const k = pid + '|' + key; add[k] = (add[k] || 0) + n; };
  for (const e of events) {
    if (e.type === 'claim') { inc(e.pid, 'claims'); if (isLieCard(cur.lastActualCard, cur.lastClaimedCard)) inc(e.pid, 'lies'); }
    if (e.type === 'caught') { inc(e.liar, 'caught'); inc(e.accuser, 'catches'); }
    if (e.type === 'truth') inc(e.accuser, 'wrong');
    if (e.type === 'believed' && isLieCard(prev.lastActualCard, prev.lastClaimedCard)) inc(e.pid, 'gotAway');
    if (e.type === 'draw') inc(e.pid, 'drawn', e.n);
    if (e.type === 'unoCaught') {
      const line = FX.newEntries(prev.log, cur.log).find(l => /le gritó UNO a|atrapó a/.test(l));
      if (line) inc(FX.namesIn(line, cur)[0], 'unoCatches');
    }
  }
  const pairs = [];
  const FieldPath = firebase.firestore.FieldPath, FV = firebase.firestore.FieldValue;
  for (const [k, n] of Object.entries(add)) {
    const [pid, key] = k.split('|');
    pairs.push(new FieldPath('stats', pid, key), FV.increment(n));
  }
  if (pairs.length) queueStatsWrite(pairs);
}

// Counts are saved together a moment later, so they don't collide with the move that
// is being saved right now (which would make that move's save retry)
let _statsPending = [], _statsTimer = null;
function queueStatsWrite(pairs) {
  _statsPending.push(...pairs);
  clearTimeout(_statsTimer);
  _statsTimer = setTimeout(() => {
    const out = _statsPending; _statsPending = [];
    if (out.length && currentRoomId) db.collection('rooms').doc(currentRoomId).update(...out).catch(e => console.warn('[stats]', e));
  }, 1500);
}

// Room score: the host adds the win once per game. Each game has a number (gameNo, set
// when it starts) and the room remembers it was counted (seriesDone), so a second
// winner-screen redraw or a second device can't count it again.
// Each winner (several in a shared win) gets +1 win and the round's points
// (official scoring: all cards left in the other hands). When someone's total
// reaches 500 the room remembers them as the match winner (matchWinner); the
// next game then starts the points from zero (handleStart).
function winnerNames(state) {
  const names = winnerIds(state).map(id => state.players?.find(p => p.id === id)?.name).filter(Boolean);
  return names.length ? names : (state.winnerName ? [state.winnerName] : []);
}
function saveSeriesOnEnd(state) {
  if (state.hostId !== localUid || !state.winnerName || state.seriesDone) return;
  const gameKey = `${currentRoomId}|${state.gameNo || 0}`;
  if (_seriesSavedFor === gameKey) return;
  _seriesSavedFor = gameKey;
  const FP = firebase.firestore.FieldPath, inc = firebase.firestore.FieldValue.increment;
  const names = winnerNames(state);
  const gain = roundPoints(state);
  const args = [];
  for (const name of names) args.push(new FP('series', name), inc(1));
  if (gain > 0) {
    for (const name of names) args.push(new FP('points', name), inc(gain));
    if (!state.matchWinner) {
      const totals = names.map(n => [n, (state.points?.[n] || 0) + gain]);
      const top = Math.max(...totals.map(([, v]) => v));
      if (top >= MATCH_POINTS) args.push('matchWinner', totals.filter(([, v]) => v === top).map(([n]) => n).join(' & '));
    }
  }
  args.push('seriesDone', true);
  db.collection('rooms').doc(currentRoomId).update(...args).catch(() => {});
}

const AWARDS = [
  { id: 'liar',      icon: '🤥', stat: 'gotAway', min: 2 },
  { id: 'detective', icon: '🕵️', stat: 'catches', min: 2 },
  { id: 'pinocho',   icon: '🤥', stat: 'caught',  min: 2 },
  { id: 'paranoid',  icon: '😒', stat: 'wrong',   min: 2 },
  { id: 'collector', icon: '🃏', stat: 'drawn',   min: 6 }
];
function matchAwards(state) {
  const stats = state.stats || {};
  const out = [];
  for (const a of AWARDS) {
    let best = null, bestN = a.min - 1, tie = false;
    for (const p of state.players) {
      const n = stats[p.id]?.[a.stat] || 0;
      if (n > bestN) { best = p; bestN = n; tie = false; } else if (n === bestN && best) tie = true;
    }
    if (best && !tie) out.push({ ...a, name: best.name, n: bestN });
  }
  // Heart of gold: most face-down plays with no lie at all
  const honest = state.players
    .map(p => ({ p, s: stats[p.id] || {} }))
    .filter(x => (x.s.claims || 0) >= 3 && !(x.s.lies || 0))
    .sort((a, b) => b.s.claims - a.s.claims)[0];
  if (honest) out.push({ id: 'honest', icon: '😇', name: honest.p.name, n: honest.s.claims });
  return out;
}

const MY_STATS_KEY = 'unoMyStats';
const BADGES = [
  { id: 'first',     icon: '🏆', test: c => c.won },
  { id: 'poker',     icon: '🃏', test: c => c.won && (c.ms.gotAway || 0) >= 3 && !c.ms.caught },
  { id: 'detective', icon: '🕵️', test: c => (c.ms.catches || 0) >= 3 },
  { id: 'honest',    icon: '😇', test: c => c.won && !(c.ms.lies || 0) },
  { id: 'comeback',  icon: '🚀', test: c => c.won && c.maxCards >= 12 },
  { id: 'hunter',    icon: '📣', test: c => (c.ms.unoCatches || 0) >= 1 },
  { id: 'streak',    icon: '🔥', test: c => c.s.streak >= 3 },
  { id: 'bigliar',   icon: '🤥', test: c => c.s.gotAway >= 25 },
  { id: 'veteran',   icon: '🎖️', test: c => c.s.games >= 10 },
  { id: 'legend',    icon: '👑', test: c => c.s.wins >= 10 }
];
function loadMyStats() {
  const base = { games: 0, wins: 0, streak: 0, best: 0, lies: 0, gotAway: 0, catches: 0, caught: 0, badges: {}, recorded: [] };
  try { return Object.assign(base, JSON.parse(localStorage.getItem(MY_STATS_KEY) || '{}')); } catch (_) { return base; }
}
function saveMyStats(s) { try { localStorage.setItem(MY_STATS_KEY, JSON.stringify(s)); } catch (_) {} }

function recordMyGame(state, gameKey) {
  if (!state.players?.some(p => p.id === localUid)) return [];
  const s = loadMyStats();
  if (s.recorded.includes(gameKey)) return [];
  s.recorded = [...s.recorded, gameKey].slice(-30);
  const won = winnerIds(state).includes(localUid);
  const ms = state.stats?.[localUid] || {};
  s.games++;
  if (won) { s.wins++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
  for (const k of ['lies', 'gotAway', 'catches', 'caught']) s[k] += ms[k] || 0;
  const ctx = { s, won, ms, maxCards: _myMaxCards };
  const fresh = BADGES.filter(b => !s.badges[b.id] && b.test(ctx));
  for (const b of fresh) s.badges[b.id] = new Date().toISOString().slice(0, 10);
  saveMyStats(s);
  return fresh;
}

function confetti(ms = 3500, count = 170) {
  if (!FX.motion()) return;
  const cv = document.createElement('canvas');
  cv.className = 'fx-confetti';
  cv.width = innerWidth * devicePixelRatio;
  cv.height = innerHeight * devicePixelRatio;
  FX.layer().appendChild(cv);
  const g = cv.getContext('2d');
  g.scale(devicePixelRatio, devicePixelRatio);
  const cols = ['#C81515', '#D4A800', '#189A20', '#1040B8', '#ffffff'];
  const bits = Array.from({ length: count }, () => ({
    x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .6,
    vx: (Math.random() - .5) * 2.4, vy: 2 + Math.random() * 3.2, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
    w: 7 + Math.random() * 5, h: 10 + Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)]
  }));
  const t0 = performance.now();
  (function frame(now) {
    const age = now - t0;
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalAlpha = Math.max(0, Math.min(1, (ms - age) / 600));
    for (const b of bits) {
      b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vy += .03;
      g.save(); g.translate(b.x, b.y); g.rotate(b.r);
      g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)));
      g.restore();
    }
    if (age < ms) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

let _celebrated = null;
function afterWinnerRender(state) {
  if (typeof LOCAL_GAME !== 'undefined' && LOCAL_GAME) {
    if (_celebrated !== 'tutorial') { _celebrated = 'tutorial'; FX.play('win'); confetti(4200, 200); tutorialOutro(); }
    return;
  }
  saveSeriesOnEnd(state);
  const standings = document.getElementById('winner-standings');
  if (!standings) return;

  // Cards left for everyone (the original screen only listed them after a vote)
  if (standings.classList.contains('hidden') && state.hands && state.players?.length) {
    standings.innerHTML = `<div class="standing-head">${t('win.standings')}</div>` + computeStandings(state).map((s, i) =>
      `<div class="standing-row ${winnerIds(state).includes(s.id) ? 'winner-row' : ''}">
        <span class="standing-rank">#${i + 1}</span>
        <span class="standing-name">${esc(s.name)}</span>
        <span class="standing-stats">${t('win.cards', { n: s.cards })}</span>
      </div>`).join('');
    standings.classList.remove('hidden');
  }

  let extra = document.getElementById('winner-extra');
  if (!extra) {
    extra = document.createElement('div');
    extra.id = 'winner-extra';
    extra.className = 'winner-extra';
    standings.after(extra);
  }
  const awards = matchAwards(state);
  const series = Object.entries(state.series || {}).sort((a, b) => b[1] - a[1]);
  const total = series.reduce((n, [, w]) => n + w, 0);
  // Points race to 500. Before the host has saved this game, add its points in
  // so everyone sees the new totals straight away.
  const gain = roundPoints(state);
  const wNames = winnerNames(state);
  const pts = { ...(state.points || {}) };
  if (!state.seriesDone && gain > 0) for (const n of wNames) pts[n] = (pts[n] || 0) + gain;
  const ptsList = Object.entries(pts).sort((a, b) => b[1] - a[1]);
  const pointsHTML = ptsList.length ? `<div class="win-sec">
      ${state.matchWinner ? `<div class="match-win"><b>${t('win.match', { name: esc(state.matchWinner) })}</b><span>${t('win.matchSub', { n: MATCH_POINTS })}</span></div>` : ''}
      <div class="mode-label">${t('win.points', { n: MATCH_POINTS })}</div>
      ${gain > 0 ? `<div class="points-gain">${esc(wNames.join(' & '))} · ${t('win.gain', { n: gain })}</div>` : ''}
      <div class="points-list">${ptsList.map(([name, p]) =>
        `<div class="points-row ${wNames.includes(name) ? 'lead' : ''}"><span class="points-name">${esc(name)}</span>
          <span class="points-bar"><i style="width:${Math.min(100, p / MATCH_POINTS * 100)}%"></i></span><b>${p}</b></div>`).join('')}</div>
    </div>` : '';
  extra.innerHTML = pointsHTML +
    (awards.length ? `<div class="win-sec"><div class="mode-label">${t('win.awards')}</div><div class="award-list">${awards.map(a =>
      // New look: winner and reason on their own lines so nothing gets cut off
      `<div class="award"><span class="award-icon">${a.icon}</span><span class="award-text"><b>${t('aw.' + a.id)}</b><span class="award-who">${esc(a.name)}</span><span class="award-why">${t('aw.' + a.id + 'Why', { n: a.n })}</span></span></div>`).join('')}</div></div>` : '') +
    (total >= 2 ? `<div class="win-sec"><div class="mode-label">${t('win.series')}</div><div class="series">${series.map(([name, w]) =>
      `<span class="series-item ${wNames.includes(name) ? 'lead' : ''}">${esc(name)} <b>${w}</b></span>`).join('')}</div></div>` : '');

  const gameKey = `${currentRoomId}|${state.winner}|${(state.log || []).at(-1)}`;
  if (_celebrated === gameKey) return;
  _celebrated = gameKey;
  const won = winnerIds(state).includes(localUid);
  FX.play(won ? 'win' : 'lose');
  if (won) FX.buzz([60, 40, 60, 40, 160]);
  confetti(won ? 4200 : 2600, won ? 200 : 90);
  // stats arrive with the last write; wait a moment so the final counts are in
  setTimeout(() => {
    const fresh = recordMyGame(roomState || state, gameKey);
    fresh.forEach((b, i) => setTimeout(() => badgeToast(b), 600 + i * 1600));
    updateStatsLink();
  }, 1200);
}

function badgeToast(b) {
  const el = document.createElement('div');
  el.className = 'badge-toast';
  el.innerHTML = `<span class="bt-icon">${b.icon}</span><span><small>${t('win.newBadge')}</small><b>${t('b.' + b.id)}</b><span>${t('b.' + b.id + 'Why')}</span></span>`;
  document.body.appendChild(el);
  FX.play('truth');
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

function openMyStats() {
  const s = loadMyStats();
  const rate = s.games ? Math.round(100 * s.wins / s.games) + '%' : '—';
  const tile = (k, v) => `<div class="st-tile"><b>${v}</b><span>${t('stats.' + k)}</span></div>`;
  let modal = document.getElementById('stats-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'stats-modal';
    modal.className = 'spotify-modal';
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="spotify-modal-card stats-card">
    <h3 class="spotify-modal-title">🏅 ${t('stats.title')}</h3>
    ${s.games ? '' : `<p class="spotify-modal-desc">${t('stats.none')}</p>`}
    <div class="st-grid">${tile('games', s.games)}${tile('wins', s.wins)}${tile('rate', rate)}${tile('streak', s.best)}
      ${tile('lies', s.lies)}${tile('gotAway', s.gotAway)}${tile('catches', s.catches)}${tile('caught', s.caught)}</div>
    <div class="mode-label" style="align-self:flex-start">${t('stats.badges')} · ${Object.keys(s.badges).length}/${BADGES.length}</div>
    <div class="badge-grid">${BADGES.map(b => `<div class="badge ${s.badges[b.id] ? 'got' : 'locked'}">
      <span class="badge-icon">${b.icon}</span><b>${t('b.' + b.id)}</b><span>${t('b.' + b.id + 'Why')}</span></div>`).join('')}</div>
    <p class="spotify-modal-desc">${t('stats.local')}</p>
    <div class="spotify-modal-btns"><button class="btn btn-primary btn-sm" onclick="document.getElementById('stats-modal').classList.add('hidden')">${t('stats.close')}</button></div>
  </div>`;
  modal.classList.remove('hidden');
}
function updateStatsLink() {
  const el = document.getElementById('stats-link-count');
  if (!el) return;
  const s = loadMyStats();
  el.textContent = s.games ? ` · ${s.wins}/${s.games}` : '';
}

// ============================================================
// Y5 — reconnect grace: countdown on the seat of someone whose connection dropped
// ============================================================

addStrings({
  'rc.label': ['Reconectando…', 'Reconnecting…'],
  'rc.turn':  ['Reconectando… {s} s', 'Reconnecting… {s} s']
});
setInterval(() => {
  const state = roomState;
  if (!state || state.status !== 'playing' || (typeof LOCAL_GAME !== 'undefined' && LOCAL_GAME)) return;
  document.querySelectorAll('.rc-badge').forEach(b => {
    const left = Math.max(0, Math.ceil((RECONNECT_TURN_GRACE - (Date.now() - +b.dataset.since)) / 1000));
    b.textContent = b.dataset.turn === '1' ? t('rc.turn', { s: left }) : t('rc.label');
  });
  checkReconnectGrace(state);
}, 1000);

// ============================================================
// G6 — throw reactions at players
// Tap another player's seat and throw something. Throws go through the Realtime
// Database (rooms/<code>/reactions), are seen by everyone and deleted after a few seconds.
// ============================================================

addStrings({ 'throw.title': ['Lanzar a {name}', 'Throw at {name}'] });
const THROWABLES = ['🍅', '🤥', '🕵️', '👏', '💐', '🤡'];
let _throwPicker = null, _lastThrow = 0, _reactRef = null, _reactRoom = null;

function openThrowPicker(seatEl) {
  closeThrowPicker();
  const pid = seatEl.dataset.uid;
  const p = roomState?.players.find(x => x.id === pid);
  if (!p) return;
  _throwPicker = document.createElement('div');
  _throwPicker.className = 'throw-picker';
  _throwPicker.innerHTML = `<div class="tp-title">${esc(t('throw.title', { name: p.name }))}</div>
    <div class="tp-row">${THROWABLES.map(e => `<button type="button" class="tp-btn" data-emoji="${e}">${e}</button>`).join('')}</div>`;
  document.body.appendChild(_throwPicker);
  const r = seatEl.getBoundingClientRect(), pr = _throwPicker.getBoundingClientRect();
  _throwPicker.style.left = Math.max(8, Math.min(innerWidth - pr.width - 8, r.left + r.width / 2 - pr.width / 2)) + 'px';
  _throwPicker.style.top  = (r.bottom + 8) + 'px';
  _throwPicker.addEventListener('click', e => {
    const b = e.target.closest('.tp-btn');
    if (!b) return;
    sendThrow(pid, b.dataset.emoji);
    closeThrowPicker();
  });
}
function closeThrowPicker() { _throwPicker?.remove(); _throwPicker = null; }
document.addEventListener('click', e => {
  if (_throwPicker && !_throwPicker.contains(e.target)) { closeThrowPicker(); if (!e.target.closest('.opponent')) return; }
  const seat = e.target.closest('#opponents-row .opponent');
  if (!seat || roomState?.status !== 'playing' || (typeof LOCAL_GAME !== 'undefined' && LOCAL_GAME)) return;
  openThrowPicker(seat);
});
function sendThrow(to, emoji) {
  if (!currentRoomId || Date.now() - _lastThrow < 1200) return;
  _lastThrow = Date.now();
  const ref = rtdb.ref(`rooms/${currentRoomId}/reactions`).push();
  ref.set({ from: localUid, to, emoji, t: firebase.database.ServerValue.TIMESTAMP })
    .then(() => setTimeout(() => ref.remove().catch(() => {}), 8000))
    .catch(err => console.warn('[throw]', err));
}
let _serverOffset = 0;
try { rtdb.ref('.info/serverTimeOffset').on('value', s => { _serverOffset = s.val() || 0; }); } catch (_) {}
function listenThrows() {
  if (_reactRoom === currentRoomId) return;
  _reactRef?.off();
  _reactRef = null;
  _reactRoom = currentRoomId;
  if (!currentRoomId) return;
  _reactRef = rtdb.ref(`rooms/${currentRoomId}/reactions`).limitToLast(5);
  _reactRef.on('child_added', snap => {
    const r = snap.val();
    if (!r || Date.now() + _serverOffset - (r.t || 0) > 6000) return;
    showThrow(r.from, r.to, r.emoji);
  });
}
function seatOfThrow(pid) {
  if (pid === localUid) return document.getElementById('player-hand')?.getBoundingClientRect();
  return document.querySelector(`.opponent[data-uid="${CSS.escape(pid)}"]`)?.getBoundingClientRect();
}
function showThrow(from, to, emoji) {
  if (document.hidden || !THROWABLES.includes(emoji)) return;
  const a = seatOfThrow(from) || { left: innerWidth / 2, top: innerHeight, width: 0, height: 0 };
  const b = seatOfThrow(to);
  if (!b) return;
  const el = document.createElement('div');
  el.className = 'fx-icon fx-throw';
  el.textContent = emoji;
  FX.layer().appendChild(el);
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height / 2;
  const land = () => {
    el.remove();
    const splat = emoji === '🍅' ? ['#e53935', '#ff6b6b', '#8b0000'] : emoji === '💐' ? ['#ff8fc7', '#ffd54a', '#7dffb0'] : ['#ffffff', '#ffd54a'];
    FX.burst(b, splat, 12, 50);
    FX.popIcon(b, emoji, 1.8);
    FX.play('pop');
    if (to === localUid) FX.buzz(30);
    FX.shake(to === localUid ? document.getElementById('player-hand') : document.querySelector(`.opponent[data-uid="${CSS.escape(to)}"]`));
  };
  if (!FX.motion()) { land(); return; }
  const mx = (ax + bx) / 2, my = Math.min(ay, by) - 90;
  el.animate([
    { transform: `translate(${ax}px, ${ay}px) translate(-50%,-50%) rotate(0) scale(.8)` },
    { transform: `translate(${mx}px, ${my}px) translate(-50%,-50%) rotate(360deg) scale(1.3)`, offset: .5 },
    { transform: `translate(${bx}px, ${by}px) translate(-50%,-50%) rotate(720deg) scale(1)` }
  ], { duration: 650, easing: 'ease-in-out' }).onfinish = land;
}

// ============================================================
// G1 — "Jugar contra bots": one tap into a game with 3 bots
// G2 — bot level picked by the host
// ============================================================

addStrings({
  'land.bots': ['Jugar contra bots', 'Play against bots'],
  'land.defaultName': ['Jugador', 'Player'],
  'bots.level': ['Nivel de los bots', 'Bot level'],
  'bots.easy': ['Fácil', 'Easy'], 'bots.normal': ['Normal', 'Normal'], 'bots.hard': ['Difícil', 'Hard'],
  'bots.easyDesc':   ['Se olvidan del UNO y casi nunca te acusan.', 'They forget UNO and rarely accuse you.'],
  'bots.normalDesc': ['Mienten y desconfían con algo de suerte.', 'They lie and doubt with a bit of luck.'],
  'bots.hardDesc':   ['Siempre gritan UNO y sospechan cuando tienen la carta que anuncias.', 'They always shout UNO and get suspicious when they hold the card you claim.'],
  'err.generic': ['Algo salió mal. Intenta de nuevo.', 'Something went wrong. Try again.']
});

const waitFor = (test, ms = 8000) => new Promise(res => {
  const t0 = Date.now();
  (function check() { if (test()) return res(true); if (Date.now() - t0 > ms) return res(false); setTimeout(check, 120); })();
});

let _quickBusy = false;
async function handleQuickBots() {
  if (_quickBusy) return;
  const input = document.getElementById('player-name');
  if (!input.value.trim()) input.value = t('land.defaultName');
  _quickBusy = true;
  try {
    await handleCreate();
    if (!currentRoomId) return;
    await waitFor(() => roomState?.players?.length >= 1);
    const bots = [];
    for (let i = 0; i < 3; i++) bots.push(makeBot([...roomState.players, ...bots]));
    await db.collection('rooms').doc(currentRoomId).update({
      players: firebase.firestore.FieldValue.arrayUnion(...bots),
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    });
    await waitFor(() => roomState?.players?.length >= 4);
    await handleStart();
  } catch (e) {
    console.error('quick bots failed', e);
    showLandingError(t('err.generic'));
  } finally { _quickBusy = false; }
}

async function handleSetBotLevel(level) {
  if (!roomState || roomState.status !== 'lobby' || roomState.hostId !== localUid || !BOT_LEVELS[level]) return;
  await db.collection('rooms').doc(currentRoomId).update({ botLevel: level, lastActivity: firebase.firestore.FieldValue.serverTimestamp() });
}

// ============================================================
// G3 — invite link, QR code, WhatsApp
// ============================================================

addStrings({
  'inv.title': ['Invita a tus amigos', 'Invite your friends'], 'inv.copy': ['Copiar enlace', 'Copy link'],
  'inv.copied': ['¡Copiado!', 'Copied!'], 'inv.whatsapp': ['WhatsApp', 'WhatsApp'], 'inv.share': ['Compartir', 'Share'],
  'inv.qr': ['Código QR', 'QR code'], 'inv.qrHelp': ['Escanéalo con la cámara del móvil para entrar.', 'Scan it with a phone camera to join.'],
  'inv.msg': ['¡Juega UNO Mentiroso conmigo! Entra aquí: {url}', 'Play UNO Mentiroso with me! Join here: {url}'],
  'inv.joining': ['Entrando en la sala {code}…', 'Joining room {code}…'],
  'inv.needName': ['Escribe tu nombre y pulsa Unirse para entrar en la sala {code}.', 'Type your name and press Join to enter room {code}.']
});

const inviteURL = () => `${location.origin}${location.pathname}?sala=${currentRoomId}`;
let _qrOpen = false;
function inviteHTML() {
  return `<div class="lobby-row invite">
    <div class="mode-label">${t('inv.title')}</div>
    <div class="invite-btns">
      <button type="button" class="seg-btn" onclick="copyInviteLink(this)">🔗 ${t('inv.copy')}</button>
      <a class="seg-btn inv-wa" href="https://wa.me/?text=${encodeURIComponent(t('inv.msg', { url: inviteURL() }))}" target="_blank" rel="noopener">💬 ${t('inv.whatsapp')}</a>
      ${navigator.share ? `<button type="button" class="seg-btn" onclick="shareInvite()">📤 ${t('inv.share')}</button>` : ''}
      <button type="button" class="seg-btn" onclick="toggleInviteQR()" aria-expanded="${_qrOpen}">▦ ${t('inv.qr')}</button>
    </div>
    <div class="invite-qr ${_qrOpen ? '' : 'hidden'}"><div id="invite-qr-code"></div><p class="mode-desc">${t('inv.qrHelp')}</p></div>
  </div>`;
}
function copyInviteLink(btn) {
  const done = () => { btn.textContent = '✓ ' + t('inv.copied'); setTimeout(() => { btn.textContent = '🔗 ' + t('inv.copy'); }, 1500); };
  navigator.clipboard?.writeText(inviteURL()).then(done, done) ?? done();
}
function shareInvite() { navigator.share?.({ title: 'UNO Mentiroso', url: inviteURL() }).catch(() => {}); }
function toggleInviteQR() { _qrOpen = !_qrOpen; if (roomState) renderLobby(roomState); }
let _qrLib = null;
function drawInviteQR() {
  const box = document.getElementById('invite-qr-code');
  if (!box) return;
  _qrLib = _qrLib || new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  _qrLib.then(() => {
    if (box.dataset.url === inviteURL()) return;
    box.innerHTML = '';
    box.dataset.url = inviteURL();
    new QRCode(box, { text: inviteURL(), width: 172, height: 172, colorDark: '#0b1226', colorLight: '#ffffff' });
  }).catch(() => { _qrLib = null; box.textContent = t('err.generic'); });
}

// Opening a link with ?sala=CODE fills in the code and joins (straight away when we
// already know the player's name from last time)
async function handleInviteParam() {
  const code = new URLSearchParams(location.search).get('sala');
  if (!code) return;
  history.replaceState(null, '', location.pathname);
  if (currentRoomId) return;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  document.getElementById('room-code-input').value = clean;
  document.getElementById('join-form').classList.remove('hidden');
  const name = document.getElementById('player-name');
  if (name.value.trim()) {
    showLandingError(t('inv.joining', { code: clean }));
    await waitFor(() => !!localUid, 6000);
    handleJoin();
  } else {
    showLandingError(t('inv.needName', { code: clean }));
    name.focus();
  }
}
(function rememberName() {
  const input = document.getElementById('player-name');
  try { if (!input.value) input.value = localStorage.getItem('unoName') || ''; } catch (_) {}
  input.addEventListener('change', () => { try { localStorage.setItem('unoName', input.value.trim()); } catch (_) {} });
})();

// ============================================================
// LOBBY EXTRAS (invite, turn timer, bot level)
// ============================================================

function renderLobbyExtras(state, isHost) {
  resetGameExtras();
  let area = document.getElementById('lobby-extras-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'lobby-extras-area';
    area.className = 'lobby-extras-area';
    document.querySelector('.lobby-card').insertBefore(area, document.querySelector('.lobby-actions'));
  }
  const seg = (items, cur, fn) => items.map(([val, label]) => isHost
    ? `<button type="button" class="seg-btn ${val === cur ? 'selected' : ''}" onclick="${fn}(${JSON.stringify(val).replace(/"/g, '&quot;')})">${label}</button>`
    : `<span class="seg-btn ${val === cur ? 'selected' : 'dim'}">${label}</span>`).join('');
  const timer = state.turnTimer || 0;
  const level = state.botLevel || 'normal';
  const hasBots = state.players.some(p => p.isAI);
  area.innerHTML = `${inviteHTML()}
    <div class="lobby-row">
      <div class="mode-label">${t('timer.label')}</div>
      <div class="seg">${seg(TURN_TIMER_OPTIONS.map(s => [s, s ? t('timer.s', { n: s }) : t('timer.off')]), timer, 'handleSetTurnTimer')}</div>
      ${timer ? `<p class="mode-desc">${t('timer.desc')}</p>` : ''}
    </div>
    ${hasBots ? `<div class="lobby-row">
      <div class="mode-label">${t('bots.level')}</div>
      <div class="seg">${seg(['easy', 'normal', 'hard'].map(l => [l, t('bots.' + l)]), level, 'handleSetBotLevel')}</div>
      <p class="mode-desc">${t('bots.' + level + 'Desc')}</p>
    </div>` : ''}`;
  if (_qrOpen) drawInviteQR();
}

applyStaticI18n();
syncMenu();
updateStatsLink();
