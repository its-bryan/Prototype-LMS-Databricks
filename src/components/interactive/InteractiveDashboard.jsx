import { motion } from "framer-motion";
import { useApp } from "../../context/AppContext";
import { getBMStats, getGMStats, getBMTrends, getGMTrends } from "../../selectors/demoSelectors";
import { roleMeta } from "../../config/navigation";
import MiniBarChart from "../MiniBarChart";

const cardAnim = (i) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.1 },
});

function SectionHeader({ title }) {
  return (
    <motion.h3
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-sm font-semibold text-[#6E6E6E] uppercase tracking-wide mb-3"
    >
      {title}
    </motion.h3>
  );
}

function BMDashboard({ navigateTo }) {
  const stats = getBMStats();
  const trends = getBMTrends();
  const cards = [
    { label: "Total Leads", value: stats.total, color: "text-[#1A1A1A]" },
    { label: "Rented", value: stats.rented, color: "text-[#2E7D32]" },
    { label: "Cancelled", value: stats.cancelled, color: "text-[#C62828]" },
    { label: "Unused", value: stats.unused, color: "text-[#F5C400]" },
    { label: "Enrichment Rate", value: `${stats.enrichmentRate}%`, color: "text-[#2E7D32]" },
    { label: "Needs Enrichment", value: stats.total - stats.enriched, color: "text-[#C62828]" },
  ];

  return (
    <div>
      <SectionHeader title="This Week · Feb 17–21" />
      <div className="grid grid-cols-3 gap-4 mb-8">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            {...cardAnim(i)}
            className="border border-[#E6E6E6] rounded-lg p-5"
          >
            <p className="text-xs text-[#6E6E6E] uppercase tracking-wide">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      <SectionHeader title="4-Week Trend" />
      <div className="grid grid-cols-3 gap-4 mb-8">
        <motion.div {...cardAnim(0)}>
          <MiniBarChart
            data={trends.leadVolume}
            labels={trends.labels}
            color="#1A1A1A"
            label="Lead Volume"
          />
        </motion.div>
        <motion.div {...cardAnim(1)}>
          <MiniBarChart
            data={trends.conversionRate}
            labels={trends.labels}
            color="#2E7D32"
            label="Conversion Rate"
            suffix="%"
          />
        </motion.div>
        <motion.div {...cardAnim(2)}>
          <MiniBarChart
            data={trends.enrichmentRate}
            labels={trends.labels}
            color="#F5C400"
            label="Enrichment Rate"
            suffix="%"
          />
        </motion.div>
      </div>

      <motion.div {...cardAnim(3)}>
        <button
          onClick={() => navigateTo("bm-leads")}
          className="px-5 py-2.5 bg-[#F5C400] text-[#1A1A1A] rounded font-medium text-sm hover:bg-[#e0b200] transition-colors cursor-pointer"
        >
          Review My Leads
        </button>
      </motion.div>
    </div>
  );
}

function GMDashboard({ navigateTo }) {
  const stats = getGMStats();
  const trends = getGMTrends();
  const cards = [
    { label: "Cancelled Unreviewed", value: stats.cancelledUnreviewed, color: "text-[#C62828]" },
    { label: "Unused Overdue (5+ days)", value: stats.unusedOverdue, color: "text-[#F5C400]" },
    { label: "Enrichment Compliance", value: `${stats.enrichmentCompliance}%`, color: "text-[#2E7D32]" },
  ];

  const actions = [
    { label: "View Compliance", view: "gm-compliance" },
    { label: "Review Cancelled", view: "gm-cancelled" },
    { label: "Spot Check", view: "gm-spot-check" },
  ];

  return (
    <div>
      <SectionHeader title="This Week · Feb 17–21" />
      <div className="grid grid-cols-3 gap-4 mb-8">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            {...cardAnim(i)}
            className="border border-[#E6E6E6] rounded-lg p-5"
          >
            <p className="text-xs text-[#6E6E6E] uppercase tracking-wide">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      <SectionHeader title="4-Week Trend" />
      <div className="grid grid-cols-3 gap-4 mb-8">
        <motion.div {...cardAnim(0)}>
          <MiniBarChart
            data={trends.cancelledUnreviewed}
            labels={trends.labels}
            color="#C62828"
            label="Cancelled Unreviewed"
          />
        </motion.div>
        <motion.div {...cardAnim(1)}>
          <MiniBarChart
            data={trends.enrichmentCompliance}
            labels={trends.labels}
            color="#2E7D32"
            label="Enrichment Compliance"
            suffix="%"
          />
        </motion.div>
        <motion.div {...cardAnim(2)}>
          <MiniBarChart
            data={trends.regionConversionRate}
            labels={trends.labels}
            color="#1A1A1A"
            label="Region Conversion Rate"
            suffix="%"
          />
        </motion.div>
      </div>

      <motion.div {...cardAnim(3)} className="flex gap-3">
        {actions.map((a) => (
          <button
            key={a.view}
            onClick={() => navigateTo(a.view)}
            className="px-4 py-2 bg-[#F5C400] text-[#1A1A1A] rounded font-medium text-sm hover:bg-[#e0b200] transition-colors cursor-pointer"
          >
            {a.label}
          </button>
        ))}
      </motion.div>
    </div>
  );
}

function AdminDashboard({ navigateTo }) {
  const cards = [
    { label: "Data Uploads", desc: "Upload HLES and TRANSLOG files", view: "admin-uploads" },
    { label: "Org Mapping", desc: "Manage BM/Branch/GM assignments", view: "admin-org-mapping" },
  ];

  return (
    <div className="grid grid-cols-2 gap-6">
      {cards.map((card, i) => (
        <motion.button
          key={card.view}
          {...cardAnim(i)}
          onClick={() => navigateTo(card.view)}
          className="border border-[#E6E6E6] rounded-lg p-6 text-left hover:border-[#F5C400] transition-colors cursor-pointer"
        >
          <p className="text-lg font-semibold text-[#1A1A1A] mb-1">{card.label}</p>
          <p className="text-sm text-[#6E6E6E]">{card.desc}</p>
        </motion.button>
      ))}
    </div>
  );
}

export default function InteractiveDashboard() {
  const { role, navigateTo } = useApp();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">{roleMeta[role]?.label} Dashboard</h1>
        <div className="w-12 h-1 bg-[#F5C400] mt-2" />
      </div>
      {role === "bm" && <BMDashboard navigateTo={navigateTo} />}
      {role === "gm" && <GMDashboard navigateTo={navigateTo} />}
      {role === "admin" && <AdminDashboard navigateTo={navigateTo} />}
    </div>
  );
}
