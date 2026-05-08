"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, CheckCircle, Image as ImageIcon, MapPin, Mic, Phone, Siren, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCase, setCaseStatus } from "@/lib/firestore/cases";
import type { EmergencyCase } from "@/lib/firestore/types";

const CasesMap = dynamic(() => import("@/components/map/cases-map"), { ssr: false });

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [c, setC] = useState<EmergencyCase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!params?.id) return;
      const data = await getCase(params.id);
      setC(data);
      setLoading(false);
    })();
  }, [params?.id]);

  const onAction = async (s: any, note: string) => {
    if (!c) return;
    try {
      await setCaseStatus(c.id, s, user?.email || "officer", note);
      toast.success("Status updated");
      const fresh = await getCase(c.id);
      setC(fresh);
    } catch (e: any) {
      toast.error("Update failed", { description: e.message });
    }
  };

  return (
    <DashboardShell allow={["police_officer", "police_station", "super_admin"]} title="Case">
      <div className="space-y-6" data-testid="case-detail-page">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs text-white/60 transition-colors hover:text-white"
          data-testid="case-back-button"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {loading ? (
          <div className="py-8 text-center text-xs text-white/40">Loading case…</div>
        ) : !c ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-white/50">Case not found.</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <Siren className="h-4 w-4 text-danger" /> {c.userName || "Unknown"}
                    <Badge variant={c.status === "new" ? "danger" : c.status === "resolved" ? "ok" : "amber"}>{c.status}</Badge>
                    <Badge variant="outline">{c.priority}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {c.location && (
                      <Field icon={MapPin} label="Location" value={`${c.location.lat.toFixed(5)}, ${c.location.lng.toFixed(5)}`} />
                    )}
                    {c.userPhone && <Field icon={Phone} label="Phone" value={c.userPhone} />}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {c.imageUrl && (
                      <a target="_blank" rel="noreferrer" href={c.imageUrl} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white/[0.02] px-3 py-1.5 text-xs text-white/70 hover:text-cyan">
                        <ImageIcon className="h-3 w-3" /> Open photo
                      </a>
                    )}
                    {c.audioUrl && (
                      <audio controls src={c.audioUrl} className="h-9 w-full max-w-md rounded-lg" />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {c.status !== "in_progress" && c.status !== "resolved" && c.status !== "false_alarm" && (
                      <Button onClick={() => onAction("in_progress", "Officer en route / arrived.")} data-testid="case-arrived">
                        <CheckCircle className="h-4 w-4" /> Mark arrived
                      </Button>
                    )}
                    {c.status !== "resolved" && c.status !== "false_alarm" && (
                      <Button variant="outline" onClick={() => onAction("resolved", "Resolved on-site.")} data-testid="case-resolve">
                        Resolve
                      </Button>
                    )}
                    {c.status !== "false_alarm" && c.status !== "resolved" && (
                      <Button variant="outline" onClick={() => onAction("false_alarm", "False alarm.")} data-testid="case-false-alarm">
                        <X className="h-4 w-4" /> False alarm
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                <CardContent>
                  {!c.notes || c.notes.length === 0 ? (
                    <div className="text-xs text-white/40">No notes yet.</div>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {c.notes.map((n: any, i: number) => (
                        <li key={i} className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">{n.by} · {typeof n.at === "string" ? n.at : n.at?.toDate?.().toLocaleString()}</div>
                          <div className="mt-1 text-white/80">{n.text}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-cyan" /> Live location</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="h-[460px] w-full overflow-hidden rounded-b-2xl border-t border-[var(--border)]">
                  <CasesMap cases={[c]} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function Field({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/40">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 truncate font-mono text-sm text-white">{value}</div>
    </div>
  );
}
