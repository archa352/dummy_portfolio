"use client";

import { useEffect, useRef } from "react";
import { AetherMarkup } from "./AetherMarkup";

export function AetherExperience() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void import("./dom/boot").then(({ boot }) => {
      if (!cancelled) dispose = boot(root);
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <div ref={rootRef} className="aether-root">
      <AetherMarkup />
    </div>
  );
}
