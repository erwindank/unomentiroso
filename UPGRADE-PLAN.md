# UNO Mentiroso upgrade plan (2026-11-21)

The 27 ideas built for VIRUS! (Desktop/virusgame, UPGRADE-PLAN.md there), adapted to this game.
New code lives in separate files so app.js stays readable:
- `i18n.js`   — `t()` translations (ES / EN), language switch, English log translation
- `fx.js`     — sounds, vibration, flying cards, spotlight, stamps, banners
- `extras.js` — faces, turn banner/timer, danger alert, zoom, preview, ⚙️ menu, awards,
                stats + badges, quick bots, invite/QR, throws, reconnect badge
- `tutorial.js` — guided first game (runs on this device through a small Firestore stand-in)

Effects are worked out by comparing each new room state with the previous one
(`FX.onState(prev, cur)`), so every move — from any of the ~20 save paths, bots included —
gets its animation without changing the rules code.

## How each idea is adapted
- R1 flying cards: face-up plays, face-down claims (card back), draws/penalties (deck → seat)
- R2 faces: each player's seat has a face — nervous while their claim is open, shocked when
  caught, smug when proven right, cocky at 1–2 cards, worried with lots of cards
- R3 big moments: ¡MENTIROSO! / ¡ERA VERDAD! stamps, +2/+4 card showers, reverse spin, skip ⊘,
  wild colour burst, hand swap / pass spin, ¡UNO! pop
- B1 spotlight: "Ana dice: Rojo 5" in the middle for face-down plays
- B2 turn banner + timer (host option): turn timeout = draw 1 and pass; vote timeout = "Lo creo"
- B3 danger alert at 2 cards (1 card already has the UNO system)
- B4 hold/hover a card: big card + its rule (normal vs liar, action effect)
- B5 preview: hand badges (✓ honest play / 🎭 bluff only / ✗ can't); the claim window says
  "Verdad" or "Mentira"; in-game warning windows instead of browser alert()
- G2 bot personalities: how often they lie and how suspicious they are; levels easy/normal/hard
- G4 awards from host-tracked match stats (lies told, got away, caught, catches, wrong accusations,
  cards drawn); room score across rematches
- G7 guided game: play face-up, bluff, catch a liar, believe, shout UNO, win

## Steps (all done 2026-11-21, tested in a browser; not committed or pushed yet)
1. [x] i18n core + effects engine (state diff): flying cards, spotlight, stamps, sounds,
       vibration, calm mode (R1 R3 R4 R5 B1 Y4)
2. [x] Faces on seats (R2)
3. [x] Turn banner + timer (B2), danger alert at 2 cards (B3)
4. [x] Zoom (B4), hand badges + claim truth label + in-game warnings (B5)
5. [x] Settings menu + rules window (B6)
6. [x] Winner confetti (R6), match stats + awards + room score (G4), my stats + badges (G5)
7. [x] Quick bots (G1), bot personalities + levels (G2)
8. [x] Invite link, QR, WhatsApp (G3); VIRUS! room codes no longer open here
9. [x] Throw reactions (G6)
10. [x] Guided first game (G7)
11. [x] Thumb hand (Y1), install as app (Y2), colour-blind marks (Y3), reconnect grace (Y5),
        card frame + back (Y7), living table (Y8)
12. [x] English (Y6)

## Notes
- New styles are in `extras.css` (style.css itself is unchanged).
- Match counts live on the room as `stats.<pid>.<count>`; only the host writes them, as
  atomic increments, batched 1.5 s after each move so they don't collide with it.
- Room score: `series.<name>`, counted once per game via `gameNo` + `seriesDone`.
- The log is still saved in Spanish by every device; `translateLog()` (i18n.js) shows it in
  English. A new log message needs a matching line in `LOG_EN`, and fx.js / extras.js read
  some Spanish phrases ("descubrió a", "dijo la Verdad", "pierde su turno"…) to spot events.
- Guided game: `tutorial.js` answers the room id 'TUTORIAL' from memory (doc().get/update,
  runTransaction); every other room goes to Firestore as before.
- Fixed while here: bots blocked "Terminar" (now only people vote); the two browser alert()
  pop-ups are in-game windows; VIRUS! room codes (same Firestore collection) are rejected.
