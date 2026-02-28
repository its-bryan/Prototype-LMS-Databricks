/**
 * LeadContactCard — Contact Details section with view/edit toggle.
 * Shows read-only email/phone by default; pencil icon enables editing.
 * Phone uses country code + number as separate components in edit mode.
 */
import { useState, useEffect } from "react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import PhoneInput, { parsePhoneE164 } from "./PhoneInput";

function formatNow() {
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

export default function LeadContactCard({ lead }) {
  const { updateLeadContact } = useData();
  const { userProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [email, setEmail] = useState(lead?.email ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");

  useEffect(() => {
    setEmail(lead?.email ?? "");
    setPhone(lead?.phone ?? "");
  }, [lead?.id, lead?.email, lead?.phone]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const prevEmail = lead?.email ?? "";
    const prevPhone = lead?.phone ?? "";
    const newEmail = email.trim() || null;
    const newPhone = phone.trim() || null;
    const changes = [];
    if (newEmail !== prevEmail) changes.push("email");
    if (newPhone !== prevPhone) changes.push("phone");
    const author = userProfile?.displayName ?? lead?.bmName ?? "Branch Manager";
    const logEntry = {
      time: formatNow(),
      timestamp: Date.now(),
      author,
      role: "bm",
      action: changes.length ? `Contact info updated: ${changes.join(", ")}` : "Contact info saved",
      source: "enrichment",
      previous: changes.length ? { email: prevEmail || null, phone: prevPhone || null } : undefined,
      updated: changes.length ? { email: newEmail, phone: newPhone } : undefined,
    };
    try {
      await updateLeadContact(lead.id, { email: newEmail, phone: newPhone }, logEntry);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setIsEditing(false);
      window.dispatchEvent(new CustomEvent("onboarding:action", { detail: { actionType: "edit_contact" } }));
    } catch (err) {
      setError(err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEmail(lead?.email ?? "");
    setPhone(lead?.phone ?? "");
    setError(null);
    setIsEditing(false);
  };

  const hasChanges = email !== (lead?.email ?? "") || phone !== (lead?.phone ?? "");
  const isEmailBlank = !email?.trim();
  const isPhoneBlank = !phone?.trim();
  const needsEnrichment = isEmailBlank || isPhoneBlank;
  const parsedPhone = parsePhoneE164(lead?.phone ?? "");

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-bold text-[#6E6E6E] uppercase tracking-wider">Contact Details</h3>
        {!isEditing && (
          <button
            type="button"
            data-onboarding="contact-edit"
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded text-[#6E6E6E] hover:bg-gray-100 hover:text-[#1A1A1A] transition-colors"
            aria-label="Edit contact details"
          >
            <PencilIcon />
          </button>
        )}
      </div>

      {isEditing ? (
        <>
          {needsEnrichment && (
            <div className="mb-3 p-3 rounded-lg bg-[var(--color-warning-light)] border border-[var(--color-warning)]/30">
              <p className="text-sm font-medium text-[var(--hertz-black)]">
                Add email and phone here to enable Email, SMS, and Call.
              </p>
              <p className="text-xs text-[var(--neutral-600)] mt-1">
                Required before you can contact this lead. Click Save when done.
              </p>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--neutral-600)] block mb-1">
                Email {isEmailBlank && <span className="text-[var(--color-warning)]">— add to enable Email</span>}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className={`w-full border rounded px-3 py-2 text-sm bg-white focus:border-[var(--hertz-primary)] focus:outline-none ${
                  isEmailBlank ? "border-[var(--color-warning)]/50" : "border-[var(--neutral-200)]"
                }`}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--neutral-600)] block mb-1">
                Phone {isPhoneBlank && <span className="text-[var(--color-warning)]">— add to enable SMS & Call</span>}
              </label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                showHint={true}
                showWarning={isPhoneBlank}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-3 py-1.5 bg-[var(--hertz-primary)] text-[var(--hertz-black)] rounded text-sm font-medium hover:opacity-90 disabled:opacity-60 cursor-pointer"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-3 py-1.5 border border-[var(--neutral-200)] rounded text-sm font-medium text-[#6E6E6E] hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
              {saved && <span className="text-sm text-[var(--color-success)] font-medium">✓ Saved</span>}
              {error && <span className="text-sm text-[var(--color-error)]">{error}</span>}
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[#6E6E6E] text-xs uppercase">Email</p>
            <p className="font-medium truncate" title={lead?.email ?? undefined}>{lead?.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-[#6E6E6E] text-xs uppercase">Phone</p>
            {lead?.phone ? (
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-[#6E6E6E]">{parsedPhone.countryCode}</span>
                <span className="font-medium">
                  {parsedPhone.local.length === 10
                    ? parsedPhone.local.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")
                    : parsedPhone.local || "—"}
                </span>
              </div>
            ) : (
              <p className="font-medium">—</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
