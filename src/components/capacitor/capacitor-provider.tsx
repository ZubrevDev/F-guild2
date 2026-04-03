"use client";

import { useEffect } from "react";
import { initCapacitor } from "@/lib/capacitor-init";

export function CapacitorProvider() {
  useEffect(() => {
    initCapacitor().catch(() => {
      // Silently ignore — web browser doesn't have native plugins
    });
  }, []);

  return null;
}
