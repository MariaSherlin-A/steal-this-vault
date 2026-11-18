import { Experiment } from "./components/Experiment";
import { Lab } from "./components/Lab";
import { Footer, HowItWorks, Technical } from "./components/More";
import { Intruders } from "./components/Intruders";
import { Record } from "./components/Record";
import { Stake } from "./components/Stake";
import { Theatre } from "./components/Theatre";
import { Header, Hero, NextView } from "./components/Top";
import { useView, type View } from "./lib/useView";

function Content({ view }: { view: View }) {
  switch (view) {
    case "experiment":
      return <Experiment />;
    case "lab":
      return <Lab />;
    case "record":
      return (
        <>
          <Record />
          <Intruders />
        </>
      );
    case "how":
      return (
        <>
          <HowItWorks />
          <Stake />
        </>
      );
    case "technical":
      return <Technical />;
    default:
      return (
        <>
          <Hero />
          <Theatre />
        </>
      );
  }
}

export function App() {
  const view = useView();
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
