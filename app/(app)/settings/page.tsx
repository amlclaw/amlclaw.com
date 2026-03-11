"use client";

import PageGuide from "@/components/shared/PageGuide";
import SettingsForm from "@/components/settings/SettingsForm";

export default function SettingsPage() {
  return (
    <>
      <div style={{ padding: "var(--sp-5) var(--sp-6) 0" }}>
        <PageGuide
          pageKey="settings"
          title="Settings"
          description="Configure API keys, AI providers, screening defaults, and application preferences."
          tips={[
            "Add your AI provider API key to enable policy and rule generation",
            "Configure TrustIn API key for blockchain screening",
            "Customize screening defaults for your compliance workflow",
          ]}
        />
      </div>
      <SettingsForm />
    </>
  );
}
