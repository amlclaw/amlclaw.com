"use client";

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import PageGuide from "@/components/shared/PageGuide";
import ScreeningForm from "@/components/screening/ScreeningForm";
import ScreeningResult from "@/components/screening/ScreeningResult";
import HistoryPanel from "@/components/screening/HistoryPanel";

const BatchScreening = lazy(() => import("@/components/screening/BatchScreening"));

export default function ScreeningPage() {
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<Record<string, unknown> | null>(null);
  const [progress, setProgress] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [batchOpen, setBatchOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const MAX_POLL_ATTEMPTS = 60; // 60 * 3s = 3 minutes max

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  const pollJob = useCallback(
    (id: string) => {
      stopPolling();
      pollCountRef.current = 0;
      let failCount = 0;
      const poll = () => {
        pollCountRef.current++;
        if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
          stopPolling();
          setJobData({ status: "error", error: "Screening timed out. The TrustIn API may be slow — try again or reduce max nodes.", request: {} });
          setLoading(false);
          return;
        }
        fetch(`/api/screening/${id}`)
          .then((r) => r.json())
          .then((data) => {
            failCount = 0;
            setJobData(data);
            if (typeof data.progress === "string") {
              setProgress(data.progress);
            }
            if (data.status === "completed" || data.status === "error") {
              stopPolling();
              setLoading(false);
              setRefreshTrigger((p) => p + 1);
            }
          })
          .catch(() => {
            failCount++;
            if (failCount >= 5) {
              stopPolling();
              setJobData({ status: "error", error: "Connection lost. Please check your network and try again.", request: {} });
              setLoading(false);
            }
          });
      };
      poll();
      pollRef.current = setInterval(poll, 3000);
    },
    [stopPolling]
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleJobStarted = useCallback(
    (id: string) => {
      setJobId(id);
      setJobData(null);
      setProgress("Submitting screening request...");
      setLoading(true);
      pollJob(id);
    },
    [pollJob]
  );

  const handleHistorySelect = useCallback(
    (id: string) => {
      setJobId(id);
      setJobData(null);
      setProgress("Loading...");
      setLoading(true);
      fetch(`/api/screening/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setJobData(data);
          if (data.status === "running") {
            pollJob(id);
          } else {
            setLoading(false);
          }
        })
        .catch(() => {
          setLoading(false);
        });
    },
    [pollJob]
  );

  return (
    <div style={{ display: "flex", gap: "var(--sp-4)", padding: "var(--sp-5) var(--sp-6)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-2)" }}>
          <PageGuide
            pageKey="screening"
            title="Address Screening"
            description="Screen blockchain addresses against your compliance rule sets using TrustIn KYA API."
            tips={[
              "Enter an address, select scenario and ruleset, then start screening",
              "Use Batch Screening for multiple addresses at once",
              "View screening history on the right panel",
            ]}
          />
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setBatchOpen(true)}
            style={{ flexShrink: 0 }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            Batch
          </button>
        </div>
        <ScreeningForm onJobStarted={handleJobStarted} onLoading={setLoading} />
        <div style={{ marginTop: "var(--sp-3)" }}>
          <ScreeningResult job={jobData} jobId={jobId} loading={loading} progress={progress} />
        </div>
      </div>
      <div style={{ width: 200, flexShrink: 0 }}>
        <HistoryPanel onSelect={handleHistorySelect} refreshTrigger={refreshTrigger} />
      </div>

      {batchOpen && (
        <Suspense fallback={null}>
          <BatchScreening
            onClose={() => setBatchOpen(false)}
            onComplete={() => setRefreshTrigger((p) => p + 1)}
          />
        </Suspense>
      )}
    </div>
  );
}
