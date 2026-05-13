"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Edit2,
  Eye,
  EyeOff,
  Play,
  Plus,
  Search,
  Trash2,
  Video as VideoIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard/shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import {
  addVideo,
  deleteVideo,
  extractVideoId,
  getAllVideos,
  getThumbnailUrl,
  isValidYouTubeUrl,
  togglePublishStatus,
  updateVideo,
  VIDEO_CATEGORIES,
  type EducationalVideo,
} from "@/lib/firestore/videos";

interface FormState {
  url: string;
  title: string;
  description: string;
  category: string;
}

const EMPTY_FORM: FormState = {
  url: "",
  title: "",
  description: "",
  category: "General",
};

export default function AdminVideosPage() {
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<EducationalVideo[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EducationalVideo | null>(null);
  const [deleting, setDeleting] = useState<EducationalVideo | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [urlError, setUrlError] = useState("");
  const [previewVid, setPreviewVid] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const rows = await getAllVideos();
      setVideos(rows);
    } catch (e: any) {
      console.error("[videos] load error", e);
      toast.error("Could not load videos", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return videos;
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(t) ||
        (v.description || "").toLowerCase().includes(t) ||
        v.category.toLowerCase().includes(t),
    );
  }, [videos, q]);

  const counts = useMemo(() => {
    const total = videos.length;
    const published = videos.filter((v) => v.published).length;
    return { total, published, draft: total - published };
  }, [videos]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPreviewVid(null);
    setUrlError("");
    setShowForm(true);
  };

  const openEdit = (v: EducationalVideo) => {
    setEditing(v);
    setForm({
      url: `https://youtube.com/watch?v=${v.videoId}`,
      title: v.title,
      description: v.description || "",
      category: v.category,
    });
    setPreviewVid(v.videoId);
    setUrlError("");
    setShowForm(true);
  };

  const onUrlChange = (url: string) => {
    setForm((p) => ({ ...p, url }));
    if (!url.trim()) {
      setPreviewVid(null);
      setUrlError("");
      return;
    }
    const vid = extractVideoId(url);
    if (vid) {
      setPreviewVid(vid);
      setUrlError("");
    } else {
      setPreviewVid(null);
      setUrlError("Invalid YouTube URL");
    }
  };

  const onSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!editing && !isValidYouTubeUrl(form.url)) {
      toast.error("Enter a valid YouTube URL");
      return;
    }
    try {
      setSubmitting(true);
      if (editing) {
        const patch: any = {
          title: form.title,
          description: form.description,
          category: form.category,
        };
        const currentUrl = `https://youtube.com/watch?v=${editing.videoId}`;
        if (form.url && form.url !== currentUrl) {
          if (!isValidYouTubeUrl(form.url)) {
            toast.error("Invalid YouTube URL");
            return;
          }
          patch.url = form.url;
        }
        await updateVideo(editing.id, patch);
        toast.success("Video updated");
      } else {
        await addVideo({
          url: form.url,
          title: form.title,
          description: form.description,
          category: form.category,
          published: true,
        });
        toast.success("Video added");
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setPreviewVid(null);
      await load();
    } catch (e: any) {
      console.error("[videos] submit error", e);
      toast.error(e?.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onTogglePublish = async (v: EducationalVideo) => {
    try {
      await togglePublishStatus(v.id, v.published);
      toast.success(v.published ? "Unpublished" : "Published");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not update status");
    }
  };

  const onConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteVideo(deleting.id);
      toast.success("Video deleted");
      setDeleting(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  return (
    <DashboardShell allow={["super_admin"]} title="Educational Videos">
      <div className="space-y-6" data-testid="admin-videos-page">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">
              Library
            </div>
            <h1 className="text-3xl font-semibold text-white">Educational Videos</h1>
            <p className="mt-1 max-w-xl text-sm text-white/50">
              Curate the YouTube content that appears inside the Maitri mobile app.
              Only published videos are visible to end users.
            </p>
          </div>
          <Button onClick={openCreate} data-testid="videos-add-button">
            <Plus className="h-4 w-4" /> Add video
          </Button>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 py-5">
              <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-2.5">
                <VideoIcon className="h-4 w-4 text-cyan" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Total
                </div>
                <div className="mt-0.5 font-mono text-2xl font-semibold text-white">
                  {counts.total}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-5">
              <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-2.5">
                <Eye className="h-4 w-4 text-ok" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Published
                </div>
                <div className="mt-0.5 font-mono text-2xl font-semibold text-white">
                  {counts.published}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-5">
              <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-2.5">
                <EyeOff className="h-4 w-4 text-amber" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Drafts
                </div>
                <div className="mt-0.5 font-mono text-2xl font-semibold text-white">
                  {counts.draft}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Search by title, description, or category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10"
            data-testid="videos-search-input"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--glass)] p-10 text-center text-xs text-white/40">
            Loading videos…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={VideoIcon}
            title={videos.length === 0 ? "No videos yet" : "No matches"}
            description={
              videos.length === 0
                ? "Click 'Add video' to start curating content for the mobile app."
                : "Try a different search term."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((v) => (
              <Card key={v.id} data-testid={`video-card-${v.id}`}>
                <CardContent className="space-y-3 p-4">
                  <a
                    href={`https://youtube.com/watch?v=${v.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block aspect-video overflow-hidden rounded-xl border border-[var(--border)] bg-black"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.thumbnailUrl || getThumbnailUrl(v.videoId)}
                      alt={v.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (!img.src.includes("hqdefault")) {
                          img.src = `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`;
                        }
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-bg0 shadow-[0_0_20px_rgba(0,229,255,0.4)]">
                        <Play className="h-5 w-5 fill-current" />
                      </div>
                    </div>
                    <div className="absolute right-2 top-2">
                         <Badge variant={v.published ? "ok" : "amber"}>
                        {v.published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </a>

                  <div className="space-y-1">
                    <h3 className="line-clamp-2 text-sm font-semibold text-white">
                      {v.title}
                    </h3>
                    {v.description && (
                      <p className="line-clamp-2 text-xs text-white/50">{v.description}</p>
                    )}
                    <div className="pt-1">
                        <Badge variant="default">{v.category}</Badge>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(v)}
                      className="flex-1"
                      data-testid={`video-edit-${v.id}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTogglePublish(v)}
                      className="flex-1"
                      data-testid={`video-toggle-${v.id}`}
                    >
                      {v.published ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" /> Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Publish
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleting(v)}
                      className="!border-danger/30 !text-danger hover:!bg-danger/10"
                      data-testid={`video-delete-${v.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent
          className="max-w-xl"
          onClose={() => {
            setShowForm(false);
            setEditing(null);
            setForm(EMPTY_FORM);
            setPreviewVid(null);
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing ? "Edit video" : "Add video"}</DialogTitle>
            <DialogDescription>
              Paste any YouTube link — Maitri auto-extracts the video ID and thumbnail.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="video-url">YouTube URL *</Label>
              <Input
                id="video-url"
                placeholder="https://youtube.com/watch?v=..."
                value={form.url}
                onChange={(e) => onUrlChange(e.target.value)}
                data-testid="video-url-input"
              />
              {urlError && <div className="text-xs text-danger">{urlError}</div>}
            </div>

            {previewVid && (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getThumbnailUrl(previewVid)}
                  alt="preview"
                  className="h-44 w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `https://img.youtube.com/vi/${previewVid}/hqdefault.jpg`;
                  }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="video-title">Title *</Label>
              <Input
                id="video-title"
                placeholder="Enter video title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                data-testid="video-title-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="video-desc">Description</Label>
              <Textarea
                id="video-desc"
                placeholder="Short description for students"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                data-testid="video-description-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="video-category">Category</Label>
              <Select
                id="video-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                data-testid="video-category-select"
              >
                {VIDEO_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              data-testid="video-form-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting}
              data-testid="video-form-submit"
            >
              {submitting ? "Saving…" : editing ? "Update video" : "Add video"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="max-w-md" onClose={() => setDeleting(null)}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-danger/10 p-2 text-danger">
                <AlertCircle className="h-5 w-5" />
              </div>
              <DialogTitle>Delete video?</DialogTitle>
            </div>
            <DialogDescription>
              {deleting?.title}
              <br />
              This permanently removes it from the mobile library.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirmDelete} data-testid="video-delete-confirm">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
