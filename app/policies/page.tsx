"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import PolicyList from "@/components/PolicyList";
import PolicyViewer from "@/components/PolicyViewer";
import PolicyGenerator from "@/components/PolicyGenerator";

function PoliciesContent() {
  const searchParams = useSearchParams();
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const [generatorMode, setGeneratorMode] = useState(false);
  const [generatorDocs, setGeneratorDocs] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Handle incoming generate request from /documents
  useEffect(() => {
    const generate = searchParams.get("generate");
    const docs = searchParams.get("docs");
    if (generate === "true" && docs) {
      setGeneratorDocs(docs.split(","));
      setGeneratorMode(true);
      window.history.replaceState(null, "", "/policies");
    }
  }, [searchParams]);

  const handleGenerateNew = useCallback(() => {
    window.location.href = "/documents";
  }, []);

  const handlePolicyCreated = useCallback((policyId: string) => {
    setGeneratorMode(false);
    setSelectedPolicy(policyId);
    setRefreshTrigger((n) => n + 1);
  }, []);

  const handleGenerateRules = useCallback((policyId: string) => {
    window.location.href = `/rules?generate=true&policy=${policyId}`;
  }, []);

  return (
    <div className="layout-sidebar" style={{ height: "calc(100vh - 96px)" }}>
      <div className="sidebar">
        <PolicyList
          selected={selectedPolicy}
          onSelect={(id) => { setSelectedPolicy(id); setGeneratorMode(false); }}
          onGenerate={handleGenerateNew}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <div className="main">
        {generatorMode ? (
          <PolicyGenerator
            documentIds={generatorDocs}
            onPolicyCreated={handlePolicyCreated}
            onCancel={() => setGeneratorMode(false)}
          />
        ) : (
          <PolicyViewer
            policyId={selectedPolicy}
            onGenerateRules={handleGenerateRules}
            onRefresh={() => setRefreshTrigger((n) => n + 1)}
          />
        )}
      </div>
    </div>
  );
}

export default function PoliciesPage() {
  return (
    <Suspense>
      <PoliciesContent />
    </Suspense>
  );
}
