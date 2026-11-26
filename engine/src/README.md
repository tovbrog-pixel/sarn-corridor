# Lines of Advance engine

Tov Binyamin Brog · 25 November 2026

The shared engine of two games: France 1944 (tovbrog-pixel/france-1944) and Sarn Corridor (tovbrog-pixel/sarn-corridor). The player draws lines of advance and the corps and division commanders fight the battle. Both games build their page and desktop app from these files.

## Where it came from

On 25 Nov 2026 the two games' engine copies were merged into one: France 1944's engine at commit 01917bd, plus the opt-in parts Sarn Corridor had added (sarn-corridor commit 869b601). Checks on the merge:
- France 1944 with this engine gives identical output on its regression suite, `tools/test-command.js`, `tools/tutorial-run.js`, `tools/test-transport2.js` and a 96-hour Overlord run.
- Sarn Corridor's regression fingerprints equal France 1944's on all nine shared scenarios.

## How each game uses it

Each game keeps the engine in its own `engine/src` folder as a git subtree of this repository. The game's build tools, tests and GitHub Actions read `engine/src` as before.

First time, in a game repository (the folder must be removed and committed first):

```
git rm -r engine/src && git commit -m "engine/src moves to the shared engine"
git subtree add --prefix engine/src https://github.com/tovbrog-pixel/lines-of-advance-engine.git main --squash
```

Take the latest engine:

```
git subtree pull --prefix engine/src https://github.com/tovbrog-pixel/lines-of-advance-engine.git main --squash
```

Send an engine change made in a game repository back here:

```
git subtree push --prefix engine/src https://github.com/tovbrog-pixel/lines-of-advance-engine.git main
```

## Rules for changes

1. A change for one game reaches the other only as a setting. Without the setting, the other game must give the same results.
2. Before an engine change goes back to this repository, run both games' checks:
   - France 1944: `node tools/regress.js`, `node tools/test-command.js`, `node tools/tutorial-run.js`.
   - Sarn Corridor: `node tools/regress.js` and the corridor scenario at 200 hours (`node tools/scenario-corridor.js 200 <seed> out.json`).

   A changed regression result needs a reason in the commit message, and both games record new baselines.
3. Record each change in `CHANGES.md` with the game that asked for it and the setting that controls it, if any.

## Game settings

**From `game.json` in the game repository.** The game's page builder (`tools/build-preview.js`) reads this file into `GAMECFG` on the page. Without the file the page keeps France 1944's words.

| Field | Use | France 1944 | Sarn Corridor |
| --- | --- | --- | --- |
| `name` | Title on the menu and intro screens | (template) Lines of Advance | Sarn Corridor |
| `title` | Browser tab title | (template) | Sarn Corridor: Operational Command |
| `menu`, `sub` | Menu and intro lines | (template) | invented war, 1940 |
| `levelName` | Name of the middle difficulty level | Historical | Standard |
| `oobNote` | Order-of-battle note on the menu | the record | the scenario |
| `store` | Prefix of the saved stop settings | f44 | sc |

**From the scenario.** Each of these is off unless the scenario sets it.

| Setting | Effect | Used by |
| --- | --- | --- |
| `hHour` | Before this hour neither side fires, flies missions or enters enemy ground | Sarn Corridor |
| `variants` | One deployment drawn from the seed at the start | Sarn Corridor |
| `supplyMin` | Minutes between supply ticks (default 10) | Sarn Corridor load tests |
| `modules: ['intel']` | Pre-war intelligence picture, sightings, stale reports struck off | Sarn Corridor |
| sub spec `'kind\|name\|mul\|bns'` | A regiment or brigade simulated as one unit of `bns` battalions | Sarn Corridor regiment test |
| town field `t[4]` | Built-up radius in km | Sarn Corridor |
| `labels` | Side names on the menu and score bar | Sarn Corridor |

Division templates for both games live in `divisions.js`: France 1944's 1944 divisions and Sarn Corridor's `vd_`, `sa_` and `ko_` divisions.

## Files

The engine is plain JavaScript, loaded in order by each game's `tools/load-engine.js` (tests) and `tools/build-preview.js` (page). `index.tpl.html` is the page template. `/*CODE*/` takes the engine and `/*GAMECFG*/` takes the game settings.
