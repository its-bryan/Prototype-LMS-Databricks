import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../../context/DataContext";
import LeadQueue from "../LeadQueue";

export default function InteractiveToDo() {
  const navigate = useNavigate();
  const { fetchLeadsPage } = useData();
  const [todoLeads, setTodoLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const LIMIT = 20;

  const loadPage = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const result = await fetchLeadsPage({
        status: "Cancelled,Unused",
        enrichmentComplete: false,
        limit: LIMIT,
        offset,
      });
      setTodoLeads(result.items);
      setTotal(result.total);
      setHasNext(result.hasNext);
    } catch (err) {
      console.error("[ToDo] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchLeadsPage]);

  useEffect(() => { loadPage(page * LIMIT); }, [loadPage, page]);

  const handleLeadClick = (lead) => {
    navigate(`/bm/leads/${lead.id}`);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-1">
        <h2 className="text-xl font-semibold text-[var(--hertz-black)]">My To Do</h2>
        <span className="px-2 py-1 bg-[var(--color-error)] text-white rounded text-xs font-medium">
          {total} pending
        </span>
      </div>
      <p className="text-sm text-[var(--neutral-600)] mb-4">
        Cancelled and unused leads that still need comments.
      </p>
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-[var(--neutral-100)] animate-pulse" />
          ))}
        </div>
      ) : todoLeads.length === 0 ? (
        <div className="text-center py-12 text-[var(--neutral-600)]">
          All caught up — no leads need comments.
        </div>
      ) : (
        <>
          <LeadQueue leads={todoLeads} onLeadClick={handleLeadClick} />
          {(hasNext || page > 0) && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-[var(--neutral-200)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
              >
                Previous
              </button>
              <span className="text-xs text-[var(--neutral-600)]">
                Page {page + 1} of {Math.ceil(total / LIMIT) || 1}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!hasNext}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-[var(--neutral-200)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-[var(--neutral-50)]"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
