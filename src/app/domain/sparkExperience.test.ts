import test from "node:test";
import assert from "node:assert/strict";
import {
  inferSparkUseCase,
  resolveSparkUseCase,
  nextGenesisTool,
  publishedSparkPosts,
  safeExternalUrl,
} from "./sparkExperience";
import type { Production, PublishJob } from "./types";
test("purpose stays independent from medium and format", () => {
  assert.equal(inferSparkUseCase("anime drama episodes"), "drama");
  assert.equal(inferSparkUseCase("short movie"), "short_movies");
  assert.equal(
    resolveSparkUseCase({
      settings: { sparkUseCase: "avatar" },
      contentFormat: "faceless",
    }),
    "avatar",
  );
});
test("chat asks only missing essentials and permits asset setup later", () => {
  const draft = {
    sparkUseCase: "explainer" as const,
    brandName: "Science",
    contentFormat: "faceless" as const,
  };
  assert.equal(nextGenesisTool(draft, []), "connect");
  assert.equal(nextGenesisTool(draft, ["connect", "format"]), "voice");
  assert.equal(
    nextGenesisTool(draft, ["connect", "format", "voice", "preferences"]),
    "review",
  );
  assert.equal(nextGenesisTool({ ...draft, brandName: "" }, []), "identity");
});
test("feed excludes exports, status-only records and different accounts", () => {
  const productions = [
    { id: "p", brandId: "b", title: "Clip" },
  ] as Production[];
  const receipt = {
    id: "j",
    productionId: "p",
    title: "Clip",
    platform: "YouTube Shorts",
    status: "Published",
    scheduledTime: "2026-10-08",
    platformPostId: "video",
    accountId: "channel",
    postUrl: "https://youtube.com/watch?v=video",
  } as PublishJob;
  const account = { channelId: "channel", platform: "youtube" };
  assert.equal(
    publishedSparkPosts(productions, [receipt, receipt], "b", account).length,
    1,
  );
  for (const patch of [
    { status: "Export Ready" },
    { accountId: "other" },
    { platformPostId: undefined },
    { postUrl: "javascript:alert(1)" },
  ]) {
    assert.equal(
      publishedSparkPosts(
        productions,
        [{ ...receipt, ...patch } as PublishJob],
        "b",
        account,
      ).length,
      0,
    );
  }
  assert.equal(
    publishedSparkPosts(productions, [receipt], "other", account).length,
    0,
  );
  assert.equal(safeExternalUrl("data:text/html,hello"), undefined);
});
