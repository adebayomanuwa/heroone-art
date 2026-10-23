#!/usr/bin/env python3
"""Waveform + loudness envelope for the player (no audio leaves your machine).
Usage: python3 tools/peaks.py <track-id> <path/to/song.mp3>   (needs ffmpeg and numpy)
Writes assets/music/<track-id>.json"""
import subprocess, sys, json, base64, os
import numpy as np
tid, src = sys.argv[1], sys.argv[2]
SR = 8000
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
B = 240; n = len(x) // B
rms = np.sqrt(np.mean(x[:n * B].reshape(B, n) ** 2, axis=1))
lo, hi = np.percentile(rms, 3), rms.max()
peaks = [int(round(v * 100)) for v in 0.12 + 0.88 * np.power(np.clip((rms - lo) / (hi - lo), 0, 1), 1.35)]
H = SR // 20; m = len(x) // H
e = np.sqrt(np.mean(x[:m * H].reshape(m, H) ** 2, axis=1)); out = np.zeros_like(e); a = 0
for i, v in enumerate(e):
    a = v if v > a else a * 0.82 + v * 0.18; out[i] = a
env = np.clip(out / (np.percentile(out, 98) or 1), 0, 1)
dst = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'music', tid + '.json')
json.dump({'id': tid, 'duration': round(len(x) / SR, 2), 'peaks': peaks, 'envHz': 20, 'env': base64.b64encode((env * 255).astype(np.uint8).tobytes()).decode()}, open(dst, 'w'), separators=(',', ':'))
print('wrote', dst)
