import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compileCharacterFromGenreFoundation,
  formatIdentityBlock,
  foundationContainsForbiddenIdentity,
} from "./compileCharacterFromGenreFoundation";
import { normalizeCharacterGenre } from "../../domain/characterGenre";
import { buildProductionCharacterSheetPrompt } from "./characterSheetPrompt";

describe("character genre catalog", () => {
  it("normalizes typed aliases to catalog ids", () => {
    assert.equal(normalizeCharacterGenre("3d"), "pixel_3d");
    assert.equal(normalizeCharacterGenre("PIXAR"), "pixel_3d");
    assert.equal(normalizeCharacterGenre("cgi"), "pixel_3d");
    assert.equal(normalizeCharacterGenre("photoreal"), "realistic");
    assert.equal(normalizeCharacterGenre("anime"), "anime");
    assert.equal(normalizeCharacterGenre("3D Cartoon"), "pixel_3d");
  });
});

describe("identity-free foundations", () => {
  it("never embeds the old look-alike sample person", () => {
    for (const genre of ["Realistic", "Cinematic", "3D", "Anime"]) {
      const compiled = compileCharacterFromGenreFoundation({ genre });
      assert.equal(foundationContainsForbiddenIdentity(compiled.portraitPrompt), false, genre);
      assert.equal(foundationContainsForbiddenIdentity(compiled.sheetPrompt), false, genre);
      assert.doesNotMatch(compiled.portraitPrompt, /Korean woman/i);
      assert.doesNotMatch(compiled.portraitPrompt, /oatmeal/i);
      assert.doesNotMatch(compiled.portraitPrompt, /Seoul/i);
    }
  });

  it("keeps identity in CHANGE slots only", () => {
    const compiled = compileCharacterFromGenreFoundation({
      genre: "3D",
      identity: {
        name: "Ada",
        age: "late 20s",
        gender: "woman",
        ethnicity: "West African",
        hair: "short natural black hair",
        wardrobe: "cream knit and grey trousers",
      },
    });
    assert.match(compiled.sheetPrompt, /CHARACTER IDENTITY — USER DECIDES/);
    assert.match(compiled.sheetPrompt, /West African/);
    assert.match(compiled.sheetPrompt, /short natural black hair/);
    assert.match(compiled.sheetPrompt, /MEDIUM LOCK: Feature-CGI/);
    assert.match(compiled.sheetPrompt, /Moodboard images are STYLE \/ MEDIUM/);
    assert.equal(compiled.genreLabel, "3D");
  });

  it("does not invent identity when slots are empty", () => {
    const block = formatIdentityBlock({});
    assert.match(block, /No identity variables were supplied/);
    assert.match(block, /Do not invent a celebrity/);
  });

  it("uses library 3-view geometry by default", () => {
    const compiled = compileCharacterFromGenreFoundation({
      genre: "Realistic",
      identity: { name: "Santiago" },
    });
    assert.match(compiled.sheetPrompt, /Panel 1 \(left third\): full body/i);
    assert.match(compiled.sheetPrompt, /true 90-degree side profile, MEDIUM bust/i);
    assert.match(compiled.sheetPrompt, /frontal MEDIUM bust facing camera/i);
    assert.doesNotMatch(compiled.sheetPrompt, /Panel 2: BACK full-body/);
  });
});

describe("buildProductionCharacterSheetPrompt — identity-free compile", () => {
  it("locks medium and identity ownership without a baked look-alike", () => {
    const prompt = buildProductionCharacterSheetPrompt({
      creatorName: "Rival",
      role: "support",
      genre: "Anime",
      purpose: "Antagonist for confrontation",
      brandName: "SPARK",
    });
    assert.match(prompt, /Anime/);
    assert.match(prompt, /MEDIUM LOCK/);
    assert.match(prompt, /owns identity/i);
    assert.doesNotMatch(prompt, /Korean woman/i);
    assert.match(prompt, /90-degree side profile/i);
  });

  it("keeps full_turnaround_multiview as a separate recipe", () => {
    const prompt = buildProductionCharacterSheetPrompt({
      creatorName: "Santiago",
      genre: "Cinematic",
      layoutStyle: "full_turnaround_multiview",
    });
    assert.match(prompt, /FRONT, 3\/4 FRONT, LEFT, RIGHT, BACK/);
  });
});
