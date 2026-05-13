"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileText,
  Loader2,
  MapPin,
  ShieldCheck,
  Upload,
  X,
  Image as ImageIcon,
  FileType2,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { submitStationRequest } from "@/lib/firestore/stations";
import { uploadToCloudinary } from "@/lib/cloudinary";

const step1 = z.object({
  name: z.string().min(3, "Station name is required"),
  officerInCharge: z.string().min(3, "Officer-in-charge name is required"),
  email: z.string().email("Enter the official station email"),
  phone: z.string().min(7, "Enter a valid phone number"),
  govtVerificationId: z.string().min(3, "Verification / registration ID is required"),
});

const step2 = z.object({
  address: z.string().min(5, "Full address required"),
  district: z.string().min(2, "District required"),
  state: z.string().min(2, "State required"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

type Step1Values = z.infer<typeof step1>;
type Step2Values = z.infer<typeof step2>;

export interface StationDoc {
  name: string;        // category name
  fileName: string;
  url: string;
  publicId?: string;
  resourceType?: "image" | "raw" | "video";
  uploadedAt: string;
}

const REQUIRED_DOC_TYPES = [
  { key: "Government Registration Proof", desc: "Govt-issued station registration / gazette." },
  { key: "Police Authorization Document", desc: "Authorization letter signed by department." },
  { key: "Officer ID Proof", desc: "Officer-in-charge ID card (front + back if applicable)." },
  { key: "Address Verification", desc: "Utility bill / lease / municipality document." },
];

const ACCEPT = "image/png,image/jpeg,image/jpg,application/pdf";

function genTempId() {
  return `req-${Math.random().toString(36).slice(2, 10)}`;
}

export default function RegisterStationPage() {
  const router = useRouter();
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [s1, setS1] = useState<Step1Values | null>(null);
  const [s2, setS2] = useState<Step2Values | null>(null);
  // Map docTypeKey → uploaded document
  const [docs, setDocs] = useState<Record<string, StationDoc>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  // Local request id used as folder name in Cloudinary so files stay grouped
  const [requestUploadId] = useState(genTempId);

  const form1 = useForm<Step1Values>({
    resolver: zodResolver(step1),
    defaultValues: s1 || { name: "", officerInCharge: "", email: "", phone: "", govtVerificationId: "" },
  });

  const form2 = useForm<Step2Values>({
    resolver: zodResolver(step2),
    defaultValues: s2 || { address: "", district: "", state: "", lat: 0, lng: 0 },
  });

  const onNext1 = (values: Step1Values) => {
    setS1(values);
    setStage(2);
  };
  const onNext2 = (values: Step2Values) => {
    setS2(values);
    setStage(3);
  };

  const handleUpload = async (docKey: string, file: File) => {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error("Unsupported file type", { description: "PDF / JPG / PNG only." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large", { description: "Max 10MB per file." });
      return;
    }
    setUploadingKey(docKey);
    setUploadProgress((p) => ({ ...p, [docKey]: 0 }));
    try {
      const folder = `stations/documents/${requestUploadId}`;
      const { url, public_id } = await uploadToCloudinary(file, folder, (pct) =>
        setUploadProgress((p) => ({ ...p, [docKey]: pct })),
      );
      const resourceType: StationDoc["resourceType"] = file.type === "application/pdf" ? "raw" : "image";
      setDocs((d) => ({
        ...d,
        [docKey]: {
          name: docKey,
          fileName: file.name,
          url,
          publicId: public_id,
          resourceType,
          uploadedAt: new Date().toISOString(),
        },
      }));
      toast.success(`${docKey} uploaded`);
      console.log("[register-station] uploaded", docKey, public_id);
    } catch (e: unknown) {
      toast.error("Upload failed", { description: (e as Error)?.message || "Cloudinary error" });
      console.error("[register-station] upload failed", e);
    } finally {
      setUploadingKey(null);
    }
  };

  const onUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form2.setValue("lat", Number(pos.coords.latitude.toFixed(6)));
        form2.setValue("lng", Number(pos.coords.longitude.toFixed(6)));
        toast.success("Current location captured");
      },
      (err) => toast.error("Could not fetch location", { description: err.message }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const onSubmitAll = async () => {
    if (!s1 || !s2) return;
    const missing = REQUIRED_DOC_TYPES.filter((d) => !docs[d.key]).map((d) => d.key);
    if (missing.length > 0) {
      toast.error("Missing documents", { description: `Required: ${missing.join(", ")}` });
      return;
    }
    setSubmitting(true);
    try {
      const id = await submitStationRequest({
        name: s1.name,
        officerInCharge: s1.officerInCharge,
        phone: s1.phone,
        email: s1.email,
        address: s2.address,
        district: s2.district,
        state: s2.state,
        geo: { lat: s2.lat, lng: s2.lng },
        govtVerificationId: s1.govtVerificationId,
        documents: Object.values(docs),
      });
      setSubmittedId(id);
      setStage(4);
      toast.success("Registration submitted", {
        description: "Your station request is now pending super-admin approval.",
      });
    } catch (e: unknown) {
      toast.error("Submission failed", { description: (e as Error)?.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl"
    >
      <Card data-testid="register-station-card">
        <CardHeader>
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
            <Building2 className="h-3 w-3 text-cyan" />
            Police Station Registration
          </div>
          <CardTitle>Register your station with Maitri</CardTitle>
          <CardDescription>
            All requests are reviewed by Maitri operations. Approved stations receive a Station ID,
            login credentials and an officer-onboarding QR code by email.
          </CardDescription>

          <Stepper stage={stage} />
        </CardHeader>

        <CardContent>
          <AnimatePresence mode="wait">
            {stage === 1 && (
              <motion.form
                key="s1"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onSubmit={form1.handleSubmit(onNext1)}
                className="space-y-5"
                data-testid="register-station-step-1"
              >
                <Section title="Station details" icon={Building2}>
                  <Two>
                    <FieldShell label="Station name" error={form1.formState.errors.name?.message}>
                      <Input
                        placeholder="e.g. Bandra Police Station"
                        data-testid="rs-input-name"
                        {...form1.register("name")}
                      />
                    </FieldShell>
                    <FieldShell label="Officer-in-charge" error={form1.formState.errors.officerInCharge?.message}>
                      <Input
                        placeholder="Full name of OIC"
                        data-testid="rs-input-oic"
                        {...form1.register("officerInCharge")}
                      />
                    </FieldShell>
                  </Two>

                  <Two>
                    <FieldShell label="Station email" error={form1.formState.errors.email?.message}>
                      <Input
                        type="email"
                        placeholder="station@police.gov.in"
                        data-testid="rs-input-email"
                        {...form1.register("email")}
                      />
                    </FieldShell>
                    <FieldShell label="Phone" error={form1.formState.errors.phone?.message}>
                      <Input
                        placeholder="+91 22 0000 0000"
                        data-testid="rs-input-phone"
                        {...form1.register("phone")}
                      />
                    </FieldShell>
                  </Two>

                  <FieldShell
                    label="Govt. verification / registration ID"
                    error={form1.formState.errors.govtVerificationId?.message}
                  >
                    <Input
                      placeholder="Internal department ID issued by your state"
                      data-testid="rs-input-govtid"
                      {...form1.register("govtVerificationId")}
                    />
                  </FieldShell>
                </Section>

                <Footer
                  left={
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-white/40 hover:text-cyan"
                      data-testid="rs-back-to-login"
                    >
                      <ArrowLeft className="h-3 w-3" /> Back to login
                    </Link>
                  }
                  right={
                    <Button type="submit" data-testid="rs-step1-next">
                      Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  }
                />
              </motion.form>
            )}

            {stage === 2 && (
              <motion.form
                key="s2"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onSubmit={form2.handleSubmit(onNext2)}
                className="space-y-5"
                data-testid="register-station-step-2"
              >
                <Section title="Address & jurisdiction" icon={MapPin}>
                  <FieldShell label="Full address" error={form2.formState.errors.address?.message}>
                    <Textarea
                      placeholder="Building, street, area"
                      data-testid="rs-input-address"
                      {...form2.register("address")}
                    />
                  </FieldShell>
                  <Two>
                    <FieldShell label="District" error={form2.formState.errors.district?.message}>
                      <Input data-testid="rs-input-district" {...form2.register("district")} />
                    </FieldShell>
                    <FieldShell label="State" error={form2.formState.errors.state?.message}>
                      <Input data-testid="rs-input-state" {...form2.register("state")} />
                    </FieldShell>
                  </Two>
                  <Two>
                    <FieldShell label="Latitude" error={form2.formState.errors.lat?.message}>
                      <Input
                        type="number"
                        step="0.000001"
                        data-testid="rs-input-lat"
                        {...form2.register("lat")}
                      />
                    </FieldShell>
                    <FieldShell label="Longitude" error={form2.formState.errors.lng?.message}>
                      <Input
                        type="number"
                        step="0.000001"
                        data-testid="rs-input-lng"
                        {...form2.register("lng")}
                      />
                    </FieldShell>
                  </Two>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onUseCurrentLocation}
                    data-testid="rs-use-location"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Use my current location
                  </Button>
                </Section>

                <Footer
                  left={
                    <Button type="button" variant="ghost" onClick={() => setStage(1)} data-testid="rs-step2-back">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                  }
                  right={
                    <Button type="submit" data-testid="rs-step2-next">
                      Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  }
                />
              </motion.form>
            )}

            {stage === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="space-y-5"
                data-testid="register-station-step-3"
              >
                <Section title="Verification documents" icon={FileText}>
                  <p className="text-xs text-white/50">
                    Upload <b>all four</b> documents below. Accepted formats: PDF, JPG, JPEG, PNG (max 10MB each).
                    Files are stored securely on Cloudinary and accessible only to operations.
                  </p>

                  <div className="space-y-3">
                    {REQUIRED_DOC_TYPES.map((d) => {
                      const doc = docs[d.key];
                      const isUploading = uploadingKey === d.key;
                      const progress = uploadProgress[d.key] ?? 0;
                      return (
                        <div
                          key={d.key}
                          className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3"
                          data-testid={`rs-doc-block-${d.key.replace(/s+/g, "-").toLowerCase()}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">{d.key}</span>
                                <Badge variant="danger">Required</Badge>
                                {doc && <Badge variant="ok">Uploaded</Badge>}
                              </div>
                              <div className="mt-1 text-[11px] text-white/40">{d.desc}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {doc && (
                                <>
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded border border-[var(--border)] bg-white/[0.03] px-2 py-1 text-[11px] text-cyan hover:bg-white/[0.06]"
                                    data-testid={`rs-doc-preview-${d.key.replace(/s+/g, "-").toLowerCase()}`}
                                  >
                                    Preview
                                  </a>
                                  <button
                                    onClick={() =>
                                      setDocs((arr) => {
                                        const c = { ...arr };
                                        delete c[d.key];
                                        return c;
                                      })
                                    }
                                    className="rounded p-1 text-white/40 hover:bg-white/5 hover:text-danger"
                                    data-testid={`rs-doc-remove-${d.key.replace(/s+/g, "-").toLowerCase()}`}
                                    aria-label="Remove document"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              {!doc && (
                                <label
                                  className={`inline-flex cursor-pointer items-center gap-1 rounded border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-cyan transition-colors hover:bg-cyan/20 ${isUploading ? "pointer-events-none opacity-60" : ""}`}
                                  data-testid={`rs-doc-upload-${d.key.replace(/s+/g, "-").toLowerCase()}`}
                                >
                                  {isUploading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                  )}
                                  {isUploading ? `${progress}%` : "Upload"}
                                  <input
                                    type="file"
                                    accept={ACCEPT}
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUpload(d.key, file);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                          {doc && (
                            <div className="mt-2 flex items-center gap-2 text-[11px] text-white/50">
                              {doc.resourceType === "raw" ? (
                                <FileType2 className="h-3.5 w-3.5 text-pink" />
                              ) : (
                                <ImageIcon className="h-3.5 w-3.5 text-cyan" />
                              )}
                              <span className="truncate">{doc.fileName}</span>
                            </div>
                          )}
                          {isUploading && (
                            <div className="mt-2 h-1 overflow-hidden rounded bg-white/5">
                              <div
                                className="h-full bg-cyan transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Section>

                <Section title="Review" icon={ShieldCheck}>
                  <ReviewBlock title="Station">
                    <Row k="Name" v={s1?.name} />
                    <Row k="OIC" v={s1?.officerInCharge} />
                    <Row k="Email" v={s1?.email} />
                    <Row k="Phone" v={s1?.phone} />
                    <Row k="Govt. ID" v={s1?.govtVerificationId} />
                  </ReviewBlock>
                  <ReviewBlock title="Location">
                    <Row k="Address" v={s2?.address} />
                    <Row k="District/State" v={`${s2?.district}, ${s2?.state}`} />
                    <Row k="Geo" v={`${s2?.lat}, ${s2?.lng}`} />
                  </ReviewBlock>
                  <ReviewBlock title="Documents">
                    <div className="text-xs text-white/70">
                      {Object.keys(docs).length}/4 uploaded
                    </div>
                  </ReviewBlock>
                </Section>

                <Footer
                  left={
                    <Button type="button" variant="ghost" onClick={() => setStage(2)} data-testid="rs-step3-back">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                  }
                  right={
                    <Button onClick={onSubmitAll} disabled={submitting} data-testid="rs-submit">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Submit for approval
                    </Button>
                  }
                />
              </motion.div>
            )}

            {stage === 4 && (
              <motion.div
                key="s4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-5 py-6 text-center"
                data-testid="register-station-success"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-ok/40 bg-ok/10">
                  <Check className="h-6 w-6 text-ok" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Request received</h3>
                  <p className="mt-1 text-sm text-white/55">
                    Your station registration has been forwarded to Maitri super-admin operations.
                    On approval, the OIC will receive a login email with Station ID + temporary password.
                  </p>
                </div>
                <Badge variant="outline" className="font-mono">
                  Request ID: {submittedId}
                </Badge>
                <div className="flex justify-center gap-2 pt-2">
                  <Button onClick={() => router.push("/login")} data-testid="rs-success-login">
                    Go to login
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Stepper({ stage }: { stage: 1 | 2 | 3 | 4 }) {
  const items = ["Details", "Location", "Documents", "Done"];
  return (
    <div className="mt-3 flex items-center gap-2" data-testid="register-station-stepper">
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const active = stage === n;
        const done = stage > n;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors ${
                done
                  ? "border-ok/40 bg-ok/15 text-ok"
                  : active
                  ? "border-cyan/40 bg-cyan/15 text-cyan"
                  : "border-white/10 bg-white/[0.02] text-white/40"
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : n}
            </div>
            <div className={`text-[10px] uppercase tracking-[0.18em] ${active ? "text-white" : "text-white/40"}`}>
              {label}
            </div>
            {i < items.length - 1 && (
              <div className={`mx-2 h-px flex-1 ${done ? "bg-ok/30" : "bg-white/5"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-cyan" />
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">{title}</div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Two({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}

function FieldShell({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}

function Footer({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/[0.02] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-[0.14em] text-white/40">{k}</span>
      <span className="truncate text-right text-sm text-white">{v || "—"}</span>
    </div>
  );
}
