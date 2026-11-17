import { Experiment } from "./components/Experiment";
import { Lab } from "./components/Lab";
import { Footer, HowItWorks, Technical } from "./components/More";
import { Intruders } from "./components/Intruders";
import { Record } from "./components/Record";
import { Stake } from "./components/Stake";
import { Header, Hero } from "./components/Top";

export function App() {
  return (
    <>
      <a className="skip" href="#lab">
        Skip to the attack lab
      </a>
      <Header />
      <main>
        <Hero />
        <Experiment />
        <Lab />
        <Record />
        <Intruders />
        <HowItWorks />
        <Stake />
        <Technical />
      </main>
      <Footer />
    </>
  );
}
