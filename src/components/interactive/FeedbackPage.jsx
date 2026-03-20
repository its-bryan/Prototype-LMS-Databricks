import { useCallback, useEffect, useMemo, useState } from "react";
import StarRating from "../shared/StarRating";
import ProvideFeedbackModal from "../ProvideFeedbackModal";
import SubmitFeatureRequestModal from "../SubmitFeatureRequestModal";
import {
  fetchFeedbackSummary,
  fetchFeedbackList,
  submitFeedback,
  fetchFeatureRequests,
  submitFeatureRequest,
  toggleFeatureRequestUpvote,
} from "../../data/databricksData";

const FEEDBACK_PAGE_SIZE = 20;

function truncateText(value, maxLen) {
  if (!value) return "—";
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}...`;
}

function formatDate(dateValue) {
  if (!dateValue) return "—";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeDate(dateValue) {
  if (!dateValue) return "—";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "—";
  const diffMs = Date.now() - parsed.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  return formatDate(dateValue);
}

export default function FeedbackPage() {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [featureRequests, setFeatureRequests] = useState([]);
  const [featureRequestsLoading, setFeatureRequestsLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const [showAllFeedback, setShowAllFeedback] = useState(false);
  const [feedbackOffset, setFeedbackOffset] = useState(0);
  const [feedbackPage, setFeedbackPage] = useState({ items: [], total: 0, limit: FEEDBACK_PAGE_SIZE, offset: 0, hasNext: false });
  const [feedbackPageLoading, setFeedbackPageLoading] = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const nextSummary = await fetchFeedbackSummary();
      setSummary(nextSummary);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadFeatureRequests = useCallback(async () => {
    setFeatureRequestsLoading(true);
    try {
      const result = await fetchFeatureRequests();
      setFeatureRequests(result.items ?? []);
    } finally {
      setFeatureRequestsLoading(false);
    }
  }, []);

  const loadFeedbackPage = useCallback(async (offset) => {
    setFeedbackPageLoading(true);
    try {
      const result = await fetchFeedbackList({ limit: FEEDBACK_PAGE_SIZE, offset });
      setFeedbackPage(result);
    } finally {
      setFeedbackPageLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setPageError(null);
      try {
        await Promise.all([loadSummary(), loadFeatureRequests()]);
      } catch (err) {
        if (!active) return;
        setPageError(err?.message ?? "Failed to load feedback page");
      }
    })();
    return () => {
      active = false;
    };
  }, [loadSummary, loadFeatureRequests]);

  useEffect(() => {
    if (!showAllFeedback) return;
    loadFeedbackPage(feedbackOffset).catch((err) => {
      setPageError(err?.message ?? "Failed to load feedback table");
    });
  }, [showAllFeedback, feedbackOffset, loadFeedbackPage]);

  const handleSubmitFeedback = async (payload) => {
    await submitFeedback(payload);
    setShowFeedbackModal(false);
    setFeedbackOffset(0);
    await Promise.all([loadSummary(), showAllFeedback ? loadFeedbackPage(0) : Promise.resolve()]);
  };

  const handleSubmitFeatureRequest = async (payload) => {
    await submitFeatureRequest(payload);
    setShowFeatureModal(false);
    await loadFeatureRequests();
  };

  const handleToggleUpvote = async (requestId) => {
    let previous = null;
    setFeatureRequests((current) => {
      previous = current;
      return current.map((item) => {
        if (item.id !== requestId) return item;
        const nextUpvoted = !item.userHasUpvoted;
        return {
          ...item,
          userHasUpvoted: nextUpvoted,
          upvoteCount: Math.max(0, item.upvoteCount + (nextUpvoted ? 1 : -1)),
        };
      });
    });

    try {
      const result = await toggleFeatureRequestUpvote(requestId);
      setFeatureRequests((current) => current.map((item) => (
        item.id === requestId
          ? {
              ...item,
              userHasUpvoted: result.userHasUpvoted,
              upvoteCount: result.upvoteCount,
            }
          : item
      )));
    } catch (err) {
      if (previous) setFeatureRequests(previous);
      setPageError(err?.message ?? "Failed to update upvote");
    }
  };

  const feedbackRangeText = useMemo(() => {
    if (!feedbackPage.total) return "0 results";
    const start = feedbackPage.offset + 1;
    const end = Math.min(feedbackPage.offset + feedbackPage.limit, feedbackPage.total);
    return `Showing ${start}-${end} of ${feedbackPage.total}`;
  }, [feedbackPage]);

  const totalUpvotes = useMemo(
    () => (featureRequests ?? []).reduce((sum, item) => sum + (item.upvoteCount ?? 0), 0),
    [featureRequests]
  );

  const avgRating = summary?.avgRating ?? 0;
  const shownRecentCount = (summary?.latest ?? []).length;

  return (
    <div className="px-6 py-5 space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--hertz-black)]">Feedback & Feature Requests</h1>
        <p className="text-sm text-[var(--neutral-700)] max-w-4xl">
          Leo is still in its early stages of development, your feedback is valuable to us. We will closely monitor this page to continue building Leo to make work and life easier for you all!
        </p>
      </header>

      {pageError && (
        <div className="rounded-md border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-3 text-sm text-[var(--color-error)]">
          {pageError}
        </div>
      )}

      <section className="rounded-xl border border-[var(--neutral-200)] bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[var(--hertz-black)]">Recent Feedback</h2>
              <div className="inline-flex items-center gap-1.5 text-[var(--neutral-700)]">
                <StarRating value={summaryLoading ? 0 : avgRating} readOnly size="sm" />
                <span className="text-sm font-medium">
                  {summaryLoading ? "..." : `${avgRating.toFixed(1)} stars`}
                </span>
              </div>
            </div>
            <p className="text-xs text-[var(--neutral-600)]">Latest 5 submissions from your teams</p>
          </div>
          <button
            type="button"
            onClick={() => setShowFeedbackModal(true)}
            className="px-3 py-2 text-sm font-medium bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded-md hover:bg-[var(--hertz-primary-hover)] transition-colors"
          >
            Provide Feedback
          </button>
        </div>

        <div className="space-y-2">
          {(summary?.latest ?? []).length === 0 && !summaryLoading && (
            <p className="text-sm text-[var(--neutral-600)] py-4">No feedback yet. Be the first to share your thoughts.</p>
          )}
          {(summary?.latest ?? []).map((item) => (
            <div key={item.id} className="border border-[var(--neutral-200)] rounded-md p-3 bg-[var(--neutral-50)]/40">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <StarRating value={item.rating} readOnly size="sm" />
                  <p className="text-sm text-[var(--hertz-black)]">{truncateText(item.feedbackText || item.comments || "—", 100)}</p>
                  <p className="text-xs text-[var(--neutral-600)]">{item.userName || "Anonymous"}</p>
                </div>
                <span className="text-xs text-[var(--neutral-500)] whitespace-nowrap">{formatRelativeDate(item.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-[var(--neutral-700)]">
          <span>
            {summaryLoading
              ? "Loading reviews..."
              : `Showing ${shownRecentCount} out of ${summary?.totalFeedback ?? 0} reviews.`}
          </span>
          <button
            type="button"
            onClick={() => {
              const next = !showAllFeedback;
              setShowAllFeedback(next);
              if (next) setFeedbackOffset(0);
            }}
            className="font-medium text-[var(--hertz-black)] underline underline-offset-2 hover:text-[var(--neutral-700)]"
          >
            {showAllFeedback ? "Hide" : "See more"}
          </button>
        </div>

        {showAllFeedback && (
          <div className="rounded-lg border border-[var(--neutral-200)] overflow-hidden">
            <div className="max-h-[24rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--neutral-100)] text-[var(--hertz-black)] sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Stars</th>
                    <th className="text-left px-3 py-2 font-medium">Feedback</th>
                    <th className="text-left px-3 py-2 font-medium">Submitted By</th>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(feedbackPage.items ?? []).map((item) => (
                    <tr key={item.id} className="border-t border-[var(--neutral-200)]">
                      <td className="px-3 py-2"><StarRating value={item.rating} readOnly size="sm" /></td>
                      <td className="px-3 py-2 text-[var(--hertz-black)]">{truncateText(item.feedbackText || item.comments || "—", 180)}</td>
                      <td className="px-3 py-2 text-[var(--neutral-700)]">{item.userName || "Anonymous"}</td>
                      <td className="px-3 py-2 text-[var(--neutral-600)]">{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--neutral-200)] text-xs text-[var(--neutral-600)]">
              <span>{feedbackPageLoading ? "Loading..." : feedbackRangeText}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFeedbackOffset((prev) => Math.max(0, prev - FEEDBACK_PAGE_SIZE))}
                  disabled={feedbackOffset === 0 || feedbackPageLoading}
                  className="px-2 py-1 rounded border border-[var(--neutral-300)] disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackOffset((prev) => prev + FEEDBACK_PAGE_SIZE)}
                  disabled={feedbackPageLoading || !feedbackPage.hasNext}
                  className="px-2 py-1 rounded border border-[var(--neutral-300)] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--neutral-200)] bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--hertz-black)]">Feature Requests</h2>
            <p className="text-xs text-[var(--neutral-600)]">
              Sorted by upvotes so top needs stay visible. Total upvotes: {featureRequestsLoading ? "..." : totalUpvotes}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowFeatureModal(true)}
            className="px-3 py-2 text-sm font-medium bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded-md hover:bg-[var(--hertz-primary-hover)] transition-colors"
          >
            Submit New Feature Request
          </button>
        </div>

        <div className="rounded-lg border border-[var(--neutral-200)] overflow-hidden">
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--hertz-black)] text-white sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Request ID</th>
                  <th className="text-left px-3 py-2 font-medium">Requester</th>
                  <th className="text-left px-3 py-2 font-medium">Title</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-left px-3 py-2 font-medium">Request Date</th>
                  <th className="text-left px-3 py-2 font-medium">Upvote</th>
                </tr>
              </thead>
              <tbody>
                {!featureRequestsLoading && featureRequests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[var(--neutral-600)]">
                      No feature requests yet.
                    </td>
                  </tr>
                )}
                {featureRequests.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--neutral-200)]">
                    <td className="px-3 py-2 text-[var(--neutral-700)]">{item.id}</td>
                    <td className="px-3 py-2 text-[var(--neutral-700)]">{item.requesterName}</td>
                    <td className="px-3 py-2 text-[var(--hertz-black)] font-medium">{item.title}</td>
                    <td className="px-3 py-2 text-[var(--neutral-700)]" title={item.description}>
                      {truncateText(item.description, 50)}
                    </td>
                    <td className="px-3 py-2 text-[var(--neutral-600)]">{formatDate(item.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleToggleUpvote(item.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border transition-colors ${
                          item.userHasUpvoted
                            ? "bg-[var(--hertz-primary)]/20 border-[var(--hertz-primary)] text-[var(--hertz-black)]"
                            : "border-[var(--neutral-300)] text-[var(--neutral-700)] hover:bg-[var(--neutral-50)]"
                        }`}
                        title={item.userHasUpvoted ? "Remove upvote" : "Upvote"}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 5l7 10H5l7-10z" />
                        </svg>
                        <span className="text-xs font-medium">{item.upvoteCount}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {showFeedbackModal && (
        <ProvideFeedbackModal
          onCancel={() => setShowFeedbackModal(false)}
          onSubmit={handleSubmitFeedback}
        />
      )}

      {showFeatureModal && (
        <SubmitFeatureRequestModal
          onCancel={() => setShowFeatureModal(false)}
          onSubmit={handleSubmitFeatureRequest}
        />
      )}
    </div>
  );
}
