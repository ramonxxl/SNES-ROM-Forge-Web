# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Client-side (no backend) port of [SNES ROM Forge](https://github.com/ramonxxl/SNES-ROM-Forge), a tool
that merges multiple SNES ROMs (LoROM/HiROM) into a single image for flashing to a multi-game PIC
flash cart. Runs entirely in the browser as plain ES modules — no bundler, no framework, no npm
dependencies. Live at https://ramonxxl.github.io/SNES-ROM-Forge-Web/.

Every file in `src/core/` and `src/devices/` is a **direct port** of the equivalent Python module in
the original desktop app (`core/*.py`, `devices/*.py`) — same offsets, same scoring heuristics, same
slot algorithm. When changing logic in these two directories, keep behavior in sync with intent rather
than introducing JS-idiomatic shortcuts that would diverge from the Python original. `src/ui/` and
`src/app.js` are a from-scratch reimplementation of the desktop app's card-based UI using plain DOM
(no virtual DOM, no templating).

## Commands

```
npm test              # runs tests/*.test.js via Node's built-in test runner (node --test)
node --test tests/detector.test.js   # run a single test file
```

There is no build step, bundler, or linter configured. To run the app locally, serve the directory
with any static file server (opening `index.html` via `file://` fails because the page uses ES module
`import`, which browsers block on that scheme):

```
npx serve .
# or
python -m http.server
```

## Architecture

**Pipeline:** `App` (src/app.js) orchestrates everything — it holds the list of loaded `SNESRom`
instances and the selected `flashProfile`, and wires up the top bar (title + flash-capacity `<select>`,
inline — there is no settings dialog), the sidebar buttons (generate BIN, clear, help), the
reorderable card row, and the flash-occupancy bar (`_updateOccupancy`, backed by
`resolveSlotSizes` from merger.js) that stays in sync with both ROM list and flash-profile changes.
ROM cards are reordered via native HTML5 drag-and-drop (`draggable`, `dragstart`/`dragover`/`drop` on
each card in `_rebuildCards`) rather than fixed swap buttons.

1. **Load** — `SNESRom.load(file)` (src/core/rom.js) strips a 512-byte SMC copier header if present
   (`stripSmcHeader` in detector.js, detected via `length % 1024 === 512`), then runs mapping
   detection.
2. **Detect** — `detect(data)` (src/core/detector.js) scores both a LoROM candidate (header at
   `0x7FC0`) and a HiROM candidate (header at `0xFFC0`) using four independent signals (checksum
   complement pair, plausible ROM-size byte, printable title, valid reset vector), each worth points;
   the mapping needs a score >= `MIN_DETECTION_SCORE` (2) to be accepted, otherwise mapping is
   `"unknown"`.
3. **Validate** — `validate(roms, flashProfile, slotSizes)` (src/core/validator.js) throws
   `ValidationError` (blocking) for: no ROMs selected, unknown mapping, mixed LoROM/HiROM in the same
   batch, a ROM larger than its computed slot, or total slot size exceeding flash capacity. It returns
   non-blocking warnings (SMC header stripped, invalid original checksum, unprintable internal title)
   that get logged but don't stop the merge.
4. **Slot sizing** — `resolveSlotSizes` (src/core/merger.js) is the core hardware-mapping algorithm:
   each ROM's natural slot is the smallest power-of-two multiple of a 1 MB base unit that fits it
   (`computeNaturalSlotSize`). The target board's PIC uses 2 address lines wired to the flash's top
   address bits (4 possible positions) — **no address combination may be left unassigned**, since a
   floating address on a blank region of flash hangs the SNES. So slots are repeatedly doubled
   (always the currently-smallest slot first) until their sum exactly fills the flash capacity; when a
   ROM's slot ends up bigger than the ROM itself, the ROM's *entire* data (header included) repeats to
   fill it — never zero-fill for repeated regions. Only the leftover flash capacity beyond all slots is
   padded, and always with `0xFF`, never `0x00`.
5. **Merge** — `merge(roms, flashProfile)` fixes each ROM's own internal checksum independently (via
   `fixChecksum` in checksum.js, using that ROM's detected `headerOffset` — never a hardcoded offset)
   before concatenating; there is intentionally no "global" checksum over the final image. Returns
   `{ data, report }` where `report` carries per-ROM offsets/slot sizes and the validation messages,
   used to build the on-page log.
6. **Save** — `App._saveBinFile` prefers `window.showSaveFilePicker` (File System Access API); falls
   back to an `<a download>` blob URL on browsers without it (Firefox/Safari).

**Checksum math** (src/core/checksum.js): the SNES internal checksum is a 16-bit sum of every byte in
the ROM with the 4 checksum/complement bytes themselves treated as zero (`computeChecksum` simply
skips summing that range rather than copying+zeroing). `complement = checksum ^ 0xFFFF`. Both are
stored little-endian at `headerOffset + 0x1E` (checksum) and `headerOffset + 0x1C` (complement).

**Boxart fetch** (src/ui/boxart.js): best-effort, never blocks the UI. Tries the imported filename and
then the ROM's internal title (both against 4 region suffixes) against the
`libretro-thumbnails` GitHub raw content repo, with results cached in the browser's Cache Storage API
(`snes-rom-forge-boxart-v1`) so repeat lookups work offline. Any fetch failure (offline, CORS, 404)
silently falls through to the next candidate; if all fail, the caller keeps its colored banner
placeholder.

**Flash profiles** (src/devices/flashProfiles.js): a flat list of `{ name, capacityBytes }`; the
default is the confirmed hardware target, a 29L3211 (4 MB) driven by a PIC12F629 with 2 address lines.
Only this "PIC with 2 address lines" board model is implemented — alternate board profiles are
explicitly out of scope for this port (see README).

## Tests

`tests/*.test.js` use Node's built-in `node:test` + `node:assert` — no test framework dependency.
They construct synthetic ROM buffers by hand (writing header bytes at the LoROM/HiROM offsets) rather
than loading real ROM files, so new tests for core logic should follow that pattern: build a minimal
`Uint8Array` with just the header fields under test set correctly, and rely on the rest being zero.
