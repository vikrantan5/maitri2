// Client-side Cloudinary signed-upload helper.
export interface CloudinarySignature {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  folder: string;
  signature: string;
  upload_url: string;
  upload_preset?: string;
  public_id?: string;
}

export async function signCloudinary(folder: string, public_id?: string): Promise<CloudinarySignature> {
  const res = await fetch("/api/cloudinary-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, public_id }),
  });
  if (!res.ok) throw new Error(`Cloudinary sign failed (${res.status})`);
  return res.json();
}

export async function uploadToCloudinary(
  file: File,
  folder = "saheli/uploads",
  onProgress?: (pct: number) => void,
): Promise<{ url: string; public_id: string }> {
  const sig = await signCloudinary(folder);
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", sig.api_key);
  fd.append("timestamp", String(sig.timestamp));
  fd.append("signature", sig.signature);
  fd.append("folder", sig.folder);
  if (sig.public_id) fd.append("public_id", sig.public_id);
  if (sig.upload_preset) fd.append("upload_preset", sig.upload_preset);

  // Use XHR so we can hook progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", sig.upload_url);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: data.secure_url, public_id: data.public_id });
        } else {
          reject(new Error(data.error?.message || `Upload failed (${xhr.status})`));
        }
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(fd);
  });
}
