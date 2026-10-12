import test from "node:test";
import assert from "node:assert/strict";
import { refreshPrivateMedia } from "./refreshPrivateMedia";

test("hydration renews legacy/private media once per durable path without mutation", async () => {
  const root = "https://spark-test.supabase.co";
  const input = { avatar: `${root}/storage/v1/object/public/Spark/brands/b1/a.png`,
    scenes: [{ url: `${root}/storage/v1/object/sign/Spark/brands/b1/a.png?token=expired` }],
    path: "brands/b1/a.png", external: "https://other.supabase.co/storage/v1/object/public/Spark/a.png" };
  const calls: string[] = [];
  const output = await refreshPrivateMedia(input, root, async (path) => { calls.push(path); return "https://signed.example/test"; });
  assert.deepEqual(calls, ["brands/b1/a.png"]);
  assert.equal(output.avatar, "https://signed.example/test");
  assert.equal(output.scenes[0].url, output.avatar);
  assert.equal(output.path, input.path);
  assert.equal(output.external, input.external);
  assert.ok(input.avatar.includes("/public/"));
});

test("unauthorized media becomes unavailable while unrelated fields remain intact", async () => {
  const output = await refreshPrivateMedia({ url: "https://spark-test.supabase.co/storage/v1/object/public/Spark/a.png", title: "hello", id: 3 },
    "https://spark-test.supabase.co", async () => { throw new Error("denied"); });
  assert.deepEqual(output, { url: "", title: "hello", id: 3 });
});
