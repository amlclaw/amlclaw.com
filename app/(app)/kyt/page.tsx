"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PageGuide from "@/components/shared/PageGuide";
import KytForm from "@/components/screening/KytForm";
import KytResult from "@/components/screening/KytResult";
import HistoryPanel from "@/components/screening/HistoryPanel";

export default function KytPage() {
  return (
    <Suspense fallback={null}>
      <KytPageInner />
    </Suspense>
  );
}

function KytPageInner() {
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<Record<string, unknown> | null>(null);
  const [progress, setProgress] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const MAX_POLL_ATTEMPTS = 100; // 100 * 3s = 5 minutes max

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
          setJobData({ status: "error", error: "Screening timed out. The width.info API may be slow — try again or reduce max nodes.", request: {} });
          setLoading(false);
          return;
        }
        fetch(`/api/kyt/${id}`)
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

  // Deep link: /kyt?job=<id> auto-loads that report (monitor "view" links)
  const searchParams = useSearchParams();
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    const job = searchParams.get("job");
    if (job && !deepLinkedRef.current) {
      deepLinkedRef.current = true;
      handleHistorySelect(job);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleJobStarted = useCallback(
    (id: string) => {
      setJobId(id);
      setJobData(null);
      setProgress("Submitting KYT screening request...");
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
      fetch(`/api/kyt/${id}`)
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
        <PageGuide
          pageKey="kyt"
          title="Transaction Screening (KYT)"
          description="Screen a transaction hash via the width.info V3 API. Choose in (source of funds), out (destination), or both — each direction uses its own KYT ruleset."
          tips={[
            "Paste a tx hash, pick the screen direction, then start screening",
            "IN / OUT ruleset IDs default to the KYT-IN / KYT-OUT builtins",
            "Use 'Monitor from/to address' on a result to track the counterparty with periodic KYA",
          ]}
        />
        <KytForm onJobStarted={handleJobStarted} onLoading={setLoading} />
        <div style={{ marginTop: "var(--sp-3)" }}>
          <KytResult job={jobData} jobId={jobId} loading={loading} progress={progress} />
        </div>
      </div>
      <div style={{ width: 200, flexShrink: 0 }}>
        <HistoryPanel type="kyt" onSelect={handleHistorySelect} refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
