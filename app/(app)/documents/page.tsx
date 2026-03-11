"use client";

import PageGuide from "@/components/shared/PageGuide";
import DocumentLibrary from "@/components/documents/DocumentLibrary";

export default function DocumentsPage() {
  return (
    <>
      <div style={{ padding: "var(--sp-5) var(--sp-6) 0" }}>
        <PageGuide
          pageKey="documents"
          title="Document Library"
          description="Browse and manage regulatory documents that power your compliance policies."
          tips={[
            "Select documents and click 'Generate Compliance Policy'",
            "Upload your own documents (MD/PDF/TXT)",
            "Filter by jurisdiction to find relevant docs",
          ]}
        />
      </div>
      <DocumentLibrary />
    </>
  );
}
