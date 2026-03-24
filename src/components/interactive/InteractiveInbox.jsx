import { useState, useEffect } from "react";
import { motion as Motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import { formatDateShort } from "../../utils/dateTime";
import StatusBadge from "../StatusBadge";

export default function InteractiveInbox() {
  const navigate = useNavigate();
  const { fetchLeadsPage } = useData();
  const [directiveLeads, setDirectiveLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  /* eslint-disable react-hooks/set-state-in-effect -- inbox list load */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeadsPage({ hasDirective: true, limit: 50 })
      .then((result) => {
        if (!cancelled) {
          setDirectiveLeads(result.items);
          setTotal(result.total);
        }
      })
      .catch((err) => console.error("[Inbox] fetch failed:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchLeadsPage]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleClick = (lead) => {
    navigate(`/bm/leads/${lead.id}`);
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-[#1A1A1A] mb-4">Inbox</h2>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-[var(--neutral-100)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-1">
        <h2 className="text-xl font-semibold text-[#1A1A1A]">Inbox</h2>
        {total > 0 && (
          <span className="px-2 py-1 bg-[#C62828] text-white rounded text-xs font-medium">
            {total} directive{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="text-sm text-[#6E6E6E] mb-5">
        Messages from your General Manager tied to specific reservations. Click to review and take action.
      </p>

      {directiveLeads.length === 0 ? (
        <div className="text-center py-12 text-[#6E6E6E]">
          No directives — your inbox is clear.
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {directiveLeads.map((lead, i) => (
            <Motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => handleClick(lead)}
              className="border border-[#E6E6E6] rounded-lg p-4 cursor-pointer hover:border-[#FFD100] hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[#1A1A1A]">{lead.customer}</span>
                  <span className="text-xs font-mono text-[#6E6E6E]">{lead.reservationId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={lead.status} />
                  {!lead.enrichmentComplete && (
                    <span className="text-xs text-[#C62828] font-medium">Needs comments</span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-[#F4C300] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
                <p className="text-sm text-[#272425] leading-relaxed">{lead.gmDirective}</p>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-[#6E6E6E]">
                {lead.initDtFinal && (
                  <span>{formatDateShort(new Date(lead.initDtFinal + "T12:00:00Z"))}</span>
                )}
                <span>{lead.branch}</span>
              </div>
            </Motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
