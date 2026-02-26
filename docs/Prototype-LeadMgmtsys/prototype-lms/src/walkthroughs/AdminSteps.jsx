import TitleCard from "../components/TitleCard";
import AdminUpload from "../components/AdminUpload";
import OrgMapping from "../components/OrgMapping";
import { uploadSummary, orgMapping } from "../data/mockData";

function Admin1() {
  return (
    <TitleCard
      title="Admin — Data & Configuration"
      subtitle="Upload data. Manage mappings. Keep the system current."
    />
  );
}

function Admin2() {
  const { hles } = uploadSummary;
  return (
    <AdminUpload
      fileName="Conversion_Data_Feb_2026.xlsx"
      type="hles"
      summary={[
        { label: "Rows parsed", value: hles.rowsParsed.toLocaleString() },
        { label: "New leads", value: hles.newLeads.toLocaleString(), color: "text-[#2E7D32]" },
        { label: "Updated", value: hles.updated.toLocaleString() },
        { label: "Unchanged", value: hles.unchanged.toLocaleString(), color: "text-[#6E6E6E]" },
        {
          label: "Failed validation",
          value: hles.failed.toString(),
          color: "text-[#C62828]",
          expandable: true,
          details: hles.failedDetails,
        },
      ]}
    />
  );
}

function Admin3() {
  const { translog } = uploadSummary;
  return (
    <AdminUpload
      fileName="Translog_Feb_2026.csv"
      type="translog"
      summary={[
        { label: "Events parsed", value: translog.eventsParsed.toLocaleString() },
        { label: "Matched to existing leads", value: translog.matched.toLocaleString(), color: "text-[#2E7D32]" },
        {
          label: "Orphan events (stored for future matching)",
          value: translog.orphan.toLocaleString(),
          color: "text-[#6E6E6E]",
        },
      ]}
    />
  );
}

function Admin4() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">Organisation Mapping</h2>
      <p className="text-sm text-[#6E6E6E] mb-4">Upload in bulk. Edit where needed.</p>
      <OrgMapping
        rows={orgMapping}
        editingRow={0}
        editedValue="R. Martinez"
        missingRows={[10, 14]}
      />
    </div>
  );
}

export const adminSteps = [Admin1, Admin2, Admin3, Admin4];
