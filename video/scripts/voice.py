"""
Voices the narration in src/script.ts with Microsoft Edge's neural voice "Andrew"
(en-US-AndrewMultilingualNeural) through the edge-tts package, one file per scene,
then evens out the loudness with ffmpeg (-16 LUFS) into public/audio/scene-NN.wav.

    python -m venv .venv && .venv/Scripts/pip install edge-tts
    .venv/Scripts/python scripts/voice.py
    npm run timing && npm run score && npm run render

Only the spoken text is changed for pronunciation; the subtitles keep the real spelling.
"""
import asyncio
import pathlib
import re
import subprocess
import tempfile

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORDER = ["wallet", "leak", "drain", "quantum", "qday", "title", "dare", "locks", "attacks", "control", "product", "drill", "close"]
VOICE = "en-US-AndrewMultilingualNeural"

src = (ROOT / "src" / "script.ts").read_text(encoding="utf8")
narration = dict(re.findall(r'\n  (\w+):\s*\n?\s*"([^"]+)"', src))


def spoken(text: str) -> str:
    return text.replace("QoreChain", "Core Chain").replace("ML-DSA-87", "M L D S A eighty-seven").replace("Q-Day", "Q Day")


async def main() -> None:
    out = ROOT / "public" / "audio"
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for i, key in enumerate(ORDER, 1):
            raw = pathlib.Path(tmp) / f"scene-{i:02d}.mp3"
            await edge_tts.Communicate(spoken(narration[key]), VOICE, rate="-4%", pitch="-2Hz").save(str(raw))
            wav = out / f"scene-{i:02d}.wav"
            subprocess.run(
                ["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", "highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "1", str(wav)],
                check=True,
            )
            print(wav.name, key)


asyncio.run(main())
