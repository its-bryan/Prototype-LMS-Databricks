import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const FREQUENCY_OPTIONS = ["Daily", "Weekly", "Monthly", "Rarely"];
const TIME_SPENT_OPTIONS = ["Less than 5 min", "5-15 min", "15-30 min", "30-60 min", "More than 1 hour"];

export default function SubmitFeatureRequestModal({ onSubmit, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [currentProcess, setCurrentProcess] = useState("");
  const [frequency, setFrequency] = useState(FREQUENCY_OPTIONS[0]);
  const [timeSpent, setTimeSpent] = useState(TIME_SPENT_OPTIONS[1]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const isValid = useMemo(() => title.trim().length > 0 && description.trim().length > 0, [title, description]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setError("Short description is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        currentProcess: currentProcess.trim(),
        frequency,
        timeSpent,
      });
    } catch (err) {
      setError(err?.message ?? "Failed to submit feature request");
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
          className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-[var(--neutral-200)]"
        >
          <div className="px-6 pt-5 pb-4 border-b border-[var(--neutral-200)] shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--hertz-black)]">Submit New Feature Request</h3>
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
              Help us prioritize what matters most for your workflow in LEO.
            </p>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            <div>
              <label className="text-xs text-[var(--neutral-600)] uppercase tracking-wide block mb-1">
                Title <span className="text-[var(--color-error)]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(null); }}
                placeholder="e.g. Export all branch tasks to CSV"
                className="w-full border border-[var(--neutral-200)] rounded-md px-3 py-2 text-sm bg-white focus:border-[var(--hertz-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--hertz-primary)]"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--neutral-600)] uppercase tracking-wide block mb-1">
                Short Description <span className="text-[var(--color-error)]">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError(null); }}
                rows={3}
                placeholder="Describe the feature request briefly"
                className="w-full border border-[var(--neutral-200)] rounded-md px-3 py-2 text-sm bg-white leading-relaxed focus:border-[var(--hertz-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--hertz-primary)] resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--neutral-600)] uppercase tracking-wide block mb-1">
                How do you do it today?
              </label>
              <textarea
                value={currentProcess}
                onChange={(e) => setCurrentProcess(e.target.value)}
                rows={4}
                placeholder="Before LEO, and with the current way LEO is built"
                className="w-full border border-[var(--neutral-200)] rounded-md px-3 py-2 text-sm bg-white leading-relaxed focus:border-[var(--hertz-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--hertz-primary)] resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[var(--neutral-600)] uppercase tracking-wide block mb-1">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full border border-[var(--neutral-200)] rounded-md px-3 py-2 text-sm bg-white focus:border-[var(--hertz-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--hertz-primary)]"
                >
                  {FREQUENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--neutral-600)] uppercase tracking-wide block mb-1">
                  Time Spent
                </label>
                <select
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                  className="w-full border border-[var(--neutral-200)] rounded-md px-3 py-2 text-sm bg-white focus:border-[var(--hertz-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--hertz-primary)]"
                >
                  {TIME_SPENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
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
                {saving ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
