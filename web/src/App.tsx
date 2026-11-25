import { qor } from "./lib/format";
import { useSmoothScroll } from "./lib/motion";
import { useChain } from "./lib/useChain";
import { useView, type View } from "./lib/useView";
import { Footer, Header, Loader, NextView } from "./components/Chrome";
import { Drill } from "./components/Drill";
import { Hero } from "./components/Hero";
import { Intruders } from "./components/Intruders";
import { Lab } from "./components/Lab";
import { Locks } from "./components/Locks";
import { Technical } from "./components/More";
import { Strip } from "./components/Poster";
import { Score } from "./components/Score";
import { Stake } from "./components/Stake";
import { Theatre } from "./components/Theatre";
import { Watch } from "./components/Watch";

/** The scrolling bands between sections. Their numbers are the live ones, or left out until read. */
function Bands({ second = false }: { second?: boolean }) {
  const { hybrid } = useChain();
  const h = hybrid?.stats;
  if (second) {
    return (
      <Strip
        reverse
        tone="violet"
        items={["Refused", "Refused", h ? `${h.refusedCount} times and counting` : "Counting", "Refused", "The key fits. The door doesn’t."]}
      />
    );
  }
  return (
    <Strip
      items={[
        "Key published",
        h ? (h.balance > 0n ? "Vault still full" : "Vault empty") : "Reading the vault",
        h ? `${qor(h.balance, 3)} QOR inside` : "Live from the chain",
        h ? `${h.refusedCount} thefts refused` : "Thefts refused",
        "Try it yourself",
      ]}
    />
  );
}

function Content({ view }: { view: View }) {
  switch (view) {
    case "lab":
      return (
        <>
          <Lab />
          <Stake />
        </>
      );
    case "intruders":
      return <Intruders />;
    case "technical":
      return <Technical />;
    default:
      return (
        <>
          <Hero />
          <Bands />
          <Locks />
          <Theatre />
          <Score />
          <Bands second />
          <Drill />
          <Watch />
        </>
      );
  }
}

export function App() {
  const view = useView();
  useSmoothScroll();
  return (
    <>
      <a className="skip" href="#lab">
        Skip to the attack lab
      </a>
      <Loader />
      <Header view={view} />
      <main key={view} className="view">
        <Content view={view} />
        <NextView view={view} />
      </main>
      <Footer />
      <div className="grain" aria-hidden />
    </>
  );
}
