export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center gap-6">
      <img src="/hertz-logo.svg" alt="Hertz" className="h-10 opacity-80" />
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-[3px] border-[#FFD100] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#6E6E6E] font-medium tracking-wide">Loading your dashboard…</p>
      </div>
    </div>
  );
}
