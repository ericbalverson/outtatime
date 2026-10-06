"use client";

import { useState, useTransition } from "react";
import { createReport } from "@/app/actions";
import { Button, Modal, Radio, inputClass } from "./ui";

export function ReportDialog({ open, onClose, instanceName }: { open: boolean; onClose: () => void; instanceName: string }) {
  const [range, setRange] = useState<"all" | "week">("all");
  const [basis, setBasis] = useState<"instance" | "all">("instance");
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();

  return (
    <Modal open={open} onClose={onClose} title="Generate report">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(() => createReport({ range, totalBasis: basis, title }));
        }}
      >
        <div className="space-y-2">
          <div className="text-sm font-medium text-zinc-300">Report period</div>
          <Radio
            name="range"
            value={range}
            onChange={setRange}
            options={[
              { value: "all", label: "Full report", hint: "Every work week, all entries" },
              { value: "week", label: "This week only", hint: "Mon–Sun, this week's entries" },
            ]}
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-zinc-300">“Total time worked” covers</div>
          <Radio
            name="basis"
            value={basis}
            onChange={setBasis}
            options={[
              { value: "instance", label: "Current instance", hint: instanceName },
              { value: "all", label: "All time", hint: "Every instance, including past ones" },
            ]}
          />
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-300">Title (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Auto-generated if blank" className={inputClass} />
        </label>
        <p className="text-xs text-zinc-500">
          Reports are saved as a snapshot of this moment. Later edits to your time won’t change them.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={pending}>
            {pending ? "Generating…" : "Generate"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
