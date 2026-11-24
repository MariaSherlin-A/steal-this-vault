"""
Voices the second film's narration (src/film/script.ts) with Edge's neural voice "Andrew"
and records when each word is spoken, for the word-lit subtitles.

    <venv>/python scripts/voice-film.py

Writes public/audio/film-NN.wav (48 kHz mono, -16 LUFS) and src/film/words.json:
{ scene: { "seconds": length, "words": [[text, start, end], ...] } }.
Only the spoken text is respelt for pronunciation; the subtitle words keep the real spelling.
"""
import asyncio
import json
import pathlib
import re
import subprocess
import tempfile

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICE = "en-US-AndrewMultilingualNeural"

src = (ROOT / "src" / "film" / "script.ts").read_text(encoding="utf8")
order = re.findall(r'"(\w+)"', re.search(r"SCENES = \[([^\]]+)\]", src).group(1))
lines = dict(re.findall(r'\n  (\w+):\s*\n?\s*"([^"]+)"', src))

SAY = [("QoreChain", "Core Chain"), ("Q-Day", "Q Day"), ("QOR", "Q O R")]


def spoken(text: str) -> str:
    for a, b in SAY:
        text = text.replace(a, b)
    return text


def seconds(path: pathlib.Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True
    )
    return float(out.stdout.strip())


async def voice(text: str, mp3: pathlib.Path) -> list:
    """Save the speech and return the spoken words with their start and end, in seconds."""
    words = []
    com = edge_tts.Communicate(spoken(text), VOICE, rate="-4%", pitch="-2Hz", boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                words.append([chunk["text"], round(start, 3), round(start + chunk["duration"] / 1e7, 3)])
    return words


def to_written(text: str, spoken_words: list) -> list:
    """Map the voice's word timings back onto the written words, so subtitles keep the real spelling."""
    written = text.split()
    out = []
    j = 0
    for w in written:
        # a written word may be voiced as several words ("Q-Day" as "Q Day", "QOR" as "Q O R")
        parts = len(spoken(w).split())
        group = spoken_words[j : j + parts] or spoken_words[-1:]
        out.append([w, group[0][1], group[-1][2]])
        j += parts
    return out


async def main() -> None:
    audio = ROOT / "public" / "audio"
    audio.mkdir(parents=True, exist_ok=True)
    timings = {}
    with tempfile.TemporaryDirectory() as tmp:
        for i, key in enumerate(order, 1):
            mp3 = pathlib.Path(tmp) / f"film-{i:02d}.mp3"
            for attempt in range(4):
                try:
                    words = await voice(lines[key], mp3)
                    break
                except edge_tts.exceptions.NoAudioReceived:
                    print(f"  {key}: no audio from the service, retrying ({attempt + 1})")
                    await asyncio.sleep(3 * (attempt + 1))
            else:
                raise SystemExit(f"the voice service gave no audio for {key}")
            wav = audio / f"film-{i:02d}.wav"
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-af", "highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "1", str(wav)],
                check=True,
            )
            timings[key] = {"file": wav.name, "seconds": round(seconds(wav), 3), "words": to_written(lines[key], words)}
            print(f"{wav.name}  {key:10s} {timings[key]['seconds']:6.2f}s  {len(words)} spoken words")
    (ROOT / "src" / "film" / "words.json").write_text(json.dumps(timings, indent=1), encoding="utf8")


asyncio.run(main())
