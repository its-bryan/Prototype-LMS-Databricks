import { AppProvider, useApp } from "./context/AppContext";
import AppLayout from "./components/layout/AppLayout";
import JourneyMode from "./components/JourneyMode";
import InteractiveShell from "./components/interactive/InteractiveShell";

function AppContent() {
  const { mode, role } = useApp();

  if (mode === "journey") {
    return <JourneyMode />;
  }

  if (!role) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Interactive Demo</h2>
        <div className="w-12 h-1 bg-[#F5C400] mb-4" />
        <p className="text-[#6E6E6E]">Select a role from the sidebar to begin exploring.</p>
      </div>
    );
  }

  return <InteractiveShell />;
}

export default function App() {
  return (
    <AppProvider>
      <AppLayout>
        <AppContent />
      </AppLayout>
    </AppProvider>
  );
}
