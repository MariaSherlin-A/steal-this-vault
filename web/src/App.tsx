import { Experiment } from "./components/Experiment";
import { Lab } from "./components/Lab";
import { Footer, HowItWorks, Technical } from "./components/More";
import { Intruders } from "./components/Intruders";
import { Record } from "./components/Record";
import { Stake } from "./components/Stake";
import { Network } from "./components/Network";
import { ChainStrip, Explore, Steps } from "./components/Overview";
import { Theatre } from "./components/Theatre";
import { Header, Hero, NextView } from "./components/Top";
import { useSpotlight } from "./lib/useSpotlight";
import { useView, type View } from "./lib/useView";

function Content({ view }: { view: View }) {
  switch (view) {
    case "experiment":
      return <Experiment />;
    case "lab":
      return (
        <>
          <Lab />
          <Stake />
        </>
      );
    case "record":
      return (
        <>
          <Record />
          <Intruders />
        </>
      );
    case "how":
      return <HowItWorks />;
    case "technical":
      return <Technical />;
    default:
      return (
        <>
          <Hero backdrop={<Network />} />
          <ChainStrip />
          <Steps />
          <Theatre />
          <Explore />
        </>
      );
  }
}

export function App() {
  const view = useView();
  useSpotlight();
  return (
    <>
      <a className="skip" href="#lab">
        Skip to the attack lab
      </a>
      <Header view={view} />
      <main key={view} className="view">
        <Content view={view} />
        <NextView view={view} />
      </main>
      <Footer />
    </>
  );
}
