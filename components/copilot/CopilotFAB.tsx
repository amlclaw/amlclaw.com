"use client";

import { useState } from "react";
import CopilotDrawer from "./CopilotDrawer";

export default function CopilotFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={`copilot-fab ${open ? "copilot-fab-active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="AML Copilot"
      >
        {open ? "✕" : "🤖"}
      </button>
      <CopilotDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
