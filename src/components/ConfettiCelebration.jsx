/**
 * Confetti celebration for successful conversion (Rented).
 * Uses canvas-confetti for a proper burst effect. Magical, delightful.
 * Respects prefers-reduced-motion.
 */
import { useEffect } from "react";
import confetti from "canvas-confetti";

const PARTY_COLORS = [
  "#FF6B9D",
  "#C44569",
  "#FFB347",
  "#FFD93D",
  "#6BCB77",
  "#4D96FF",
  "#9B59B6",
  "#FF8C42",
  "#00D9FF",
  "#E056FD",
  "#F9E79F",
  "#58D68D",
];

function fire(origin, opts = {}) {
  const defaults = {
    particleCount: 80,
    spread: 100,
    origin,
    colors: PARTY_COLORS,
    ticks: 200,
    gravity: 0.8,
    scalar: 1.1,
    drift: 0.5,
    disableForReducedMotion: true,
  };
  return confetti({ ...defaults, ...opts });
}

export default function ConfettiCelebration({ onComplete }) {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      onComplete?.();
      return;
    }

    const origin = { x: 0.5, y: 0.5 };

    // Main burst from center
    const p1 = fire(origin, {
      particleCount: 120,
      spread: 360,
      startVelocity: 35,
      decay: 0.92,
    });

    // Secondary burst — slightly delayed for layered effect
    const t1 = setTimeout(
      () =>
        fire(origin, {
          particleCount: 60,
          spread: 180,
          angle: 90,
          startVelocity: 28,
          decay: 0.9,
        }),
      150
    );

    // Third burst — from sides for fullness
    const t2 = setTimeout(
      () => {
        fire({ x: 0.2, y: 0.5 }, { particleCount: 40, angle: 60, spread: 55, startVelocity: 25 });
        fire({ x: 0.8, y: 0.5 }, { particleCount: 40, angle: 120, spread: 55, startVelocity: 25 });
      },
      250
    );

    // Resolve when animation completes (p1 resolves when all confetti on canvas is done)
    if (p1) {
      p1.then(() => onComplete?.()).catch(() => onComplete?.());
    } else {
      setTimeout(() => onComplete?.(), 5000);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      confetti.reset();
    };
  }, [onComplete]);

  return null;
}
