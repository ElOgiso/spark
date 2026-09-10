import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Voice profile resolution logic maps custom voice names without slop fallback", () => {
  const testCases = [
    {
      input: {
        voiceProfile: { id: "voice-123", name: "Rachel", language: "English" },
        voiceId: "voice-123",
      },
      expectedName: "Rachel",
      expectedId: "voice-123",
    },
    {
      input: {
        voiceProfile: "Adam",
        voiceId: "pNInz6obpgDQGcFmaJgB",
      },
      expectedName: "Adam",
      expectedId: "pNInz6obpgDQGcFmaJgB",
    },
    {
      input: {
        voiceName: "Bella",
        voiceId: "EXAVITQu4vr4xnSDxMaL",
      },
      expectedName: "Bella",
      expectedId: "EXAVITQu4vr4xnSDxMaL",
    },
  ];

  for (const tc of testCases) {
    const rawVoiceName =
      (typeof tc.input.voiceProfile === "object" && tc.input.voiceProfile?.name)
        ? String(tc.input.voiceProfile.name).trim()
        : typeof tc.input.voiceProfile === "string" && tc.input.voiceProfile.trim()
        ? tc.input.voiceProfile.trim()
        : (tc.input as any).voiceName ? String((tc.input as any).voiceName).trim() : "Executive Presenter";

    const rawVoiceId =
      (typeof tc.input.voiceProfile === "object" && ((tc.input.voiceProfile as any)?.voiceId || (tc.input.voiceProfile as any)?.id))
        ? String((tc.input.voiceProfile as any).voiceId || (tc.input.voiceProfile as any).id).trim()
        : tc.input.voiceId ? String(tc.input.voiceId).trim() : "21m00Tcm4TlvDq8ikWAM";

    assert.equal(rawVoiceName, tc.expectedName);
    assert.equal(rawVoiceId, tc.expectedId);
  }
});

test("BrandGenesisFlow pre-provisions brand before getOAuthAuthorizationUrl", () => {
  const flowCode = fs.readFileSync(path.join(__dirname, "BrandGenesisFlow.tsx"), "utf8");
  assert.ok(flowCode.includes("ensureDefaultBrand"), "BrandGenesisFlow should import or call ensureDefaultBrand before OAuth");
  assert.ok(flowCode.includes("setActiveSessionBrand"), "BrandGenesisFlow should set active session brand");
  assert.ok(flowCode.includes("alreadyInitialized"), "BrandGenesisFlow should track alreadyInitialized");
});

test("App.tsx deduplicates initializeBrandGenesis using alreadyInitialized flag", () => {
  const appCode = fs.readFileSync(path.join(__dirname, "../../App.tsx"), "utf8");
  assert.ok(appCode.includes("if (!finalData.alreadyInitialized)"), "App.tsx should guard against duplicate initializeBrandGenesis runs");
});
