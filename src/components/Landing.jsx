const journeys = [
  {
    key: "bm",
    icon: "📋",
    role: "Branch View",
    description: "Review and enrich your leads",
  },
  {
    key: "gm",
    icon: "📊",
    role: "Manager View",
    description: "Track compliance and drive accountability",
  },
  {
    key: "admin",
    icon: "⚙️",
    role: "Admin",
    description: "Upload data and manage configuration",
  },
];

export default function Landing({ onSelect }) {
  return (
    <div className="h-full bg-white flex flex-col items-center justify-center px-8 overflow-y-auto">
      <div className="mb-12 text-center">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--hertz-black)] tracking-tight whitespace-nowrap">
          LEO: Your Lead Management System
        </h1>
        <p className="text-[var(--neutral-600)] text-lg mt-2">
          Turning leads into happy customers
        </p>
        <div className="w-16 h-1 bg-[var(--hertz-primary)] mx-auto mt-3 mb-4" />
      </div>

      <div className="flex gap-6 max-w-4xl w-full">
        {journeys.map((j) => (
          <button
            key={j.key}
            onClick={() => onSelect(j.key)}
            className="flex-1 text-left p-6 rounded-lg border border-[var(--neutral-200)] hover:border-[var(--hertz-primary)] hover:border-l-4 transition-all group cursor-pointer"
          >
            <div className="text-3xl mb-3">{j.icon}</div>
            <h2 className="text-xl font-semibold text-[var(--hertz-black)] mb-1">{j.role}</h2>
            <p className="text-[var(--neutral-600)] text-sm">{j.description}</p>
          </button>
        ))}
      </div>

      <p className="mt-12 text-xs text-[var(--neutral-200)]">Hertz — Insurance Replacement Division</p>
    </div>
  );
}
