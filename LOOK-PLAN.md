# New look plan (2026-11-22)

Approved draft: https://claude.ai/artifact/2TYyLctsaQ7JuRhSCUBrcD — all 7 ideas picked.
Choices: navy blue felt table, navy card back, back reads "UNO" + red "MENTIROSO" ribbon.
Game rules and Firebase logic stay untouched; this is looks only.

**Status (2026-11-22): all 10 steps built, not committed yet.** New files: look.css (all new styles,
loaded last) and look.js (seat layout, bot accessories, turn ring, deal animation, start-page fan).
Also: the 🎭 lie emoji became 🤥 (claim button + two badges), and the rules text describes the
new hand marks (gold glow / Mentira tag / dimmed ✕).

## Steps

1. **Cards** — one shared card builder (`cardFaceHTML`) used by the hand, the pile, the claim
   preview, the zoom, the reveal slots and fx.js. Cream edge, tilted oval, upright numbers,
   gloss. Liar cards: colour frame, dark striped face, speech-bubble "?" mark. Wild: four-colour
   oval. Every card back (deck, flying backs, reveal slots, bot mini cards) becomes the new
   "UNO / MENTIROSO" navy back.
2. **Fonts** — Rubik for body text and card numbers, Oswald stays for titles and labels.
3. **Table** — navy felt oval with grain, stitched seam and padded leather rail. Deck and pile in
   the middle, dotted direction ring. Blurry background circles removed.
4. **Seats** — opponents sit around the top edge of the table (spread along an arc for 1–9
   opponents) with a name tag and card count, instead of the boxes row.
5. **Turn ring + bot faces** — gold glow and a ring that empties on the current player's seat.
   Bots keep their mood faces and get their own accessory (Pinocho nose, Sherlock cap + pipe,
   El Tahúr top hat + moustache).
6. **Hand** — cards fan out in a curve and lift on hover. Honest-play cards glow gold,
   bluff-only cards get a small "Mentira" tag, unplayable ones dim.
7. **Screen** — line icons instead of emoji in the top bar, room code hidden in bot games,
   turn messages as a pop-up on the felt. The log stays (smaller), nothing is removed.
8. **Motion** — deal animation at the start of a game; check play/draw/bot flights use the new cards.
9. **Start page** — box style: blue, faint repeated MENTIROSO, chunky UNO with red MENTIROSO
   ribbon under it, "No te fíes de nadie", bots button first, cards peeking at the bottom.
10. **Check** — phone + desktop, bot game + tutorial, colour-blind symbols, calm mode;
    bump ?v= on edited files and the service worker cache.
