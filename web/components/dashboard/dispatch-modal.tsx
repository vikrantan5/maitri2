"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dispatchOfficers } from "@/lib/firestore/cases";
import type { PoliceOfficer, EmergencyCase } from "@/lib/firestore/types";

export function DispatchModal({
  c,
  stationId,
  by,
  open,
  onOpenChange,
  onDispatched,
}: {
  c: EmergencyCase | null;
  stationId: string | undefined;
  by: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDispatched?: () => void;
}) {
  const [officers, setOfficers] = useState<PoliceOfficer[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !stationId) return;
    setLoading(true);
    setPicked(new Set());
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "policeOfficers"),
            where("stationId", "==", stationId),
          ),
        );
        setOfficers(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<PoliceOfficer, "id">) }))
            .filter((o) => o.status === "approved"),
        );
      } catch (e: any) {
        toast.error("Could not load officers", { description: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, stationId]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = async () => {
    if (!c) return;
    if (picked.size === 0) {
      toast.error("Select at least one officer");
      return;
    }
    setSubmitting(true);
    try {
      const uids = officers.filter((o) => picked.has(o.id)).map((o) => o.uid || o.id);
      await dispatchOfficers(c.id, uids, by);
      toast.success(`Dispatched ${uids.length} officer(s)`);
      onDispatched?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Dispatch failed", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Dispatch officers</DialogTitle>
          <DialogDescription>
            Assign one or more on-duty officers to {c?.userName || "this case"}. They will be notified instantly.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-xs text-white/50">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading officers…
          </div>
        ) : officers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-white/50">
            No approved officers in this station yet. Approve officers from the Officers tab first.
          </div>
        ) : (
          <div className="max-h-[360px] space-y-2 overflow-y-auto">
            {officers.map((o) => {
              const sel = picked.has(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => toggle(o.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${sel ? "border-cyan/50 bg-cyan/10" : "border-[var(--border)] bg-white/[0.02] hover:bg-white/[0.05]"}`}
                  data-testid={`dispatch-officer-${o.id}`}
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{o.name}</div>
                    <div className="font-mono text-[11px] text-white/50">
                      Badge {o.badgeNumber} · {o.rank || "Officer"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.online && <span className="h-2 w-2 rounded-full bg-ok shadow-[0_0_8px_var(--green)]" />}
                    <Badge variant={sel ? "default" : "outline"}>{sel ? "selected" : "available"}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
            <UserCog className="mr-1 inline h-3 w-3" />
            {picked.size} selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={submitting || picked.size === 0} data-testid="dispatch-submit">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Dispatch {picked.size > 0 ? `(${picked.size})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
