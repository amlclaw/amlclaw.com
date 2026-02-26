"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ScreeningForm from "@/components/ScreeningForm";
import ScreeningResult from "@/components/ScreeningResult";
import HistoryPanel from "@/components/HistoryPanel";

export default function ScreeningPage() {
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<Record<string, unknown> | null>(null);
  const [progress, setProgress] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    (id: string) => {
      stopPolling();
      const poll = () => {
        fetch(`/api/screening/${id}`)
          .then((r) => r.json())
          .then((data) => {
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
          .catch(() => {});
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
    <div className="layout-sidebar">
      <div className="main">
        <ScreeningForm onJobStarted={handleJobStarted} onLoading={setLoading} />
        <div style={{ marginTop: "var(--sp-5)" }}>
          <ScreeningResult job={jobData} jobId={jobId} loading={loading} progress={progress} />
        </div>
      </div>
      <div className="sidebar">
        <HistoryPanel onSelect={handleHistorySelect} refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
