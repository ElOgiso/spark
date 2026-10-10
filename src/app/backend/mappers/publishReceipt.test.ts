import test from "node:test";
import assert from "node:assert/strict";
import {
  domainPublishJobToInsert,
  publishJobRowToDomain,
} from "./workspaceMappers";
import type { PublishJobRow } from "../database.types";
import type { PublishJob } from "../../domain/types";

test("verified publication receipt survives the existing metadata mapper", () => {
  const job: PublishJob = {
    id: "job",
    productionId: "production",
    title: "Release",
    platform: "YouTube",
    scheduledTime: "—",
    status: "Published",
    accountId: "channel",
    platformPostId: "video",
    postUrl: "https://youtube.com/watch?v=video",
    publishedAt: "2026-10-08T10:00:00Z",
  };
  const row = {
    ...domainPublishJobToInsert("brand", job),
    id: job.id,
  } as PublishJobRow;
  const restored = publishJobRowToDomain(row);
  assert.equal(row.brand_id, "brand");
  for (const field of [
    "accountId",
    "platformPostId",
    "postUrl",
    "publishedAt",
  ] as const) {
    assert.equal(restored[field], job[field]);
  }
});

test("legacy Published labels do not invent a publication receipt", () => {
  const restored = publishJobRowToDomain({
    id: "legacy",
    production_id: "p",
    status: "published",
    platform: "YouTube",
    metadata: { accountId: 42, postUrl: null },
  } as unknown as PublishJobRow);
  assert.equal(restored.status, "Published");
  assert.equal(restored.postUrl, undefined);
  assert.equal(restored.accountId, undefined);
  assert.equal(restored.platformPostId, undefined);
});
