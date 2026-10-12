import test from 'node:test';
import assert from 'node:assert/strict';
import { persistBufferToSpark } from './_sparkStorage';

function storageClient(signedUrl?: string, signError?: string) {
  const calls: string[] = [];
  return {
    calls,
    client: { storage: { from(bucket: string) {
      calls.push(bucket);
      return {
        async upload(path: string, bytes: Buffer, options: any) {
          assert.equal(path, 'brands/b1/p1/video/master.mp4');
          assert.ok(bytes.length);
          assert.equal(options.upsert, true);
          return { error: null };
        },
        async createSignedUrl() {
          return { data: signedUrl ? { signedUrl } : null, error: signError ? { message: signError } : null };
        },
        getPublicUrl() { throw new Error('Private bucket must not use public URLs'); },
      };
    } } } as any,
  };
}

test('private media returns signed playback with a durable storage path', async () => {
  const { client, calls } = storageClient('https://example.supabase.co/storage/v1/object/sign/Spark/path?token=test');
  const result = await persistBufferToSpark({ buffer: Buffer.from('test'), storagePath: 'brands/b1/p1/video/master.mp4', contentType: 'video/mp4', supabase: client });
  assert.equal(result.videoUrl, result.signedUrl);
  assert.equal(result.publicUrl, result.signedUrl);
  assert.equal(result.storagePath, 'brands/b1/p1/video/master.mp4');
  assert.deepEqual(calls, ['Spark', 'Spark']);
});

test('signing failure cannot return success with an unusable public URL', async () => {
  const { client } = storageClient(undefined, 'not authorized');
  await assert.rejects(persistBufferToSpark({ buffer: Buffer.from('test'), storagePath: 'brands/b1/p1/video/master.mp4', contentType: 'video/mp4', supabase: client }), /signing playback failed: not authorized/);
});
