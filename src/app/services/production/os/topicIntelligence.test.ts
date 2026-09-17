import assert from "node:assert/strict";
import test from "node:test";
import type { Brand, ResearchSource, ResearchPattern, ViralSpark } from "../../../domain/types";
import {
  planTopics,
  createViralSparksFromTopics,
  isTopicAllowedByNiche,
  deriveFormatSignature,
  collectMustNotCopyTitles,
  type TopicCandidate,
  type PlanTopicsInput,
} from "./topicIntelligence";
import { ModelRouter } from "../../runtime/modelRouter";

const mockBrand: Brand = {
  id: "brand-test-1",
  name: "Apex AI",
  niche: "Artificial Intelligence",
  archetype: "The Expert Guide",
  purpose: "Educate founders on AI tools and workflows",
  contentPillars: [
    { label: "LLM Engineering", active: true },
    { label: "Agentic Workflows", active: true },
    { label: "AI Hardware", active: false },
  ],
  audience: {
    primary: "Software Engineers & Tech Founders",
    painPoints: ["Rapidly changing AI APIs", "Complex orchestration"],
    desires: ["Production-ready AI architectures"],
  },
  tone: [{ label: "Technical", active: true }],
  contentFormat: "Short-form (45–60 sec)",
};

test("isTopicAllowedByNiche allows on-niche topics and drops off-niche topics", () => {
  const onNicheCandidate: TopicCandidate = {
    topic: "Building Autonomous Agents with Local LLMs",
    premise: "Learn how to build local AI agents without cloud lock-in",
    format: "Short-form",
    nicheTag: "Artificial Intelligence",
    rationale: "High search volume among software engineers",
    mustNotCopy: [],
  };

  const offNicheCandidate: TopicCandidate = {
    topic: "Top 5 Sourdough Bread Proofing Techniques",
    premise: "Get the perfect crust every time with cold fermentation",
    format: "Short-form",
    nicheTag: "Culinary & Baking",
    rationale: "Trending home baking hobby",
    mustNotCopy: [],
  };

  // On-niche passes
  assert.equal(
    isTopicAllowedByNiche(onNicheCandidate, "Artificial Intelligence", mockBrand.contentPillars),
    true
  );

  // Pillar match passes (topic mentions LLM)
  const pillarCandidate: TopicCandidate = {
    ...onNicheCandidate,
    nicheTag: "Engineering",
    topic: "LLM Engineering Best Practices",
  };
  assert.equal(
    isTopicAllowedByNiche(pillarCandidate, "Artificial Intelligence", mockBrand.contentPillars),
    true
  );

  // Off-niche rejected
  assert.equal(
    isTopicAllowedByNiche(offNicheCandidate, "Artificial Intelligence", mockBrand.contentPillars),
    false
  );

  // allowOverride allows off-niche
  assert.equal(
    isTopicAllowedByNiche(offNicheCandidate, "Artificial Intelligence", mockBrand.contentPillars, true),
    true
  );
});

test("deriveFormatSignature extracts pacing, hookStyle, and chapterShape from patterns", () => {
  const patterns: ResearchPattern[] = [
    {
      id: "pat-1",
      sourceId: "src-1",
      patternType: "Hook",
      confidence: 0.9,
      originWeight: 0.9,
      title: "Curiosity Gap",
      description: "99% of developers use this tool wrong",
      evidence: "High hook retention",
      metrics: {
        successScore: 92,
        hookFormula: "99% of developers use this tool wrong",
        format: "Problem Context -> Live Demo -> Verdict",
        ctaLine: "Follow for daily architecture breakdowns",
      },
      createdAt: new Date().toISOString(),
    },
  ];

  const sig = deriveFormatSignature(patterns, []);
  assert.equal(sig?.hookStyle, "99% of developers use this tool wrong");
  assert.equal(sig?.chapterShape, "Problem Context -> Live Demo -> Verdict");
  assert.match(sig?.pacing || "", /Follow for daily architecture breakdowns/);
});

test("collectMustNotCopyTitles gathers titles from recentVideos and videoResearch", () => {
  const sources: ResearchSource[] = [
    {
      id: "src-brightside",
      platform: "youtube",
      url: "https://youtube.com/@brightside",
      username: "brightside",
      displayName: "Bright Side",
      metricsAvailability: "available",
      status: "active",
      createdAt: new Date().toISOString(),
      recentVideos: [
        { videoId: "v1", title: "10 Hidden Places on Earth No One Is Allowed to Visit", publishedAt: "2026-01-01" },
        { videoId: "v2", title: "What Happens If You Don't Sleep for 7 Days", publishedAt: "2026-01-02" },
      ],
      videoResearch: {
        videoId: "v3",
        platform: "youtube",
        title: "Why The Ocean Is Deeper Than You Think",
        url: "https://youtube.com/watch?v=v3",
        hookAnalysis: "Scale comparison",
      },
    },
  ];

  const titles = collectMustNotCopyTitles(sources);
  assert.equal(titles.length, 3);
  assert.ok(titles.includes("10 Hidden Places on Earth No One Is Allowed to Visit"));
  assert.ok(titles.includes("What Happens If You Don't Sleep for 7 Days"));
  assert.ok(titles.includes("Why The Ocean Is Deeper Than You Think"));
});

test("planTopics respects count cap (max 5 default, max 8 calendar) and applies niche lock", async () => {
  const originalExecute = ModelRouter.executeCategoryRequest;

  // Mock ModelRouter returning 10 candidates (some on-niche, some off-niche)
  ModelRouter.executeCategoryRequest = async () => {
    return JSON.stringify([
      {
        topic: "AI Agent Architecture 2026",
        premise: "How modern autonomous agents maintain long-term memory",
        format: "Short-form",
        nicheTag: "Artificial Intelligence",
        rationale: "Trending developer pain point",
        estRpmBand: "$6-$10",
        searchVolumeRank: 95,
      },
      {
        topic: "How to Bake Italian Ciabatta", // OFF-NICHE
        premise: "Secrets to high hydration dough",
        format: "Short-form",
        nicheTag: "Cooking & Baking",
        rationale: "Popular home cooking topic",
        estRpmBand: "$2-$4",
        searchVolumeRank: 70,
      },
      {
        topic: "Fine-tuning DeepSeek Locally",
        premise: "Step by step local quantization and fine-tuning",
        format: "Short-form",
        nicheTag: "Artificial Intelligence",
        rationale: "High demand for open weights",
        estRpmBand: "$7-$12",
        searchVolumeRank: 90,
      },
      {
        topic: "MCP Servers Explained for Developers",
        premise: "Connect tools to your LLM using Model Context Protocol",
        format: "Short-form",
        nicheTag: "Artificial Intelligence",
        rationale: "Emerging protocol standard",
        estRpmBand: "$8-$14",
        searchVolumeRank: 92,
      },
      {
        topic: "Why Context Windows Kill Reasoning",
        premise: "Why more context doesn't always mean smarter outputs",
        format: "Short-form",
        nicheTag: "Artificial Intelligence",
        rationale: "Counter-intuitive insight",
        estRpmBand: "$5-$9",
        searchVolumeRank: 88,
      },
      {
        topic: "Vector Databases vs Graph RAG",
        premise: "When graph structures beat vector embeddings",
        format: "Short-form",
        nicheTag: "Artificial Intelligence",
        rationale: "Technical debate among practitioners",
        estRpmBand: "$8-$15",
        searchVolumeRank: 94,
      },
      {
        topic: "Evaluation Frameworks for Production LLMs",
        premise: "How to unit test non-deterministic models",
        format: "Short-form",
        nicheTag: "Artificial Intelligence",
        rationale: "Enterprise readiness demand",
        estRpmBand: "$9-$16",
        searchVolumeRank: 91,
      },
      {
        topic: "Low-Latency Voice Pipelines",
        premise: "Under 300ms speech-to-speech architecture",
        format: "Short-form",
        nicheTag: "Artificial Intelligence",
        rationale: "Real-time AI adoption surge",
        estRpmBand: "$6-$11",
        searchVolumeRank: 89,
      },
      {
        topic: "Prompt Injection Defense in Depth",
        premise: "Security hardening for customer-facing agents",
        format: "Short-form",
        nicheTag: "Artificial Intelligence",
        rationale: "Critical security requirement",
        estRpmBand: "$7-$13",
        searchVolumeRank: 87,
      },
    ]);
  };

  try {
    // 1. Default count = 5
    const standardPlan = await planTopics({ brand: mockBrand });
    assert.equal(standardPlan.length, 5);
    // Cooking candidate was dropped
    assert.ok(!standardPlan.some((c) => c.topic.includes("Ciabatta")));
    assert.ok(standardPlan.every((c) => c.nicheTag === "Artificial Intelligence"));

    // 2. Calendar mode count = 8
    const calendarPlan = await planTopics({ brand: mockBrand, count: 8 });
    assert.equal(calendarPlan.length, 8);
    assert.ok(!calendarPlan.some((c) => c.topic.includes("Ciabatta")));

    // 3. Requested count = 20 -> hard capped to 8
    const cappedPlan = await planTopics({ brand: mockBrand, count: 20 });
    assert.equal(cappedPlan.length, 8);
  } finally {
    ModelRouter.executeCategoryRequest = originalExecute;
  }
});

test("createViralSparksFromTopics writes deduplicated ViralSparks with format signatures", async () => {
  const candidates: TopicCandidate[] = [
    {
      topic: "AI Agent Architecture 2026",
      premise: "How modern autonomous agents maintain long-term memory",
      format: "Short-form (45–60 sec)",
      nicheTag: "Artificial Intelligence",
      rationale: "Trending developer pain point",
      referenceChannel: "https://youtube.com/@aiexplained",
      formatSignature: {
        pacing: "Fast dynamic cuts",
        hookStyle: "99% of developers build agents wrong",
        chapterShape: "Hook -> Deep Dive -> Benchmark",
      },
      mustNotCopy: ["Old Video 1"],
    },
    {
      topic: "Local LLM Fine-tuning",
      premise: "Step by step local quantization",
      format: "Short-form (45–60 sec)",
      nicheTag: "Artificial Intelligence",
      rationale: "Open source models surge",
      mustNotCopy: [],
    },
  ];

  const existingSourceSpark: ViralSpark = {
    id: "spk-vid-source1",
    title: "Watched Video Adaptation",
    hook: "The reason your code broke today",
    views: "10,000",
    velocity: "Rising",
    platformFit: "YouTube Shorts",
    brandFitScore: 90,
    category: "rising",
    timeWindow: "Immediate Opportunity",
    productionTime: "10 mins",
    whyNow: "Breaking API change",
    angle: "Fixing bugs fast",
    audienceEmotion: "Urgency",
    expectedRetention: "80%",
    difficulty: "Low",
    riskLevel: "Low",
    suggestedFormat: "Short-form",
    suggestedProductionMode: "express",
    origin: "SOURCE",
    fingerprint: "fp-source-1",
    status: "ready",
  };

  const result = await createViralSparksFromTopics(candidates, mockBrand, {
    existingSparks: [existingSourceSpark],
  });

  assert.equal(result.created.length, 2);
  assert.equal(result.skipped, 0);

  // Spark 1 has referenceChannel -> origin HYBRID
  const spark1 = result.created[0];
  assert.equal(spark1.origin, "HYBRID");
  assert.equal(spark1.title, "AI Agent Architecture 2026");
  assert.equal(spark1.researchContext?.sourceName, "https://youtube.com/@aiexplained");
  assert.equal(spark1.researchContext?.hookPattern, "99% of developers build agents wrong");
  assert.equal(spark1.status, "draft");
  assert.ok(spark1.fingerprint);

  // Spark 2 has no referenceChannel -> origin TREND
  const spark2 = result.created[1];
  assert.equal(spark2.origin, "TREND");
  assert.equal(spark2.title, "Local LLM Fine-tuning");

  // Rerunning with the newly created sparks should skip duplicates
  const rerun = await createViralSparksFromTopics(candidates, mockBrand, {
    existingSparks: [existingSourceSpark, ...result.created],
  });
  assert.equal(rerun.created.length, 0);
  assert.equal(rerun.skipped, 2);

  // Existing SOURCE spark remains untouched
  assert.equal(existingSourceSpark.origin, "SOURCE");
});
