/**
 * Google Drive Service for SPARK Media OS.
 * Supports optional parallel / preferred upload of generated production assets
 * to the user's connected Google Drive folder.
 */

export interface GoogleDriveUploadResult {
  fileId: string;
  webViewLink?: string;
  webContentLink?: string;
  filename: string;
}

export async function uploadToUserGoogleDriveIfConnected(params: {
  blob: Blob;
  filename: string;
  mimeType: string;
  productionId: string;
}): Promise<GoogleDriveUploadResult | null> {
  const { blob, filename, mimeType, productionId } = params;

  if (typeof localStorage === "undefined") return null;

  try {
    // 1. Check for user Google Drive access token from connected accounts or storage
    const { ensureValidGoogleAccess } = await import("./socialIntegrationService");
    const googleToken =
      (await ensureValidGoogleAccess("YouTube Shorts")) ||
      localStorage.getItem("spark_google_drive_token");

    if (!googleToken) {
      return null;
    }

    // 2. Build multipart upload payload
    const metadata = {
      name: `SPARK_${productionId.slice(0, 8)}_${filename}`,
      mimeType: mimeType || "image/png",
      description: `Generated production asset for SPARK Production ${productionId}`,
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", blob);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
        },
        body: form,
      }
    );

    if (res.ok) {
      const data = await res.json();
      return {
        fileId: data.id,
        webViewLink: data.webViewLink,
        webContentLink: data.webContentLink,
        filename: data.name || filename,
      };
    } else {
      const errText = await res.text().catch(() => "");
      console.warn(`[GoogleDriveService] Upload notice (${res.status}):`, errText);
    }
  } catch (err) {
    console.warn("[GoogleDriveService] Upload error notice:", err);
  }

  return null;
}
