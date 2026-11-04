"""Measure the WAVs written by e2e/audio.spec.ts (AUDIO_EVIDENCE=<dir>) and draw spectrograms to look at.

usage: python analyze_audio.py <dir>
Writes <dir>/report.md, <dir>/spectrogram-*.png, <dir>/variation.png and 60 s 16-bit listening copies (<dir>/listen/).
"""
import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d

SONGS = {  # bpm, beats per bar, bars in the chord table, pitch classes of the song's scale
    "title": (76, 4, 8, "G A B C D E F#"),
    "meadow": (84, 4, 16, "C D E F G A B"),
    "coast": (70, 2, 16, "F G A B C D E"),
    "desert": (78, 4, 16, "D Eb F F# G A Bb C"),
    "tundra": (72, 3, 16, "A B C# D E F# G#"),
    "finale": (88, 4, 16, "Bb C D Eb F G A"),
    "ending": (90, 4, 16, "D E F# G A B C#"),
}
PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "G#": 8, "A": 9, "Bb": 10, "B": 11}


def db(x):
    return 20 * np.log10(np.maximum(x, 1e-9))


def load(path):
    sr, d = wavfile.read(path)
    return sr, d.astype(np.float64)


def lufs(mono_stereo, sr):
    """BS.1770 integrated loudness (K-weighting, 400 ms blocks, -70 absolute and -10 relative gates)."""
    # shelf and RLB high-pass, bilinear from the standard's analogue prototypes
    f0, g, q = 1681.974, 3.9998, 0.7072
    k = np.tan(np.pi * f0 / sr)
    vh = 10 ** (g / 20)
    vb = vh ** 0.4996
    a0 = 1 + k / q + k * k
    shelf_b = [(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0]
    shelf_a = [1, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    f0, q = 38.135, 0.5003
    k = np.tan(np.pi * f0 / sr)
    a0 = 1 + k / q + k * k
    hp_b, hp_a = [1, -2, 1], [1, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    x = signal.lfilter(hp_b, hp_a, signal.lfilter(shelf_b, shelf_a, mono_stereo, axis=0), axis=0)
    win, hop = int(0.4 * sr), int(0.1 * sr)
    if len(x) < win:
        return float("nan")
    e = np.array([np.sum(np.mean(x[i:i + win] ** 2, axis=0)) for i in range(0, len(x) - win, hop)])
    l = -0.691 + 10 * np.log10(np.maximum(e, 1e-12))
    keep = l > -70
    if not keep.any():
        return float("nan")
    rel = -0.691 + 10 * np.log10(np.mean(e[keep])) - 10
    keep = l > rel
    return -0.691 + 10 * np.log10(np.mean(e[keep]))


def longest_silence(mono, sr, floor=-60.0):
    win = int(0.1 * sr)
    n = len(mono) // win
    r = np.sqrt(np.mean(mono[: n * win].reshape(n, win) ** 2, axis=1))
    best = run = 0
    for v in db(r):
        run = run + 1 if v < floor else 0
        best = max(best, run)
    return best * 0.1


def bands(mono, sr):
    f, p = signal.welch(mono, sr, nperseg=8192)
    tot = np.sum(p)
    return [10 * np.log10(np.sum(p[(f >= a) & (f < b)]) / tot + 1e-12) for a, b in [(20, 120), (120, 500), (500, 2000), (2000, 6000), (6000, 22050)]]


def resonance(mono, sr):
    """Largest narrow peak above its surroundings between 800 Hz and 8 kHz (harshness comes from these)."""
    f, p = signal.welch(mono, sr, nperseg=16384)
    pdb = 10 * np.log10(p + 1e-14)
    med = signal.medfilt(pdb, 201)
    mask = (f > 800) & (f < 8000)
    i = np.argmax((pdb - med)[mask])
    return float(f[mask][i]), float((pdb - med)[mask][i])


def chroma_in_key(mono, sr, names):
    """Share of tonal energy (200 Hz-2.5 kHz) that sits on the song's scale, by nearest semitone."""
    pcs = {PC[n] for n in names.split()}
    f, p = signal.welch(mono, sr, nperseg=32768)
    mask = (f > 200) & (f < 2500)
    m = np.round(69 + 12 * np.log2(f[mask] / 440)).astype(int) % 12
    # subtract the noise floor per bin so reverb hash doesn't count as "out of key"
    q = np.maximum(p[mask] - signal.medfilt(p, 401)[mask], 0)
    tot = np.sum(q)
    return float(sum(q[m == c].sum() for c in pcs) / tot)


def clicks(stereo, sr):
    """Largest sample-to-sample jump relative to the RMS around it. Sharp discontinuities score far above 20."""
    mono = stereo.mean(axis=1)
    d = np.abs(np.diff(signal.lfilter([1, -0.95], [1], mono)))
    win = int(0.02 * sr)
    env = np.sqrt(np.maximum(uniform_filter1d(mono ** 2, win), 0))[1:] + 1e-4
    i = int(np.argmax(d / env))
    return float(d[i] / env[i]), i / sr


def spectrogram(ax, mono, sr, title, top=8000):
    f, t, s = signal.spectrogram(mono, sr, nperseg=4096, noverlap=3072, scaling="spectrum")
    keep = f <= top
    im = ax.pcolormesh(t, f[keep], 10 * np.log10(s[keep] + 1e-12), vmin=-100, vmax=-30, cmap="magma", shading="auto")
    ax.set_yscale("symlog", linthresh=200)
    ax.set_ylim(40, top)
    ax.set_title(title, fontsize=9, loc="left")
    ax.set_ylabel("Hz", fontsize=7)
    ax.tick_params(labelsize=7)
    return im


def bar_variation(mono, sr, bpm, beats, bars):
    """Bar-synchronous spectra (300 Hz-4 kHz); correlates each bar against the same table bar in the other passes."""
    bar = 60 / bpm * beats
    passes = int((len(mono) / sr - 0.1) // (bar * bars))
    f, t, s = signal.spectrogram(mono, sr, nperseg=2048, noverlap=1536)
    band = (f > 300) & (f < 4000)
    s = np.log(s[band] + 1e-9)
    frames_per_bar = int(round(bar / (t[1] - t[0])))
    cube = []
    for p in range(passes):
        for b in range(bars):
            start = int(round((0.1 + (p * bars + b) * bar) / (t[1] - t[0])))
            if start + frames_per_bar <= s.shape[1]:
                cube.append((p, b, s[:, start:start + frames_per_bar].ravel()))
    same, other = [], []
    per_bar_pass = np.full((passes, bars), np.nan)
    for i, (p, b, v) in enumerate(cube):
        for q, c, w in cube[i + 1:]:
            r = np.corrcoef(v, w)[0, 1]
            if b == c and p != q:
                same.append(r)
                if q == p + 1:
                    per_bar_pass[p, b] = r
            elif p == q:
                other.append(r)
    return np.array(same), np.array(other), per_bar_pass


def main(root):
    root = Path(root)
    report = ["# Shiftland audio measurements", "", "## Music (first 60 s for loudness; whole render for variation)", "",
              "| biome | peak dBFS | LUFS | RMS dB | RMS range 3 s | longest gap s | DC | <120 | 120-500 | 500-2k | 2-6k | >6k dB | resonance | in key | max click |", "|---|" + "---|" * 14]
    fig, axes = plt.subplots(len(SONGS), 1, figsize=(15, 2.1 * len(SONGS)), constrained_layout=True)
    var_fig, var_axes = plt.subplots(len(SONGS), 1, figsize=(12, 1.3 * len(SONGS)), constrained_layout=True)
    (root / "listen").mkdir(exist_ok=True)
    var_rows = []
    for ax, vax, (name, (bpm, beats, bars, scale)) in zip(axes, var_axes, SONGS.items()):
        path = root / f"music-{name}.wav"
        sr, d = load(path)
        head = d[: 60 * sr]
        mono = head.mean(axis=1)
        win = 3 * sr
        rw = [db(np.sqrt(np.mean(mono[i:i + win] ** 2))) for i in range(0, len(mono) - win, win)]
        click, click_t = clicks(head, sr)
        fr, res = resonance(mono, sr)
        b = bands(mono, sr)
        report.append(f"| {name} | {db(np.abs(head).max()):.1f} | {lufs(head, sr):.1f} | {db(np.sqrt(np.mean(mono ** 2))):.1f} | {min(rw):.1f} to {max(rw):.1f} | {longest_silence(mono, sr):.1f} | {mono.mean():.1e} | "
                      + " | ".join(f"{x:.1f}" for x in b) + f" | {res:.1f} dB @ {fr:.0f} | {100 * chroma_in_key(mono, sr, scale):.1f}% | {click:.0f} @ {click_t:.1f}s |")
        spectrogram(ax, mono, sr, f"{name}: {bpm} bpm, {bars} bars ({60 / bpm * beats * bars:.0f} s a pass)")
        wavfile.write(root / "listen" / f"music-{name}.wav", sr, (np.clip(head, -1, 1) * 32767).astype(np.int16))
        full = d.mean(axis=1)
        same, other, per = bar_variation(full, sr, bpm, beats, bars)
        passes = per.shape[0]
        var_rows.append(f"| {name} | {passes} | {np.mean(same):.3f} | {np.percentile(same, 95):.3f} | {np.max(same):.3f} | {100 * np.mean(same > 0.98):.1f}% | {np.mean(other):.3f} |")
        im = vax.imshow(per, vmin=0.5, vmax=1, aspect="auto", cmap="viridis")
        vax.set_title(f"{name}: correlation of each bar with the same bar one pass later", fontsize=8, loc="left")
        vax.tick_params(labelsize=6)
    fig.savefig(root / "spectrogram-music.png", dpi=110)
    var_fig.colorbar(im, ax=var_axes, shrink=0.5)
    var_fig.savefig(root / "variation.png", dpi=110)

    report += ["", "## Bar-to-bar variation across passes (300 Hz-4 kHz log spectra)", "",
               "`same` compares a bar with itself in other passes; 1.000 would be a robotic repeat. `other` compares different bars in one pass, as the floor.", "",
               "| biome | passes | same mean | same p95 | same max | bars >0.98 | other mean |", "|---|---|---|---|---|---|---|"] + var_rows

    sfx = sorted(root.glob("sfx-*.wav"))
    report += ["", "## SFX", "", "| sfx | peak dBFS | RMS dB | length to -50 dBFS s | final 100 ms dB | DC | resonance |", "|---|---|---|---|---|---|---|"]
    cols = 5
    rows = int(np.ceil(len(sfx) / cols))
    fig, axes = plt.subplots(rows, cols, figsize=(15, 1.9 * rows), constrained_layout=True)
    for ax, path in zip(axes.ravel(), sfx):
        sr, d = load(path)
        mono = d.mean(axis=1)
        env = np.abs(d).max(axis=1)
        over = np.nonzero(env > 10 ** (-50 / 20))[0]
        length = (over[-1] / sr - 0.05) if len(over) else 0
        tail = db(np.sqrt(np.mean(mono[-int(0.1 * sr):] ** 2)))
        loud = mono[: max(int(length * sr), 1024) + int(0.05 * sr)]
        fr, res = resonance(loud, sr) if len(loud) > 16384 else (0, 0)
        name = path.stem.replace("sfx-", "")
        report.append(f"| {name} | {db(env.max()):.1f} | {db(np.sqrt(np.mean(loud ** 2))):.1f} | {length:.2f} | {tail:.1f} | {mono.mean():.1e} | {res:.1f} dB @ {fr:.0f} |")
        f, t, s = signal.spectrogram(mono[: int(min(len(mono), max(1.5, length + 0.2) * sr))], sr, nperseg=512, noverlap=384, scaling="spectrum")
        ax.pcolormesh(t, f, 10 * np.log10(s + 1e-12), vmin=-100, vmax=-25, cmap="magma", shading="auto")
        ax.set_yscale("symlog", linthresh=300)
        ax.set_ylim(40, 16000)
        ax.set_title(f"{name}  {db(env.max()):.0f} dB, {length:.2f} s", fontsize=8, loc="left")
        ax.tick_params(labelsize=6)
    for ax in axes.ravel()[len(sfx):]:
        ax.axis("off")
    fig.savefig(root / "spectrogram-sfx.png", dpi=110)

    fig, axes = plt.subplots(3, 1, figsize=(15, 6.5), constrained_layout=True)
    for ax, name, title in [(axes[0], "scene-crossfade", "meadow 0-9, same-biome call at 5, coast from 9, duck 14-17, stop at 20"),
                            (axes[1], "scene-ocean", "ocean alone, level 1"), (axes[2], "mix-pileup", "finale + ocean + pour + 6 uplifts + cracks + complete + crush + stars")]:
        sr, d = load(root / f"{name}.wav")
        spectrogram(ax, d.mean(axis=1), sr, title, top=12000)
        p, r = db(np.abs(d).max()), db(np.sqrt(np.mean(d ** 2)))
        report.append(f"\n{name}: peak {p:.1f} dBFS, RMS {r:.1f} dB, LUFS {lufs(d, sr):.1f}")
    fig.savefig(root / "spectrogram-scenes.png", dpi=110)
    (root / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))


if __name__ == "__main__":
    main(sys.argv[1])
