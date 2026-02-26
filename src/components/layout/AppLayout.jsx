import DemoTopBar from "./DemoTopBar";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }) {
  return (
    <div className="h-full flex flex-col">
      <DemoTopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-white">
          {children}
        </main>
      </div>
    </div>
  );
}
