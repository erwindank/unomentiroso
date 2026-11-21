// ============================================================
// G7 — Guided first game
//
// A short game on this device only, against "Profe Pillo", with a fixed deck so every
// lesson works:
//   1 play a normal card face up      5 play a normal card
//   2 catch the Profe lying           6 shout ¡UNO!
//   3 bluff with a dark (liar) card   7 play your last card and win
//   4 believe the Profe's true claim
//
// How it runs without the online database: while LOCAL_GAME is on, the room id
// 'TUTORIAL' is answered by a small in-memory stand-in (doc().get/update and
// runTransaction), and every save redraws the game through onRoomUpdate(). The rest
// of the game code is used as it is. Nothing is saved and it doesn't count in stats.
// ============================================================

let LOCAL_GAME = false;
const TUT_ROOM = 'TUTORIAL', TUT_BOT = 'ai-profe', TUT_ME_FALLBACK = 'tut-me';

addStrings({
  'tut.open':  ['🎓 ¿Primera vez? Aprende jugando (2 min)', '🎓 First time? Learn by playing (2 min)'],
  'tut.bot':   ['Profe Pillo', 'Prof. Sly'],
  'tut.step':  ['Paso {n} de 7', 'Step {n} of 7'],
  'tut.skip':  ['Salir del tutorial', 'Leave tutorial'],
  'tut.start': ['Tutorial: aprende a jugar contra el Profe.', 'Tutorial: learn to play against the Prof.'],
  'tut.s1': ['Las cartas de <b>color</b> son normales: se juegan boca arriba si coinciden en color o número con el descarte. Toca el <b>Rojo 5</b>.',
             '<b>Coloured</b> cards are normal: they are played face up if they match the top card\'s colour or number. Tap the <b>Red 5</b>.'],
  'tut.s2': ['El Profe jugó una carta <b>boca abajo</b> y dice que es un Rojo 7… pero tú tienes buen ojo. Pulsa <b>🚨 ¡Mentira!</b>',
             'The Prof played a card <b>face down</b> and says it\'s a Red 7… but you have a good eye. Press <b>🚨 Lie!</b>'],
  'tut.s3': ['¡Lo pillaste! Recupera su carta y roba 1. Ahora te toca mentir a ti: las cartas <b>oscuras</b> se juegan boca abajo. Toca el <b>Azul 8 oscuro</b>, deja el anuncio en <b>Rojo 8</b> y pulsa <b>Jugar carta</b>.',
             'You caught him! He takes his card back and draws 1. Now it\'s your turn to lie: <b>dark</b> cards are played face down. Tap the <b>dark Blue 8</b>, keep the claim as <b>Red 8</b> and press <b>Play card</b>.'],
  'tut.s4': ['El Profe se lo creyó 😏. Ahora dice que jugó un Rojo 2, y esta vez es verdad. Si acusas a alguien sincero, robas tú. Pulsa <b>✓ Lo creo</b>.',
             'The Prof believed you 😏. Now he says he played a Red 2, and this time it\'s true. If you accuse an honest player, you draw. Press <b>✓ I believe it</b>.'],
  'tut.s5': ['Te quedan 2 cartas. Juega el <b>Rojo 9</b>.', 'You have 2 cards left. Play the <b>Red 9</b>.'],
  'tut.s6': ['¡Solo te queda una! Grita <b>¡UNO!</b> antes de que te pillen (si te lo gritan a ti, robas 2).',
             'Only one left! Shout <b>UNO!</b> before someone catches you (if they shout it at you, you draw 2).'],
  'tut.s7': ['Juega tu última carta, el <b>Amarillo 4</b>, y gana.', 'Play your last card, the <b>Yellow 4</b>, and win.'],
  'tut.wait':  ['Turno del Profe… mira lo que hace.', "The Prof's turn… watch what he does."],
  'tut.doneT': ['¡Ganaste tu primera partida!', 'You won your first game!'],
  'tut.done':  ['Ya sabes lo básico: jugar boca arriba, mentir con las cartas oscuras, pillar mentirosos y gritar UNO. El 7 cambia manos, el 0 las pasa a todos y el Comodín abre un desafío. ¡A jugar!',
                'You know the basics: play face up, lie with the dark cards, catch liars and shout UNO. A 7 swaps hands, a 0 passes them around and the Wild starts a challenge. Have fun!'],
  'tut.again': ['Jugar contra bots', 'Play against bots'],
  'tut.home':  ['Volver al inicio', 'Back to start']
});

// ---------- In-memory stand-in for the room document ----------
const LocalRoom = { data: null };
const FV = firebase.firestore.FieldValue;
const tutClone = o => JSON.parse(JSON.stringify(o));

// Applies a Firestore-style update object (dotted paths + FieldValue sentinels)
function localApply(update) {
  const d = LocalRoom.data;
  for (const [key, value] of Object.entries(update)) {
    const path = key.split('.');
    let obj = d;
    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] ??= {};
    const last = path[path.length - 1];
    if (value instanceof FV) {
      const m = value._delegate?._methodName || '';
      if (value.isEqual(FV.delete())) delete obj[last];
      else if (value.isEqual(FV.serverTimestamp())) obj[last] = Date.now();
      else if (m.includes('arrayUnion')) obj[last] = [...new Set([...(obj[last] || []), ...(value._delegate._elements || [])])];
      else if (m.includes('arrayRemove')) obj[last] = (obj[last] || []).filter(x => !(value._delegate._elements || []).includes(x));
      else if (m.includes('increment')) obj[last] = (obj[last] || 0) + (value._delegate._operand || 0);
    } else {
      obj[last] = value === undefined ? null : tutClone(value);
    }
  }
}
let _commitTimer = null;
function localCommit() {
  clearTimeout(_commitTimer);
  _commitTimer = setTimeout(() => {
    if (!LOCAL_GAME || !LocalRoom.data) return;
    roomState = tutClone(LocalRoom.data);
    onRoomUpdate(roomState);
  }, 0);
}
const localRef = {
  id: TUT_ROOM,
  get: async () => ({ exists: !!LocalRoom.data, data: () => tutClone(LocalRoom.data) }),
  update: async (update) => { if (LocalRoom.data && update && typeof update === 'object') { localApply(update); localCommit(); } },
  set: async (data) => { LocalRoom.data = tutClone(data); localCommit(); },
  delete: async () => {},
  onSnapshot: () => () => {}
};
// db.collection(...).doc('TUTORIAL') and db.runTransaction go to the stand-in while
// the tutorial runs; everything else goes to the real database as before
(function installLocalRoom() {
  const realCollection = db.collection.bind(db);
  const realTransaction = db.runTransaction.bind(db);
  db.collection = name => {
    const real = realCollection(name);
    return new Proxy(real, {
      get(target, prop) {
        if (prop === 'doc') return id => (LOCAL_GAME && id === TUT_ROOM) ? localRef : target.doc(id);
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      }
    });
  };
  db.runTransaction = fn => {
    if (!LOCAL_GAME) return realTransaction(fn);
    const tx = {
      get: async ref => ref.get(),
      update: (ref, update) => { if (ref === localRef) localApply(update); return tx; },
      set: (ref, data) => { if (ref === localRef) LocalRoom.data = tutClone(data); return tx; }
    };
    return Promise.resolve(fn(tx)).then(r => { localCommit(); return r; });
  };
})();

// ---------- The lesson ----------
const tc = (color, value, liar) => ({ color, value, liar });
let _tutLieDone = false, _tutHonestDone = false;

function startTutorial() {
  closeRules();
  LOCAL_GAME = true;
  _tutLieDone = false; _tutHonestDone = false;
  if (!localUid) localUid = TUT_ME_FALLBACK;
  const me = localUid;
  const raw = document.getElementById('player-name').value.trim() || t('land.defaultName');
  const myName = selectedEmoji ? `${selectedEmoji} ${raw}` : raw;
  localName = myName;
  currentRoomId = TUT_ROOM;
  const fillers = [tc('green', '1', false), tc('yellow', '6', true), tc('blue', '3', false), tc('green', '9', true), tc('yellow', '2', false)];
  LocalRoom.data = {
    status: 'playing',
    hostId: me,
    players: [
      { id: me, name: myName, cardCount: 4 },
      { id: TUT_BOT, name: `🕵️ ${t('tut.bot')}`, cardCount: 5, isAI: true, persona: 'naive' }
    ],
    currentPlayerIndex: 0,
    direction: 1,
    topColor: 'red', topValue: '3', prevTopColor: 'red', prevTopValue: '3',
    lastPlayerId: null, lastActualCard: null, lastClaimedCard: null, challengeOpen: false,
    hands: {
      [me]:      [tc('red', '5', false), tc('blue', '8', true), tc('red', '9', false), tc('yellow', '4', false)],
      [TUT_BOT]: [tc('blue', '2', true), tc('red', '2', true), tc('red', '4', false), tc('green', '6', false), tc('yellow', '1', false)]
    },
    drawPile: fillers,
    log: [t('tut.start')],
    winner: null, winnerName: null, winnerReason: null, endVotes: [], stats: {}
  };
  document.body.classList.add('tutorial');
  fxPrevState = null;
  roomState = tutClone(LocalRoom.data);
  onRoomUpdate(roomState);
}

// Which lesson we're on, read from the game itself
function tutorialStep(state) {
  const me = localUid;
  if (state.challengeOpen && state.lastPlayerId === TUT_BOT) return state.lastClaimedCard?.value === '7' ? 2 : 4;
  if (getUnoQueue(state.unoCallRequired).some(r => r.playerId === me)) return 6;
  if (isMyTurn(state) && !state.challengeOpen) {
    const n = (state.hands?.[me] || []).length;
    return n === 4 ? 1 : n === 3 ? 3 : n === 2 ? 5 : 7;
  }
  return 0;   // the Profe's turn
}
// The card the lesson wants me to play
function tutorialWantCard(step) {
  return { 1: ['red', '5'], 3: ['blue', '8'], 5: ['red', '9'], 7: ['yellow', '4'] }[step] || null;
}
function tutorialAllowsCard(card) {
  const want = tutorialWantCard(tutorialStep(roomState));
  return !!want && card.color === want[0] && card.value === want[1];
}

function tutorialRender(state) {
  let coach = document.getElementById('coach');
  if (!coach) {
    coach = document.createElement('div');
    coach.id = 'coach';
    coach.className = 'coach';
    document.querySelector('.hand-area')?.before(coach);
  }
  const step = tutorialStep(state);
  const shown = step || (_tutHonestDone ? 5 : _tutLieDone ? 3 : 1);
  coach.innerHTML = `
    <div class="coach-head"><span class="coach-step">${t('tut.step', { n: shown })}</span>
      <button type="button" class="link-btn coach-skip" onclick="endTutorial()">${t('tut.skip')}</button></div>
    <div class="coach-text">${step ? t('tut.s' + step) : t('tut.wait')}</div>`;
  coach.classList.toggle('waiting', !step);
  // only the right button in a vote; point at the right card
  document.body.classList.toggle('tut-only-accuse', step === 2);
  document.body.classList.toggle('tut-only-believe', step === 4);
  const want = tutorialWantCard(step);
  const hand = state.hands?.[localUid] || [];
  document.querySelectorAll('#player-hand .card[data-index]').forEach(el => {
    const c = hand[+el.dataset.index];
    el.classList.toggle('coach-pulse', !!want && !!c && c.color === want[0] && c.value === want[1]);
  });
}

// The Profe follows the script (called instead of the normal bot brain)
function tutorialBotTurn(state) {
  if (state.status !== 'playing') return;
  const bot = state.players.find(p => p.id === TUT_BOT);
  // my face-down card: the Profe always believes it
  if (state.challengeOpen && state.lastPlayerId === localUid) {
    if (!(state.challengeBelieves || []).includes(TUT_BOT)) scheduleAiAction(() => aiExecuteBelieve(roomState, TUT_BOT, bot.name));
    return;
  }
  if (state.challengeOpen) return;                                                   // waiting for my vote
  if (getUnoQueue(state.unoCallRequired).some(r => r.playerId === localUid)) return; // waiting for my UNO
  if (state.players[state.currentPlayerIndex]?.id !== TUT_BOT) return;
  // The move is chosen when it actually runs (scheduleAiAction may skip a call while
  // the bot is still busy), reading the hand at that moment
  scheduleAiAction(async () => {
    const s = roomState;
    if (s?.players[s.currentPlayerIndex]?.id !== TUT_BOT || s.challengeOpen) return;
    const hand = s.hands?.[TUT_BOT] || [];
    const find = (color, value, liar) => hand.findIndex(c => c.color === color && c.value === value && !!c.liar === liar);
    if (!_tutLieDone) {
      const i = find('blue', '2', true);
      _tutLieDone = true;
      await aiDoPlayCard(s, TUT_BOT, bot.name, hand[i], { color: 'red', value: '7' }, i);
    } else if (!_tutHonestDone) {
      const i = find('red', '2', true);
      _tutHonestDone = true;
      await aiDoPlayCard(s, TUT_BOT, bot.name, hand[i], { color: 'red', value: '2' }, i);
    } else {
      const i = find('red', '4', false);
      if (i >= 0) await aiPlayNormalCard(s, TUT_BOT, bot.name, hand[i], i, null);
    }
  });
}

function tutorialOutro() {
  document.getElementById('coach')?.remove();
  let m = document.getElementById('tut-outro');
  if (!m) {
    m = document.createElement('div');
    m.id = 'tut-outro';
    m.className = 'spotify-modal';
    document.body.appendChild(m);
  }
  m.innerHTML = `<div class="spotify-modal-card tut-card">
    <div class="tut-trophy">🏆</div>
    <h3 class="spotify-modal-title">${t('tut.doneT')}</h3>
    <p class="spotify-modal-desc">${t('tut.done')}</p>
    <div class="spotify-modal-btns">
      <button class="btn btn-primary" onclick="endTutorial(); handleQuickBots();">🤖 ${t('tut.again')}</button>
      <button class="btn btn-ghost" onclick="endTutorial()">${t('tut.home')}</button>
    </div>
  </div>`;
  m.classList.remove('hidden');
  try { localStorage.setItem('unoTutorialDone', '1'); } catch (_) {}
  updateTutorialLink();
}

function endTutorial() {
  LOCAL_GAME = false;
  LocalRoom.data = null;
  if (localUid === TUT_ME_FALLBACK) localUid = auth.currentUser?.uid || null;
  _celebrated = null;
  roomState = null;
  currentRoomId = null;
  fxPrevState = null;
  document.body.classList.remove('tutorial', 'tut-only-accuse', 'tut-only-believe');
  document.getElementById('coach')?.remove();
  document.getElementById('tut-outro')?.remove();
  ['uno-call-overlay', 'challenge-area', 'claim-dialog'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  FX.layer().innerHTML = '';
  showScreen('landing');
}

// Start page link: bigger for people who have never played
function updateTutorialLink() {
  const el = document.getElementById('tutorial-link');
  if (!el) return;
  el.innerHTML = t('tut.open');
  let seen = false;
  try { seen = !!localStorage.getItem('unoTutorialDone') || loadMyStats().games > 0; } catch (_) {}
  el.classList.toggle('first-time', !seen);
}
document.addEventListener('langchange', updateTutorialLink);
updateTutorialLink();

// ============================================================
// Y2 — install as an app: register the service worker (sw.js)
// ============================================================
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
