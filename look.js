// ============================================================
// NEW LOOK helpers (LOOK-PLAN.md)
// Loaded last. Only changes how things look and where they sit;
// game rules and Firebase code are untouched.
// ============================================================

// ------------------------------------------------------------
// STEP 4 — seats around the table
// The opponents are drawn by renderOpponents() into #opponents-row,
// which now lives inside the felt. Here each seat gets a spot on the
// top half of the felt's edge: left → top → right, in turn order.
// ------------------------------------------------------------

// Angles in degrees (180 = left side, 90 = top, 0 = right side)
function seatAngles(n) {
  if (n <= 0) return [];
  if (n === 1) return [90];
  if (n === 2) return [145, 35];
  if (n === 3) return [180, 90, 0];
  if (n === 4) return [180, 122, 58, 0];
  // 5 or more: spread evenly along the top half
  return Array.from({ length: n }, (_, i) => 180 - (180 * i) / (n - 1));
}

function layoutSeats() {
  const row = document.getElementById('opponents-row');
  if (!row) return;
  const seats = [...row.querySelectorAll('.opponent')];
  const felt = document.getElementById('felt');
  const tall = felt && felt.clientHeight > felt.clientWidth * 1.05; // phone in portrait
  const crowded = seats.length >= 5;
  row.classList.toggle('crowded', crowded);
  seatAngles(seats.length).forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    // how far from the middle (in % of the felt). Side seats sit on the rail line,
    // the top seat a little inside so its name tag stays on the cloth.
    const rx = tall ? 41 : 44;
    const ry = tall ? 40 : 41;
    const x = 50 + Math.cos(a) * rx;
    // on a tall felt the side seats go up a bit so they don't meet the piles
    const y = 50 - Math.sin(a) * ry - (tall ? 10 : 2);
    seats[i].style.left = x.toFixed(2) + '%';
    seats[i].style.top = y.toFixed(2) + '%';
  });
}

// Re-place the seats whenever the opponents are redrawn or the window changes size
(function watchSeats() {
  const row = document.getElementById('opponents-row');
  if (!row) return;
  new MutationObserver(layoutSeats).observe(row, { childList: true });
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(layoutSeats, 80); });
})();

// ------------------------------------------------------------
// STEP 5 — bot accessories + turn ring
// Bots keep their mood faces (extras.js) and get a drawn accessory on
// top, so you can tell them apart at a glance. Same 40×40 grid as the face.
// ------------------------------------------------------------
const BOT_ACCESSORY = {
  // Pinocho: long wooden nose + little red cap
  liar: `<path d="M21 21.5 L37 19.5 L37.4 22 L21 24 Z" fill="#d98f52" stroke="#7a4a22" stroke-width=".6"/>
         <path d="M6 11 Q20 -5 34 11 Q20 6 6 11Z" fill="#d23a2a"/><circle cx="34" cy="10" r="2.2" fill="#ffd34a"/>`,
  // Sherlock: hunting cap + pipe
  sherlock: `<path d="M4 13 Q20 -4 36 13 Q20 8 4 13Z" fill="#8a6a3e"/><path d="M11 6.5 L29 6.5" stroke="#5b4426" stroke-width="1.6"/>
             <path d="M27 29 q5 1 8 -2 l2.6 0 l-.8 5 l-4.2 0 q-3 1 -5.6 -1z" fill="#4a2f1a"/>`,
  // El Tahúr: top hat with a red band + moustache
  shark: `<rect x="11" y="-6" width="18" height="15" rx="1.5" fill="#16121a"/><rect x="6" y="7.5" width="28" height="3.5" rx="1.75" fill="#16121a"/>
          <rect x="11" y="4.5" width="18" height="2.6" fill="#c33"/>
          <path d="M13 26.5 q3.5 -3.5 7 0 q3.5 -3.5 7 0 q-3.5 1.8 -7 -.8 q-3.5 2.6 -7 .8z" fill="#2a1a12"/>`,
  // El Honesto: golden halo
  honest: `<ellipse cx="20" cy="1.5" rx="10" ry="3" fill="none" stroke="#ffd54a" stroke-width="2.2"/>`,
  // Doña Confiada: pink bow
  naive: `<path d="M26 4 l7 -4 l0 9z M26 4 l-7 -4 l0 9z" fill="#ff7fb0" stroke="#b03a6a" stroke-width=".7"/><circle cx="26" cy="4.5" r="2" fill="#ff4f93"/>`
};

function decorateSeats() {
  const players = (typeof roomState !== 'undefined' && roomState?.players) || [];
  document.querySelectorAll('#opponents-row .opponent[data-uid]').forEach(seat => {
    const p = players.find(x => x.id === seat.dataset.uid);
    const wrap = seat.querySelector('.seat-face-wrap');
    if (!wrap || !p?.isAI || !BOT_ACCESSORY[p.persona] || wrap.querySelector('.seat-acc')) return;
    wrap.insertAdjacentHTML('beforeend',
      `<svg class="seat-acc acc-${p.persona}" viewBox="0 0 40 40" aria-hidden="true">${BOT_ACCESSORY[p.persona]}</svg>`);
  });
  updateTurnRing();
}

// Gold ring on the current player's face. With a turn timer on (lobby setting)
// it empties as time runs out; without one (and for bots) it circles slowly.
function updateTurnRing() {
  const wrap = document.querySelector('#opponents-row .opponent.active-player .seat-face-wrap');
  if (!wrap) return;
  const state = typeof roomState !== 'undefined' ? roomState : null;
  const left = state && typeof timeLeft === 'function' ? timeLeft(state) : null;
  const total = (state?.turnTimer || 0) * 1000;
  const timed = left !== null && total > 0;
  wrap.classList.toggle('ring-timed', timed);
  if (timed) wrap.style.setProperty('--left', Math.max(0, Math.min(1, left / total)).toFixed(3));
}

(function watchSeatLooks() {
  const row = document.getElementById('opponents-row');
  if (!row) return;
  new MutationObserver(decorateSeats).observe(row, { childList: true });
  setInterval(lookTick, 250);
})();

// Small things checked a few times a second: the turn ring and whether this is
// a game against bots only (then the room code is hidden — nobody needs it).
function lookTick() {
  updateTurnRing();
  checkDeal();
  const players = (typeof roomState !== 'undefined' && roomState?.players) || [];
  const botGame = players.length > 1 && players.every(p => p.id === localUid || p.isAI);
  document.body.classList.toggle('bot-game', botGame);
}

// ------------------------------------------------------------
// STEP 8 — deal animation at the start of a game
// fx.js already flies cards for plays, claims and draws. This adds the deal:
// when a game has just started (log has only the opening line), backs fly
// from the deck to every seat, round by round, and your cards appear one by one.
// Skipped in calm mode and when you rejoin a game that's already going.
// ------------------------------------------------------------
let _dealKey = null;      // which game start we already dealt for
let _dealing = false;

function checkDeal() {
  const state = typeof roomState !== 'undefined' ? roomState : null;
  if (!state || state.status !== 'playing') { if (state && state.status !== 'playing') _dealKey = null; return; }
  if (_dealing || (state.log || []).length > 1) return;
  const key = `${typeof currentRoomId !== 'undefined' ? currentRoomId : ''}|${state.players.map(p => p.id).join(',')}`;
  if (_dealKey === key) return;
  _dealKey = key;
  if (typeof FX !== 'undefined' && FX.motion && !FX.motion()) return;
  dealAnimation(state);
}

function flyBack(from, to, w, dur) {
  return new Promise(res => {
    if (!from || !to) return res();
    const el = document.createElement('div');
    el.className = 'card-back deal-fly';
    el.innerHTML = CARD_BACK_INNER;
    el.style.width = w + 'px';
    el.style.height = (w * 1.5) + 'px';
    document.body.appendChild(el);
    const sx = from.left + from.width / 2 - w / 2, sy = from.top + from.height / 2 - w * .75;
    const ex = to.left + to.width / 2 - w / 2,     ey = to.top + to.height / 2 - w * .75;
    el.style.left = sx + 'px'; el.style.top = sy + 'px';
    const a = el.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${ex - sx}px, ${ey - sy}px) rotate(${(Math.random() * 30 - 15).toFixed(0)}deg)`, opacity: .9 }
    ], { duration: dur, easing: 'cubic-bezier(.3,.7,.2,1)' });
    a.onfinish = () => { el.remove(); res(); };
  });
}

async function dealAnimation(state) {
  _dealing = true;
  const hand = document.getElementById('player-hand');
  // hide my cards and reveal them one at a time as they "arrive"
  let style = document.getElementById('deal-style');
  if (!style) { style = document.createElement('style'); style.id = 'deal-style'; document.head.appendChild(style); }
  const hideFrom = k => { style.textContent = `#player-hand .card:nth-child(n+${k + 1}) { opacity: 0 !important; }`; };
  hideFrom(0);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(120);
  const deck = () => document.querySelector('#draw-pile-area .card-back')?.getBoundingClientRect();
  const myCount = (state.hands?.[localUid] || []).length || 7;
  try {
    for (let r = 0; r < myCount; r++) {
      document.querySelectorAll('#opponents-row .opponent .seat-face-wrap').forEach((face, i) => {
        setTimeout(() => flyBack(deck(), face.getBoundingClientRect(), 30, 300), i * 50);
      });
      if (typeof FX !== 'undefined' && r % 2 === 0) FX.play?.('draw');
      const hr = hand.getBoundingClientRect();
      await flyBack(deck(), { left: hr.left + hr.width / 2, top: hr.top + hr.height / 2, width: 0, height: 0 }, 54, 300);
      hideFrom(r + 1);
    }
  } finally {
    style.textContent = '';
    _dealing = false;
  }
}

// ------------------------------------------------------------
// STEP 9 — start page: tagline string + the fan of cards at the bottom
// ------------------------------------------------------------
if (typeof addStrings === 'function') addStrings({ 'look.trust': ['No te fíes de nadie', 'Trust no one'] });

(function landingFan() {
  const fan = document.getElementById('land-fan');
  if (!fan || typeof buildCardHTML !== 'function') return;
  const cards = [
    { color: 'blue', value: '7', liar: false },
    { color: 'yellow', value: 'draw2', liar: true },
    { color: 'black', value: 'wild', liar: false },
    { color: 'red', value: '5', liar: true },
    { color: 'green', value: 'reverse', liar: true }
  ];
  fan.innerHTML = cards.map((c, i) => {
    const t = i / (cards.length - 1) - .5;          // -0.5 … 0.5
    return buildCardHTML(c, `--r:${(t * 50).toFixed(1)}deg;--x:${(t * 150).toFixed(0)}px`);
  }).join('');
})();
