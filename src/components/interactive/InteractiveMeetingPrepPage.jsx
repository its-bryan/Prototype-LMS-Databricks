/**
 * Meeting Prep — Dedicated page. Reached from Summary module card or sidebar.
 */
import { useNavigate } from "react-router-dom";
import BackButton from "../BackButton";
import InteractiveMeetingPrep from "./InteractiveMeetingPrep";

export default function InteractiveMeetingPrepPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-6xl">
      <BackButton onClick={() => navigate("/bm/summary")} label="Back to Summary" />
      <div id="compliance-meeting" className="scroll-mt-4">
        <InteractiveMeetingPrep />
      </div>
    </div>
  );
}
