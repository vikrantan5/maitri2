"use client";

import { QRCodeSVG } from "qrcode.react";
import { Printer, QrCode } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth.store";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OfficerOnboardQRPage() {
  const user = useAuthStore((s) => s.user);
  const stationId = user?.stationId || "DEMO-STATION";
  const onboardUrl = `saheli://onboard?stationId=${encodeURIComponent(stationId)}`;

  return (
    <DashboardShell allow={["police_station"]} title="Onboard Officers">
      <div className="space-y-6" data-testid="officer-qr-page">
        <header>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">QR Onboarding</div>
          <h1 className="text-3xl font-semibold text-white">Print-Ready Officer QR Poster</h1>
          <p className="mt-1 max-w-xl text-sm text-white/50">
            Officers scan this from the Saheli mobile app to register against your station. Print and post in your station premises.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><QrCode className="h-4 w-4 text-cyan" /> Station onboard code</span>
              <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="qr-print-button">
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-white p-8">
                <QRCodeSVG
                  value={onboardUrl}
                  size={280}
                  level="H"
                  includeMargin
                  data-testid="qr-code-svg"
                />
                <div className="mt-4 text-center font-mono text-xs text-bg0">
                  Station ID: <b>{stationId}</b>
                </div>
              </div>
              <div className="space-y-3">
                <Field label="Encoded URL" value={onboardUrl} mono />
                <Field label="Station ID" value={stationId} mono />
                <Field label="Issued by" value={user?.email || "—"} />
                <p className="rounded-xl border border-amber/30 bg-amber/10 p-3 text-[12px] text-amber">
                  Keep this poster within station premises. Anyone scanning the QR is presumed to be a verified officer of your station and will appear in your approval queue.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className={`mt-1 break-all text-sm ${mono ? "font-mono" : ""} text-white`}>{value}</div>
    </div>
  );
}
