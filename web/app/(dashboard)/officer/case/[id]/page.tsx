"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { doc, onSnapshot, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  MapPin,
  Mic,
  Phone,
  Image as ImageIcon,
  Siren,
  ShieldX,
  Flag,
  Navigation,
  MessageSquarePlus,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { setCaseStatus } from "@/lib/firestore/cases";
import type { CaseStatus, EmergencyCase } from "@/lib/firestore/types";

const CasesMap = dynamic(() => import("@/components/map/cases-map"), { ssr: false });

const STATUS_TONE: Record<string, "danger" | "amber" | "ok" | "default" | "outline"> = {
  new: "danger",
  acknowledged: "amber",
  dispatched: "default",
  in_progress: "default",
  escalated: "danger",
  resolved: "ok",
  false_alarm: "outline",
};

export default function OfficerCaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const caseId = params?.id;

  const [c, setCase] = useState<EmergencyCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!caseId) return;
    const unsub = onSnapshot(
      doc(db, "emergencyCases", caseId),
      (snap) => {
        if (!snap.exists()) {
          setCase(null);
        } else {
          setCase({ id: snap.id, ...(snap.data() as Omit<EmergencyCase, "id">) });
        }
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [caseId]);

  const mapCases = useMemo(() => (c ? [c] : []), [c]);

  const onAction = async (status: CaseStatus, label: string) => {
    if (!c) return;
    setActing(true);
    try {
      await setCaseStatus(c.id, status, user?.email || user?.uid || "officer", label);
      toast.success(`Case marked: ${status.replace("_", " ")}`);
    } catch (e: any) {
      toast.error("Update failed", { description: e.message });
    } finally {
      setActing(false);
    }
  };

  const onAddNote = async () => {
    const text = note.trim();
    if (!c || !text) return;
    setActing(true);
    try {
      await updateDoc(doc(db, "emergencyCases", c.id), {
        notes: arrayUnion({
          by: user?.email || user?.uid || "officer",
          text,
          at: new Date().toISOString(),
        }),
        lastNoteAt: serverTimestamp(),
      });
      setNote("");
      toast.success("Note added");
    } catch (e: any) {
      toast.error("Could not add note", { description: e.message });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell allow={["police_officer", "police_station", "super_admin"]} title="Case">
        <div className="py-20 text-center text-xs text-white/40" data-testid="officer-case-loading">
          Loading case…
        </div>
      </DashboardShell>
    );
  }

  if (!c) {
    return (
      <DashboardShell allow={["police_officer", "police_station", "super_admin"]} title="Case">
        <div className="space-y-4 py-10 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/40">Case not found</div>
          <p className="text-sm text-white/60">This emergency case may have been removed or you don&apos;t have access.</p>
          <Button variant="outline" onClick={() => router.push("/officer")} data-testid="officer-case-back">
            <ArrowLeft className="h-4 w-4" /> Back to my cases
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const time = c.createdAt?.toDate ? c.createdAt.toDate() : null;
  const isAssignedToMe = !!(user?.uid && c.assignedOfficers?.includes(user.uid));
  const isTerminal = c.status === "resolved" || c.status === "false_alarm";

  return (
    <DashboardShell allow={["police_officer", "police_station", "super_admin"]} title={`Case ${c.id.slice(0, 8)}`}>
      <div className="space-y-6" data-testid="officer-case-detail">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/officer" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70 hover:text-cyan" data-testid="officer-case-breadcrumb">
              <ArrowLeft className="h-3 w-3" /> Back to My Cases
            </Link>
            <h1 className="mt-1 text-3xl font-semibold text-white">{c.userName || "Unknown victim"}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
              <Badge variant={STATUS_TONE[c.status] || "outline"}>{c.status.replace("_", " ")}</Badge>
              <Badge variant="outline">{c.priority || "high"}</Badge>
              <span className="font-mono">#{c.id.slice(0, 8)}</span>
              {time && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {time.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-cyan" /> Last Known Location
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[420px] w-full overflow-hidden rounded-b-2xl border-t border-[var(--border)]">
                {c.location ? (
                  <CasesMap cases={mapCases} />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/40">
                    No location data captured.
                  </div>
                )}
              </div>
              {c.location && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
                  <div className="font-mono text-[11px] text-white/60">
                    {c.location.lat.toFixed(6)}, {c.location.lng.toFixed(6)}
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${c.location.lat},${c.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-[11px] font-medium text-cyan hover:bg-cyan/20"
                    data-testid="officer-case-navigate"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Navigate
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Siren className="h-4 w-4 text-danger" /> Victim
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Name" value={c.userName || "—"} />
                <Row label="User ID" value={<span className="font-mono text-[11px]">{c.userId}</span>} />
                {c.userPhone && (
                  <Row
                    label="Phone"
                    value={
                      <a href={`tel:${c.userPhone}`} className="inline-flex items-center gap-1 text-cyan hover:underline" data-testid="officer-case-call-victim">
                        <Phone className="h-3 w-3" /> {c.userPhone}
                      </a>
                    }
                  />
                )}
                <Row label="Priority" value={<Badge variant="outline">{c.priority || "high"}</Badge>} />
                <Row
                  label="Assigned Station"
                  value={
                    <span className="font-mono text-[11px] text-white/80">{c.assignedStationId || "Unassigned"}</span>
                  }
                />
                <Row
                  label="Officers"
                  value={
                    <span className="font-mono text-[11px] text-white/80">
                      {c.assignedOfficers?.length ? c.assignedOfficers.length : 0} assigned
                    </span>
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.imageUrl ? (
                  <a
                    href={c.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-[var(--border)] bg-white/[0.02]"
                    data-testid="officer-case-image"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.imageUrl}
                      alt="SOS evidence"
                      className="h-44 w-full object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/10 text-[11px] text-white/40">
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> No photo
                  </div>
                )}
                {c.audioUrl ? (
                  <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3" data-testid="officer-case-audio">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] text-white/60">
                      <Mic className="h-3 w-3 text-cyan" /> Recorded audio
                    </div>
                    <audio controls src={c.audioUrl} className="w-full" />
                  </div>
                ) : (
                  <div className="flex h-12 items-center justify-center rounded-xl border border-dashed border-white/10 text-[11px] text-white/40">
                    <Mic className="mr-1.5 h-3.5 w-3.5" /> No audio
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquarePlus className="h-4 w-4 text-cyan" /> Timeline & Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3" data-testid="officer-case-notes">
                {(!c.notes || c.notes.length === 0) ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-white/40">
                    No notes yet — be the first to log an update.
                  </div>
                ) : (
                  [...c.notes]
                    .sort((a: any, b: any) => String(b.at).localeCompare(String(a.at)))
                    .map((n: any, i: number) => (
                      <div key={i} className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
                          <span className="font-mono">{n.by}</span>
                          <span>{typeof n.at === "string" ? new Date(n.at).toLocaleString() : ""}</span>
                        </div>
                        <p className="mt-1 text-sm text-white/80">{n.text}</p>
                      </div>
                    ))
                )}
              </div>

              {!isTerminal && (
                <div className="space-y-2 border-t border-[var(--border)] pt-4">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add an update for your station and dispatch…"
                    rows={3}
                    data-testid="officer-case-note-input"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={onAddNote} disabled={acting || !note.trim()} data-testid="officer-case-note-submit">
                      <MessageSquarePlus className="h-4 w-4" /> Log update
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Field Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!isAssignedToMe && user?.role === "police_officer" && (
                <div className="rounded-xl border border-amber/30 bg-amber/5 p-3 text-[11px] text-amber/80">
                  You are not currently assigned to this case. Actions are read-only.
                </div>
              )}
              <Button
                className="w-full justify-start"
                disabled={acting || isTerminal || c.status === "in_progress"}
                onClick={() => onAction("in_progress", "Officer arrived on scene.")}
                data-testid="officer-case-arrived"
              >
                <Siren className="h-4 w-4" /> Mark arrived
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={acting || isTerminal}
                onClick={() => onAction("resolved", "Resolved on-site.")}
                data-testid="officer-case-resolve"
              >
                <CheckCircle2 className="h-4 w-4 text-ok" /> Resolve
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={acting || isTerminal}
                onClick={() => onAction("escalated", "Escalated for backup.")}
                data-testid="officer-case-escalate"
              >
                <Flag className="h-4 w-4 text-amber" /> Escalate
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={acting || isTerminal}
                onClick={() => onAction("false_alarm", "Marked false alarm.")}
                data-testid="officer-case-false-alarm"
              >
                <ShieldX className="h-4 w-4 text-white/60" /> False alarm
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{label}</span>
      <span className="text-right text-sm text-white/85">{value}</span>
    </div>
  );
}
