import { motion, useReducedMotion } from "framer-motion";

const CHART_HEIGHT = 280;

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

export default function ObservatoryBarChart({
  points,
  mode = "single",
  yAxis = "count",
  title,
  subtitle,
  onBarClick,
}) {
  const reduceMotion = useReducedMotion();

  const dataMax = Math.max(
    1,
    ...points.map((p) => {
      if (mode === "stacked") return p.total ?? 0;
      if (mode === "cluster") return Math.max(p.value ?? 0, p.unusedPct ?? 0);
      return p.value ?? 0;
    })
  );
  const maxValue = yAxis === "percent" ? 100 : Math.ceil(dataMax * 1.1);

  const yTicks = yAxis === "percent" ? [0, 25, 50, 75, 100] : [0, Math.round(maxValue * 0.25), Math.round(maxValue * 0.5), Math.round(maxValue * 0.75), maxValue];
  const heightDenominator = yAxis === "percent" ? 100 : maxValue;

  return (
    <div className="rounded-xl border border-[var(--neutral-200)] bg-white shadow-[var(--shadow-sm)]">
      <div className="px-5 py-4 border-b border-[var(--neutral-100)]">
        <h3 className="text-base font-semibold text-[var(--hertz-black)]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--neutral-600)] mt-1">{subtitle}</p>}
      </div>

      <div className="px-4 pt-4 pb-7">
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="flex items-stretch gap-3">
              <div className="w-12 shrink-0 h-[320px] flex flex-col justify-between text-[10px] text-[var(--neutral-500)] text-right pr-2">
                {yTicks.slice().reverse().map((tick) => (
                  <span key={tick}>{yAxis === "percent" ? `${tick}%` : formatNumber(tick)}</span>
                ))}
              </div>

              <div className="flex-1 relative">
                <div className="absolute inset-0 pointer-events-none">
                  {yTicks.map((tick) => {
                    const ratio = yAxis === "percent" ? tick / 100 : tick / maxValue;
                    const top = (1 - ratio) * CHART_HEIGHT;
                    return <div key={tick} className="absolute left-0 right-0 border-t border-dashed border-[var(--neutral-200)]" style={{ top }} />;
                  })}
                </div>

                <div className="relative h-[320px] flex items-end gap-2 px-2">
                  {points.map((p, idx) => {
                    const singleHeight = ((p.value ?? 0) / heightDenominator) * CHART_HEIGHT;
                    const unusedPercentHeight = ((p.unusedPct ?? 0) / heightDenominator) * CHART_HEIGHT;
                    const rentedHeight = ((p.rented ?? 0) / maxValue) * CHART_HEIGHT;
                    const cancelledHeight = ((p.cancelled ?? 0) / maxValue) * CHART_HEIGHT;
                    const unusedHeight = ((p.unused ?? 0) / maxValue) * CHART_HEIGHT;
                    const percentLabel = `${Math.round(p.value ?? 0)}%`;
                    const unusedPercentLabel = `${Math.round(p.unusedPct ?? 0)}%`;

                    return (
                      <div key={p.label} className="flex-1 min-w-[34px] h-full flex flex-col items-center justify-end">
                        <div className="w-full max-w-[48px] flex items-end justify-center" title={p.tooltip}>
                          {mode === "single" ? (
                            <div className="relative w-full flex items-end justify-center">
                              {yAxis === "percent" && (
                                <span
                                  className="absolute text-[10px] font-semibold text-[var(--neutral-700)]"
                                  style={{ bottom: `${Math.min(singleHeight + 6, CHART_HEIGHT + 6)}px` }}
                                >
                                  {percentLabel}
                                </span>
                              )}
                              <motion.div
                                initial={reduceMotion ? false : { height: 0 }}
                                animate={{ height: singleHeight }}
                                transition={{ duration: 0.45, delay: idx * 0.02 }}
                                className="w-full rounded-t-md bg-[var(--hertz-primary)]"
                              />
                            </div>
                          ) : mode === "cluster" ? (
                            <div className="relative w-full flex items-end justify-center gap-1">
                              <div className="relative h-full flex-1 flex items-end justify-center">
                                {yAxis === "percent" && (
                                  <span
                                    className="absolute text-[10px] font-semibold text-[var(--neutral-700)]"
                                    style={{ bottom: `${Math.min(singleHeight + 6, CHART_HEIGHT + 6)}px` }}
                                  >
                                    {percentLabel}
                                  </span>
                                )}
                                <motion.button
                                  type="button"
                                  initial={reduceMotion ? false : { height: 0 }}
                                  animate={{ height: singleHeight }}
                                  transition={{ duration: 0.45, delay: idx * 0.02 }}
                                  onClick={() => onBarClick?.(p, "conversion")}
                                  className="w-full rounded-t-md bg-[var(--hertz-primary)]"
                                />
                              </div>
                              <div className="relative h-full flex-1 flex items-end justify-center">
                                {yAxis === "percent" && (
                                  <span
                                    className="absolute text-[10px] font-semibold text-[var(--neutral-700)]"
                                    style={{ bottom: `${Math.min(unusedPercentHeight + 6, CHART_HEIGHT + 6)}px` }}
                                  >
                                    {unusedPercentLabel}
                                  </span>
                                )}
                                <motion.button
                                  type="button"
                                  initial={reduceMotion ? false : { height: 0 }}
                                  animate={{ height: unusedPercentHeight }}
                                  transition={{ duration: 0.45, delay: idx * 0.02 + 0.03 }}
                                  onClick={() => onBarClick?.(p, "unused")}
                                  className="w-full cursor-pointer rounded-t-md bg-[var(--neutral-300)]"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="w-full">
                              <span
                                className="block text-center text-[10px] font-semibold text-[var(--neutral-700)] mb-1"
                              >
                                {formatNumber(p.total ?? ((p.rented ?? 0) + (p.cancelled ?? 0) + (p.unused ?? 0)))}
                              </span>
                              <div className="relative w-full rounded-t-md overflow-hidden border border-[var(--neutral-200)] border-b-0 bg-[var(--neutral-50)]">
                                <motion.div
                                  initial={reduceMotion ? false : { height: 0 }}
                                  animate={{ height: rentedHeight }}
                                  transition={{ duration: 0.45, delay: idx * 0.02 }}
                                  className="w-full bg-[var(--chart-primary)] flex items-center justify-center"
                                >
                                  {p.rented > 0 && rentedHeight >= 18 && <span className="text-[10px] font-bold text-white">{formatNumber(p.rented)}</span>}
                                </motion.div>
                                <motion.div
                                  initial={reduceMotion ? false : { height: 0 }}
                                  animate={{ height: cancelledHeight }}
                                  transition={{ duration: 0.45, delay: idx * 0.02 + 0.03 }}
                                  className="w-full bg-[var(--chart-black)] flex items-center justify-center"
                                >
                                  {p.cancelled > 0 && cancelledHeight >= 18 && <span className="text-[10px] font-bold text-white">{formatNumber(p.cancelled)}</span>}
                                </motion.div>
                                <motion.div
                                  initial={reduceMotion ? false : { height: 0 }}
                                  animate={{ height: unusedHeight }}
                                  transition={{ duration: 0.45, delay: idx * 0.02 + 0.06 }}
                                  className="w-full bg-[var(--chart-neutral)] flex items-center justify-center"
                                >
                                  {p.unused > 0 && unusedHeight >= 18 && <span className="text-[10px] font-bold text-[var(--hertz-black)]">{formatNumber(p.unused)}</span>}
                                </motion.div>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="mt-4 text-[10px] text-[var(--neutral-600)] text-center leading-tight">{p.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {mode === "stacked" && (
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-[var(--neutral-600)]">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--chart-primary)]" />Rented</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--chart-black)]" />Cancelled</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--chart-neutral)]" />Unused</span>
              </div>
            )}
            {mode === "cluster" && (
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-[var(--neutral-600)]">
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--hertz-primary)]" />Conversion %</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--neutral-300)]" />Unused %</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
