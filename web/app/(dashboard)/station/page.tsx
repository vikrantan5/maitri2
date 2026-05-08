import { Building2 } from "lucide-react";

export default function StationPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <Building2 className="mx-auto mb-4 h-10 w-10 text-cyan" />
        <h1 className="text-2xl font-semibold text-white">Police Station Command Center</h1>
        <p className="mt-2 text-sm text-white/50">
          Realtime SOS panel, dispatch, officer roster & QR onboarding land here in Phase 2.
        </p>
      </div>
    </div>
  );
}
