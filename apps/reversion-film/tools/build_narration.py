# Turn a folder of synthesised (or recorded) line wavs into the film's audio/
# folder: trimmed, level-matched, encoded to mono mp3 at 128 kbps, named
# line-01.mp3 .. line-NN.mp3 to match the caption order.
#
#   python tools/build_narration.py <wav_dir> [--dry-run]
#
# The film's narration layer is all-or-nothing: one missing clip disables the
# whole voice track and the film falls back to captions on the authored
# timeline. So this refuses to write a partial set, and says which lines are
# missing instead.
#
# Levels are matched to the Africa film's recorded clips rather than pushed to
# a broadcast target. That film's narration is the reference for what Matthew's
# voice sits at in this house, and a louder clone would stick out the moment
# the two pieces are watched back to back.
import argparse
import json
import math
import sys
from pathlib import Path

import av
import numpy as np
import soundfile as sf

APP = Path(__file__).resolve().parent.parent
AUDIO_OUT = APP / "audio"
LINES = json.loads((APP / "narration" / "tts-lines.json").read_text(encoding="utf-8"))

# Measured across the Africa film's recorded clips, not guessed: they average
# -28.8 dBFS RMS. Normalising the clone to a broadcast-ish -23 would put it
# about 6 dB above Matthew's real voice, which is exactly the tell you notice
# when the two films are watched back to back.
TARGET_RMS_DBFS = -28.8
PEAK_CEILING = 0.95
HEAD_PAD = 0.06           # seconds of silence kept at the head
TAIL_PAD = 0.22           # and at the tail, so the cut never clips a breath
SILENCE_DB = -45.0        # below this counts as silence for trimming


def db(x):
    return 20 * math.log10(max(x, 1e-9))


def rms(a):
    return float(np.sqrt(np.mean(np.square(a)))) if len(a) else 0.0


def trim(a, sr):
    """Drop leading and trailing silence, keeping a small pad."""
    if not len(a):
        return a
    win = max(1, int(0.01 * sr))
    frames = a[: len(a) // win * win].reshape(-1, win)
    loud = np.sqrt(np.mean(np.square(frames), axis=1))
    above = np.where(db_arr(loud) > SILENCE_DB)[0]
    if not len(above):
        return a
    start = max(0, above[0] * win - int(HEAD_PAD * sr))
    end = min(len(a), (above[-1] + 1) * win + int(TAIL_PAD * sr))
    return a[start:end]


def db_arr(a):
    return 20 * np.log10(np.maximum(a, 1e-9))


def read_any(path, sr=24000):
    """Read wav/mp3 to mono float32 at sr."""
    if path.suffix.lower() == ".wav":
        a, in_sr = sf.read(str(path), dtype="float32", always_2d=True)
        a = a.mean(axis=1)
        if in_sr != sr:
            idx = np.linspace(0, len(a) - 1, int(len(a) * sr / in_sr))
            a = np.interp(idx, np.arange(len(a)), a).astype(np.float32)
        return a
    with av.open(str(path)) as c:
        res = av.AudioResampler(format="fltp", layout="mono", rate=sr)
        out = []
        for frame in c.decode(c.streams.audio[0]):
            for f in res.resample(frame):
                out.append(f.to_ndarray().reshape(-1))
        for f in res.resample(None):
            out.append(f.to_ndarray().reshape(-1))
    return np.concatenate(out) if out else np.zeros(0, dtype=np.float32)


def write_mp3(path, audio, sr=24000, bitrate=128000):
    """Encode mono mp3, matching the Africa film's 128 kbps mono clips."""
    with av.open(str(path), mode="w") as c:
        stream = c.add_stream("mp3", rate=sr)
        stream.bit_rate = bitrate
        frame = av.AudioFrame.from_ndarray(
            np.ascontiguousarray((audio * 32767).astype(np.int16).reshape(1, -1)),
            format="s16", layout="mono")
        frame.rate = sr
        for packet in stream.encode(frame):
            c.mux(packet)
        for packet in stream.encode(None):
            c.mux(packet)


def report_reference():
    """What the recorded clips actually sit at, for the target above."""
    ref = APP.parent / "africa-causes-of-death-film" / "audio"
    vals = []
    for p in sorted(ref.glob("line-*.mp3"))[:12]:
        a = read_any(p)
        if len(a):
            vals.append(db(rms(a)))
    return sum(vals) / len(vals) if vals else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wav_dir", type=Path)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--target-db", type=float, default=TARGET_RMS_DBFS)
    args = ap.parse_args()

    src = {}
    for l in LINES:
        for ext in (".wav", ".mp3", ".flac"):
            p = args.wav_dir / f"{l['file']}{ext}"
            if p.exists():
                src[l["n"]] = p
                break

    missing = [l["n"] for l in LINES if l["n"] not in src]
    if missing:
        print(f"MISSING {len(missing)} of {len(LINES)} lines: {missing[:12]}"
              f"{' ...' if len(missing) > 12 else ''}")
        print("The narration layer is all-or-nothing; refusing to write a partial set.")
        return 1

    measured = report_reference()
    if measured is not None:
        print(f"recorded reference sits at {measured:.1f} dBFS RMS; "
              f"matching clone to {args.target_db:.1f}")

    AUDIO_OUT.mkdir(exist_ok=True)
    total = 0.0
    rows = []
    for l in LINES:
        a = trim(read_any(src[l["n"]]), 24000)
        cur = rms(a)
        if cur > 0:
            a = a * (10 ** ((args.target_db - db(cur)) / 20))
        peak = float(np.max(np.abs(a))) if len(a) else 0.0
        if peak > PEAK_CEILING:
            a = a * (PEAK_CEILING / peak)
        dur = len(a) / 24000
        total += dur
        rows.append((l["n"], dur, l["seconds"]))
        if not args.dry_run:
            write_mp3(AUDIO_OUT / f"{l['file']}.mp3", a)

    print(f"\n{len(rows)} lines, {total/60:.1f} min of speech"
          f"{' (dry run, nothing written)' if args.dry_run else f' -> {AUDIO_OUT}'}")

    # Lines that came out far longer than their authored slot are the ones the
    # timeline will have to stretch hardest around, and usually mean the
    # synthesiser tripped on something.
    odd = [r for r in rows if r[1] > r[2] * 1.6 or r[1] < r[2] * 0.45]
    if odd:
        print(f"\n{len(odd)} lines are far off their authored duration, check these first:")
        for n, got, want in odd[:15]:
            print(f"  line-{n:02d}  {got:5.1f}s vs {want:4.1f}s authored")

    write_checklist(rows)
    print(f"listen-through order written to narration/listen-checklist.md")
    return 0


def write_checklist(rows):
    """A listen-through ordered by risk rather than by line number.

    Every line has to be heard before this ships: no automated check catches a
    swallowed clause, a wrong stress or a number read as digits. Ordering by
    how likely each line is to be wrong means the problems surface in the first
    ten minutes rather than the last.
    """
    by_n = {l["n"]: l for l in LINES}
    scored = []
    for n, got, want in rows:
        l = by_n[n]
        ratio = got / want if want else 1
        # Long text is split into several generation passes, and the joins are
        # where a seam or a repeated word shows up.
        chunked = len(l["text"]) > 135
        expanded = l["text"] != l["original"]
        risk = (2.5 if chunked else 0) + (1.5 if ratio > 1.6 else 0) + (1.5 if ratio < 0.6 else 0) \
            + (1.0 if expanded else 0)
        why = ", ".join(filter(None, [
            "split into chunks" if chunked else "",
            f"{ratio:.2f}x its slot" if ratio > 1.6 or ratio < 0.6 else "",
            "numbers expanded" if expanded else "",
        ])) or "routine"
        scored.append((risk, n, got, want, why, l))
    scored.sort(key=lambda r: (-r[0], r[1]))

    md = ["# Narration listen-through", "",
          "Ordered by how likely each line is to be wrong, not by line number, so",
          "problems surface early. Tick them off as you go.", "",
          f"{len(scored)} lines. Synthesised, so every one needs hearing: no check here",
          "catches a swallowed clause, a wrong stress, or a figure read as digits.", ""]
    last_risky = None
    for risk, n, got, want, why, l in scored:
        risky = risk > 0
        if risky != last_risky:
            md.append(f"\n## {'Check these first' if risky else 'Routine'}\n")
            last_risky = risky
        md.append(f"- [ ] **{l['file']}** ({got:.1f}s, {why})  \n      {l['text']}")
    (APP / "narration" / "listen-checklist.md").write_text("\n".join(md) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
