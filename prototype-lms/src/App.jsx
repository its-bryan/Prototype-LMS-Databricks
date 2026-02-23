import { useState } from "react";
import Landing from "./components/Landing";
import WalkthroughShell from "./components/WalkthroughShell";
import { bmSteps } from "./walkthroughs/BranchManagerSteps";
import { gmSteps } from "./walkthroughs/GeneralManagerSteps";
import { adminSteps } from "./walkthroughs/AdminSteps";

const walkthroughs = {
  bm: { title: "Branch Manager — Weekly Lead Review", steps: bmSteps },
  gm: { title: "General Manager — Compliance & Oversight", steps: gmSteps },
  admin: { title: "Admin — Data & Configuration", steps: adminSteps },
};

export default function App() {
  const [activeJourney, setActiveJourney] = useState(null);

  if (!activeJourney) {
    return <Landing onSelect={(key) => setActiveJourney(walkthroughs[key])} />;
  }

  return (
    <WalkthroughShell
      steps={activeJourney.steps}
      title={activeJourney.title}
      onBack={() => setActiveJourney(null)}
    />
  );
}
