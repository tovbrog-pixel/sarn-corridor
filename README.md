# Sarn Corridor

Division-level campaign game on an invented continent: Valdenmark against Korovia across five neutral states, on the pattern of Avalon Hill's Blitzkrieg (1965). Built on a copy of the France 1944-45 engine (Lines of Advance).

- `docs/design-document.md`: the design document (v1, 23 Nov 2026)
- `docs/map/`: the sample map page
- `tools/mapgen/gen.py`: continent generator; writes `data/terrain` (1 km engine grid) and `data/map.json`
- `tools/sarnmap.js`: loads the continent into a scenario window
- `engine/`: simulation, rendering and interface, copied from france-1944 on 23 Nov 2026

Author: Tov Binyamin Brog
