# video

The demo film, built from code with [Remotion](https://www.remotion.dev) (React rendered
frame by frame in Chrome, then encoded with FFmpeg). Not a screen recording: an animated
telling of the experiment in the site's own colours and type, carried by Maria's voice.

The script is [docs/video-script.md](../docs/video-script.md). This package is not in the
root workspaces, so the keeper's install stays small; it has its own `package.json`.

```sh
cd video
npm install
npm run timing     # measure public/audio/scene-01..08.* and set each scene's length
npm run preview    # quick half-size render to out/preview.mp4
npm run render     # full 1080p render to out/steal-this-vault-demo.mp4
npm run studio     # open the Remotion studio to scrub through scenes
```

From the repository root, `npm run video:timing` and `npm run video` do the same.

- `src/timing.json`: scene order and lengths. `npm run timing` overwrites the lengths with
  the measured audio and marks which scenes have a file; a scene without one keeps the
  script's estimate and plays silent.
- `src/data.json`: the real figures shown in the record scene, with the date they were read
  from the chain (`npm run status` at the root). Update them before a final render.
- `src/scenes/`: one component per scene; each paces itself against its own length, so the
  pictures follow the voice however fast it is read.
- `public/audio/`: the voice files, ignored by git.

Requires FFmpeg's `ffprobe` on the path for `npm run timing`; Remotion brings its own encoder.
