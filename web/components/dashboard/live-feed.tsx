"use client";

import { useEffect, useRef } from "react";
import { Siren } from "lucide-react";
import { toast } from "sonner";
import { useEmergencyCases, useSosEvents } from "@/lib/realtime/useEmergencyCases";
import { SosCard } from "./sos-card";
import { EmptyState } from "@/components/ui/empty-state";
import { acceptCase, ensureCaseFromSosEvent, setCaseStatus } from "@/lib/firestore/cases";
import type { EmergencyCase } from "@/lib/firestore/types";

export function LiveFeed({
  scope,
  by,
  onCaseAction,
}: {
  scope?: { stationId?: string };
  by: string;
  onCaseAction?: (caseId: string, action: "accept" | "dispatch" | "resolve") => void;
}) {
  const { cases, loading } = useEmergencyCases({ stationId: scope?.stationId, max: 25 });
  const { events } = useSosEvents(15);
  const seenRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Materialize emergencyCases from raw sos_events that haven't been promoted yet
  useEffect(() => {
    events.forEach((e) => {
      if (seenRef.current.has(e.id)) return;
      seenRef.current.add(e.id);
      ensureCaseFromSosEvent(e.id, e).catch(() => {
        /* ignore — security rules / network */
      });
    });
  }, [events]);

  // Audible alert + toast when a NEW case appears
  const newCount = cases.filter((c) => c.status === "new").length;
  const newIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    cases.forEach((c) => {
      if (c.status === "new" && !newIdsRef.current.has(c.id)) {
        newIdsRef.current.add(c.id);
        toast.error("🚨 New SOS triggered", {
          description: `${c.userName || "Unknown"} · ${c.location ? `${c.location.lat.toFixed(3)}, ${c.location.lng.toFixed(3)}` : "no location"}`,
        });
        try {
          if (!audioRef.current) audioRef.current = new Audio("/alarm.mp3");
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        } catch {}
      }
    });
  }, [cases]);

  if (loading) {
    return <div className="rounded-2xl border border-[var(--border)] bg-[var(--glass)] p-6 backdrop-blur-xl text-center text-xs text-white/40">Connecting to live SOS stream…</div>;
  }

  if (cases.length === 0) {
    return (
      <EmptyState
        icon={Siren}
        title="No active SOS cases"
        description="Live SOS triggers from the mobile app will appear here in real-time."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger shadow-[0_0_8px_var(--red)]" />
          Live SOS feed · {cases.length} active · {newCount} unattended
        </div>
      </div>
      <div className="space-y-3">
        {cases.map((c: EmergencyCase) => (
          <SosCard
            key={c.id}
            c={c}
            onAccept={
              scope?.stationId
                ? async () => {
                    await acceptCase(c.id, scope!.stationId!, by);
                    onCaseAction?.(c.id, "accept");
                  }
                : undefined
            }
            onDispatch={
              scope?.stationId
                ? () => onCaseAction?.(c.id, "dispatch")
                : undefined
            }
            onResolve={
              scope?.stationId
                ? async () => {
                    await setCaseStatus(c.id, "resolved", by, "Marked resolved.");
                    onCaseAction?.(c.id, "resolve");
                  }
                : undefined
            }
            href={`/officer/case/${c.id}`}
          />
        ))}
      </div>
    </div>
  );
}
