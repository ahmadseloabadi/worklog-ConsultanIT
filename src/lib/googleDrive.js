import { driveCreatePermission, driveDownload, driveGetFile, driveUploadMultipart } from "@/lib/googleClient";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

/**
 * Upload gambar ke Drive akun yang login, buka akses "anyone with the link - viewer",
 * lalu kembalikan URL untuk kolom Keterangan.
 */
export async function uploadImage(dataUrl, fileName, folderId) {
  if (typeof dataUrl !== "string" || !dataUrl) throw httpError("dataUrl kosong.", 400);
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) throw httpError("Format gambar tidak valid.", 400);
  const [, mimeType, base64] = match;
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) throw httpError("Tipe gambar tidak diizinkan.", 400);

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  if (Math.floor((base64.length * 3) / 4) - padding > MAX_IMAGE_BYTES) {
    throw httpError("Ukuran gambar terlalu besar (maks 8MB).", 400);
  }

  const safeName = `${Date.now()}_${(fileName || "paste").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const blob = await (await fetch(dataUrl)).blob();
  const created = await driveUploadMultipart({ name: safeName, parents: [folderId] }, blob, mimeType);
  await driveCreatePermission(created.id, { role: "reader", type: "anyone" });
  return created.webViewLink;
}

const imageCache = new Map();

/** Muat gambar bukti dari Drive (butuh token) menjadi blob URL untuk <img>. Hasil di-cache per sesi. */
export function getDriveImageUrl(fileId) {
  if (!imageCache.has(fileId)) {
    const promise = (async () => {
      const response = await driveDownload(fileId);
      const mimeType = (response.headers.get("Content-Type") || "").split(";")[0];
      if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) throw httpError("File bukti bukan gambar yang didukung.", 415);
      const blob = await response.blob();
      if (blob.size > MAX_IMAGE_BYTES) throw httpError("Ukuran gambar bukti melebihi 8 MB.", 413);
      return URL.createObjectURL(blob);
    })();
    promise.catch(() => imageCache.delete(fileId));
    imageCache.set(fileId, promise);
  }
  return imageCache.get(fileId);
}

export async function validateDriveFolder(folderId) {
  const file = await driveGetFile(folderId, "id,name,mimeType,capabilities(canAddChildren)");
  if (file.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("Link Google Drive harus mengarah ke folder.");
  }
  if (!file.capabilities?.canAddChildren) {
    throw new Error("Akun Google yang login tidak memiliki izin menambahkan file ke folder ini.");
  }
  return { id: file.id, name: file.name };
}
