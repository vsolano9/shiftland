# Game Off 2026: research

Collected 2026-11-03 by three read-only research helpers plus direct reads of the jam page. Sources are linked; items marked *unverified* came from forum posts or search snippets only.

## The jam

| Fact | Value | Source |
| --- | --- | --- |
| Theme | **SHIFT**, "strong or loose inspirations apply" | [GitHub blog](https://github.blog/open-source/gaming/game-off-2026-the-theme-is-shift/), [itch page](https://itch.io/jam/game-off-2026) |
| Submissions | 2026-11-01 21:37 UTC to 2026-12-01 21:37 UTC (repo pushed and itch entry in before **Dec 1, 13:37 PST = 21:37 UTC = 22:37 CET**) | itch page |
| Voting | Participants rate each other until 2027-01-01 13:37 PST | itch page |
| Categories | Overall, Gameplay, Graphics, Audio, Innovation, Theme Interpretation | itch page |
| Repo | Public GitHub repo, created and worked on during the jam; templates and starter projects allowed; "vast majority of the work" in the jam window | GitHub blog |
| License | Any; open source encouraged, not required | GitHub blog |
| Team | Solo or team, no size limit stated | GitHub blog |
| Assets and tools | Any tools and assets: open source, commercial, commissioned, original | GitHub blog |
| AI | "AI-assisted development is allowed." The submission form asks about AI use so others understand how the game was made | GitHub blog |
| Prizes | None stated (bragging rights, GitHub blog winners post) | itch page |
| Joined | 2,938 on 2026-11-03 | itch page |

Note the submission deadline is in CET evening (22:37). Plan to submit by **Nov 29**, not the last day.

## Past editions

| Year | Theme | Entries | Total ratings |
| --- | --- | --- | --- |
| 2025 | WAVES | 709 | n/a |
| 2024 | SECRETS | 507 | 4,696 |
| 2023 | SCALE | 609 | 8,765 |

Past join counts were not collected, so the submit rate is unknown; with 2,938 joined this year, expect **roughly 600-900 entries**.

Ratings per entry are low: top-5 games had 9-56 ratings. 2024 averaged ~9 ratings per entry (4,696 / 507), 2023 ~14 (8,765 / 609). The 2023 overall winner is listed with **9** ratings (*recheck: odd against a ~14 average*), which suggests score, not volume, decides the rank, but itch's adjusted score (community-reported formula: score × sqrt(min(median, n) / median)) penalises entries below the median rating count. *Unverified formula.* Consequence: we must get at least the median number of ratings, which in practice means Victor rates 20+ other entries in December and comments on them.

### What won (2025, WAVES)

| Place | Game | Genre | Engine | Theme as |
| --- | --- | --- | --- | --- |
| 1 | Evaw | Platformer | Godot | Light/sound waves and radio across a fallen nation |
| 2 | Where the Water Flows | Isometric puzzle | Godot | Sea level is the level design |
| 3 | BEACON | Atmospheric puzzle | Unity | Light waves reveal paths |
| 4 | A Kingdom Slightly Out Of Tune | Puzzle-strategy | Unity | Sound waves as weapons |
| 5 | Wave Drifter | Naval arcade | Godot | Ocean chases |
| Theme | La Ola | Typing | | Typing speed drives a stadium wave |
| Gfx + Gameplay | Ooqo | Score chaser | | Glide over fish |

2024 (SECRETS) overall: Trail of Secrets (also theme winner), made by the same developer as 2025's Tidal Town. Graphics winner Museum Servivit had 67 ratings.

### Patterns worth copying

1. **The theme is the mechanic**, not the story or the art. Four of the 2025 top 5 turn WAVES into the thing you manipulate (Wave Drifter is the exception: waves are the setting). Five games is a small sample; treat it as a lean, not a law.
2. **Small, readable puzzle or arcade loops** with one core verb. No sprawling games in the top 10.
3. **Craft and a strong look** matter: graphics winners pull the most ratings.
4. Godot/Unity dominate, but nothing says web tech is penalised; a browser game removes the download step, which is the biggest drop-off for raters (forum consensus, *unverified stats*).

## itch.io platform facts (HTML5)

From [itch.io HTML5 docs](https://itch.io/docs/creators/html5):

- ZIP with `index.html` at the root; max **1,000 files**, 500 MB extracted, 200 MB per file, 240-char paths.
- Case-sensitive, relative paths only (a leading `/` breaks); external resources over HTTPS.
- Embed mode needs a fixed viewport size; optional fullscreen button. "Mobile friendly" flag forces click-to-launch fullscreen on phones.
- "Click to play" on by default; audio must start after a user gesture anyway.
- SharedArrayBuffer / cross-origin isolation: *unverified*; don't depend on them. WebGL2: *unverified on itch, assume yes* (Skyway Rally runs three.js WebGL2 fine on Vercel); test in the live iframe early (week 1 upload of a draft page set to restricted/draft).
- Vite builds need `base: './'` for relative asset paths.

Page: cover image 630×500 (recommended), 3-5 screenshots, a GIF, controls listed in the description, browser build first.

## Generative AI: our position

- Game Off allows AI-assisted development and asks about it at submission.
- itch.io requires AI-content disclosure site-wide since late 2024 (tag categories reported as graphics, sound, text and *possibly* code: confirm on the real upload form in week 1); untagged AI assets can be hidden from browse ([PC Gamer](https://pcgamer.com/software/platforms/indie-distribution-platform-itch-io-now-requires-asset-creators-to-disclose-the-use-of-generative-ai-in-their-work), [GamesMarket](https://www.gamesmarket.global/itchio-now-requires-gen-ai-content-to-be-tagged-in-all-games-and-asset-packs-711e824843d410eab51fcd9436836294/)).
- Many jam communities are hostile to AI art; several 2026 jams ban it. Raters are other jam devs.

**Decision for the plan:** the code is AI-written (disclosed honestly; this is the point of how we work). **Shipped graphics and audio are made in code** (procedural geometry, shaders, canvas textures, WebAudio synthesis), as Skyway Rally already does. Codex image gen is used for **concepts only** (internal references, never shipped, never on the itch page). That keeps the honest answer to the AI question to "code: AI-assisted; art and audio: procedural, made in code", which is the answer least likely to cost ratings in Graphics and Audio. If Victor prefers shipped AI art, it must be tagged and the page must say so.

## Theme map: SHIFT

~40 senses collected: position, swap places, gear shift, Shift key, bit shift / shift register, work shift / night shift / shift change, time shift, phase shift, paradigm shift, shapeshift, tone shift, allegiance shift, power shift, shifting goalposts, perspective shift, colour shift, redshift / Doppler, focus shift / tilt-shift, gravity shift, centre-of-mass shift, dimension shift, scale shift, tectonic plates, tides, scene shift (theatre), register shift (language), blame shift, price shift.

**Clichés most entrants will pick** (avoid as the core): light/dark or mirror world swap, gravity flip, literal Shift-key gimmick, shapeshifting player, colour/phase swap platformer, time rewind, perspective rotate (Fez).

**Under-used angles:** shift work and crew handovers, shifting sands and erosion, gear shift as feel/rhythm, shift registers and signal chains, tectonic plates, shifting goalposts, allegiance shifts, tilt-shift focus, redshift/Doppler, cargo/weight shift.

Well-trodden commercial references to stay clear of copying: Fez, Antichamber, Superliminal, Braid, Ikaruga, Baba Is You, Monument Valley, Viewfinder, Patrick's Parabox.

## Our reusable tech

- **Stack proven here:** Vite + TypeScript + three.js + vitest + Playwright (Skyway Rally, Aether Relay). Skyway Rally ships with all art procedural (canvas textures, code geometry) and all audio synthesised in WebAudio (`src/audio.ts`), fonts via @fontsource. We write fresh code in the jam repo (rules want the work done in-jam), reusing patterns, not copying a game.
- **Audio:** WebAudio synthesis first (as Skyway). Free tools as needed: ZzFX/ZzFXM (MIT, tiny JS SFX + music), jsfxr, BeepBox/Bosca Ceoil for music (check licences before shipping). ElevenLabs (`eleven sfx|music`) exists but is generative AI: avoid for shipped audio under the stance above.
- **QA:** Playwright screenshots + `taste_critic.py`, vitest for rules/sims, autopilot bots for balance (Skyway has `autopilot.ts`).
- **Hosting:** itch.io HTML5 zip; optionally a mirror on Vercel for testing (Vercel deploy of a public game is a public release: needs Victor's OK).
