# Where's My Pendrive?

A small pixel-art web game in the style of Game Boy Advance-era Pokémon games.
A government official loses his pendrive in different office scenarios. Find it
before the timer runs out — his face gets redder as panic sets in.

## Run it

Just open `index.html` in a browser. No build step, no dependencies — plain
HTML + CSS + JS, plus two Google Fonts (Press Start 2P, VT323) loaded from
Google's CDN (they fall back to Courier if offline).

## Project layout

```
index.html          entry point
css/style.css       all styling (scene + HUD + dialogue are CSS; room objects
                    are photo images blended in as a desaturated collage)
objects/            PNG cutouts for 5 room objects (painting, desk, minibar,
                    bin, bookshelf)
js/game.js          reusable game engine (timer, dialogue, hotspots, overlays)
js/sprite.js        pixel-art character rendered on <canvas>
js/levels/level1.js Level 1: "The Office" configuration
```

## Adding Level 2, 3, ...

Each level is a plain data file in `js/levels/`. Create `js/levels/level2.js`
registering `window.LEVELS[2] = { ... }` (copy the shape from `level1.js`), add
a `<script src="js/levels/level2.js">` tag in `index.html`, and change the boot
line at the bottom of `js/game.js` to `startLevel(window.LEVELS[2])` (or build
a level-select screen).

The engine reads everything from the config:

- `timeLimit` — seconds on the clock
- `nervousness: { sweatAt, shakeAt }` — % of time elapsed where the sweat drop
  appears / the screen shakes
- `player: { left, bottom }` — where the character stands
- `introLines` — dialogue shown when the level starts
- `sceneHTML` — the room markup; interactive elements get `data-hotspot="id"`
- `hotspots` — every interactive object: clicking costs `penaltySeconds` and
  shows a joke (decoy behaviour)
- `winCandidates` — hotspot ids that may hide the pendrive this round
- `reveals` — per candidate: `revealClass` + `winTarget` + `revealLines` for
  how its hidden safe is revealed when it is the round's winner
- `winTitle` / `winText` / `loseTitle` / `loseText` — overlay texts

## Level 1: The Office

- 45 seconds on the clock; the progress bar shifts green → yellow → red.
- Search 7 objects: window, bookshelf, desk, plant, trash bin, mini bar, painting.
- Each round one of the 6 candidates (all but the window) hides the pendrive
  at random — click it to reveal its hidden safe, then click the safe to win.
- Every wrong guess costs 5 seconds and shows a hint/joke.
