import assert from "node:assert/strict";
import test from "node:test";
import {
  setActiveSessionBrand,
  getBrandWorkspaceId,
  encodeOAuthState,
  parseOAuthState,
  buildPlatformAccountMap,
  listLiveConnectedAccounts,
  clearAllStoredAccountTokens,
  saveConnectedAccountToken,
  getStoredAccountTokens,
  getOAuthAuthorizationUrl,
  OAUTH_CONFIGS,
} from "./socialIntegrationService";

// Mock localStorage in Node environment if absent
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] || null,
    length: 0,
  } as any;
}

test("Session brand authority: getBrandWorkspaceId anchors to active session and user", () => {
  const brandA = "11111111-1111-4111-8111-111111111111";
  const userA = "user-a-1234";

  setActiveSessionBrand(brandA, userA);
  assert.equal(getBrandWorkspaceId(), brandA);

  // Clear session brand
  setActiveSessionBrand(null, null);
  assert.equal(getBrandWorkspaceId(), "");
});

test("OAuth state encoding and decoding embeds brandId and userId", () => {
  const brandId = "22222222-2222-4222-8222-222222222222";
  const userId = "33333333-3333-4333-8333-333333333333";

  const stateStr = encodeOAuthState("youtube", brandId, userId);
  assert.ok(stateStr.startsWith("spark_oauth_youtube_"));

  const parsed = parseOAuthState(stateStr);
  assert.ok(parsed);
  assert.equal(parsed?.platform, "youtube");
  assert.equal(parsed?.brandId, brandId);
  assert.equal(parsed?.userId, userId);
});

test("Platform Account Map: strictly isolates accounts across brands", () => {
  const brandA = "aaaa1111-1111-4111-8111-111111111111";
  const brandB = "bbbb2222-2222-4222-8222-222222222222";

  // Wipe before test
  clearAllStoredAccountTokens();

  // Save a YouTube token under Brand A
  setActiveSessionBrand(brandA, "user-a");
  saveConnectedAccountToken({
    platform: "YouTube Shorts",
    handle: "@creator_brand_a",
    displayName: "Creator Brand A",
    accessToken: "token-a",
    refreshToken: "refresh-a",
    status: "Connected",
    brand_id: brandA,
  });

  // Querying under Brand A should show the account
  const mapA = buildPlatformAccountMap(undefined, brandA);
  assert.ok(mapA.has("youtube"));
  assert.equal(mapA.get("youtube")?.handle, "@creator_brand_a");

  // Querying under Brand B MUST NOT show Brand A's account
  const mapB = buildPlatformAccountMap(undefined, brandB);
  assert.ok(!mapB.has("youtube"), "Brand B must not see Brand A's YouTube account");

  // Listing under Brand B must be empty
  const liveB = listLiveConnectedAccounts(brandB);
  assert.equal(liveB.length, 0, "Brand B live connected accounts must be empty");

  // User B on Brand B connects their OWN account to the same YouTube channel / handle
  setActiveSessionBrand(brandB, "user-b");
  saveConnectedAccountToken({
    platform: "YouTube Shorts",
    handle: "@creator_brand_b",
    displayName: "Creator Brand B",
    accessToken: "token-b",
    refreshToken: "refresh-b",
    status: "Connected",
    brand_id: brandB,
  });

  const liveBAfter = listLiveConnectedAccounts(brandB);
  assert.equal(liveBAfter.length, 1);
  assert.equal(liveBAfter[0].handle, "@creator_brand_b");

  // User B querying Brand A MUST NOT see User A's token
  const mapBOnBrandA = buildPlatformAccountMap(undefined, brandA);
  assert.ok(!mapBOnBrandA.has("youtube"), "User B must not see User A's YouTube account on Brand A");

  // When User A resumes session on Brand A, Brand A's account is preserved
  setActiveSessionBrand(brandA, "user-a");
  const mapAAfter = buildPlatformAccountMap(undefined, brandA);
  assert.equal(mapAAfter.get("youtube")?.handle, "@creator_brand_a");
});

test("Storage purge: clearAllStoredAccountTokens wipes all platform tokens and session pointers", () => {
  const brandId = "cccc3333-3333-4333-8333-333333333333";
  setActiveSessionBrand(brandId, "user-c");

  saveConnectedAccountToken({
    platform: "Twitter/X",
    handle: "@creator_x",
    displayName: "Creator X",
    accessToken: "x-token",
    status: "Connected",
    brand_id: brandId,
  });

  assert.ok(Object.keys(getStoredAccountTokens()).length > 0);
  assert.equal(getBrandWorkspaceId(), brandId);

  // Perform sign-out purge
  clearAllStoredAccountTokens();

  assert.equal(getBrandWorkspaceId(), "");
  assert.equal(Object.keys(getStoredAccountTokens()).length, 0);
  assert.equal(localStorage.getItem("spark_current_brand_id"), null);
  assert.equal(localStorage.getItem("spark_current_user_id"), null);
});

test("OAuth authorization resilience: getOAuthAuthorizationUrl auto-generates brand workspace when session is empty", () => {
  // Set mock client IDs for test runner
  OAUTH_CONFIGS["YouTube Shorts"].clientId = "mock-google-client-id";
  OAUTH_CONFIGS["Twitter/X"].clientId = "mock-x-client-id";

  // Ensure session is completely clean
  clearAllStoredAccountTokens();
  assert.equal(getBrandWorkspaceId(), "");

  // Calling without brandId must NOT throw; it must auto-generate a valid UUID workspace
  const ytUrl = getOAuthAuthorizationUrl("YouTube Shorts");
  assert.ok(ytUrl && ytUrl !== "#", "YouTube auth URL must be returned without error");

  const brandIdAfter = getBrandWorkspaceId();
  assert.ok(brandIdAfter && brandIdAfter.length > 0, "A valid brandId workspace must be automatically generated and anchored");

  // Check state embedded in the URL
  const ytParsed = new URL(ytUrl);
  const ytState = ytParsed.searchParams.get("state") || "";
  const ytDecoded = parseOAuthState(ytState);
  assert.equal(ytDecoded?.brandId, brandIdAfter, "Embedded state must match the auto-generated brandId");

  // Calling for X with an explicit brand must honor the explicit brand
  const explicitBrand = "99999999-9999-4999-8999-999999999999";
  const xUrl = getOAuthAuthorizationUrl("Twitter/X", explicitBrand, "user-explicit");
  assert.ok(xUrl && xUrl !== "#", "X auth URL must be returned without error");

  const xParsed = new URL(xUrl);
  const xState = xParsed.searchParams.get("state") || "";
  const xDecoded = parseOAuthState(xState);
  assert.equal(xDecoded?.brandId, explicitBrand, "Explicit brand ID must be preserved in state");
  assert.equal(xDecoded?.userId, "user-explicit", "Explicit user ID must be preserved in state");
});

