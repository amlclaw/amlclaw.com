import Sidebar from "@/components/shared/Sidebar";
import SetupBanner from "@/components/shared/SetupBanner";

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
    </>
  );
}
