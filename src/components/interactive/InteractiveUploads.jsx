import { useState } from "react";
import { motion } from "framer-motion";
import { uploadSummary } from "../../data/mockData";

function UploadCard({ type, fileName, summary }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setUploaded(true);
    }, 1500);
  };

  return (
    <div className="border border-[#E6E6E6] rounded-lg p-6 space-y-4">
      <div className="border-2 border-dashed border-[#E6E6E6] rounded-lg p-6 text-center">
        <p className="text-[#6E6E6E] text-sm mb-2">{type}</p>
        <div className="inline-flex items-center gap-2 bg-gray-50 rounded px-4 py-2 text-sm font-mono text-[#1A1A1A]">
          📄 {fileName}
        </div>
      </div>

      {!uploaded && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-4 py-2 bg-[#FFD100] text-[#1A1A1A] rounded text-sm font-medium hover:bg-[#E6BC00] transition-colors cursor-pointer disabled:opacity-60"
        >
          {uploading ? "Processing..." : "Upload & Validate"}
        </button>
      )}

      {uploading && (
        <div className="h-2 bg-gray-100 rounded overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="h-full bg-[#FFD100] rounded"
          />
        </div>
      )}

      {uploaded && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-[#E6E6E6] rounded-lg p-4 space-y-2"
        >
          <h3 className="font-semibold text-[#1A1A1A] text-sm">Validation Summary</h3>
          {summary.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-[#6E6E6E]">{item.label}</span>
              <span className={`font-medium ${item.color || "text-[#1A1A1A]"}`}>{item.value}</span>
            </div>
          ))}
          <div className="pt-2">
            <span className="text-[#2E7D32] text-sm font-medium">✓ Import Confirmed</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function InteractiveUploads() {
  const { hles, translog } = uploadSummary;

  const hlesSummary = [
    { label: "Rows parsed", value: hles.rowsParsed.toLocaleString() },
    { label: "New leads", value: hles.newLeads.toLocaleString(), color: "text-[#2E7D32]" },
    { label: "Updated", value: hles.updated.toLocaleString() },
    { label: "Unchanged", value: hles.unchanged.toLocaleString(), color: "text-[#6E6E6E]" },
    { label: "Failed validation", value: hles.failed.toString(), color: "text-[#C62828]" },
  ];

  const translogSummary = [
    { label: "Events parsed", value: translog.eventsParsed.toLocaleString() },
    { label: "Matched to existing leads", value: translog.matched.toLocaleString(), color: "text-[#2E7D32]" },
    { label: "Orphan events", value: translog.orphan.toLocaleString(), color: "text-[#6E6E6E]" },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">Data Uploads</h2>
      <p className="text-sm text-[#6E6E6E] mb-6">Upload HLES and TRANSLOG data files.</p>

      <div className="grid grid-cols-2 gap-6">
        <UploadCard
          type="HLES Conversion Data"
          fileName="Conversion_Data_Feb_2026.xlsx"
          summary={hlesSummary}
        />
        <UploadCard
          type="TRANSLOG Activity Data"
          fileName="Translog_Feb_2026.csv"
          summary={translogSummary}
        />
      </div>
    </div>
  );
}
