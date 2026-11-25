# Saints of Ash - Case 01: The Lily Saint

A playable vertical slice of a 2D neo-noir occult detective platformer. Everything (art, lighting, sound) is generated in code.

**Play:** https://rohitkparida.github.io/saints-of-ash/

Four areas: a rain-soaked alley, Precinct 9, the Line 4 subway, and the other side.
Find six clues, link them on the cork board, and use the killer's eye at a cost to your sanity.

## Controls
| Key | Action |
|---|---|
| A / D | Move |
| W / S | Climb ladders and stairs |
| Space | Jump (S + Space drops through a ledge) |
| Shift | Sneak |
| E | Interact |
| Q (hold) | Killer's eye |
| N | Notebook |
| V | Switch pixel art / hand-painted |
| M | Mute |

## Run locally
```
python -m http.server 8765
```
then open http://localhost:8765/. URL options: `?skip=1`, `?area=precinct|subway|other`, `?mode=painted`.

## Layout
`js/core.js` palette, input, procedural audio - `js/render.js` drawing primitives, rain, fog - `js/puppet.js` character sprites -
`js/areas.js` levels - `js/ui.js` notebook, cork board, dialogue - `js/game.js` loop, physics, story. `SPEC.md` describes the shared API.

## Isometric demo

`iso.html` is a second, isometric take on the same case: the Starlite Motor Court on Route 9. Rooms cut away as you walk in, there is a drained pool, and Q, the cork board and the other world all work as in the side-scroller. Add `?skip=1` to skip the title screen.
