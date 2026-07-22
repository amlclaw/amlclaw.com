"use client";

import PageGuide from "@/components/shared/PageGuide";
import SettingsForm from "@/components/settings/SettingsForm";

export default function SettingsPage() {
  return (
    <div style={{ padding: "var(--sp-5) var(--sp-6)" }}>
      <PageGuide
        pageKey="settings"
        title="Settings"
        description="Configure API keys, screening defaults, monitoring, and application preferences."
        tips={[
          "Set your width.info API key to enable KYA/KYT screening",
          "Etherscan / TronGrid keys are optional — defaults are rate-limited",
          "Ruleset IDs are managed server-side on width.info; 0 = builtin default",
        ]}
      />
      <SettingsForm />
    </div>
  );
}
