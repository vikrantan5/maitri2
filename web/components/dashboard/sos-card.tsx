"use client";

import { motion } from "framer-motion";
import { Clock, MapPin, Mic, Phone, Image as ImageIcon, Siren, Lock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmergencyCase } from "@/lib/firestore/types";

const STATUS_COLOR: Record<string, "danger" | "amber" | "ok" | "default" | "outline"> = {
  broadcasted: "danger",
  new: "danger",
  assigned: "amber",
  acknowledged: "amber",
  dispatched: "default",
  in_progress: "default",
  escalated: "danger",
  resolved: "ok",
  false_alarm: "outline",
};

export function SosCard({
  c,
  myStationId,
  onAccept,
  acceptLabel = "Accept case",
  onDispatch,
  onResolve,
  href,
}: {
  c: EmergencyCase;
  /** Current viewer's station id. Used to determine if this case has been
   *  claimed by a different station (first-accept race lost). */
  myStationId?: string;
  onAccept?: () => void;
  /** Label for the primary accept CTA. Stations use "Accept case"; the
   *  officer dashboard uses "Mark in-progress" / etc. */
  acceptLabel?: string;
  onDispatch?: () => void;
  onResolve?: () => void;
  href?: string;
}) {
  const isBroadcasted = c.status === "broadcasted" || c.status === "new";
  const time = c.createdAt?.toDate ? c.createdAt.toDate() : null;

  // Multi-station logic: the case is "claimed" once any station has won
  // the first-accept race. If the winner is NOT us, hide the Accept CTA
  // and render a "Locked to <stationId>" pill.
  const claimedByOther =
    !!c.assignedStationId && !!myStationId && c.assignedStationId !== myStationId;
  const ownedByMe = !!myStationId && c.assignedStationId === myStationId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border bg-[var(--glass)] p-5 backdrop-blur-xl ${
        isBroadcasted && !claimedByOther
          ? "border-danger/40 shadow-[0_0_40px_-15px_var(--red)]"
          : "border-[var(--border)]"
      } ${claimedByOther ? "opacity-60" : ""}`}
      data-testid={`sos-card-${c.id}`}
    >
      {isBroadcasted && !claimedByOther && (
        <span className="absolute right-4 top-4 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-danger opacity-70" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-danger" />
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-2">
          <Siren className="h-4 w-4 text-danger" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{c.userName || "Unknown"}</span>
            <Badge variant={STATUS_COLOR[c.status] || "outline"}>
              {c.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline">{c.priority || "high"}</Badge>
            {claimedByOther && (
              <Badge variant="outline" data-testid={`sos-claimed-${c.id}`}>
                <Lock className="mr-1 inline h-3 w-3" />
                claimed by {c.assignedStationId}
              </Badge>
            )}
            {ownedByMe && (
              <Badge variant="ok" data-testid={`sos-owned-${c.id}`}>
                yours
              </Badge>
            )}
            {!c.assignedStationId && (c.nearbyStationIds?.length ?? 0) > 1 && (
              <Badge variant="amber" data-testid={`sos-broadcast-count-${c.id}`}>
                broadcast · {c.nearbyStationIds!.length} stations
              </Badge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
            {c.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {c.location.lat.toFixed(4)}, {c.location.lng.toFixed(4)}
              </span>
            )}
            {time && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {time.toLocaleString()}
              </span>
            )}
            {c.userPhone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {c.userPhone}
              </span>
            )}
          </div>

          {(c.imageUrl || c.audioUrl) && (
            <div className="mt-3 flex items-center gap-2">
              {c.imageUrl && (
                <a
                  href={c.imageUrl}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white/[0.02] px-2 py-1 text-[11px] text-white/70 hover:text-cyan"
                  rel="noreferrer"
                  data-testid={`sos-photo-${c.id}`}
                >
                  <ImageIcon className="h-3 w-3" /> Photo
                </a>
              )}
              {c.audioUrl && (
                <a
                  href={c.audioUrl}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white/[0.02] px-2 py-1 text-[11px] text-white/70 hover:text-cyan"
                  rel="noreferrer"
                  data-testid={`sos-audio-${c.id}`}
                >
                  <Mic className="h-3 w-3" /> Audio
                </a>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {/* Accept CTA — for station context (when myStationId provided)
                only shown while still broadcasting and not already claimed.
                For officer context (no myStationId) the parent decides via
                conditionally providing/withholding onAccept. */}
            {onAccept && !claimedByOther && (myStationId ? (c.status === "broadcasted" || c.status === "new") : true) && (
              <Button size="sm" onClick={onAccept} data-testid={`sos-accept-${c.id}`}>
                {acceptLabel}
              </Button>
            )}
            {onDispatch && ownedByMe && (c.status === "assigned" || c.status === "acknowledged") && (
              <Button size="sm" variant="outline" onClick={onDispatch} data-testid={`sos-dispatch-${c.id}`}>
                Dispatch officers
              </Button>
            )}
            {onResolve && c.status !== "resolved" && c.status !== "false_alarm" && (myStationId ? ownedByMe : true) && (
              <Button size="sm" variant="outline" onClick={onResolve} data-testid={`sos-resolve-${c.id}`}>
                Resolve
              </Button>
            )}
            {href && (
              <Link href={href} className="inline-flex">
                <Button size="sm" variant="ghost" data-testid={`sos-view-${c.id}`}>
                  Open case →
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
