import "@/app/sar.css";
import "@/app/copilot.css";
import Sidebar from "@/components/shared/Sidebar";
import SetupBanner from "@/components/shared/SetupBanner";
import CopilotFAB from "@/components/copilot/CopilotFAB";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <div className="app-content">
        <SetupBanner />
        {children}
      </div>
      <CopilotFAB />
    </>
  );
}
