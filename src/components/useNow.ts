"use client";

import { useEffect, useState } from "react";

/** Current time (ms), ticking every second, corrected for client/server clock skew. */
export function useNow(serverNow: number, active: boolean) {
  // Ignore small differences (page load latency); only correct a genuinely wrong device clock.
  const [offset] = useState(() => {
    const diff = serverNow - Date.now();
    return Math.abs(diff) > 30_000 ? diff : 0;
  });
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    if (!active) return;
    const id = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(id);
  }, [active, offset]);
  return now;
}
