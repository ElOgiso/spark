/**
 * Server-side persist of media bytes into the SPARK bucket.
 * storagePath is the durable identity. Private-bucket playback uses a signed URL.
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
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
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

  const { data: signData, error: signError } = await supabase.storage
    .from(SPARK_STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  const signedUrl = signData?.signedUrl;
  if (signError || !signedUrl) {
    throw new Error(`Spark persist succeeded but signing playback failed: ${signError?.message || "missing signed URL"}`);
  }

  return {
    storagePath,
    // Compatibility field consumed by existing video/ingest handlers; never a public endpoint.
    publicUrl: signedUrl,
    videoUrl: signedUrl,
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
