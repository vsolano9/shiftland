"""Turns the frames from scripts/gif.mjs into press/push.gif. Usage: python scripts/gif.py"""
import json, os, glob, tempfile
from PIL import Image

src = os.path.join(tempfile.gettempdir(), 'shiftland-gif-frames')
files = sorted(glob.glob(os.path.join(src, '*.png')))
times = json.load(open(os.path.join(src, 'times.json')))
frames = [Image.open(f).convert('RGB').resize((640, 360), Image.LANCZOS) for f in files]
palette = frames[len(frames) // 2].quantize(colors=128, method=Image.MEDIANCUT)
out = [f.quantize(palette=palette, dither=Image.NONE) for f in frames]
dur = [max(50, min(110, b - a)) for a, b in zip(times, times[1:])] + [1800]  # a slow capture shouldn't play as a slow game
dest = os.path.join(os.path.dirname(__file__), '..', '..', 'press', 'push.gif')
out[0].save(dest, save_all=True, append_images=out[1:], duration=dur, loop=0, optimize=True)
print(os.path.getsize(dest), 'bytes', len(out), 'frames', sum(dur), 'ms')
