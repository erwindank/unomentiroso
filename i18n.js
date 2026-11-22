// ============================================================
// I18N — Spanish / English text (idea Y6)
//
// t('key', { name: 'Ana' }) returns the text in the chosen language, with {name}
// replaced. Missing English keys fall back to Spanish, missing keys show the key.
// Loaded before every other script so all of them can use t().
// ============================================================

const I18N = { es: {}, en: {} };

// The chosen language: saved per device, Spanish by default
let LANG = (() => {
  try { return localStorage.getItem('unoLang') === 'en' ? 'en' : 'es'; } catch (_) { return 'es'; }
})();
try { document.documentElement.lang = LANG; } catch (_) {}

function t(key, params) {
  let s = I18N[LANG]?.[key] ?? I18N.es[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
  return s;
}

// Adds a block of strings: addStrings({ key: ['español', 'English'], ... })
function addStrings(map) {
  for (const [k, [es, en]] of Object.entries(map)) {
    I18N.es[k] = es;
    I18N.en[k] = en ?? es;
  }
}

// English only: for fixed text in index.html, whose Spanish is written in the page
function addEnglish(map) { Object.assign(I18N.en, map); }

// Switches language, saves it, and tells the page to redraw ('langchange' event)
function setLanguage(lang) {
  LANG = lang === 'en' ? 'en' : 'es';
  try { localStorage.setItem('unoLang', LANG); } catch (_) {}
  document.documentElement.lang = LANG;
  applyStaticI18n();
  document.dispatchEvent(new Event('langchange'));
}

// Fixed text in index.html: elements with data-i18n="key" (text) or
// data-i18n-ph="key" (placeholder) / data-i18n-title="key" (tooltip).
// The Spanish text written in the HTML is kept as the fallback.
function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.dataset.i18nEs === undefined) el.dataset.i18nEs = el.innerHTML;
    const k = el.dataset.i18n;
    el.innerHTML = (LANG === 'es' || !I18N.en[k]) ? (I18N.es[k] ?? el.dataset.i18nEs) : I18N.en[k];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    if (el.dataset.i18nPhEs === undefined) el.dataset.i18nPhEs = el.placeholder;
    el.placeholder = I18N[LANG][el.dataset.i18nPh] ?? el.dataset.i18nPhEs;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    if (el.dataset.i18nTitleEs === undefined) el.dataset.i18nTitleEs = el.title;
    el.title = I18N[LANG][el.dataset.i18nTitle] ?? el.dataset.i18nTitleEs;
  });
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('selected', b.dataset.lang === LANG));
}

// A colour's name on screen (the saved log keeps Spanish names: see translateLog)
const colorLabel = c => t('color.' + c);

// ---- Game words (app.js) ----
addStrings({
  'card.wildTo':  ['{w} y cambia el color a {c}', '{w} and changes the colour to {c}'],
  'card.wild4To': ['{w} <b>+4</b> y cambia el color a {c}', '{w} <b>+4</b> and changes the colour to {c}'],
  'ui.copy': ['Copiar', 'Copy'], 'ui.copied': ['¡Copiado!', 'Copied!'], 'ui.cancel': ['Cancelar', 'Cancel'],
  'ui.close': ['Cerrar', 'Close'], 'ui.retry': ['Reintentar', 'Try again'], 'ui.disconnect': ['Desconectar', 'Disconnect'],
  'ui.someone': ['Alguien', 'Someone'], 'chat.me': ['(yo)', '(me)'],
  'err.name': ['Escribe tu nombre primero', 'Type your name first'],
  'err.connecting': ['Aún conectando… intenta de nuevo', 'Still connecting… try again'],
  'err.code': ['Introduce el código de sala de 6 caracteres', 'Enter the 6-character room code'],
  'err.notFound': ['Sala no encontrada', 'Room not found'],
  'err.ended': ['La partida ya terminó', 'That game has already ended'],
  'err.started': ['La partida ya comenzó', 'That game has already started'],
  'err.full': ['Sala llena (máximo {n})', 'Room full (max {n})'],
  'lob.removeBot': ['Eliminar bot', 'Remove bot'], 'lob.back': ['vuelve', 'back'], 'lob.readyBadge': ['✓ listo', '✓ ready'],
  'lob.dc': ['desconectado', 'disconnected'], 'lob.ready': ['✓ Estás listo para jugar', "✓ You're ready to play"],
  'lob.again': ['¡Quiero jugar de nuevo!', 'I want to play again!'], 'lob.start': ['Iniciar partida', 'Start game'],
  'lob.waitingPlayers': ['Esperando jugadores…', 'Waiting for players…'], 'lob.addBot': ['+ Agregar Bot 🤖', '+ Add bot 🤖'],
  'vc.title': ['Chat de voz', 'Voice chat'], 'vc.opened': ['{name} abrió el micrófono', '{name} turned their mic on'],
  'vc.left': ['{name} dejó el chat de voz', '{name} left voice chat'], 'vc.muted': ['{name} silenció el micrófono', '{name} muted their mic'],
  'vc.unmuted': ['{name} activó el micrófono', '{name} unmuted their mic'], 'vc.noMic': ['No se pudo acceder al micrófono', 'Could not use the microphone'],
  'vc.join': ['Unirse al chat de voz', 'Join voice chat'], 'vc.mute': ['Silenciar micrófono', 'Mute microphone'], 'vc.leave': ['Salir del chat de voz', 'Leave voice chat'],
  'uno.mine': ['¡Solo te queda 1 carta!', 'You only have 1 card left!'], 'uno.shout': ['¡GRITA UNO!', 'SHOUT UNO!'],
  'uno.other': ['¡{name} tiene 1 carta!', '{name} has 1 card!'], 'uno.callOn': ['Gritarle UNO a {name}', 'Call UNO on {name}'],
  'st.played': ['{name} jugó — dice {card}', '{name} played — says {card}'],
  'st.yourTurn': ['✨ ¡Tu turno! Elige una carta.', '✨ Your turn! Pick a card.'],
  'st.turnOf': ['Turno de {name}', "{name}'s turn"],
  'ch.believe1': ['{names} lo cree', '{names} believes it'], 'ch.believeN': ['{names} lo creen', '{names} believe it'],
  'ch.waiting': ['Esperando: {names}', 'Waiting for: {names}'],
  'ch.question': ['{name} dice que jugó {card}. ¿Lo crees?', '{name} says they played {card}. Do you believe it?'],
  'hand.drawnOk': ['¡Carta robada jugable! Juega cualquier carta válida o pasa.', 'The card you drew can be played! Play any valid card or pass.'],
  'hand.drawnNo': ['Carta robada no jugable. Juega una carta válida o pasa.', "The card you drew can't be played. Play a valid card or pass."],
  'hand.pick': ['Tu turno — haz clic en una carta para jugar', 'Your turn — tap a card to play it'],
  'hand.count': ['Tu mano ({n})', 'Your hand ({n})'],
  'toi.you': ['tu turno', 'your turn'], 'toi.prev': ['anterior', 'previous'], 'toi.next': ['siguiente', 'next'],
  'nt.on': ['🔔 Notificaciones activadas', '🔔 Notifications on'], 'nt.onBody': ['Recibirás avisos del juego.', "You'll get game alerts."],
  'nt.disable': ['Desactivar notificaciones', 'Turn off notifications'], 'nt.enable': ['Activar notificaciones', 'Turn on notifications'],
  'nt.started': ['¡La partida comenzó!', 'The game has started!'], 'nt.first': ['{name} va primero.', '{name} goes first.'],
  'nt.won': ['🏆 ¡Ganaste!', '🏆 You won!'], 'nt.over': ['🃏 Partida terminada', '🃏 Game over'],
  'nt.congrats': ['¡Felicidades!', 'Congratulations!'], 'nt.whoWon': ['Ganó {name}', '{name} won'],
  'nt.yourTurn': ['¡Es tu turno!', "It's your turn!"], 'nt.yourTurnBody': ['Elige una carta para jugar.', 'Pick a card to play.'],
  'nt.played': ['{name} jugó una carta', '{name} played a card'], 'nt.claim': ['Dice que jugó {card}. ¿Lo crees?', 'They say it\'s {card}. Do you believe it?'],
  'nt.uno': ['¡Solo te queda 1 carta! Grita UNO antes de que alguien te atrape.', 'Only 1 card left! Shout UNO before someone catches you.'],
  'mu.mute': ['Silenciar música', 'Mute music'], 'mu.play': ['Activar música', 'Play music'],
  'claim.wildTitle': ['Elige el color del Comodín', 'Pick the Wild colour'], 'claim.title': ['Declara esta carta como…', 'Declare this card as…'],
  'wc.noWildTitle': ['Sin comodines aquí', 'No wilds here'], 'wc.noWild': ['No puedes usar un comodín en esta actividad.', "You can't use a wild card in this challenge."],
  'wc.played': ['{name} jugó {w}', '{name} played a {w}'], 'wc.putOne': ['¡Pon una carta — color {c}!', 'Put down a card — colour {c}!'],
  'wc.tapOne': ['Toca una carta de tu mano (¿no tienes ese color? ¡Miente!)', 'Tap a card from your hand (no card of that colour? Bluff!)'],
  'wc.who': ['¿Quién tiene {c}?', 'Who has {c}?'], 'wc.accuse': ['Acusar a {name}', 'Accuse {name}'],
  'wc.accusing': ['{name} está acusando…', '{name} is accusing…'], 'wc.had': ['¡{name} tenía {c}!', '{name} had {c}!'],
  'wc.discard': ['Descartar y seguir', 'Discard and continue'], 'wc.waitingFor': ['Esperando a {name}…', 'Waiting for {name}…'],
  'wc.pickFinal': ['El {w} se queda en {c}', 'The {w} stays {c}'], 'wc.picking': ['El Comodín se queda en {c}…', 'The Wild stays {c}…'],
  'wc.finish': ['Seguir jugando', 'Keep playing'],
  'draw.ok': ['Sí, robar', 'Yes, draw'],
  'draw.t1': ['Tienes cartas jugables', 'You have playable cards'],
  'draw.m1': ['Tienes cartas que puedes jugar en este turno. ¿Quieres robar de todas formas?', 'You have cards you can play this turn. Draw anyway?'],
  'draw.t2': ['¡Tienes cartas jugables!', 'You have playable cards!'],
  'draw.m2': ['Tienes cartas de mentira que coinciden con el descarte y puedes jugarlas. ¿Seguro que quieres robar de todas formas?', 'You have liar cards that match the top card and you can play them. Are you sure you want to draw?'],
  'draw.t3': ['Solo tienes cartas de mentira', 'You only have liar cards'],
  'draw.m3': ['No tienes cartas jugables honestamente, pero puedes jugar una carta de mentira. ¿Quieres robar de todas formas?', "You can't play honestly, but you could play a liar card. Draw anyway?"],
  'g.leaveQ': ['¿Seguro que quieres salir?', 'Are you sure you want to leave?'],
  'g.leaveBody': ['Si sales ahora no podrás ver la puntuación final ni serás incluido en el marcador. Si quieres terminar la partida y ver los resultados, vota para finalizar.', "If you leave now you won't see the final score or be counted in it. To end the game and see the results, vote to end instead."],
  'g.leave': ['Salir', 'Leave'], 'g.stay': ['Quedarme', 'Stay'], 'g.voteEnd': ['Votar Terminar', 'Vote to end'],
  'g.votes': ['{n}/{t} quieren terminar', '{n}/{t} want to end'], 'g.withdraw': ['Retirar voto', 'Withdraw vote'], 'g.end': ['Terminar', 'End game'],
  'w.vote': ['🤝 ¡Partida terminada!', '🤝 Game over!'], 'w.byPoints': ['{name} ganó con menos puntos', '{name} won with the fewest points'],
  'w.byCards': ['{name} ganó con menos cartas', '{name} won with the fewest cards'], 'w.last': ['🏆 ¡Último en pie!', '🏆 Last one standing!'],
  'w.winner': ['🎉 ¡Ganador!', '🎉 Winner!'], 'w.shared': ['🤝 ¡Victoria compartida!', '🤝 Shared win!'],
  'sp.cancel': ['Cancelaste la conexión con Spotify.', 'You cancelled the Spotify connection.'],
  'sp.session': ['Error de sesión Spotify. Intenta de nuevo.', 'Spotify session error. Try again.'],
  'sp.fetch': ['No se pudo contactar Spotify. Revisa tu conexión.', "Couldn't reach Spotify. Check your connection."],
  'sp.other': ['Error de Spotify: {e}', 'Spotify error: {e}'], 'sp.nothing': ['Sin reproducción activa ahora mismo.', 'Nothing playing right now.'],
  'sp.connected': ['Conectado a Spotify', 'Connected to Spotify'], 'sp.on': ['Spotify conectado', 'Spotify connected'],
  'sp.connectTitle': ['Conectar Spotify', 'Connect Spotify'],
  'sp.desc': ['Comparte lo que estás escuchando con los demás jugadores. Aparecerá en la barra superior.', "Share what you're listening to with the other players. It shows in the top bar."],
  'sp.connectBtn': ['Conectar cuenta', 'Connect account'], 'sp.errTitle': ['Error de Spotify', 'Spotify error'],
  'lf.notFound': ['Usuario no encontrado en Last.fm.', 'User not found on Last.fm.'], 'lf.netError': ['Error de conexión. Intenta de nuevo.', 'Connection error. Try again.'],
  'lf.now': ['Escuchando ahora', 'Listening now'], 'lf.last': ['Última escuchada', 'Last played'], 'lf.none': ['Sin historial de Last.fm.', 'No Last.fm history.'],
  'lf.as': ['Conectado como {name}', 'Connected as {name}'], 'lf.connectTitle': ['Conectar Last.fm', 'Connect Last.fm'],
  'lf.desc': ['Introduce tu usuario de Last.fm para compartir lo que escuchas (funciona con Spotify, Apple Music, Tidal y más).', 'Enter your Last.fm username to share what you listen to (works with Spotify, Apple Music, Tidal and more).'],
  'lf.placeholder': ['Tu usuario de Last.fm', 'Your Last.fm username'], 'lf.connect': ['Conectar', 'Connect']
});

// ---- Game log in English ----
// Log lines are saved in Spanish by everyone (so all players can read the same log);
// with English on they're translated as they're shown. Most specific patterns first.
const LOG_EN = [
  [/^(.+) se reconectó\.$/, '$1 reconnected.'],
  [/^(.+) se desconectó\.$/, '$1 disconnected.'],
  [/^Se saltó el turno de (.+) \(desconectado\)\.$/, "$1's turn was skipped (disconnected)."],
  [/^Partida terminada por acuerdo\. ¡(.+) gana!$/, 'Game ended by agreement. $1 wins!'],
  [/^¡Partida iniciada! (.+) va primero\.$/, 'Game started! $1 goes first.'],
  [/^(.+) grita ¡UNO! 🎴$/, '$1 shouts UNO! 🎴'],
  [/^(.+) dice ¡UNO! 🎴$/, '$1 says UNO! 🎴'],
  [/^🚨 (.+) le gritó UNO a (.+)\. (.+) roba 2 cartas\.$/, '🚨 $1 called UNO on $2. $3 draws 2 cards.'],
  [/^🚨 (.+) atrapó a (.+) con una carta\. (.+) roba 2 cartas\.$/, '🚨 $1 caught $2 with one card. $3 draws 2 cards.'],
  [/^(.+) intenta atrapar UNO pero no hay nadie con una carta\.$/, '$1 tries to call UNO but nobody has one card.'],
  [/^(.+) jugó Comodín y elige (.+)\. ¡Todos ponen una carta boca abajo!$/, '$1 played a Wild and picks $2. Everyone puts a card face down!'],
  [/^(.+) jugó una carta boca abajo y dijo (.+)\.$/, '$1 played a card face down and said $2.'],
  [/^(.+) jugó (.+) boca arriba\.$/, '$1 played $2 face up.'],
  [/^(.+) eligió el color (.+)\.$/, '$1 chose $2.'],
  [/^Todos pasan su mano en la dirección actual\.$/, 'Everyone passes their hand in the current direction.'],
  [/^🚨 ¡(.+) descubrió a (.+)! Mintió \(era (.+)\)\. (.+) recuperó la carta y robó (\d+) más\.$/, '🚨 $1 caught $2! They lied (it was $3). $4 took the card back and drew $5 more.'],
  [/^✓ (.+) acusó a (.+), pero (.+) dijo la Verdad \((.+)\)\. (.+) roba 1\.$/, '✓ $1 accused $2, but $3 told the Truth ($4). $5 draws 1.'],
  [/^(.+) roba (\d+) y pierde su turno\.$/, '$1 draws $2 and loses their turn.'],
  [/^(.+) roba (\d+) \(penalización\)\.$/, '$1 draws $2 (penalty).'],
  [/^(.+) robó (\d+) tras el intercambio\.$/, '$1 drew $2 after the swap.'],
  [/^(.+) robará 1 tras el intercambio de manos\.$/, '$1 will draw 1 after the hand swap.'],
  [/^(.+) roba (\d+)\.$/, '$1 draws $2.'],
  [/^(.+) confía en (.+)\.$/, '$1 trusts $2.'],
  [/^(.+) elige con quién intercambiar manos\.$/, '$1 picks who to swap hands with.'],
  [/^(.+) pierde su turno \(reverse\)\.$/, '$1 loses their turn (reverse).'],
  [/^(.+) pierde su turno\.$/, '$1 loses their turn.'],
  [/^¡Dirección invertida!$/, 'Direction reversed!'],
  [/^(.+) robó una carta y pasó\.$/, '$1 drew a card and passed.'],
  [/^(.+) pasó su turno\.$/, '$1 passed their turn.'],
  [/^(.+) intercambió manos con (.+)\.$/, '$1 swapped hands with $2.'],
  [/^Todos pusieron su carta\. ¡(.+) elige a quién acusar!$/, 'Everyone put a card down. $1 picks who to accuse!'],
  [/^(.+) acusa a (.+) - ¡Mintió! No tiene (.+)\. Devuelve la carta a su mano y roba 1\.$/, "$1 accuses $2 — they lied! They don't have $3. The card goes back to their hand and they draw 1."],
  [/^✅ (.+) acusa a (.+) — ¡sí tenía (.+)! Actividad terminada\.(.*)$/, '✅ $1 accuses $2 — they did have $3! Challenge over.$4'],
  [/^Las cartas restantes son descartadas\.$/, 'The remaining cards are discarded.'],
  [/^(.+) elige el color final: (.+)\.$/, '$1 picks the final colour: $2.'],   // older saved logs
  [/^El Comodín se queda en (.+)\.$/, 'The Wild stays $1.'],
  [/^(.+) salió de la partida\.$/, '$1 left the game.'],
  [/^¡(.+) gana por ser el último jugador!$/, '$1 wins as the last player left!'],
  [/^(.+) retiró su voto para terminar\.$/, '$1 withdrew their vote to end.'],
  [/^(.+) propone terminar \((\d+)\/(\d+)\)\.$/, '$1 wants to end the game ($2/$3).'],
  [/^⏰ (.+) se quedó sin tiempo: robó una carta y pasó\.$/, '⏰ $1 ran out of time: drew a card and passed.']
];
// Card words inside a line (after the sentence itself was translated)
const LOG_WORDS_EN = [
  [/Comodín \+4 y cambia el color a /g, 'Wild +4 and changes the colour to '],
  [/Comodín y cambia el color a /g, 'Wild and changes the colour to '],
  [/ Cartas descartadas — /g, ' Discarded cards — '],
  [/Comodín/g, 'Wild'],
  [/(?<!\p{L})Rojo(?!\p{L})/gu, 'Red'], [/(?<!\p{L})Amarillo(?!\p{L})/gu, 'Yellow'],
  [/(?<!\p{L})Verde(?!\p{L})/gu, 'Green'], [/(?<!\p{L})Azul(?!\p{L})/gu, 'Blue']
];
function translateLog(msg) {
  if (LANG !== 'en' || typeof msg !== 'string') return msg;
  let out = msg;
  for (const [re, rep] of LOG_EN) { if (re.test(out)) { out = out.replace(re, rep); break; } }
  for (const [re, rep] of LOG_WORDS_EN) out = out.replace(re, rep);
  return out;
}

// ---- Fixed text in index.html (its Spanish is written in the page) ----
addEnglish({
  'land.tagline':  'Play cards. Tell lies. Catch the liar!',
  'land.howTitle': 'How to play',
  'land.how1':     'There are two kinds of cards: <strong>Normal</strong> (played face up, no lying) and <strong>Liar</strong> (played face down, and you announce which card it is — you may lie). Liar cards include the action cards and some numbers.',
  'land.how2':     'If someone thinks you\'re lying, they can shout <strong>Liar!</strong> before the next turn. If you lied: you take the card back and draw 1. If you told the truth: the accuser draws 1.',
  'land.how3':     'A <strong>7</strong> swaps your hand with another player\'s. A <strong>0</strong> makes everyone pass their hand in the current direction. When you have one card left, shout <strong>UNO!</strong>',
  'land.allRules': 'See all the rules →',
  'land.emoji':    'Pick an emoji',
  'land.name':     'Your name',
  'land.create':   'Create room',
  'land.joinCode': 'Join with a code',
  'land.codePh':   'Room code (e.g. XK7M2P)',
  'land.join':     'Join',
  'land.players':  'Up to 10 players · No account needed',
  'lob.title':     'Waiting room',
  'lob.code':      'Code:',
  'lob.waitHost':  'Waiting for the host…',
  'lob.leave':     'Leave room',
  'lob.share':     'Share the code with friends so they can join',
  'g.copyCode':    'Copy code',
  'g.rules':       'Rules',
  'g.chat':        'Chat',
  'g.drawPile':    'Draw',
  'g.discardPile': 'Discard',
  'g.pass':        'Pass turn',
  'g.lie':         '🚨 Liar!',
  'g.believe':     '✓ I believe it',
  'g.sevenTitle':  '7 — Pick who to swap hands with',
  'g.playCard':    'Play card',
  'w.again':       'Play again',
  'w.other':       'Join another room',
  'chat.ph':       'Message…',
  'mp.title':      'Background music?',
  'mp.desc':       'Adds some atmosphere to the game',
  'mp.yes':        'Yes, with music',
  'mp.no':         'No music',
  'rules.title':   '📖 UNO Mentiroso rules',
  'rules.goalT':   'Goal',
  'rules.goal':    'Be the first to run out of cards. Each card you play must match the top card\'s <strong>colour</strong> or <strong>number/symbol</strong> (or be a wild).',
  'rules.typesT':  'Two kinds of card',
  'rules.normal':  '<strong>Normal</strong> (coloured background): played face up. You can\'t lie with them.',
  'rules.liar':    '<strong>Liar</strong> (dark background): played face down and you announce which card it is. Tell the truth… or lie.',
  'rules.challengeT': 'Do you believe it?',
  'rules.challenge': 'After a face-down card, everyone else votes <strong>✓ I believe it</strong> or shouts <strong>🚨 Liar!</strong>. If they lied: they take the card back and draw 1. If it was true: the accuser draws 1 and the card counts.',
  'rules.specialT': 'Special cards',
  'rules.s7':      '<strong>7</strong>: swap your hand with another player\'s.',
  'rules.s0':      '<strong>0</strong>: everyone passes their hand in the direction of play.',
  'rules.sAct':    '<strong>⊘</strong> skip, <strong>⇄</strong> reverse, <strong>+2</strong> the next player draws 2.',
  'rules.sWild':   '<strong>Wild</strong>: always face up; starts the wild card challenge and a colour is picked. <strong>Wild +4</strong>: the next player draws 4.',
  'rules.unoT':    'UNO!',
  'rules.uno':     'When you have one card left, shout <strong>UNO!</strong>. If someone calls it on you first, you draw 2.',
  'rules.drawT':   'Drawing',
  'rules.draw':    'If you don\'t play, draw 1 card. You may play that card straight away if it fits; otherwise your turn ends. When the draw pile runs out, the played cards are shuffled into a new one.',
  'rules.scoreT':  'Points',
  'rules.score':   'The winner scores the cards left in everyone else\'s hand: numbers at face value, <strong>⊘ ⇄ +2</strong> 20, wilds 50. First to <strong>500 points</strong> wins the match. If several players run out of cards at once, they share the win.',
  'rules.hereT':   'How to play here',
  'rules.here':    'On your turn each card has a mark: <strong>✓</strong> you can play it truthfully, <strong>🎭</strong> only by lying, <strong>✕</strong> not at all. Hold a card to see it bigger. Tap another player to throw something at them.',
  'rules.ok':      'Got it'
});

// ---- Effects / spotlight captions (fx.js) ----
addStrings({
  'color.red':    ['Rojo', 'Red'],
  'color.yellow': ['Amarillo', 'Yellow'],
  'color.green':  ['Verde', 'Green'],
  'color.blue':   ['Azul', 'Blue'],
  'color.black':  ['Comodín', 'Wild'],
  'card.wild':    ['Comodín', 'Wild'],
  'card.wild4':   ['Comodín +4', 'Wild +4'],

  'fx.says':      ['¡{name} dice!', '{name} says!'],
  'fx.played':    ['{name} juega', '{name} plays'],
  'fx.liar':      ['¡MENTIROSO!', 'LIAR!'],
  'fx.liarSub':   ['{name} mintió: era {card}', '{name} lied: it was {card}'],
  'fx.truth':     ['¡ERA VERDAD!', 'IT WAS TRUE!'],
  'fx.truthSub':  ['{name} roba 1 por desconfiar', '{name} draws 1 for doubting'],
  'fx.believed':  ['Todos lo creen', 'Everyone believes it'],
  'fx.reverse':   ['¡Cambio de sentido!', 'Direction reversed!'],
  'fx.skip':      ['{name} pierde el turno', '{name} loses their turn'],
  'fx.uno':       ['¡UNO!', 'UNO!'],
  'fx.caught':    ['¡Pillado!', 'Caught!'],
  'fx.swap':      ['¡Cambio de manos!', 'Hands swapped!'],
  'fx.pass':      ['¡Todos pasan su mano!', 'Everyone passes their hand!']
});
