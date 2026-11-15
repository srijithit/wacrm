"use client";

import { useEffect } from "react";

/**
 * Headless component mounted in DashboardShell.
 * Periodically sweeps due automation wait steps and flow timeouts while an
 * authenticated agent/admin has the CRM open.
 */
export function AutomationDrainPulse() {
  useEffect(() => {
    const drain = () => {
      fetch("/api/automations/cron", { method: "GET" }).catch(() => {});
    };

    // Run on initial mount and then every 25 seconds
    drain();
    const interval = setInterval(drain, 25_000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
