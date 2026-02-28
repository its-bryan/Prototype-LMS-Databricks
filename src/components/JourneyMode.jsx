import { useApp } from "../context/AppContext";
import WalkthroughShell from "./WalkthroughShell";
import { bmSteps } from "../walkthroughs/BranchManagerSteps";
import { gmSteps } from "../walkthroughs/GeneralManagerSteps";
import { adminSteps } from "../walkthroughs/AdminSteps";

const walkthroughs = {
  bm: { title: "Branch View — Weekly Lead Review", steps: bmSteps },
  gm: { title: "Manager View — Compliance & Oversight", steps: gmSteps },
  admin: { title: "Admin — Data & Configuration", steps: adminSteps },
};

export default function JourneyMode() {
  const { role, setMode } = useApp();
  const wt = role ? walkthroughs[role] : null;

  if (!wt) return null;

  return (
    <WalkthroughShell
      steps={wt.steps}
      title={wt.title}
      onBack={() => setMode("interactive")}
    />
  );
}
