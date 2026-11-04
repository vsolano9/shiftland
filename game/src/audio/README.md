# Shiftland audio

All audio is synthesised in code at runtime (game jam rule): no audio files ship. Import `GameAudio` from `audio.ts`.

| File | Holds |
| --- | --- |
| `audio.ts` | `GameAudio`: node graph, lookahead sequencer (0.4 s ahead, 100 ms tick), crossfade, ocean, duck, mute, hidden-tab pause, polyphony caps |
| `songs.ts` | The score: one `Song` per biome (key, tempo, chord loop, phrases, layers, arrangement, sends, plate notes). Change the music here |
| `compose.ts` | Pure `Composer`: turns a `Song` into bars, with arrangement per pass, two takes per 4-bar slot, ornaments and a seeded RNG, so repeats differ |
| `synth.ts` | Pure sample generators: additive notes, Karplus-Strong pluck, shaker, drum, noise, impulse, pad wave |
| `sfx.ts` | SFX recipes from `docs/design-plates.md` (`playSfx`), `pourSound`, `gullCry`, and the `Voice` that frees its nodes when it ends |
| `theory.ts` | `midi`, `freq`, `rng`, `plateNote`, `scaleStep`, `snap`, `tickPair`, `fallingThird` |
| `tools/analyze_audio.py` | Reads the rendered WAVs; writes `report.md`, spectrograms, the variation plot and 16-bit `listen/` copies. Its song table must match `songs.ts` |

## API notes beyond the interface

- `new GameAudio({ ctx, seed })`: both optional. Passing an `OfflineAudioContext` makes it render offline; drive the sequencer with `advanceTo(t)`.
- `scale` is the current biome's five plate notes as MIDI numbers; `stats` reports live voices and notes (the leak test reads it).
- `play('complete')` ducks the music through its own fanfare, so callers need not.
- `slide`: `intensity` is plate size 0-1 (larger plates sound lower). `tick`: `variant` picks the pitch per creature. `plate` is 0-based.

## How the game uses it (`src/app.ts`)

- Every move: `slide`, then `uplift` when land rose, `crack` and `pour` when a rift opened; goals tick with a pitch per creature, and the last one plays `complete`.
- The ocean bed runs under every screen; each biome crossfades to its song on a flight.
- `setMood` follows goals met: the song opens from a muffled low pass to the full band as creatures get happy, also on undo.
- The title loop plays `slide` and a soft `uplift` through `world.heroSfx`, only once the browser has unlocked audio.
- `hover` plays on plate hover and `chord` on the ending's last shift.

Nobody has heard this yet: it is checked by renders and metrics only (`e2e/audio.spec.ts`, `report.md`). The first person to listen should judge the mix.

## Checks

```
npx vitest run src/audio                 # theory, score in key, voice leading, no repeat over 30 min, tuning, decay
npx playwright test e2e/audio.spec.ts    # renders each SFX and 60 s of each biome in Chromium, and measures them
AUDIO_EVIDENCE=<dir> npx playwright test e2e/audio.spec.ts   # also writes WAVs (150 s of music) to <dir>
python src/audio/tools/analyze_audio.py <dir>                # report and spectrograms from those WAVs
```

Gain staging: `drive` 0.46 into a glue compressor, trim 0.62, limiter, out 0.8. Chromium's compressor adds make-up gain, so measure after any change: music should sit near -21 dBFS RMS and -6 dBFS peak, and the limiter should rarely work.
