import { Shield } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden border-r border-[var(--border)] lg:flex lg:flex-col lg:justify-between p-12">
        <Link href="/" className="flex items-center gap-2 text-white">
          <Shield className="h-6 w-6 text-cyan" strokeWidth={2.4} />
          <span className="font-mono text-sm tracking-[0.3em]">MAITRI</span>
        </Link>

        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
            Live Operations
          </div>
          <h1 className="text-4xl font-semibold leading-[1.05] text-white lg:text-5xl">
            Emergency
            <br />
            Response
            <br />
            <span className="bg-gradient-to-r from-cyan to-pink bg-clip-text text-transparent">
              Operating&nbsp;System.
            </span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/60">
            Realtime SOS triage, police station coordination, officer dispatch
            and unsafe-zone analytics — all on one government-grade console
            engineered for women&apos;s safety.
          </p>
        </div>

        {/* Radar */}
        <div className="absolute -right-24 bottom-1/2 translate-y-1/2 opacity-90">
          <div className="radar">
            <div className="sweep" />
          </div>
        </div>

        {/* Footer stats */}
        <div className="relative z-10 flex gap-10">
          <Stat value="3" label="Roles" />
          <Stat value="<500ms" label="SOS Sync" />
          <Stat value="24×7" label="Uptime" />
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-6 lg:p-10">{children}</div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-2xl text-white">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">{label}</div>
    </div>
  );
}
