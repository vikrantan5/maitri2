/**
 * Educational Videos CRUD — mirrors mobile `src/services/videoService.js`.
 *
 * Collection: `educational_videos`
 * Rules: read = admin OR (signed-in AND published=true). write = admin only.
 *
 * Used by the web super-admin `/super-admin/videos` page.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export const VIDEOS_COLLECTION = "educational_videos";

export const VIDEO_CATEGORIES = [
  "Karate",
  "Kung fu",
  "Self Defence",
  "Women Safety",
  "General",
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

export interface EducationalVideo {
  id: string;
  videoId: string;
  title: string;
  description?: string;
  category: string;
  thumbnailUrl: string;
  published: boolean;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const YT_PATTERNS = [
  /(?:youtube.com\/watch\?v=)([a-zA-Z0-9_-]+)/,
  /(?:youtu.be\/)([a-zA-Z0-9_-]+)/,
  /(?:youtube.com\/embed\/)([a-zA-Z0-9_-]+)/,
  /(?:youtube.com\/v\/)([a-zA-Z0-9_-]+)/,
  /(?:youtube.com\/shorts\/)([a-zA-Z0-9_-]+)/,
];

export function extractVideoId(url: string): string | null {
  if (!url) return null;
  for (const p of YT_PATTERNS) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function isValidYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

export function getThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

export interface AddVideoInput {
  url: string;
  title: string;
  description?: string;
  category: string;
  published?: boolean;
}

export async function addVideo(input: AddVideoInput): Promise<EducationalVideo> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const videoId = extractVideoId(input.url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  // Dedupe
  const dupes = await getDocs(
    query(collection(db, VIDEOS_COLLECTION), where("videoId", "==", videoId)),
  );
  if (!dupes.empty) throw new Error("This video has already been added");

  const payload = {
    videoId,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    category: input.category,
    thumbnailUrl: getThumbnailUrl(videoId),
    published: input.published ?? true,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, VIDEOS_COLLECTION), payload);
  return { id: ref.id, ...(payload as any) };
}

export interface UpdateVideoInput {
  url?: string;
  title?: string;
  description?: string;
  category?: string;
  published?: boolean;
}

export async function updateVideo(id: string, updates: UpdateVideoInput) {
  const patch: Record<string, any> = { ...updates, updatedAt: serverTimestamp() };
  if (updates.url) {
    const vid = extractVideoId(updates.url);
    if (!vid) throw new Error("Invalid YouTube URL");
    patch.videoId = vid;
    patch.thumbnailUrl = getThumbnailUrl(vid);
    delete patch.url;
  }
  await updateDoc(doc(db, VIDEOS_COLLECTION, id), patch);
}

export async function deleteVideo(id: string) {
  await deleteDoc(doc(db, VIDEOS_COLLECTION, id));
}

export async function togglePublishStatus(id: string, currentPublished: boolean) {
  await updateDoc(doc(db, VIDEOS_COLLECTION, id), {
    published: !currentPublished,
    updatedAt: serverTimestamp(),
  });
}

export async function getAllVideos(): Promise<EducationalVideo[]> {
  // Admin view — newest first. Falls back to client sort if index missing.
  try {
    const snap = await getDocs(
      query(collection(db, VIDEOS_COLLECTION), orderBy("createdAt", "desc")),
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EducationalVideo, "id">) }));
  } catch {
    const snap = await getDocs(collection(db, VIDEOS_COLLECTION));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EducationalVideo, "id">) }));
    rows.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    return rows;
  }
}
