"""
Generates Framatic's built-in music library and sound effects.

Everything here is synthesized from scratch (oscillators + noise), so the
audio is original and free to use in any ad. Re-run to regenerate:
    python3 scripts/music/generate.py public/audio
then encode WAV -> MP3 (see scripts/music/encode.sh).
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
rng = np.random.default_rng(7)


# ---------- helpers ----------
def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_arr(sec):
    return np.arange(int(sec * SR)) / SR


def env_exp(n, decay):
    t = np.arange(n) / SR
    return np.exp(-t / max(decay, 1e-4))


def adsr(n, a=0.01, d=0.1, s=0.7, r=0.1):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n)
    e[:na] = np.linspace(0, 1, na, endpoint=False) if na else e[:na]
    nd = min(nd, max(0, n - na))
    if nd:
        e[na : na + nd] = np.linspace(1, s, nd, endpoint=False)
    nr = min(nr, n)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((t * freq + phase) % 1.0) - 1


def lp(x, cutoff, order=2):
    b, a = signal.butter(order, min(cutoff, SR / 2 - 100) / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def hp(x, cutoff, order=2):
    b, a = signal.butter(order, cutoff / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def place(buf, sample, start_sec, gain=1.0):
    s = int(start_sec * SR)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(sample))
    buf[s:e] += sample[: e - s] * gain


def delay(x, sec, fb=0.35, mix=0.3):
    d = int(sec * SR)
    a = np.zeros(d + 1)
    a[0] = 1
    a[d] = -fb
    wet = signal.lfilter([1], a, x)
    return x * (1 - mix) + (wet - x) * mix + x * mix


def reverb(x, size=1.0, mix=0.25):
    combs = [1557, 1617, 1491, 1422]
    out = np.zeros_like(x)
    for c in combs:
        d = int(c * size)
        a = np.zeros(d + 1)
        a[0] = 1
        a[d] = -0.78
        out += signal.lfilter([1], a, x)
    out /= len(combs)
    for ap in (225, 556):
        d = int(ap * size)
        b = np.zeros(d + 1)
        b[0] = -0.5
        b[d] = 1
        a = np.zeros(d + 1)
        a[0] = 1
        a[d] = -0.5
        out = signal.lfilter(b, a, out)
    out = lp(out, 6000)
    return x * (1 - mix) + out * mix


# ---------- instruments ----------
def kick(punch=1.0):
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_exp(n, 0.16)
    click = hp(rng.standard_normal(n), 3000) * env_exp(n, 0.004) * 0.25
    return np.tanh((body + click) * 1.6 * punch) * 0.9


def snare():
    n = int(0.3 * SR)
    noise = bp(rng.standard_normal(n), 1200, 7000) * env_exp(n, 0.07)
    tone = np.sin(2 * np.pi * 190 * t_arr(0.3)[:n]) * env_exp(n, 0.05) * 0.5
    return (noise * 0.8 + tone) * 0.7


def clap():
    n = int(0.35 * SR)
    out = np.zeros(n)
    for i, off in enumerate((0, 0.011, 0.022)):
        burst = bp(rng.standard_normal(n), 900, 5000) * env_exp(n, 0.012 if i < 2 else 0.12)
        place(out, burst, off, 0.6)
    return out * 0.8


def hat(open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    x = hp(rng.standard_normal(n), 7500, 3) * env_exp(n, 0.09 if open_ else 0.018)
    return x * 0.35


def shaker():
    n = int(0.09 * SR)
    x = bp(rng.standard_normal(n), 5000, 11000) * adsr(n, 0.02, 0.03, 0.2, 0.03)
    return x * 0.25


def bass_note(m, dur, cutoff=500, sub=0.6):
    n = int(dur * SR)
    f = mtof(m)
    x = saw(f, n) * 0.6 + np.sin(2 * np.pi * f * np.arange(n) / SR) * sub
    x = lp(x, cutoff, 2) * adsr(n, 0.005, 0.12, 0.75, 0.04)
    return np.tanh(x * 1.4) * 0.55


def pad_chord(notes, dur, cutoff=1800, bright=1.0):
    n = int(dur * SR)
    x = np.zeros(n)
    for m in notes:
        f = mtof(m)
        for det in (-0.12, 0.0, 0.11):
            x += saw(f * 2 ** (det / 12), n, rng.random())
    x = lp(x / (len(notes) * 3), cutoff * bright, 2)
    return x * adsr(n, 0.25, 0.4, 0.8, 0.35) * 0.55


def pluck(m, dur=0.35, cutoff=3500, square=False):
    n = int(dur * SR)
    f = mtof(m)
    t = np.arange(n) / SR
    if square:
        x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + saw(f * 2, n) * 0.2
    else:
        x = saw(f, n) * 0.7 + np.sin(2 * np.pi * f * 2 * t) * 0.2
    sweep = lp(x, cutoff, 2)
    return sweep * env_exp(n, dur * 0.35) * 0.45


def epiano(m, dur):
    n = int(dur * SR)
    f = mtof(m)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * env_exp(n, 0.3) + 0.12 * np.sin(2 * np.pi * 3 * f * t) * env_exp(n, 0.15)
    trem = 1 + 0.08 * np.sin(2 * np.pi * 4.5 * t)
    return x * trem * env_exp(n, 1.1) * adsr(n, 0.004, 0.05, 1.0, 0.05) * 0.22


def bell(m, dur=1.2):
    n = int(dur * SR)
    f = mtof(m)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.0 * env_exp(n, 0.4)
    return np.sin(2 * np.pi * f * t + mod) * env_exp(n, 0.6) * 0.18


# ---------- arrangement ----------
def chord_notes(root, quality):
    shapes = {"maj": [0, 4, 7], "min": [0, 3, 7], "maj7": [0, 4, 7, 11], "min7": [0, 3, 7, 10], "sus2": [0, 2, 7], "add9": [0, 4, 7, 14]}
    return [root + i for i in shapes[quality]]


def sidechain(n, beat, bars, beats_per_bar=4, depth=0.55, release=0.22):
    env = np.ones(n)
    for b in range(bars * beats_per_bar):
        s = int(b * beat * SR)
        k = int(release * SR)
        seg = 1 - depth * np.exp(-np.arange(k) / (k / 4))
        e = min(n, s + k)
        env[s:e] = np.minimum(env[s:e], seg[: e - s])
    return env


def render_track(spec):
    bpm = spec["bpm"]
    beat = 60 / bpm
    bar = beat * 4
    prog = spec["progression"]  # list of (root_midi, quality) per bar (cycled)
    sections = spec["sections"]  # list of (name, bars, layers)
    total_bars = sum(b for _, b, _ in sections)
    n = int((total_bars * bar + 2.5) * SR)
    drums, bass, pads, lead = (np.zeros(n) for _ in range(4))
    swing = spec.get("swing", 0.0)
    bar_i = 0
    for name, bars, layers in sections:
        for bb in range(bars):
            t0 = bar_i * bar
            root, q = prog[bar_i % len(prog)]
            notes = chord_notes(root, q)
            # drums
            for k in range(4):
                tb = t0 + k * beat
                if "kick" in layers and (spec.get("four_on_floor") or k in (0, 2) or (k == 3 and bb % 2 == 1 and spec.get("kick_push"))):
                    place(drums, kick(), tb, 0.95)
                if "snare" in layers and k in (1, 3):
                    place(drums, clap() if spec.get("clap") else snare(), tb, 0.8)
                if "hats" in layers:
                    for s8 in (0, 1):
                        off = s8 * beat / 2 + (swing * beat / 2 if s8 else 0)
                        place(drums, hat(open_=(s8 == 1 and spec.get("open_hats"))), tb + off, 0.8 if s8 else 0.55)
                if "shaker" in layers:
                    for s16 in range(4):
                        place(drums, shaker(), tb + s16 * beat / 4 + (swing * beat / 4 if s16 % 2 else 0), 0.9 if s16 % 2 else 0.5)
            # bass
            if "bass" in layers:
                pattern = spec.get("bass_pattern", [(0, 1.0), (2, 1.0)])
                for pos, length in pattern:
                    place(bass, bass_note(root - 12 if root >= 48 else root, length * beat * 0.95, spec.get("bass_cutoff", 520)), t0 + pos * beat, 1.0)
            # pads / keys
            if "pad" in layers:
                place(pads, pad_chord([m + 12 for m in notes], bar * 1.02, spec.get("pad_cutoff", 1800), 1.4 if name == "drop" else 1.0), t0, 1.0)
            if "keys" in layers:
                for k, hitb in enumerate(spec.get("keys_rhythm", [0, 1.5, 2.5])):
                    for m in notes:
                        place(pads, epiano(m + 12, beat * 1.4), t0 + hitb * beat + (0.01 * k), 0.9)
            # lead / arp
            if "arp" in layers:
                arp = [notes[i % len(notes)] + 24 + (12 if i % 8 >= 6 else 0) for i in range(8)]
                for i, m in enumerate(arp):
                    place(lead, pluck(m, beat * 0.6, spec.get("arp_cutoff", 3200), spec.get("square_arp", False)), t0 + i * beat / 2 + (swing * beat / 2 if i % 2 else 0), 0.8)
            if "bells" in layers and bb % 2 == 0:
                for i, m in enumerate([notes[-1] + 24, notes[1] + 24]):
                    place(lead, bell(m), t0 + i * beat * 2, 1.0)
            if "riser" in layers and bb == bars - 1:
                place(lead, riser_sfx(bar) * 0.5, t0, 1.0)
            bar_i += 1
    sc = sidechain(n, beat, total_bars, depth=spec.get("sc_depth", 0.5))
    lead = delay(lead, beat * 0.75, 0.35, 0.25)
    mix = drums * spec.get("drum_gain", 1.0) + bass * sc + reverb(pads, 1.0, 0.3) * sc * spec.get("pad_gain", 1.0) + reverb(lead, 0.8, 0.22)
    mix = hp(mix, 30)
    # fade tail and master
    tail = int(2.0 * SR)
    mix[-tail:] *= np.linspace(1, 0, tail) ** 2
    mix = np.tanh(mix * 1.3)
    mix /= np.max(np.abs(mix)) + 1e-9
    return (mix * 0.89).astype(np.float32), total_bars * bar


# ---------- sound effects ----------
def whoosh_sfx():
    d = 0.7
    n = int(d * SR)
    x = rng.standard_normal(n)
    t = np.arange(n) / SR
    out = np.zeros(n)
    chunk = 512
    for i in range(0, n, chunk):
        c = 400 + 5000 * np.sin(np.pi * min(1, t[i] / d)) ** 2
        out[i : i + chunk] = bp(x[i : i + chunk + 64], max(200, c * 0.5), min(16000, c * 1.6), 1)[: len(out[i : i + chunk])]
    e = np.sin(np.pi * t / d) ** 2
    return reverb(out * e, 0.7, 0.25) * 0.6


def riser_sfx(d=2.0):
    n = int(d * SR)
    t = np.arange(n) / SR
    f = 200 * 2 ** (3 * t / d)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    noise = hp(rng.standard_normal(n), 2000) * 0.2
    e = (t / d) ** 2
    return (tone + noise) * e


def hit_sfx():
    n = int(1.4 * SR)
    k = np.zeros(n)
    place(k, kick(1.4), 0, 1.0)
    noise = lp(rng.standard_normal(n), 3000) * env_exp(n, 0.25) * 0.4
    return reverb(np.tanh((k + noise) * 1.5), 1.2, 0.35) * 0.8


def impact_sfx():
    n = int(2.0 * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t * 6)) / SR) * env_exp(n, 0.6)
    noise = lp(rng.standard_normal(n), 1800) * env_exp(n, 0.35) * 0.5
    return reverb(np.tanh((sub + noise) * 1.8), 1.3, 0.4) * 0.8


def click_sfx():
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 2200 * t) * env_exp(n, 0.008) + hp(rng.standard_normal(n), 4000) * env_exp(n, 0.004) * 0.3) * 0.5


def swell_sfx():
    n = int(2.5 * SR)
    x = pad_chord([60, 64, 67, 71, 74], 2.5, 2500)
    t = np.arange(n) / SR
    return reverb(x * (t / 2.5) ** 1.5 * 1.6, 1.2, 0.4)


# ---------- library ----------
TRACKS = [
    {
        "id": "bright-pop", "title": "Bright Pop", "bpm": 120,
        "moods": ["upbeat", "energetic", "happy", "pop", "bright", "positive", "fun", "optimistic", "punchy"],
        "progression": [(60, "maj"), (55, "maj"), (57, "min"), (53, "maj")],
        "sections": [("intro", 2, ["pad", "hats", "arp"]), ("a", 8, ["kick", "snare", "hats", "bass", "pad", "arp"]),
                     ("b", 8, ["kick", "snare", "hats", "open", "bass", "pad", "arp", "bells"]), ("a2", 8, ["kick", "snare", "hats", "bass", "pad", "arp"]), ("out", 2, ["pad", "bells"])],
        "four_on_floor": False, "kick_push": True, "clap": True, "bass_pattern": [(0, 0.75), (1.5, 0.5), (2, 0.75), (3.5, 0.5)], "arp_cutoff": 4200,
    },
    {
        "id": "lofi-chill", "title": "Lo-fi Chill", "bpm": 86, "swing": 0.22,
        "moods": ["lofi", "lo-fi", "chill", "calm", "relaxed", "warm", "mellow", "soft", "cozy", "laid-back", "gentle"],
        "progression": [(65, "maj7"), (64, "min7"), (62, "min7"), (60, "maj7")],
        "sections": [("intro", 1, ["keys"]), ("a", 8, ["kick", "snare", "shaker", "bass", "keys"]), ("b", 8, ["kick", "snare", "shaker", "bass", "keys", "pad"]), ("a2", 8, ["kick", "snare", "shaker", "bass", "keys"])],
        "bass_pattern": [(0, 1.5), (2.5, 1.0)], "bass_cutoff": 380, "pad_cutoff": 1200, "pad_gain": 0.6, "drum_gain": 0.8, "sc_depth": 0.25,
        "keys_rhythm": [0, 1.75, 2.5],
    },
    {
        "id": "tech-pulse", "title": "Tech Pulse", "bpm": 124,
        "moods": ["tech", "modern", "driving", "confident", "corporate", "product", "sleek", "innovative", "professional", "saas", "electronic", "futuristic"],
        "progression": [(57, "min"), (53, "maj"), (60, "maj"), (55, "maj")],
        "sections": [("intro", 2, ["kick", "hats", "arp"]), ("a", 8, ["kick", "hats", "snare", "bass", "arp", "pad"]), ("drop", 8, ["kick", "hats", "snare", "bass", "arp", "pad"]), ("a2", 8, ["kick", "hats", "snare", "bass", "arp"]), ("out", 2, ["pad"])],
        "four_on_floor": True, "clap": True, "bass_pattern": [(0.5, 0.4), (1.5, 0.4), (2.5, 0.4), (3.5, 0.4)], "square_arp": True, "arp_cutoff": 2600, "sc_depth": 0.6,
    },
    {
        "id": "cinematic-rise", "title": "Cinematic Rise", "bpm": 96,
        "moods": ["cinematic", "epic", "inspiring", "bold", "manifesto", "emotional", "dramatic", "uplifting", "anthemic", "grand", "heroic"],
        "progression": [(62, "min"), (58, "maj"), (65, "maj"), (60, "maj")],
        "sections": [("intro", 4, ["pad", "bells"]), ("build", 4, ["pad", "bells", "kick", "riser"]), ("drop", 8, ["kick", "snare", "pad", "bass", "bells", "arp"]), ("out", 4, ["pad", "bells"])],
        "bass_pattern": [(0, 2.0), (2, 2.0)], "pad_cutoff": 2200, "pad_gain": 1.2, "arp_cutoff": 2400, "sc_depth": 0.3,
    },
    {
        "id": "playful-bounce", "title": "Playful Bounce", "bpm": 108,
        "moods": ["playful", "quirky", "bouncy", "cheeky", "friendly", "light", "whimsical", "cute", "lighthearted"],
        "progression": [(60, "maj"), (57, "min"), (62, "min"), (55, "maj")],
        "sections": [("intro", 2, ["arp", "shaker"]), ("a", 8, ["kick", "snare", "shaker", "bass", "arp"]), ("b", 8, ["kick", "snare", "shaker", "bass", "arp", "bells", "pad"]), ("a2", 8, ["kick", "snare", "shaker", "bass", "arp"]), ("out", 2, ["bells"])],
        "clap": True, "bass_pattern": [(0, 0.4), (1, 0.4), (2, 0.4), (2.75, 0.25), (3, 0.4)], "bass_cutoff": 700, "arp_cutoff": 5000, "pad_gain": 0.5,
    },
]

SFX = {"whoosh": whoosh_sfx, "riser": lambda: riser_sfx(2.0), "hit": hit_sfx, "beat_drop": impact_sfx, "click": click_sfx, "swell": swell_sfx}


def write(path, x):
    x = np.asarray(x, dtype=np.float32)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    stereo = np.stack([x, x], axis=1)
    wavfile.write(path, SR, (stereo * 32767).astype(np.int16))


def main(out_dir):
    out = Path(out_dir)
    (out / "music").mkdir(parents=True, exist_ok=True)
    (out / "sfx").mkdir(parents=True, exist_ok=True)
    manifest = []
    for spec in TRACKS:
        audio, length = render_track(spec)
        write(out / "music" / f"{spec['id']}.wav", audio)
        manifest.append({"id": spec["id"], "title": spec["title"], "bpm": spec["bpm"], "durationSec": round(length, 2), "moods": spec["moods"]})
        print("track", spec["id"], round(length, 1), "s")
    for name, fn in SFX.items():
        write(out / "sfx" / f"{name}.wav", fn())
        print("sfx", name)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "public/audio")
