import { useState } from "react";
import Landing from "./components/Landing";
import WalkthroughShell from "./components/WalkthroughShell";

function Placeholder(label) {
  return function PlaceholderStep() {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#6E6E6E] text-xl">{label} — steps coming soon</p>
      </div>
    );
  };
}

const walkthroughs = {
  bm: { title: "Branch Manager — Weekly Lead Review", steps: [Placeholder("Branch Manager")] },
  gm: { title: "General Manager — Compliance & Oversight", steps: [Placeholder("General Manager")] },
  admin: { title: "Admin — Data & Configuration", steps: [Placeholder("Admin")] },
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
