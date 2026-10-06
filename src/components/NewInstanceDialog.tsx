"use client";

import { useState, useTransition } from "react";
import { startNewInstance } from "@/app/actions";
import { Button, Modal, inputClass } from "./ui";

export function NewInstanceDialog({
  open,
  onClose,
  instanceName,
  projectCount,
}: {
  open: boolean;
  onClose: () => void;
  instanceName: string;
  projectCount: number;
}) {
  const [name, setName] = useState("");
  const [saveReport, setSaveReport] = useState(true);
  const [keepProjects, setKeepProjects] = useState(true);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const check = "mt-0.5 h-4 w-4 shrink-0 accent-blue-500";

  return (
    <Modal open={open} onClose={onClose} title="Start a new instance">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await startNewInstance({ name, keepProjects, saveReport });
            setError(res.error);
            if (!res.error) {
              setName("");
              onClose();
            }
          });
        }}
      >
        <p className="text-sm text-zinc-400">
          This stops all timers, closes <span className="text-zinc-200">{instanceName}</span>, and resets every clock to
          zero. Your saved reports are kept until you delete them.
        </p>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="New instance name (optional)" className={inputClass} />
        <label className="flex gap-3 text-sm text-zinc-300">
          <input type="checkbox" checked={saveReport} onChange={(e) => setSaveReport(e.target.checked)} className={check} />
          <span>
            Save a final report for {instanceName} first
            <span className="block text-xs text-zinc-500">Recommended. You can find it on the Reports page.</span>
          </span>
        </label>
        <label className="flex gap-3 text-sm text-zinc-300">
          <input type="checkbox" checked={keepProjects} onChange={(e) => setKeepProjects(e.target.checked)} className={check} />
          <span>
            Keep my {projectCount} project tile{projectCount === 1 ? "" : "s"} (timers reset to zero)
            <span className="block text-xs text-zinc-500">Uncheck to start with an empty board.</span>
          </span>
        </label>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={pending}>
            {pending ? "Resetting…" : "Start new instance"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
