"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Building2, Eye, Download, FileText, ImageIcon, FileType2 } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { useStationRequests } from "@/lib/realtime/useStationRequests";
import { rejectStationRequest } from "@/lib/firestore/stations";
import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DocItem {
  name: string;
  fileName?: string;
  url: string;
  publicId?: string;
  resourceType?: "image" | "raw" | "video";
}

export default function StationRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const { items, loading } = useStationRequests();
  const [acting, setActing] = useState<string | null>(null);
  const [previewReq, setPreviewReq] = useState<{ id: string; documents: DocItem[]; name: string } | null>(null);
  const [activeDoc, setActiveDoc] = useState<DocItem | null>(null);
  const [credModal, setCredModal] = useState<{
    stationId: string;
    email: string;
    password: string;
    emailSent: boolean;
  } | null>(null);

  const buckets = {
    pending: items.filter((i) => i.status === "pending"),
    approved: items.filter((i) => i.status === "approved"),
    rejected: items.filter((i) => i.status === "rejected"),
  };

  const onApprove = async (id: string) => {
    setActing(id);
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Re-authenticate as super-admin");
      const res = await fetch("/api/create-station", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ requestId: id, approvedBy: user?.email || "super_admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setCredModal({
        stationId: data.stationId,
        email: data.loginEmail,
        password: data.tempPassword,
        emailSent: !!data.emailSent,
      });
      toast.success("Station approved", { description: `Credentials issued for ${data.stationId}` });
      console.log("[approve-station]", data);
    } catch (e: unknown) {
      toast.error("Approval failed", { description: (e as Error)?.message });
      console.error("[approve-station] error", e);
    } finally {
      setActing(null);
    }
  };

  const onReject = async (id: string) => {
    const reason = window.prompt("Rejection reason?") || "";
    if (!reason) return;
    setActing(id);
    try {
      await rejectStationRequest(id, user?.email || "super_admin", reason);
      toast.success("Station rejected");
    } catch (e: unknown) {
      toast.error("Rejection failed", { description: (e as Error)?.message });
    } finally {
      setActing(null);
    }
  };

  return (
    <DashboardShell allow={["super_admin"]} title="Station Approvals">
      <div className="space-y-6" data-testid="station-requests-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Workflow</div>
          <h1 className="text-3xl font-semibold text-white">Station Approval Queue</h1>
          <p className="mt-1 max-w-xl text-sm text-white/50">
            Review registration documents and approve verified stations. On approval, Firebase Auth
            credentials are issued, custom claims set, and the OIC is emailed login details.
          </p>
        </header>

        {loading ? (
          <div className="py-8 text-center text-xs text-white/40">Loading queue…</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No registration requests yet"
            description="Pending submissions from /register-station appear here in realtime."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(["pending", "approved", "rejected"] as const).map((bucket) => (
              <Card key={bucket}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base capitalize">
                    {bucket}
                    <Badge variant={bucket === "pending" ? "amber" : bucket === "approved" ? "ok" : "danger"}>
                      {buckets[bucket].length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {buckets[bucket].length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-white/40">
                      No items
                    </div>
                  )}
                  {buckets[bucket].map((s) => {
                    const docs: DocItem[] = ((s as unknown as { documents?: DocItem[] }).documents) || [];
                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3"
                        data-testid={`request-card-${s.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{s.name}</div>
                            <div className="text-[11px] text-white/50">
                              {s.district}, {s.state}
                            </div>
                            <div className="mt-1 text-[11px] text-white/40">OIC: {s.officerInCharge}</div>
                            <div className="text-[11px] text-white/40">{s.email}</div>
                          </div>
                          <Badge variant={docs.length === 4 ? "ok" : "amber"}>{docs.length}/4 docs</Badge>
                        </div>

                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setPreviewReq({ id: s.id, documents: docs, name: s.name })}
                            data-testid={`request-docs-${s.id}`}
                            disabled={docs.length === 0}
                          >
                            <Eye className="h-3.5 w-3.5" /> View documents
                          </Button>
                        </div>

                        {bucket === "pending" && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              disabled={acting === s.id}
                              onClick={() => onApprove(s.id)}
                              data-testid={`request-approve-${s.id}`}
                              className="flex-1"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={acting === s.id}
                              onClick={() => onReject(s.id)}
                              data-testid={`request-reject-${s.id}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Document list modal */}
      <Dialog open={!!previewReq} onOpenChange={(v) => !v && setPreviewReq(null)}>
        <DialogContent className="max-w-lg" onClose={() => setPreviewReq(null)}>
          <DialogHeader>
            <DialogTitle>Documents — {previewReq?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2" data-testid="docs-list">
            {previewReq?.documents.length ? (
              previewReq.documents.map((d, i) => {
                const isPdf = d.resourceType === "raw" || /\.pdf$/i.test(d.url);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white/[0.02] p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {isPdf ? (
                        <FileType2 className="h-4 w-4 text-pink" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-cyan" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{d.name}</div>
                        <div className="truncate text-[11px] text-white/40">{d.fileName || d.publicId}</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setActiveDoc(d)}
                        className="rounded border border-[var(--border)] bg-white/[0.03] px-2 py-1 text-[11px] text-cyan hover:bg-white/[0.06]"
                        data-testid={`doc-open-${i}`}
                      >
                        <Eye className="inline h-3 w-3" /> Open
                      </button>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="rounded border border-[var(--border)] bg-white/[0.03] px-2 py-1 text-[11px] text-white/70 hover:bg-white/[0.06]"
                        data-testid={`doc-download-${i}`}
                      >
                        <Download className="inline h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState icon={FileText} title="No documents on this request" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Doc preview modal */}
      <Dialog open={!!activeDoc} onOpenChange={(v) => !v && setActiveDoc(null)}>
        <DialogContent className="max-w-3xl" onClose={() => setActiveDoc(null)}>
          <DialogHeader>
            <DialogTitle>{activeDoc?.name}</DialogTitle>
          </DialogHeader>
          {activeDoc && (
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black/30">
             {activeDoc.resourceType === "raw" || /\.pdf$/i.test(activeDoc.url) ? (

                <iframe
                  src={activeDoc.url}
                  className="h-[70vh] w-full"
                  title={activeDoc.name}
                  data-testid="doc-pdf-frame"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeDoc.url}
                  alt={activeDoc.name}
                  className="max-h-[70vh] w-full object-contain"
                  data-testid="doc-image-preview"
                />
              )}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <a
              href={activeDoc?.url}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[var(--border)] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/[0.06]"
            >
              <Download className="mr-1 inline h-3 w-3" /> Download original
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials modal after approval */}
      <Dialog open={!!credModal} onOpenChange={(v) => !v && setCredModal(null)}>
        <DialogContent className="max-w-md" onClose={() => setCredModal(null)}>
          <DialogHeader>
            <DialogTitle>Station credentials issued</DialogTitle>
          </DialogHeader>
          {credModal && (
            <div className="space-y-3" data-testid="cred-modal">
              <div className="rounded-xl border border-ok/30 bg-ok/10 p-3 text-[12px] text-ok">
                {credModal.emailSent
                  ? "An email with these credentials has been sent to the station OIC."
                  : "Email delivery failed — please share these credentials manually."}
              </div>
              <Field label="Station ID" value={credModal.stationId} />
              <Field label="Email" value={credModal.email} />
              <Field label="Temp password" value={credModal.password} />
              <p className="text-[11px] text-white/40">
                Please copy these credentials now. They will not be shown again.
              </p>
              <Button onClick={() => setCredModal(null)} className="w-full">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-1 break-all font-mono text-sm text-white">{value}</div>
    </div>
  );
}
