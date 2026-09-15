import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeElementTag,
  buildProductionElementPack,
  resolveElementsForShot,
  formatElementBindingHeader,
} from "./productionElements";
import { buildVisualLockRefs } from "../productionAssetService";
import { compileLiveMotionPrompt } from "../compileLiveMotionPrompt";
import { isForbiddenI2vStartFrame } from "../officialI2vFrames";
import { buildGrokVideoGenerateBody } from "../../../../../api/runtime/_videoContract";

test("normalizeElementTag normalizes to @lowercase_slug", () => {
  assert.equal(normalizeElementTag("Eduardo"), "@eduardo");
  assert.equal(normalizeElementTag("@Eduardo"), "@eduardo");
  assert.equal(normalizeElementTag("Loc Cabin!"), "@loc_cabin");
  assert.equal(normalizeElementTag("  @Support_Marcus  "), "@support_marcus");
  assert.equal(normalizeElementTag(""), "@element");
  assert.equal(normalizeElementTag(undefined as any), "@element");
});

test("buildProductionElementPack orders by priority and deduplicates by URL", () => {
  const pack = buildProductionElementPack({
    character: {
      id: "char-1",
      name: "Eduardo",
      role: "Lead Host",
      style: "Cinematic",
      traits: [],
      voice: { name: "V1", language: "en", tone: "Warm", locked: true },
      characterSheetUrl: "https://cdn/eduardo-sheet.png",
      imageUrl: "https://cdn/eduardo-avatar.png",
    },
    supportCharacter: {
      id: "char-2",
      name: "Marcus",
      role: "Support",
      style: "Realistic",
      traits: [],
      voice: { name: "V2", language: "en", tone: "Calm", locked: true },
      characterSheetUrl: "https://cdn/marcus-sheet.png",
    },
    brand: {
      id: "brand-1",
      name: "Nordic Cabin",
      audience: "Travelers",
      locationPlateUrl: "https://cdn/cabin-plate.png",
    } as any,
    directorPropUrl: "https://cdn/axe-prop.png",
  });

  assert.equal(pack.length, 5); // eduardo sheet, eduardo avatar, marcus sheet, cabin plate, axe prop
  assert.equal(pack[0].tag, "@eduardo");
  assert.equal(pack[0].role, "character_main");
  assert.equal(pack[2].tag, "@support_marcus");
  assert.equal(pack[2].role, "character_support");
  assert.equal(pack[3].tag, "@loc_nordic_cabin");
  assert.equal(pack[3].role, "location");
  assert.equal(pack[4].tag, "@prop_hero");
  assert.equal(pack[4].role, "prop");

  // Deduplication check: passing identical URL twice should not create duplicate entries
  const packWithDupes = buildProductionElementPack({
    directorIdentityUrls: ["https://cdn/eduardo-sheet.png"],
    character: {
      name: "Eduardo",
      role: "host",
      style: "tech",
      traits: [],
      voice: { name: "v", language: "en", tone: "t", locked: true },
      characterSheetUrl: "https://cdn/eduardo-sheet.png",
    },
  });
  assert.equal(packWithDupes.length, 1);
  assert.equal(packWithDupes[0].url, "https://cdn/eduardo-sheet.png");
});

test("resolveElementsForShot resolves explicit neededTags and subjectType defaults", () => {
  const pack = buildProductionElementPack({
    character: {
      name: "Eduardo",
      role: "Lead Host",
      style: "Cinematic",
      traits: [],
      voice: { name: "V1", language: "en", tone: "Warm", locked: true },
      characterSheetUrl: "https://cdn/eduardo-sheet.png",
    },
    supportCharacter: {
      name: "Marcus",
      role: "Support",
      style: "Realistic",
      traits: [],
      voice: { name: "V2", language: "en", tone: "Calm", locked: true },
      characterSheetUrl: "https://cdn/marcus-sheet.png",
    },
    locationPlateUrl: "https://cdn/cabin-plate.png",
    directorPropUrl: "https://cdn/axe-prop.png",
  });

  // 1. Explicit tags override
  const explicit = resolveElementsForShot(pack, ["@loc_plate", "@eduardo"]);
  assert.equal(explicit.length, 2);
  assert.equal(explicit[0].tag, "@location_plate");
  assert.equal(explicit[1].tag, "@eduardo");

  // 2. Default: set
  const setElems = resolveElementsForShot(pack, [], "set");
  assert.equal(setElems.length, 1);
  assert.equal(setElems[0].role, "location");

  // 3. Default: insert
  const insertElems = resolveElementsForShot(pack, [], "insert");
  assert.equal(insertElems.length, 2);
  assert.equal(insertElems[0].role, "prop");
  assert.equal(insertElems[1].role, "location");

  // 4. Default: support
  const suppElems = resolveElementsForShot(pack, [], "support");
  assert.equal(suppElems.length, 2);
  assert.equal(suppElems[0].role, "character_support");
  assert.equal(suppElems[1].role, "location");

  // 5. Default: main
  const mainElems = resolveElementsForShot(pack, [], "main");
  assert.equal(mainElems.length, 3);
  assert.equal(mainElems[0].role, "character_main");
  assert.equal(mainElems[1].role, "location");
  assert.equal(mainElems[2].role, "prop");
});

test("formatElementBindingHeader generates clean machine-readable header", () => {
  const elements = [
    {
      tag: "@eduardo",
      role: "character_main" as const,
      label: "Eduardo",
      url: "https://cdn/eduardo.png",
      description: "character identity sheet (face/wardrobe lock)",
    },
    {
      tag: "@loc_cabin",
      role: "location" as const,
      label: "Location Plate",
      url: "https://cdn/cabin.png",
      description: "location plate (set lock)",
    },
  ];

  const header = formatElementBindingHeader(elements);
  assert.match(header, /ELEMENT BINDING:/);
  assert.match(header, /@eduardo = character identity sheet/);
  assert.match(header, /@loc_cabin = location plate/);
  assert.match(header, /IMAGE 1 = this shot’s storyboard still \(first frame/);
});

test("buildVisualLockRefs returns elements, labelLines, and tagLines", () => {
  const lock = buildVisualLockRefs({
    character: {
      name: "Eduardo",
      role: "host",
      style: "cinematic",
      traits: [],
      voice: { name: "v", language: "en", tone: "t", locked: true },
      characterSheetUrl: "https://cdn/eduardo-sheet.png",
    },
    locationPlateUrl: "https://cdn/cabin-plate.png",
    subjectType: "main",
  });

  assert.ok(Array.isArray(lock.elements));
  assert.ok(lock.elements.length >= 2);
  assert.ok(Array.isArray(lock.labelLines));
  assert.ok(Array.isArray(lock.tagLines));
  assert.match(lock.tagLines[0], /ELEMENT @eduardo → INPUT REF \[1\]/);
});

test("compileLiveMotionPrompt outputs ELEMENT BINDING header with stable tags and IMAGE 1 still", () => {
  const elements = [
    {
      tag: "@eduardo",
      role: "character_main" as const,
      label: "Eduardo",
      url: "https://cdn/eduardo.png",
      description: "character identity sheet (face/wardrobe lock)",
    },
    {
      tag: "@loc_cabin",
      role: "location" as const,
      label: "Location Plate",
      url: "https://cdn/cabin.png",
      description: "location plate (set lock)",
    },
  ];

  const result = compileLiveMotionPrompt({
    mode: "standard",
    aspectRatio: "9:16",
    sceneIndex: 1,
    totalScenes: 3,
    durationSec: 5,
    scene: {
      physicalAction: "Host turns to camera with a confident smile",
      spokenLines: "Welcome to the future.",
    },
    refLabels: ["INPUT REF [1]: First Frame Keyframe (Scene 1 shot still)"],
    isInsertOrSet: false,
    characterName: "Eduardo",
    environment: "Nordic cabin interior",
    elements,
  });

  assert.match(result.prompt, /ELEMENT BINDING:/);
  assert.match(result.prompt, /@eduardo = character identity sheet/);
  assert.match(result.prompt, /@loc_cabin = location plate/);
  assert.match(result.prompt, /IMAGE 1 = this shot’s storyboard still \(first frame/);
  assert.match(result.prompt, /VISUAL LOCK LAW:/);
  // Motion body remains motion and camera only
  assert.match(result.prompt, /Host turns to camera with a confident smile/);
});

test("officialI2vFrames continues to forbid sheets and plates as first frame", () => {
  const sheetUrl = "https://cdn/eduardo-sheet.png";
  const plateUrl = "https://cdn/cabin-plate.png";
  assert.equal(
    isForbiddenI2vStartFrame(sheetUrl, { sheetUrls: [sheetUrl], plateUrl }),
    true
  );
  assert.equal(
    isForbiddenI2vStartFrame(plateUrl, { sheetUrls: [sheetUrl], plateUrl }),
    true
  );
  assert.equal(
    isForbiddenI2vStartFrame("https://cdn/valid-cropped-shot-still.jpg", {
      sheetUrls: [sheetUrl],
      plateUrl,
    }),
    false
  );
});

test("Grok body maps referenceImageUrls from element pack (<=7, 720p)", () => {
  const pack = buildProductionElementPack({
    character: {
      name: "Eduardo",
      role: "host",
      style: "cinematic",
      traits: [],
      voice: { name: "v", language: "en", tone: "t", locked: true },
      characterSheetUrl: "https://cdn/eduardo-sheet.png",
    },
    locationPlateUrl: "https://cdn/cabin-plate.png",
  });

  const refs = resolveElementsForShot(pack, ["@eduardo", "@loc_plate"]).map((e) => e.url);
  const body = buildGrokVideoGenerateBody({
    prompt: "camera pans slowly",
    firstFrameUrl: "https://cdn/shot-01-still.jpg",
    referenceImageUrls: refs,
    durationSec: 5,
    aspectRatio: "9:16",
  });

  assert.equal((body.image as any)?.url, "https://cdn/shot-01-still.jpg");
  assert.ok(Array.isArray(body.reference_images));
  assert.equal((body.reference_images as any[]).length, 2);
  assert.equal((body.reference_images as any[])[0]?.url, "https://cdn/eduardo-sheet.png");
  assert.equal((body.reference_images as any[])[1]?.url, "https://cdn/cabin-plate.png");
  assert.equal(body.resolution, "720p");
});
