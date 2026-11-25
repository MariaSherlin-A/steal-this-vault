# video

The demo film, made from code with [Remotion](https://www.remotion.dev): React rendered frame
by frame in Chrome, then encoded with FFmpeg. 2:48, 1920x1080, 60 fps.

Scenes 1, 2 and the close are drawn in code. Every other scene is a real recording of the
running site, taken one frame at a time so its animations come out smooth at 60 fps while the
chain data loads live. The attack lab was run live for the film, with recording off. Callout
boxes are measured from the page, not placed by eye.

This package is not in the root workspaces, so the keeper's install stays small; it has its
own `package.json`.

## Build

```sh
cd video
npm install
# 1. the site running locally (npm run dev at the root), then record every site shot:
node --experimental-websocket capture/shots.mjs http://localhost:5173/
# 2. narration with word timings (needs Python and edge-tts)
npm run film:voice
# 3. original score to the scene lengths, then the final sound mix
npm run film:sound
# 4. the picture, with and without subtitles
npm run film
npm run film:clean
```

Then join each picture with `public/music/film-mix.wav` in FFmpeg, normalised to -16 LUFS:

```sh
ffmpeg -i out/film-subtitled-picture.mp4 -i public/music/film-mix.wav -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a aac -b:a 320k -shortest -movflags +faststart \
  out/steal-this-vault-film-subtitled.mp4
```

## Where things are

- `capture/rec60.mjs`: the frame-exact recorder (drives Chrome through its DevTools protocol).
- `capture/shots.mjs`: every site shot, scripted: where to scroll, what to click, how long.
- `src/film/`: the film. `script.ts` holds the narration, `words.json` its word timings,
  `Film.tsx` the scenes and callouts, `SiteScene.tsx` the framed recordings.
- `scripts/voice-film.py`, `scripts/score-film.mjs`, `scripts/mix-film.mjs`: voice, music, mix.
- `src/scenes/` and the `Main` composition: an earlier, fully animated draft of the film, kept
  for the record (`npm run render`). It is not the submitted film.
- `public/rec/`, `public/audio/`, `public/music/` and `out/`: recordings, sound and renders,
  ignored by git.

## Credits

Narration: Microsoft Edge's neural voice "Andrew", through edge-tts. Music: composed for the
film in code (`scripts/score-film.mjs`). Photo of IBM Quantum System One: IBM Research, CC BY 2.0.
Statistic: Chainalysis, December 2025, as reported by The Block.
