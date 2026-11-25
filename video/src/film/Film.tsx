/**
 * The second film: eleven scenes, the problem drawn in code and the rest recorded live from the
 * Paper & Ink site. `clean: true` (input props) renders without subtitles.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, getInputProps, interpolate, staticFile } from "remotion";
import { Close } from "./Close";
import { C, Grain, StripWipe, Subtitles, useFonts } from "./kit";
import { Problem } from "./Problem";
import { QDay } from "./QDay";
import { SiteScene } from "./SiteScene";
import { FPS, TIMELINE, TOTAL, cue, type SceneTiming } from "./timing";
import type { FilmScene } from "./script";

const CLEAN = Boolean((getInputProps() as { clean?: boolean }).clean);
const sec = (s: number) => Math.round(s * FPS);

/** Scenes with a dark background, so the subtitles flip to paper. */
const DARK: Partial<Record<FilmScene, boolean>> = { problem: false, qday: true, replay: true, close: true };

function SceneBody({ id }: { id: FilmScene }) {
  switch (id) {
    case "problem":
      return <Problem />;
    case "qday":
      return <QDay />;
    case "close":
      return <Close />;
    case "dare":
      return (
        <SiteScene
          clip="dare"
          clipSeconds={16.7}
          n="01"
          chapter="The key"
          title={[]}
          titleFrames={-40}
          startFrom={1.0}
          zooms={[
            { at: cue("dare", /^publishes$/), until: cue("dare", /^money$/) - 30, x: 1570, y: 800, scale: 1.45 },
            { at: cue("dare", /^money$/), until: cue("dare", /^chain\.$/) + 40, x: 340, y: 920, scale: 1.4 },
          ]}
          marks={[
            { at: cue("dare", /^publishes$/) + 20, until: cue("dare", /^money$/) - 20, box: [1277, 692, 587, 220], label: "The real private key · published on purpose", tone: "violet" },
            { at: cue("dare", /^Copy$/), until: cue("dare", /^money$/) - 20, box: [1685, 850, 157, 40], label: "Copy it", tone: "mint", tagSide: "bottom" },
            { at: cue("dare", /^inside:$/), box: [56, 833, 650, 163], label: "Still inside · read live from the chain", tone: "mint" },
          ]}
        />
      );
    case "locks":
      return (
        <SiteScene
          clip="locks"
          clipSeconds={18.7}
          n="02"
          chapter="Two locks"
          title={[{ text: "One key" }, { text: "opens nothing.", accent: true }]}
          zooms={[{ at: cue("locks", /^second$/), until: cue("locks", /^No$/), x: 1340, y: 430, scale: 1.25 }]}
          marks={[
            { at: cue("locks", /^first$/), until: cue("locks", /^second$/) + 10, box: [985, 170, 260, 420], label: "Lock 1 · the ordinary key", tone: "carmine" },
            { at: cue("locks", /^second$/) + 6, until: cue("locks", /^chain$/) - 4, box: [1437, 215, 262, 372], label: "Lock 2 · quantum-safe · ML-DSA-87", tone: "violet" },
            { at: cue("locks", /^chain$/), until: cue("locks", /^vault$/, 30) - 2, box: [1437, 423, 262, 74], label: "Checked by the chain", tone: "mint" },
            { at: cue("locks", /^vault$/, 30), box: [1437, 423, 262, 74], label: "…and again by the vault", tone: "mint" },
          ]}
        />
      );
    case "replay":
      return (
        <SiteScene
          clip="replay"
          clipSeconds={12.3}
          n="03"
          chapter="Replay"
          dark
          title={[{ text: "Watch them" }, { text: "fail.", accent: true }]}
          marks={[
            { at: cue("replay", /^real$/), until: cue("replay", /^Every$/) - 6, box: [56, 727, 1808, 132], label: "Real break-in attempts · from the vault's own record", tone: "violet" },
            { at: cue("replay", /^Every$/), box: [56, 168, 1808, 531], label: "Every one hits the same wall", tone: "mint" },
          ]}
        />
      );
    case "score":
      return (
        <SiteScene
          clip="score"
          clipSeconds={19.8}
          n="04"
          chapter="Scoreboard"
          title={[{ text: "Same key." }, { text: "Two endings.", accent: true }]}
          marks={[
            { at: cue("score", /^twin:$/), until: sec(8.9), box: [57, 111, 885, 429], label: "The one-lock twin · robbed 3 times", tone: "carmine" },
            { at: cue("score", /^ordinary$/), until: sec(8.9), box: [979, 111, 885, 429], label: "The vault · still full · 5 thefts refused", tone: "mint", tagSide: "bottom" },
            { at: cue("score", /^count$/), until: sec(15.3), box: [56, 200, 1180, 184], label: "Counted by the vault itself, on chain", tone: "violet" },
          ]}
        />
      );
    case "lab":
      return (
        <SiteScene
          clip="lab"
          clipSeconds={21.0}
          n="07"
          chapter="Attack lab"
          title={[{ text: "Your turn," }, { text: "thief." , accent: true }]}
          playbackRate={1.4}
          marks={[
            { at: cue("lab", /^eighteen$/), until: sec(7.9), box: [40, 200, 1840, 820], label: "18 real attacks · run live · nothing recorded", tone: "violet" },
            { at: cue("lab", /^Eighteen$/), until: sec(12.4), box: [50, 96, 1594, 230], label: "18 of 18 refused · 0 QOR lost", tone: "mint", tagSide: "bottom" },
            { at: sec(12.9), box: [48, 72, 1596, 294], label: "The unprotected twin · same robbery · it pays", tone: "carmine", tagSide: "bottom" },
          ]}
        />
      );
    case "drill":
      return (
        <SiteScene
          clip="drill"
          clipSeconds={16.7}
          n="05"
          chapter="Q-Day drill"
          title={[{ text: "Q-Day" }, { text: "came early.", accent: true }]}
          segments={[
            { from: 0, clip: 0, rate: 0.77 },
            { from: sec(6.5), clip: 6.3 },
            { from: sec(10.5), clip: 11.4 },
          ]}
          marks={[
            { at: cue("drill", /^bot$/), until: sec(6.4), box: [56, 110, 1808, 457], label: "24 hours with the thief · 0 thefts · 0 lost · read from the chain", tone: "mint", tagSide: "bottom" },
            { at: sec(8.2), until: sec(10.4), box: [56, 210, 1808, 391], label: "On Q-Day: one-lock wallets open · this vault still shut", tone: "violet", tagSide: "bottom" },
            { at: sec(11.8), box: [851, 110, 1013, 385], label: "Proof: the owner got in, with both keys", tone: "mint", tagSide: "bottom" },
          ]}
        />
      );
    case "watch":
      return (
        <SiteScene
          clip="watch"
          clipSeconds={15.1}
          n="06"
          chapter="Alerts & rescue"
          title={[{ text: "Every knock" }, { text: "rings a bell.", accent: true }]}
          marks={[
            { at: cue("watch", /^told$/), until: sec(7.0), box: [56, 110, 600, 352], label: "Warned while the money is safe", tone: "mint", tagSide: "bottom" },
            { at: sec(8.7), box: [996, 160, 868, 401], label: "The way out · only the owner can do it", tone: "violet", tagSide: "bottom" },
          ]}
        />
      );
    case "intruders":
      return (
        <SiteScene
          clip="intruders"
          clipSeconds={9.2}
          n="08"
          chapter="Intruders"
          title={[{ text: "Thieves leave" }, { text: "footprints.", accent: true }]}
          titleFrames={50}
          marks={[
            { at: cue("intruders", /^trail:$/), until: sec(4.5), box: [970, 100, 894, 545], label: "Every thief leaves a trail", tone: "carmine", tagSide: "bottom" },
            { at: sec(5.2), box: [1003, 345, 828, 112], label: "Where the money went · still in the thief's wallet", tone: "carmine", tagSide: "bottom" },
          ]}
        />
      );
  }
}


/** Music volume: full between lines, down under the voice, with short fades. */
function musicVolume(f: number): number {
  let v = 1;
  for (const s of TIMELINE) {
    const a = s.start + s.lead - 8;
    const b = s.start + s.frames - Math.round(0.25 * FPS);
    if (f < a - 12 || f > b + 18) continue;
    const edge = Math.min(1, (f - (a - 12)) / 12, (b + 18 - f) / 18);
    v = Math.min(v, 1 - 0.7 * Math.max(0, edge));
  }
  return v;
}

const WIPES: Partial<Record<FilmScene, { items: string[]; tone: "ink" | "violet" }>> = {
  dare: { items: ["Key published", "Vault still full", "Try it yourself"], tone: "violet" },
  lab: { items: ["Refused", "Refused", "Refused", "Your turn"], tone: "ink" },
  close: { items: ["Key published", "Money kept", "Second lock"], tone: "violet" },
};

export const Film: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {TIMELINE.map((s: SceneTiming) => (
        <Sequence key={s.id} from={s.start} durationInFrames={s.frames} name={s.id}>
          <SceneBody id={s.id} />
          <Sequence from={s.lead} name="voice">
            <Audio src={staticFile(`audio/${s.file}`)} />
          </Sequence>
          {CLEAN ? null : <Subtitles words={s.words} dark={Boolean(DARK[s.id])} />}
        </Sequence>
      ))}
      {TIMELINE.map((s) =>
        WIPES[s.id] ? (
          <Sequence key={`w-${s.id}`} from={s.start - 17} durationInFrames={34} name={`wipe-${s.id}`}>
            <StripWipe at={0} items={WIPES[s.id]!.items} tone={WIPES[s.id]!.tone} />
          </Sequence>
        ) : null,
      )}
      <Audio src={staticFile("music/film-score.wav")} volume={(f) => interpolate(musicVolume(f), [0, 1], [0, 0.85])} />
      <Grain />
    </AbsoluteFill>
  );
};

export const FILM_FRAMES = TOTAL;
export { sec };
