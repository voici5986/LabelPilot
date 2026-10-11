import { useCallback, useEffect, useRef, useState } from "react";

import type { PdfProgressUpdate } from "../utils/pdfProgress";

/** Publish the newest progress at most once per frame, scoped to one run. */
export function useFrameProgress() {
  const [progress, setProgress] = useState<PdfProgressUpdate>({
    percent: 0,
    phase: "preparing",
  });
  const epoch = useRef(0);
  const frame = useRef<number | null>(null);
  const pending = useRef<PdfProgressUpdate | null>(null);

  const publish = useCallback((value: PdfProgressUpdate) => {
    setProgress((previous) =>
      previous.percent === value.percent && previous.phase === value.phase
        ? previous
        : value,
    );
  }, []);

  const cancel = useCallback(() => {
    epoch.current += 1;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = null;
  }, []);

  const start = useCallback(
    (initial: PdfProgressUpdate) => {
      cancel();
      publish(initial);
      return epoch.current;
    },
    [cancel, publish],
  );

  const update = useCallback(
    (run: number, value: PdfProgressUpdate) => {
      if (run !== epoch.current) return;
      pending.current = value;
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        if (run !== epoch.current) return;
        frame.current = null;
        if (pending.current) publish(pending.current);
        pending.current = null;
      });
    },
    [publish],
  );

  const finish = useCallback(
    (run: number) => {
      if (run !== epoch.current) return;
      cancel();
      publish({ percent: 100, phase: "serializing" });
    },
    [cancel, publish],
  );

  useEffect(() => cancel, [cancel]);
  return { progress, start, update, finish, cancel };
}
