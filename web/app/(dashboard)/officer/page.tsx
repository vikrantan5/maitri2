import { BadgeCheck } from "lucide-react";

export default function OfficerPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <BadgeCheck className="mx-auto mb-4 h-10 w-10 text-cyan" />
        <h1 className="text-2xl font-semibold text-white">Officer Console</h1>
        <p className="mt-2 text-sm text-white/50">
          Your assigned cases, live victim location & resolve actions land here in Phase 2.
        </p>
      </div>
    </div>
  );
}
