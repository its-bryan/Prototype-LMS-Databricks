import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import StarRating from "./shared/StarRating";

export default function ProvideFeedbackModal({ onSubmit, onCancel }) {
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [comments, setComments] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const isValid = useMemo(() => {
    return rating >= 1 && (feedbackText.trim().length > 0 || comments.trim().length > 0);
  }, [rating, feedbackText, comments]);

  const handleSubmit = async () => {
    if (rating < 1) {
      setError("Please provide a star rating.");
      return;
    }
    if (!feedbackText.trim() && !comments.trim()) {
      setError("Please provide feedback or comments.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        rating,
        feedbackText: feedbackText.trim(),
        comments: comments.trim(),
        isAnonymous,
      });
    } catch (err) {
      setError(err?.message ?? "Failed to submit feedback");
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col border border-[var(--neutral-200)]"
        >
          <div className="px-6 pt-5 pb-4 border-b border-[var(--neutral-200)] shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--hertz-black)]">Provide Feedback</h3>
              <button
                type="button"
                onClick={onCancel}
                className="p-1 text-[var(--neutral-500)] hover:text-[var(--hertz-black)] transition-colors"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-[var(--neutral-600)] mt-1">
              Leo is still in its early stages of development, your feedback is valuable to us.
            </p>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            <div>
              <label className="text-xs text-[var(--neutral-600)] uppercase tracking-wide block mb-2">
                Star Rating <span className="text-[var(--color-error)]">*</span>
              </label>
              <StarRating value={rating} onChange={(v) => { setRating(v); setError(null); }} size="lg" />
            </div>

            <div>
              <label className="text-xs text-[var(--neutral-600)] uppercase tracking-wide block mb-1">
                Free Form Feedback
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => { setFeedbackText(e.target.value); setError(null); }}
                rows={3}
                placeholder="Share your experience with LEO"
                className="w-full border border-[var(--neutral-200)] rounded-md px-3 py-2 text-sm bg-white leading-relaxed focus:border-[var(--hertz-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--hertz-primary)] resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--neutral-600)] uppercase tracking-wide block mb-1">
                Comments for Developers
              </label>
              <textarea
                value={comments}
                onChange={(e) => { setComments(e.target.value); setError(null); }}
                rows={3}
                placeholder="Any comments you'd like to share with our developers and team behind LEO?"
                className="w-full border border-[var(--neutral-200)] rounded-md px-3 py-2 text-sm bg-white leading-relaxed focus:border-[var(--hertz-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--hertz-primary)] resize-none"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-[var(--neutral-700)]">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-[var(--neutral-300)] text-[var(--hertz-primary)] focus:ring-[var(--hertz-primary)]"
              />
              Submit anonymously
            </label>
          </div>

          <div className="px-6 py-4 border-t border-[var(--neutral-200)] shrink-0">
            {error && <p className="text-sm text-[var(--color-error)] mb-3">{error}</p>}
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-[var(--neutral-600)] border border-[var(--neutral-200)] rounded-md hover:bg-[var(--neutral-50)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !isValid}
                className="px-4 py-2 text-sm font-medium bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded-md hover:bg-[var(--hertz-primary-hover)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {saving ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
