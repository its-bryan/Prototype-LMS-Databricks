/**
 * Leaderboard — Dedicated page. Reached from Summary module card or sidebar.
 */
import { useNavigate } from "react-router-dom";
import BackButton from "../BackButton";
import InteractiveBMLeaderboard from "./InteractiveBMLeaderboard";

export default function InteractiveLeaderboardPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-6xl">
      <BackButton onClick={() => navigate("/bm/summary")} label="Back to Summary" />
      <div id="leaderboard" className="scroll-mt-4">
        <InteractiveBMLeaderboard />
      </div>
    </div>
  );
}
