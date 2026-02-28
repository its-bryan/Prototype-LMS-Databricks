export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#FFD100] border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-sm text-[#6E6E6E]">Loading…</p>
    </div>
  );
}
