/**
 * Server-side persist of media bytes into the SPARK bucket.
 * Public URL is the stored identity. Signed URL is playback-only.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SPARK_STORAGE_BUCKET = "Spark";

export type SparkPersistResult = {
  storagePath: string;
  publicUrl: string;
  videoUrl: string;
  signedUrl?: string;
};

export function createSparkSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_URL / VITE_SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  return createClient(supabaseUrl, supabaseKey);
}

export function sparkBrandMediaPath(
  brandId: string,
  productionId: string,
  sub: string
): string {
  const bId = String(brandId || "").trim() || "default-brand";
  const prodId = String(productionId || "").trim() || "default-prod";
  const cleanSub = String(sub || "").replace(/^\/+/, "");
  return `brands/${bId}/${prodId}/${cleanSub}`;
}

export async function persistBufferToSpark(params: {
  buffer: Buffer;
  storagePath: string;
  contentType: string;
  supabase?: SupabaseClient;
}): Promise<SparkPersistResult> {
  const supabase = params.supabase || createSparkSupabase();
  const storagePath = String(params.storagePath || "").replace(/^\/+/, "");
  if (!storagePath) {
    throw new Error("storagePath is required to persist bytes to Spark");
  }
  if (!params.buffer?.length) {
    throw new Error("empty buffer — refused to persist to Spark");
  }

  const { error: uploadError } = await supabase.storage
    .from(SPARK_STORAGE_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: params.contentType || "application/octet-stream",
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`Spark storage upload failed: ${uploadError.message}`);
  }

  const { data: publicData } = supabase.storage.from(SPARK_STORAGE_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicData?.publicUrl || "";
  let signedUrl: string | undefined;
  const { data: signData } = await supabase.storage
    .from(SPARK_STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (signData?.signedUrl) signedUrl = signData.signedUrl;

  const videoUrl = publicUrl || signedUrl || "";
  if (!videoUrl) {
    throw new Error("Spark persist succeeded but no public or signed URL was returned");
  }

  return {
    storagePath,
    publicUrl: publicUrl || videoUrl,
    videoUrl,
    signedUrl,
  };
}

export async function persistVideoBuffer(params: {
  buffer: Buffer;
  brandId: string;
  productionId: string;
  filename?: string;
  contentType?: string;
}): Promise<SparkPersistResult> {
  const filename = params.filename || `clip-${Date.now()}.mp4`;
  const storagePath = sparkBrandMediaPath(params.brandId, params.productionId, `video/${filename}`);
  return persistBufferToSpark({
    buffer: params.buffer,
    storagePath,
    contentType: params.contentType || "video/mp4",
  });
}
