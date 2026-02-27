"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import PageGuide from "@/components/PageGuide";
import RulesetList from "@/components/RulesetList";
import RulesetGenerator from "@/components/RulesetGenerator";

function RulesContent() {
  const searchParams = useSearchParams();
  const [generatorMode, setGeneratorMode] = useState(false);
  const [initialPolicyId, setInitialPolicyId] = useState<string | undefined>();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const generate = searchParams.get("generate");
    const policy = searchParams.get("policy");
    if (generate === "true" && policy) {
      setInitialPolicyId(policy);
      setGeneratorMode(true);
      window.history.replaceState(null, "", "/rules");
    }
  }, [searchParams]);

  return (
    <div className="layout-centered">
      <PageGuide
        pageKey="rules"
        title="Rule Sets"
        description="Manage detection rule sets that power address screening and monitoring."
        tips={[
          "Built-in rulesets are read-only — clone to customize",
          "AI Generate from a compliance policy for automated rule creation",
          "Click any ruleset to view, edit, or delete individual rules",
        ]}
      />
      {generatorMode ? (
        <RulesetGenerator
          initialPolicyId={initialPolicyId}
          onComplete={() => {
            setGeneratorMode(false);
            setRefreshTrigger((n) => n + 1);
          }}
          onCancel={() => setGeneratorMode(false)}
        />
      ) : (
        <RulesetList
          onGenerateFromPolicy={() => setGeneratorMode(true)}
          refreshTrigger={refreshTrigger}
        />
      )}
    </div>
  );
}

export default function RulesPage() {
  return (
    <Suspense>
      <RulesContent />
    </Suspense>
  );
}
