import test from "node:test";
import assert from "node:assert/strict";
import { ensureAssetBibleAssets } from "./ensureAssetBibleAssets";
import { listMissingAssetBibleEntries, type AssetBibleEntry } from "./assetBibleFromBrief";
import { resolveOfficialI2vClipFrames, looksLikeSheetOrGridUrl } from "../officialI2vFrames";

test("listMissing -> ensure generates prop URL for a bible prop entry when image generate is mocked", async () => {
  const { ModelRouter } = await import("../../runtime/modelRouter");
  const { ProductionAssetService } = await import("../productionAssetService");

  const originalExecute = ModelRouter.executeCategoryRequest;
  const originalUpload = ProductionAssetService.uploadAssetToStorage;

  const mockGeneratedUrl = "https://test.supabase.co/storage/v1/object/public/Spark/brands/brand-1/prod-1/props/recorder.png";
  ModelRouter.executeCategoryRequest = async () => mockGeneratedUrl;
  ProductionAssetService.uploadAssetToStorage = async (params: any) => ({
    publicUrl: mockGeneratedUrl,
    storagePath: params.storagePath,
    assetId: "pa-mock-123",
    uploadSuccess: true,
  });

  try {
    const bible: AssetBibleEntry[] = [
      {
        tag: "@prop_recorder",
        role: "prop",
        sheetKind: "prop",
        label: "Hero Tape Recorder",
        notes: "Vintage reel recorder with brushed metal casing",
      },
    ];

    const missing = listMissingAssetBibleEntries(bible, []);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].tag, "@prop_recorder");

    const result = await ensureAssetBibleAssets({
      bible,
      brand: { name: "Test Brand" },
      productionId: "prod-test-1",
      contentFormat: "standard",
      existingElements: [],
    });

    assert.equal(result.generated.length, 1);
    assert.equal(result.generated[0].tag, "@prop_recorder");
    assert.equal(result.generated[0].url, mockGeneratedUrl);
    assert.equal(result.errors.length, 0);
    assert.equal(result.stillMissing.length, 0);

    const fulfilledProp = result.fulfilled.find((e) => e.tag === "@prop_recorder");
    assert.ok(fulfilledProp);
    assert.equal(fulfilledProp.url, mockGeneratedUrl);
  } finally {
    ModelRouter.executeCategoryRequest = originalExecute;
    ProductionAssetService.uploadAssetToStorage = originalUpload;
  }
});

test("failed prop ensure logs error and does not throw or abort the run", async () => {
  const { ModelRouter } = await import("../../runtime/modelRouter");
  const originalExecute = ModelRouter.executeCategoryRequest;

  ModelRouter.executeCategoryRequest = async () => {
    throw new Error("Provider GPU out of memory");
  };

  try {
    const bible: AssetBibleEntry[] = [
      {
        tag: "@prop_bad_device",
        role: "prop",
        sheetKind: "prop",
        label: "Failing Device",
        notes: "Some broken gadget",
      },
    ];

    // Must not throw
    const result = await ensureAssetBibleAssets({
      bible,
      brand: { name: "Test Brand" },
      productionId: "prod-test-2",
      contentFormat: "standard",
      existingElements: [],
    });

    assert.equal(result.generated.length, 0);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].tag, "@prop_bad_device");
    assert.ok(result.errors[0].error.includes("GPU out of memory"));
    assert.equal(result.stillMissing.length, 1);
    assert.equal(result.stillMissing[0].tag, "@prop_bad_device");
  } finally {
    ModelRouter.executeCategoryRequest = originalExecute;
  }
});

test("faceless path with empty bible props skips ensure gracefully", async () => {
  const bible: AssetBibleEntry[] = [];

  const result = await ensureAssetBibleAssets({
    bible,
    brand: { name: "Faceless Brand" },
    productionId: "prod-test-3",
    contentFormat: "faceless",
    existingElements: [],
  });

  assert.equal(result.generated.length, 0);
  assert.equal(result.stillMissing.length, 0);
  assert.equal(result.errors.length, 0);
});

test("officialI2vFrames: prop sheet URL is never selected as first frame", async () => {
  const { resolveOfficialShotStill } = await import("../officialI2vFrames");
  const propSheetUrl = "https://example.com/storage/props/prop-sheet-gold-watch.png";
  const validShotStill = "https://example.com/storage/scenes/scene-01-still.png";

  // 1. Check looksLikeSheetOrGridUrl matches prop-sheet and product-sheet
  assert.equal(looksLikeSheetOrGridUrl(propSheetUrl), true);
  assert.equal(looksLikeSheetOrGridUrl("https://example.com/product-sheet-shoes.png"), true);

  // 2. resolveOfficialShotStill must reject prop sheet when passed alone
  const rejectedSolo = resolveOfficialShotStill({
    sceneImage: propSheetUrl,
    forbidden: { sheetUrls: [propSheetUrl] },
  });
  assert.equal(rejectedSolo, undefined, "Prop sheet alone must be rejected as start frame");

  // 3. When prop sheet is first candidate, it must be skipped in favor of the real shot still
  const selectedStill = resolveOfficialShotStill({
    sceneImage: propSheetUrl,
    keyframeUrl: validShotStill,
    forbidden: { sheetUrls: [propSheetUrl] },
  });
  assert.equal(selectedStill, validShotStill, "Must skip prop sheet and select real shot still");

  // 4. resolveOfficialI2vClipFrames must throw if only prop sheet is present
  assert.throws(
    () => {
      resolveOfficialI2vClipFrames({
        sceneImage: propSheetUrl,
        forbidden: { sheetUrls: [propSheetUrl] },
        sceneLabel: "Scene 1",
      });
    },
    /not a grid, sheet, or plate/,
    "Must throw when only a sheet/plate is provided as frame 1"
  );
});

test("ensureAssetBibleAssets strictly respects maxPropGenerations cap", async () => {
  const { ModelRouter } = await import("../../runtime/modelRouter");
  const { ProductionAssetService } = await import("../productionAssetService");

  const originalExecute = ModelRouter.executeCategoryRequest;
  const originalUpload = ProductionAssetService.uploadAssetToStorage;

  let generatedCount = 0;
  ModelRouter.executeCategoryRequest = async () => {
    generatedCount++;
    return `https://test.supabase.co/storage/v1/object/public/Spark/brands/brand-1/prod-1/props/prop-${generatedCount}.png`;
  };
  ProductionAssetService.uploadAssetToStorage = async (params: any) => ({
    publicUrl: `https://test.supabase.co/storage/v1/object/public/Spark/brands/brand-1/prod-1/props/prop-${generatedCount}.png`,
    storagePath: params.storagePath,
    assetId: `pa-${generatedCount}`,
    uploadSuccess: true,
  });

  try {
    const bible: AssetBibleEntry[] = [
      { tag: "@prop_1", role: "prop", sheetKind: "prop", label: "Prop 1", notes: "" },
      { tag: "@prop_2", role: "prop", sheetKind: "prop", label: "Prop 2", notes: "" },
      { tag: "@prop_3", role: "prop", sheetKind: "prop", label: "Prop 3", notes: "" },
      { tag: "@prop_4", role: "prop", sheetKind: "prop", label: "Prop 4", notes: "" },
    ];

    const result = await ensureAssetBibleAssets({
      bible,
      brand: { name: "Test Brand" },
      productionId: "prod-test-cap",
      contentFormat: "standard",
      existingElements: [],
      maxPropGenerations: 2,
    });

    assert.equal(result.generated.length, 2, "Must cap generations at 2");
    assert.equal(result.stillMissing.length, 2, "Remaining 2 must be left in stillMissing");
    assert.equal(result.stillMissing[0].tag, "@prop_3");
    assert.equal(result.stillMissing[1].tag, "@prop_4");
  } finally {
    ModelRouter.executeCategoryRequest = originalExecute;
    ProductionAssetService.uploadAssetToStorage = originalUpload;
  }
});

test("Resume: ensureAssetBibleAssets skips image generation for already-generated durable props", async () => {
  const { ModelRouter } = await import("../../runtime/modelRouter");
  const originalExecute = ModelRouter.executeCategoryRequest;

  let executeCalled = false;
  ModelRouter.executeCategoryRequest = async () => {
    executeCalled = true;
    return "https://test.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/unexpected.png";
  };

  try {
    const existingDurableUrl = "https://test.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/props/tape_recorder.png";
    const bible: AssetBibleEntry[] = [
      {
        tag: "@prop_recorder",
        role: "prop",
        sheetKind: "prop",
        label: "Tape Recorder",
        notes: "Vintage reel recorder",
      },
    ];

    // 1. With existingElements containing the durable prop
    const resultFromElements = await ensureAssetBibleAssets({
      bible,
      brand: { name: "Test Brand" },
      productionId: "prod-resume-1",
      contentFormat: "standard",
      existingElements: [
        {
          tag: "@prop_recorder",
          role: "prop",
          label: "Tape Recorder",
          url: existingDurableUrl,
        },
      ],
    });

    assert.equal(executeCalled, false, "Must NOT call executeCategoryRequest when prop is already in existingElements");
    assert.equal(resultFromElements.generated.length, 0, "No new generation should occur");
    assert.equal(resultFromElements.stillMissing.length, 0, "Prop should not be missing");
    assert.equal(resultFromElements.fulfilled.length, 1);
    assert.equal(resultFromElements.fulfilled[0].url, existingDurableUrl);

    // 2. With knownPropUrls
    executeCalled = false;
    const resultFromKnown = await ensureAssetBibleAssets({
      bible,
      brand: { name: "Test Brand" },
      productionId: "prod-resume-2",
      contentFormat: "standard",
      existingElements: [],
      knownPropUrls: [{ tag: "@prop_recorder", url: existingDurableUrl }],
    });

    assert.equal(executeCalled, false, "Must NOT call executeCategoryRequest when prop is in knownPropUrls");
    assert.equal(resultFromKnown.generated.length, 0);
    assert.equal(resultFromKnown.stillMissing.length, 0);
    assert.equal(resultFromKnown.fulfilled.length, 1);
    assert.equal(resultFromKnown.fulfilled[0].url, existingDurableUrl);
  } finally {
    ModelRouter.executeCategoryRequest = originalExecute;
  }
});

test("Resume: forceRegenerate=true regenerates even if existing assets exist", async () => {
  const { ModelRouter } = await import("../../runtime/modelRouter");
  const { ProductionAssetService } = await import("../productionAssetService");

  const originalExecute = ModelRouter.executeCategoryRequest;
  const originalUpload = ProductionAssetService.uploadAssetToStorage;

  const newUrl = "https://test.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/props/new_recorder.png";
  let executeCount = 0;
  ModelRouter.executeCategoryRequest = async () => {
    executeCount++;
    return newUrl;
  };
  ProductionAssetService.uploadAssetToStorage = async (params: any) => ({
    publicUrl: newUrl,
    storagePath: params.storagePath,
    assetId: "pa-new",
    uploadSuccess: true,
  });

  try {
    const existingDurableUrl = "https://test.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/props/old_recorder.png";
    const bible: AssetBibleEntry[] = [
      {
        tag: "@prop_recorder",
        role: "prop",
        sheetKind: "prop",
        label: "Tape Recorder",
        notes: "Vintage reel recorder",
      },
    ];

    const result = await ensureAssetBibleAssets({
      bible,
      brand: { name: "Test Brand" },
      productionId: "prod-force-1",
      contentFormat: "standard",
      existingElements: [
        {
          tag: "@prop_recorder",
          role: "prop",
          label: "Tape Recorder",
          url: existingDurableUrl,
        },
      ],
      forceRegenerate: true,
    });

    assert.equal(executeCount, 1, "Must call generator when forceRegenerate=true");
    assert.equal(result.generated.length, 1);
    assert.equal(result.generated[0].url, newUrl);
  } finally {
    ModelRouter.executeCategoryRequest = originalExecute;
    ProductionAssetService.uploadAssetToStorage = originalUpload;
  }
});
