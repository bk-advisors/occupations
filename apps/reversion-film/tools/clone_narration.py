# Synthesise the film's narration in Matthew's cloned voice.
#
#   python tools/clone_narration.py --ref D:\voiceclone\reference --out D:\voiceclone\wav
#   python tools/clone_narration.py ... --only 1,2,3     # a few lines, for auditioning
#
# Zero-shot cloning with F5-TTS: a short reference recording plus its exact
# transcript conditions the model, and no training or fine-tuning happens. The
# reference is built by make-reference.py from the Africa film's own recorded
# clips, so this is Matthew's voice cloned from Matthew's recordings.
#
# Runs on CPU. There is no CUDA device on this machine, so this is slow and
# meant to be left running; --only exists so quality can be judged off three
# lines before committing to all seventy nine.
#
# Every line is written as a separate wav named after its caption index, which
# is what tools/build_narration.py expects and what the film's all-or-nothing
# narration layer needs.
import argparse
import json
import os
import time
from pathlib import Path

# The model weights are about 1.4 GB and Hugging Face caches to the user
# profile by default, which lives on a C: drive with roughly 3 GB free on this
# machine. Point the cache at D: before anything imports huggingface_hub, or
# the download either fails or leaves C: with nothing to spare.
os.environ.setdefault("HF_HOME", r"D:\voiceclone\hf")

# Hugging Face's xet transfer stalls at zero bytes on this connection; plain
# HTTP works. Costs nothing when xet would have worked.
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

# torchaudio 2.11 hands decoding to torchcodec, which dynamically loads FFmpeg
# *shared libraries*. There is no ffmpeg on this machine, so the import dies
# with "Could not load this library: libtorchcodec_core4.dll". The DLLs live in
# D:\voiceclone\ffmpeg; add them to the search path before torch is imported.
_FFMPEG = Path(r"D:\voiceclone\ffmpeg")
if _FFMPEG.exists():
    for _bin in _FFMPEG.rglob("bin"):
        if any(_bin.glob("avcodec-*.dll")):
            os.add_dll_directory(str(_bin))
            os.environ["PATH"] = f"{_bin};{os.environ.get('PATH', '')}"
            break

APP = Path(__file__).resolve().parent.parent


def parse_only(s):
    if not s:
        return None
    out = set()
    for part in s.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            out.update(range(int(a), int(b) + 1))
        elif part:
            out.add(int(part))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", type=Path, default=Path(r"D:\voiceclone\reference"))
    ap.add_argument("--out", type=Path, default=Path(r"D:\voiceclone\wav"))
    ap.add_argument("--only", type=str, default=None, help="line numbers, e.g. 1,5,12-14")
    ap.add_argument("--nfe", type=int, default=24,
                    help="flow-matching steps; 32 is the default quality, 16 is roughly twice as fast")
    ap.add_argument("--speed", type=float, default=0.95,
                    help="under 1 slows the read; this is a quiet, unhurried piece")
    ap.add_argument("--seed", type=int, default=18860217,
                    help="base seed; each line uses seed+n so one line can be redone alone")
    ap.add_argument("--skip-existing", action="store_true",
                    help="resume a part-finished run instead of starting over")
    args = ap.parse_args()

    lines = json.loads((APP / "narration" / "tts-lines.json").read_text(encoding="utf-8"))
    only = parse_only(args.only)
    if only:
        lines = [l for l in lines if l["n"] in only]

    ref_wav = args.ref / "reference.wav"
    ref_txt = (args.ref / "reference.txt").read_text(encoding="utf-8").strip()
    if not ref_wav.exists():
        raise SystemExit(f"no reference at {ref_wav}; run make-reference.py first")

    args.out.mkdir(parents=True, exist_ok=True)

    from f5_tts.api import F5TTS  # imported late: loading torch takes a while

    print("loading F5-TTS (first run downloads the model)...")
    t0 = time.time()
    tts = F5TTS()
    print(f"model ready in {time.time() - t0:.0f}s")
    print(f"reference: {ref_wav.name}, {len(ref_txt.split())} words of transcript")
    print(f"synthesising {len(lines)} line(s) at nfe={args.nfe}, speed={args.speed}\n")

    started = time.time()
    audio_total = 0.0
    done = 0
    for i, l in enumerate(lines, 1):
        dest = args.out / f"{l['file']}.wav"
        if args.skip_existing and dest.exists() and dest.stat().st_size > 1000:
            print(f"[{i:>2}/{len(lines)}] {l['file']}  already done, skipping")
            done += 1
            continue
        t1 = time.time()
        # Seeded per line, so a re-run reproduces the same audio and redoing one
        # changed caption does not reshuffle the reading of every other line.
        wav, sr, _ = tts.infer(
            ref_file=str(ref_wav),
            ref_text=ref_txt,
            gen_text=l["text"],
            file_wave=str(dest),
            nfe_step=args.nfe,
            speed=args.speed,
            seed=args.seed + l["n"],
            remove_silence=False,
        )
        dur = len(wav) / sr
        audio_total += dur
        took = time.time() - t1
        print(f"[{i:>2}/{len(lines)}] {l['file']}  {dur:5.1f}s audio  "
              f"{took:5.1f}s compute  ({took / max(dur, 0.01):.1f}x realtime)")

    synthesised = len(lines) - done
    elapsed = time.time() - started
    print(f"\n{len(lines)} lines, {audio_total/60:.1f} min of speech "
          f"in {elapsed/60:.1f} min ({elapsed/max(audio_total, 0.01):.1f}x realtime)")
    print(f"wavs in {args.out}")
    if only:
        remaining = 79 - len(lines)
        print(f"\naudition only. The remaining {remaining} lines would take about "
              f"{remaining * (elapsed / len(lines)) / 60:.0f} min at this rate.")


if __name__ == "__main__":
    main()
