import { useMemo, useState } from "react";

function StarIcon({ filled, className = "w-5 h-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l2.06 6.345a1 1 0 00.95.69h6.667c.969 0 1.371 1.24.588 1.81l-5.393 3.918a1 1 0 00-.364 1.118l2.06 6.344c.3.922-.755 1.688-1.539 1.118l-5.393-3.918a1 1 0 00-1.176 0l-5.393 3.918c-.783.57-1.838-.196-1.539-1.118l2.06-6.344a1 1 0 00-.364-1.118L.784 11.772c-.783-.57-.38-1.81.588-1.81h6.667a1 1 0 00.95-.69l2.06-6.345z"
      />
    </svg>
  );
}

export default function StarRating({
  value = 0,
  max = 5,
  onChange = null,
  readOnly = false,
  size = "md",
  className = "",
}) {
  const [hoverValue, setHoverValue] = useState(0);
  const interactive = !readOnly && typeof onChange === "function";

  const iconClass = useMemo(() => {
    if (size === "sm") return "w-4 h-4";
    if (size === "lg") return "w-6 h-6";
    return "w-5 h-5";
  }, [size]);

  const displayValue = interactive && hoverValue ? hoverValue : value;

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      onMouseLeave={() => interactive && setHoverValue(0)}
      role={interactive ? "radiogroup" : undefined}
      aria-label={interactive ? "Star rating" : undefined}
    >
      {Array.from({ length: max }).map((_, idx) => {
        const starValue = idx + 1;
        const fillAmount = Math.max(0, Math.min(1, displayValue - idx));
        const filled = fillAmount >= 1;
        const colorClass = filled ? "text-[var(--hertz-primary)]" : "text-[var(--neutral-300)]";

        if (!interactive) {
          if (fillAmount > 0 && fillAmount < 1) {
            return (
              <span key={starValue} className="relative inline-block">
                <span className="text-[var(--neutral-300)]">
                  <StarIcon filled={false} className={iconClass} />
                </span>
                <span
                  className="absolute inset-y-0 left-0 overflow-hidden text-[var(--hertz-primary)]"
                  style={{ width: `${fillAmount * 100}%` }}
                >
                  <StarIcon filled className={iconClass} />
                </span>
              </span>
            );
          }
          return (
            <span key={starValue} className={colorClass}>
              <StarIcon filled={filled} className={iconClass} />
            </span>
          );
        }

        return (
          <button
            key={starValue}
            type="button"
            className={`${colorClass} transition-transform hover:scale-110`}
            onMouseEnter={() => setHoverValue(starValue)}
            onFocus={() => setHoverValue(starValue)}
            onClick={() => onChange(starValue)}
            role="radio"
            aria-checked={value === starValue}
            aria-label={`${starValue} ${starValue === 1 ? "star" : "stars"}`}
          >
            <StarIcon filled={filled} className={iconClass} />
          </button>
        );
      })}
    </div>
  );
}
