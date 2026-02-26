"use client";

import { useState, useCallback } from "react";
import MonitorList from "@/components/MonitorList";
import MonitorEditor from "@/components/MonitorEditor";
import MonitorRunHistory from "@/components/MonitorRunHistory";
import type { MonitorTask } from "@/lib/types";

export default function MonitoringPage() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MonitorTask | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<{ taskId: string; taskName: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleNew = useCallback(() => {
    setEditingTask(null);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback((task: MonitorTask) => {
    setEditingTask(task);
    setEditorOpen(true);
  }, []);

  const handleSaved = useCallback(() => {
    setRefreshTrigger((p) => p + 1);
  }, []);

  const handleSelectHistory = useCallback((taskId: string, taskName: string) => {
    setSelectedHistory({ taskId, taskName });
  }, []);

  return (
    <div className="layout-sidebar">
      <div className="main">
        <MonitorList
          onEdit={handleEdit}
          onSelectHistory={handleSelectHistory}
          onNewTask={handleNew}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <div className="sidebar">
        {selectedHistory ? (
          <MonitorRunHistory
            taskId={selectedHistory.taskId}
            taskName={selectedHistory.taskName}
            onClose={() => setSelectedHistory(null)}
          />
        ) : (
          <div className="card" style={{ padding: "var(--sp-5)", textAlign: "center" }}>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
              Select a task and click &ldquo;History&rdquo; to view execution logs
            </div>
          </div>
        )}
      </div>

      {editorOpen && (
        <MonitorEditor
          task={editingTask}
          onClose={() => setEditorOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
