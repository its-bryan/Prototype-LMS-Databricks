import { useEffect, useState } from "react";

const TOKEN_KEY = "leo_token";

function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function withTokenQuery(url, token) {
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_token=${encodeURIComponent(token)}`;
}

export default function StagingBanner() {
  const [isStaging, setIsStaging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) return () => { cancelled = true; };
    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Leo-Token": token,
    };

    fetch(withTokenQuery("/api/health/runtime", token), { headers })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((payload) => {
        if (!cancelled) setIsStaging(payload?.tier === "staging");
      })
      .catch(() => {
        if (!cancelled) setIsStaging(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isStaging) return null;

  return (
    <div className="w-full bg-amber-500 text-black text-xs font-semibold tracking-wide text-center py-1">
      STAGING ENVIRONMENT
    </div>
  );
}
