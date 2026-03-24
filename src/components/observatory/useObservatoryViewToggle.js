import { useMemo, useState, useCallback, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";

/**
 * Derives "My View" filter presets from orgMapping + observatorySnapshot
 * by matching the logged-in user to their GM record.
 *
 * Returns { viewMode, setViewMode, myFilters, ViewToggle }
 */
export default function useObservatoryViewToggle({
  setSelectedZones,
  setSelectedGms,
  setSelectedAms,
  setSelectedHertzZones,
}) {
  const { userProfile } = useAuth();
  const { orgMapping, observatorySnapshot } = useData();
  const [viewMode, setViewModeRaw] = useState("my"); // "my" | "company"

  // Derive the user's filters from orgMapping + snapshot branches
  const myFilters = useMemo(() => {
    if (!userProfile || !orgMapping?.length) return null;

    const displayName = (userProfile.displayName || "").toUpperCase().trim();
    const userId = userProfile.id;

    // Find all branches where this user is the GM (by userId or displayName)
    const myBranches = orgMapping.filter((row) => {
      if (userId && row.gmUserId && String(row.gmUserId) === String(userId)) return true;
      if (displayName && (row.gm || "").toUpperCase().trim() === displayName) return true;
      return false;
    });

    if (!myBranches.length) return null;

    const zones = [...new Set(myBranches.map((b) => b.zone).filter(Boolean))];
    const gms = [...new Set(myBranches.map((b) => b.gm).filter(Boolean))];
    const ams = [...new Set(myBranches.map((b) => b.am).filter(Boolean))];

    // hertzZone lives on snapshot branches, not orgMapping — look it up
    const hertzZones = new Set();
    if (observatorySnapshot?.branches) {
      for (const bd of Object.values(observatorySnapshot.branches)) {
        const branchGm = (bd.gm || "").toUpperCase().trim();
        if (gms.some((g) => g.toUpperCase().trim() === branchGm) && bd.hertzZone) {
          hertzZones.add(bd.hertzZone);
        }
      }
    }

    return {
      zones,
      gms,
      ams,
      hertzZones: [...hertzZones],
    };
  }, [userProfile, orgMapping, observatorySnapshot]);

  const applyMyView = useCallback(() => {
    if (myFilters) {
      setSelectedZones(myFilters.zones);
      setSelectedHertzZones(myFilters.hertzZones);
      setSelectedGms(myFilters.gms);
      setSelectedAms(myFilters.ams);
    }
  }, [myFilters, setSelectedZones, setSelectedHertzZones, setSelectedGms, setSelectedAms]);

  const applyCompanyView = useCallback(() => {
    setSelectedZones([]);
    setSelectedHertzZones([]);
    setSelectedGms([]);
    setSelectedAms([]);
  }, [setSelectedZones, setSelectedHertzZones, setSelectedGms, setSelectedAms]);

  const setViewMode = useCallback(
    (mode) => {
      setViewModeRaw(mode);
      if (mode === "my") applyMyView();
      else applyCompanyView();
    },
    [applyMyView, applyCompanyView]
  );

  // Apply "My View" on first load once data is ready
  useEffect(() => {
    if (viewMode === "my" && myFilters) {
      applyMyView();
    }
    // Only run when myFilters first becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myFilters]);

  return { viewMode, setViewMode, myFilters };
}
