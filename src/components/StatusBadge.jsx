const statusStyles = {
  Cancelled: "bg-red-50 text-[#C62828] border border-red-200",
  Unused: "bg-amber-50 text-[#1A1A1A] border border-amber-200",
  Rented: "bg-green-50 text-[#2E7D32] border border-green-200",
  Reviewed: "bg-gray-50 text-[#6E6E6E] border border-gray-200",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[status] || ""}`}>
      {status}
    </span>
  );
}
