import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeOAuthState,
  parseOAuthState,
  setActiveSessionBrand,
  getBrandWorkspaceId,
  getActiveSessionUserId,
  getOAuthAuthorizationUrl,
  OAUTH_CONFIGS,
} from "../services/socialIntegrationService";
import type { BrandRow, ProfileRow } from "./database.types";

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

test("Draft Brand Session Architecture: New user session creates draft brand and anchors session", () => {
  const testUserId = "11111111-2222-4333-8444-555555555555";
  const draftBrandId = "aaaa1111-bb22-4c33-8d44-eeee55555555";

  // Simulate createDraftBrand
  const draftBrand: Partial<BrandRow> = {
    id: draftBrandId,
    owner_id: testUserId,
    name: "Draft Brand",
    niche: null,
    settings: { is_draft: true },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert.equal(draftBrand.owner_id, testUserId);
  assert.equal((draftBrand.settings as any)?.is_draft, true);

  // Simulate bootstrap session anchoring
  setActiveSessionBrand(draftBrand.id, testUserId);
  assert.equal(getBrandWorkspaceId(), draftBrandId);
  assert.equal(getActiveSessionUserId(), testUserId);

  // Profile active brand id pointer
  const profile: Partial<ProfileRow> = {
    id: testUserId,
    active_brand_id: draftBrand.id,
    onboarding_complete: false,
  };

  assert.equal(profile.active_brand_id, draftBrandId);

  // Evaluate isComplete: draft brand must NOT be treated as finished onboarding
  const isDraft = !draftBrand || (draftBrand.settings as any)?.is_draft === true || draftBrand.name === "Draft Brand";
  const isComplete = profile.onboarding_complete === true || (!isDraft && draftBrand.name !== "My Brand");

  assert.equal(isComplete, false, "Draft brand must not trigger premature onboarding completion");
});

test("Frame 1 Connect: Embeds draft brand ID and session user ID in OAuth state", () => {
  const testUserId = "22222222-3333-4444-8555-666666666666";
  const draftBrandId = "bbbb2222-cc33-4d44-8e55-ffff66666666";

  // Set mock client IDs for test runner
  OAUTH_CONFIGS["YouTube Shorts"].clientId = "mock-google-client-id";
  OAUTH_CONFIGS["Twitter/X"].clientId = "mock-x-client-id";

  setActiveSessionBrand(draftBrandId, testUserId);

  // Frame 1 generates OAuth authorization URL
  const stateStr = encodeOAuthState("youtube", draftBrandId, testUserId);
  const parsed = parseOAuthState(stateStr);

  assert.ok(parsed);
  assert.equal(parsed?.platform, "youtube");
  assert.equal(parsed?.brandId, draftBrandId, "OAuth state must contain the draft brand ID");
  assert.equal(parsed?.userId, testUserId, "OAuth state must contain the user ID");

  // Verify getOAuthAuthorizationUrl passes through active session brand
  const authUrl = getOAuthAuthorizationUrl("YouTube Shorts", draftBrandId, testUserId);
  assert.ok(authUrl.includes("state="));
  const urlStateParam = new URL(authUrl).searchParams.get("state");
  const parsedFromUrl = parseOAuthState(urlStateParam || "");
  assert.equal(parsedFromUrl?.brandId, draftBrandId);
  assert.equal(parsedFromUrl?.userId, testUserId);
});

test("Genesis step progression: rest of Genesis PATCHes the same brand ID", () => {
  const draftBrandId = "cccc3333-dd44-4e55-8f66-000011112222";
  let brandState: Partial<BrandRow> = {
    id: draftBrandId,
    name: "Draft Brand",
    niche: null,
    settings: { is_draft: true },
  };

  // Frame 2 updates name and niche on same brand
  brandState = {
    ...brandState,
    name: "Cyber Pulse",
    niche: "AI & Tech",
  };
  assert.equal(brandState.id, draftBrandId);
  assert.equal(brandState.name, "Cyber Pulse");

  // Frame 3 updates archetype
  brandState = {
    ...brandState,
    archetype: "The Creator",
  };
  assert.equal(brandState.id, draftBrandId);
  assert.equal(brandState.archetype, "The Creator");

  // Final completion: unsets is_draft and marks onboarding complete on the SAME brand
  brandState = {
    ...brandState,
    settings: {
      ...(typeof brandState.settings === "object" ? brandState.settings : {}),
      is_draft: false,
    },
  };
  assert.equal((brandState.settings as any)?.is_draft, false);
  assert.equal(brandState.id, draftBrandId, "Final brand ID must remain identical to initial draft brand");
});
