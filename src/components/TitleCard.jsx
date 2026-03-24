import { motion } from "framer-motion";

export default function TitleCard({ title, subtitle, summary = false }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-4xl font-bold text-[var(--hertz-black)] max-w-2xl"
      >
        {title}
      </motion.h1>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="w-16 h-1 bg-[var(--hertz-primary)] mt-4 mb-4"
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className={`max-w-xl ${summary ? "text-lg text-[var(--hertz-black)]" : "text-[var(--neutral-600)] text-lg"}`}
      >
        {subtitle}
      </motion.p>
    </div>
  );
}
