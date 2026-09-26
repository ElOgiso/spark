import assert from "node:assert/strict";
import test from "node:test";
import { compileCharacterFoundations } from "./characterFoundations";
import { buildProductionCharacterSheetPrompt } from "./characterSheetPrompt";
import { normalizeCharacterGenre, visualGenreFromCharacterGenre } from "../../domain/characterGenre";
import { CONTENT_FORMAT_OPTIONS, normalizeContentFormat } from "../../domain/contentFormat";

test("character genre aliases normalize without becoming formats", () => {
  assert.equal(normalizeCharacterGenre("3d"), "3D");
  assert.equal(normalizeCharacterGenre("pixar"), "3D");
  assert.equal(normalizeCharacterGenre("photoreal"), "Realistic");
  assert.equal(normalizeCharacterGenre("anime"), "Anime");
  assert.equal(visualGenreFromCharacterGenre("3D"), "cartoon_3d");
  assert.equal(visualGenreFromCharacterGenre("Anime"), "anime");
});

test("format catalog does not include look words", () => {
  const ids = CONTENT_FORMAT_OPTIONS.map((o) => o.id);
  assert.ok(ids.includes("ugc"));
  assert.ok(ids.includes("ads"));
  assert.ok(ids.includes("explainer"));
  assert.ok(!ids.includes("anime"));
  assert.equal(normalizeContentFormat("anime"), "story");
  assert.equal(normalizeContentFormat("ugc"), "ugc");
});

test("3D foundation keeps identity and uses 3D medium lock", () => {
  const compiled = compileCharacterFoundations({
    name: "Ada",
    genre: "3D",
    skinTone: "Rich Brown",
    hairStyle: "Short Crop",
    identityImageUrl: "https://example.com/ada.jpg",
  });
  assert.equal(compiled.genreId, "3D");
  assert.match(compiled.mediumLock, /3D|CGI|pixel/i);
  assert.match(compiled.identityLock, /Short Crop/);
  assert.match(compiled.identityLock, /Rich Brown/);
  assert.match(compiled.identityLock, /Ada/);
  assert.match(compiled.identityLock, /KEEP CHARACTER FEATURES/);
  assert.match(compiled.identityLock, /face/i);
  assert.match(compiled.portraitPrompt, /KEEP THE ENGINE/);
  assert.match(compiled.sheetPrompt, /Three-panel character reference sheet/);
  assert.match(compiled.sheetPrompt, /true 90-degree side profile/);
  assert.ok(compiled.referenceImageUrls.includes("https://example.com/ada.jpg"));
  assert.ok(!/rewrite the production logic/i.test(compiled.sheetPrompt));
});

test("sheet compiler keeps 3-view geometry", () => {
  const prompt = buildProductionCharacterSheetPrompt({
    creatorName: "Maya",
    genre: "Realistic",
    hairStyle: "Braids / Locs",
    identityImageUrl: "https://example.com/maya.jpg",
  });
  assert.match(prompt, /Three-panel character reference sheet/);
  assert.match(prompt, /IDENTITY LOCK/);
  assert.match(prompt, /Braids \/ Locs/);
});
