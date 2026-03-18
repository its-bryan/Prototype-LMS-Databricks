import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";

const HERTZ_IMAGES = [
  { src: "/login-images/login-1.png", alt: "Hertz Cadillac race cars" },
  { src: "/login-images/login-2.png", alt: "Hertz winter coastal escape", objectPosition: "top center" },
  { src: "/login-images/login-3.png?v=2", alt: "Hertz Gold Kart Series" },
  { src: "/login-images/login-4.png?v=2", alt: "Hertz scenic mountain road trip" },
  { src: "/login-images/login-5.png", alt: "Hertz SUV on scenic road" },
];

const ROTATE_INTERVAL_MS = 8000;
const FADE_DURATION = 1.2;

export default function LoginScreen() {
  const { signIn, profileError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setImageIndex((i) => (i + 1) % HERTZ_IMAGES.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-x-hidden">
      {/* Left: Login form — extra padding to clear diagonal, scrollable if needed */}
      <div className="flex-1 md:flex-none md:w-[50%] flex flex-col justify-center px-6 sm:px-10 md:px-12 xl:px-16 md:pr-[12rem] bg-white min-h-screen relative pt-14 md:pt-0 pb-12 md:pb-16 shrink-0 min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Mobile: Compact Hertz header */}
        <div className="md:hidden absolute top-0 left-0 right-0 h-14 bg-[#272425] flex items-center justify-center px-4 z-10">
          <img
            src="/hertz-logo.svg"
            alt="Hertz"
            className="h-7"
          />
        </div>
        <div className="w-full max-w-md mx-auto md:ml-0 md:mr-auto">
          <div className="hidden md:block mb-8">
            <img src="/hertz-logo.svg" alt="Hertz" className="h-11" />
            <h1 className="text-xl md:text-2xl font-extrabold text-[#272425] tracking-tight mt-4 whitespace-nowrap">
              LEO: Your Lead Management System
            </h1>
            <p className="text-[#6E6E6E] text-base mt-2">
              Turning leads into happy customers
            </p>
            <div className="w-16 h-1.5 bg-[#FFD100] mt-3" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-[#272425] tracking-tight mb-2">
              Sign in
            </h2>
            <p className="text-[#666] text-base mb-8">
              Access your view with your Hertz credentials
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-base font-semibold text-[#272425] mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hertz.demo"
                  required
                  autoComplete="email"
                  className="w-full h-14 px-4 border-2 border-[#E5E5E5] rounded-xl text-[#272425] placeholder:text-[#888] focus:outline-none focus:border-[#272425] focus:ring-4 focus:ring-[#FFD100]/20 transition-all duration-200 text-base"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-base font-semibold text-[#272425] mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full h-14 px-4 border-2 border-[#E5E5E5] rounded-xl text-[#272425] placeholder:text-[#888] focus:outline-none focus:border-[#272425] focus:ring-4 focus:ring-[#FFD100]/20 transition-all duration-200 text-base"
                />
              </div>
              {(error || profileError) && (
                <p className="text-base font-medium text-[#C62828] bg-[#FFEBEE] px-5 py-3 rounded-xl">
                  {profileError || error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-14 bg-[#FFD100] text-[#272425] font-bold rounded-xl hover:bg-[#E6BC00] active:bg-[#CC9F00] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_4px_12px_rgba(255,209,0,0.35)] active:scale-[0.99] text-base"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

          </motion.div>
        </div>

      </div>

      {/* Right: Rotating Hertz branded images — diagonal cut via clip-path */}
      <div
        className="hidden md:flex md:flex-1 md:min-w-0 md:min-h-screen relative overflow-hidden bg-[#272425]"
        style={{
          clipPath: "polygon(10rem 0, 100% 0, 100% 100%, 0 100%)",
          marginLeft: "-10rem",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={imageIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: FADE_DURATION, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0"
          >
            <img
              src={HERTZ_IMAGES[imageIndex].src}
              alt={HERTZ_IMAGES[imageIndex].alt}
              className="w-full h-full object-cover"
              style={HERTZ_IMAGES[imageIndex].objectPosition ? { objectPosition: HERTZ_IMAGES[imageIndex].objectPosition } : undefined}
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#272425]/80 via-[#272425]/20 to-transparent"
              aria-hidden
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
