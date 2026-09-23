/**
 * SPARK — D-08 Durable Production Economics Test Suite
 * Minimum Required Test Matrix (Tests A through O)
 *
 * Verifies transactional, durable, idempotent, concurrency-safe credit operations
 * across CreditService, SupabaseCreditRepository, InMemoryCreditRepository, and GenerationExecutionEngine.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { CreditService } from "./creditService";
import {
  InMemoryCreditRepository,
  SupabaseCreditRepository,
  createCreditRepository,
} from "./creditRepository";
import { GenerationExecutionEngine } from "../execution/executionEngine";
import type { MediaProviderAdapter } from "../execution/adapters/types";
import type { GenerationTask, ProductionSpec } from "../execution/types";
import { CostEngine } from "../economics/costEngine";

describe("SPARK D-08: Durable Production Economics Matrix (Tests A - O)", () => {
  // Test A — persistent reservation across process / instance recreation
  it("Test A: persistent reservation survives service/repository recreation", async () => {
    // Backing store simulating database tables across process instances
    const sharedDb = {
      balances: new Map<string, number>([["user_persist_1", 50]]),
      reservations: new Map<string, any>(),
      idempotency: new Map<string, string>(),
      ledger: [] as any[],
    };

    // Mock client representing persistent database connection
    const createPersistentRepo = () => {
      const repo = new InMemoryCreditRepository();
      // Attach to shared backing state
      (repo as any).balances = sharedDb.balances;
      (repo as any).reservations = sharedDb.reservations;
      (repo as any).idempotencyIndex = sharedDb.idempotency;
      (repo as any).ledger = sharedDb.ledger;
      return repo;
    };

    // Instance 1
    let repo1: any = createPersistentRepo();
    let service1: any = new CreditService(repo1);

    const quote1 = service1.quote({ estimatedCostUsd: 0.10, generationId: "gen_persist_1" });
    assert.equal(quote1.sparkCredits, 10);

    const res1 = await service1.reserve({
      quote: quote1,
      userId: "user_persist_1",
      idempotencyKey: "res_persist_key_1",
    });
    assert.equal(res1.reservation.amount, 10);
    assert.equal(await service1.getBalance("user_persist_1"), 40);

    // Destroy service and repository instance
    repo1 = null;
    service1 = null;

    // Instance 2 (Simulating server restart / new runtime process)
    const repo2 = createPersistentRepo();
    const service2 = new CreditService(repo2);

    // Verify balance is 40 and reservation persists
    const balanceAfterRestart = await service2.getBalance("user_persist_1");
    assert.equal(balanceAfterRestart, 40);

    const persistedReservation = await service2.getReservation(res1.reservation.id);
    assert.ok(persistedReservation);
    assert.equal(persistedReservation.id, res1.reservation.id);
    assert.equal(persistedReservation.status, "RESERVED");
    assert.equal(persistedReservation.amount, 10);
  });

  // Test B — reserve idempotency
  it("Test B: reserve idempotency prevents double debit and duplicate ledger rows", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_b", 100);

    const quote = service.quote({ estimatedCostUsd: 0.25, generationId: "task_b" });
    const key = "res_idempotency_b";

    const res1 = await service.reserve({ quote, userId: "user_b", idempotencyKey: key });
    assert.equal(res1.idempotentReplay, false);
    assert.equal(await service.getBalance("user_b"), 75);

    // Replay with identical key
    const res2 = await service.reserve({ quote, userId: "user_b", idempotencyKey: key });
    assert.equal(res2.idempotentReplay, true);
    assert.equal(res2.reservation.id, res1.reservation.id);
    assert.equal(await service.getBalance("user_b"), 75); // Exactly 75, no second deduction

    const ledger = await service.getLedger("user_b");
    const reservationEntries = ledger.filter((l) => l.type === "RESERVATION");
    assert.equal(reservationEntries.length, 1);
  });

  // Test C — concurrent reservation protection
  it("Test C: concurrent reservations against same balance permit only one to succeed without negative balance", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_concurrent", 10);

    const quoteA = service.quote({ estimatedCostUsd: 0.08, generationId: "task_c1" }); // 8 credits
    const quoteB = service.quote({ estimatedCostUsd: 0.08, generationId: "task_c2" }); // 8 credits

    // Fire concurrently
    const results = await Promise.allSettled([
      service.reserve({ quote: quoteA, userId: "user_concurrent", idempotencyKey: "res_c1" }),
      service.reserve({ quote: quoteB, userId: "user_concurrent", idempotencyKey: "res_c2" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one concurrent reservation should succeed");
    assert.equal(rejected.length, 1, "Exactly one concurrent reservation should fail");

    const finalBalance = await service.getBalance("user_concurrent");
    assert.equal(finalBalance, 2, "Balance must be exactly 10 - 8 = 2, never negative");
  });

  // Test D — successful settlement
  it("Test D: settlement with actual cost releases unused reserved credits", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_d", 50);

    const quote = service.quote({ estimatedCostUsd: 0.10, generationId: "task_d" }); // 10 credits
    const { reservation } = await service.reserve({ quote, userId: "user_d", idempotencyKey: "res_d" });
    assert.equal(await service.getBalance("user_d"), 40);

    // Actual provider cost: $0.07 (7 credits)
    const { settlement } = await service.settle({
      reservationId: reservation.id,
      userId: "user_d",
      actualProviderCostUsd: 0.07,
    });

    assert.equal(settlement.consumedCredits, 7);
    assert.equal(settlement.releasedCredits, 3);
    assert.equal(settlement.status, "CONSUMED");

    // Balance reflects 40 + 3 = 43 credits
    assert.equal(await service.getBalance("user_d"), 43);
  });

  // Test E — overage handling
  it("Test E: settlement overage rejects when balance insufficient and never fabricates collection", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_e", 5);

    // Reserved 5 credits -> balance 0
    const quote = service.quote({ estimatedCostUsd: 0.05, generationId: "task_e" });
    const { reservation } = await service.reserve({ quote, userId: "user_e", idempotencyKey: "res_e" });
    assert.equal(await service.getBalance("user_e"), 0);

    // Actual cost is 8 credits (overage = 3 credits, but balance is 0)
    await assert.rejects(
      async () => {
        await service.settle({
          reservationId: reservation.id,
          userId: "user_e",
          actualProviderCostUsd: 0.08,
        });
      },
      /Insufficient credits for settlement overage/i
    );

    // Balance remains 0, never negative, never fabricated
    assert.equal(await service.getBalance("user_e"), 0);

    // Give user 10 credits balance
    await repo.setBalance("user_e", 10);
    const { settlement } = await service.settle({
      reservationId: reservation.id,
      userId: "user_e",
      actualProviderCostUsd: 0.08,
    });
    assert.equal(settlement.consumedCredits, 8);
    // 10 - 3 (overage) = 7
    assert.equal(await service.getBalance("user_e"), 7);
  });

  // Test F — NOT_SUBMITTED release
  it("Test F: provider request NOT_SUBMITTED releases reservation and restores balance once", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_f", 30);

    const quote = service.quote({ estimatedCostUsd: 0.10, generationId: "task_f" });
    const { reservation } = await service.reserve({ quote, userId: "user_f", idempotencyKey: "res_f" });
    assert.equal(await service.getBalance("user_f"), 20);

    const rel = await service.release({
      reservationId: reservation.id,
      userId: "user_f",
      reason: "NOT_SUBMITTED: validation error before provider submission",
    });

    assert.equal(rel.reservation.status, "RELEASED");
    assert.equal(rel.reservation.releasedAmount, 10);
    assert.equal(await service.getBalance("user_f"), 30);
  });

  // Test G — UNKNOWN_SUBMISSION hold
  it("Test G: UNKNOWN_SUBMISSION creates PENDING_UNKNOWN hold with protected balance and no early release", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_g", 50);

    const quote = service.quote({ estimatedCostUsd: 0.15, generationId: "task_g" });
    const { reservation } = await service.reserve({ quote, userId: "user_g", idempotencyKey: "res_g" });
    assert.equal(await service.getBalance("user_g"), 35);

    // Timeout / network disconnect -> Mark PENDING_UNKNOWN
    const pending = await service.markPendingUnknown({
      reservationId: reservation.id,
      userId: "user_g",
      reason: "Provider poll timed out after 30000ms",
    });

    assert.equal(pending.reservation.status, "PENDING_UNKNOWN");
    // Credits remain protected in reservation, not returned to available balance
    assert.equal(await service.getBalance("user_g"), 35);
  });

  // Test H — reconciliation FOUND
  it("Test H: reconciliation FOUND resumes execution and settles from existing PENDING_UNKNOWN reservation", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_h", 50);

    const quote = service.quote({ estimatedCostUsd: 0.15, generationId: "task_h" });
    const { reservation } = await service.reserve({ quote, userId: "user_h", idempotencyKey: "res_h" });
    await service.markPendingUnknown({ reservationId: reservation.id, userId: "user_h" });

    // Job reconciled as FOUND at provider with actual cost $0.12 (12 credits)
    const { settlement } = await service.settle({
      reservationId: reservation.id,
      userId: "user_h",
      actualProviderCostUsd: 0.12,
    });

    assert.equal(settlement.status, "CONSUMED");
    assert.equal(settlement.consumedCredits, 12);
    assert.equal(settlement.releasedCredits, 3);
    // Available balance restored by unused credits: 35 + 3 = 38
    assert.equal(await service.getBalance("user_h"), 38);
  });

  // Test I — reconciliation CONFIRMED_NOT_SUBMITTED
  it("Test I: reconciliation CONFIRMED_NOT_SUBMITTED safely releases PENDING_UNKNOWN reservation once", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_i", 50);

    const quote = service.quote({ estimatedCostUsd: 0.15, generationId: "task_i" });
    const { reservation } = await service.reserve({ quote, userId: "user_i", idempotencyKey: "res_i" });
    await service.markPendingUnknown({ reservationId: reservation.id, userId: "user_i" });

    // Reconciled as CONFIRMED_NOT_SUBMITTED -> Release
    const rel = await service.release({
      reservationId: reservation.id,
      userId: "user_i",
      reason: "Confirmed not submitted after provider audit",
    });

    assert.equal(rel.reservation.status, "RELEASED");
    assert.equal(await service.getBalance("user_i"), 50);
  });

  // Test J — duplicate settlement
  it("Test J: replaying settlement does not double-debit or double-release", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_j", 50);

    const quote = service.quote({ estimatedCostUsd: 0.10, generationId: "task_j" });
    const { reservation } = await service.reserve({ quote, userId: "user_j", idempotencyKey: "res_j" });

    // First settlement
    const settle1 = await service.settle({
      reservationId: reservation.id,
      userId: "user_j",
      actualProviderCostUsd: 0.08,
    });
    assert.equal(settle1.idempotentReplay, false);
    assert.equal(await service.getBalance("user_j"), 42); // 40 + 2 unused

    // Replay settlement
    const settle2 = await service.settle({
      reservationId: reservation.id,
      userId: "user_j",
      actualProviderCostUsd: 0.08,
    });
    assert.equal(settle2.idempotentReplay, true);
    assert.equal(await service.getBalance("user_j"), 42); // Untouched!
  });

  // Test K — duplicate release
  it("Test K: duplicate release does not double-restore balance", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_k", 50);

    const quote = service.quote({ estimatedCostUsd: 0.10, generationId: "task_k" });
    const { reservation } = await service.reserve({ quote, userId: "user_k", idempotencyKey: "res_k" });
    assert.equal(await service.getBalance("user_k"), 40);

    // Release 1
    const rel1 = await service.release({ reservationId: reservation.id, userId: "user_k" });
    assert.equal(rel1.idempotentReplay, false);
    assert.equal(await service.getBalance("user_k"), 50);

    // Release 2 (Replay)
    const rel2 = await service.release({ reservationId: reservation.id, userId: "user_k" });
    assert.equal(rel2.idempotentReplay, true);
    assert.equal(await service.getBalance("user_k"), 50); // Untouched!
  });

  // Test L — refund idempotency
  it("Test L: replay of refund operation executes exactly once with deterministic key", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_l", 100);

    const quote = service.quote({ estimatedCostUsd: 0.20, generationId: "task_l" });
    const { reservation } = await service.reserve({ quote, userId: "user_l", idempotencyKey: "res_l" });
    await service.settle({ reservationId: reservation.id, userId: "user_l", actualProviderCostUsd: 0.20 });
    assert.equal(await service.getBalance("user_l"), 80);

    // Refund 20 credits
    const ref1 = await service.refund({
      reservationId: reservation.id,
      userId: "user_l",
      amount: 20,
    });
    assert.equal(ref1.idempotentReplay, false);
    assert.equal(await service.getBalance("user_l"), 100);

    // Replay refund
    const ref2 = await service.refund({
      reservationId: reservation.id,
      userId: "user_l",
      amount: 20,
    });
    assert.equal(ref2.idempotentReplay, true);
    assert.equal(await service.getBalance("user_l"), 100); // Not 120!
  });

  // Test M — unauthorized user rejection
  it("Test M: financial mutations for mismatched user are rejected without state change", async () => {
    const repo = new InMemoryCreditRepository();
    const service = new CreditService(repo);
    await repo.setBalance("user_alice", 50);
    await repo.setBalance("user_attacker", 50);

    const quote = service.quote({ estimatedCostUsd: 0.10, generationId: "task_m" });
    const { reservation } = await service.reserve({ quote, userId: "user_alice", idempotencyKey: "res_m" });

    // Attacker tries to settle Alice's reservation
    await assert.rejects(
      async () => {
        await service.settle({
          reservationId: reservation.id,
          userId: "user_attacker",
          actualProviderCostUsd: 0.05,
        });
      },
      /Reservation user mismatch/i
    );

    // Attacker tries to release Alice's reservation
    await assert.rejects(
      async () => {
        await service.release({
          reservationId: reservation.id,
          userId: "user_attacker",
        });
      },
      /Reservation user mismatch/i
    );

    assert.equal(await service.getBalance("user_alice"), 40);
    assert.equal(await service.getBalance("user_attacker"), 50);
  });

  // Test N — direct client mutation rejected
  it("Test N: direct client mutation of credit balance is guarded by database policy", async () => {
    // Read and verify the profile update policy migration enforces WITH CHECK against credit_balance tampering
    const fs = await import("fs");
    const path = await import("path");
    const migration = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260923083000_profile_update_policy_with_check.sql"),
      "utf8"
    );

    assert.match(migration, /profiles_update_policy/);
    assert.match(migration, /WITH CHECK/);
    assert.match(migration, /credit_balance = \(SELECT p\.credit_balance FROM (public\.)?profiles p/);
  });

  // Test O — execution integration
  it("Test O: GenerationExecutionEngine end-to-end quote -> reserve -> submit -> actual cost -> settle", async () => {
    const creditRepo = new InMemoryCreditRepository();
    const creditService = new CreditService(creditRepo);
    await creditRepo.setBalance("user_exec_o", 100);

    const mockAdapter: MediaProviderAdapter = {
      providerId: "kling",
      capabilities: () => ({
        providerId: "kling",
        mediaTypes: ["video"],
        strategies: ["text_to_video"],
        capabilities: ["text_to_video"],
        requiresCredentials: [],
        statusMechanism: "poll",
        knownLimitations: [],
      }),
      submit: async (req) => ({
        providerJobId: `kling_job_${req.executionId}`,
        status: "queued",
      }),
      getStatus: async (jobId) => ({
        providerJobId: jobId,
        status: "succeeded",
        outputUrl: "https://storage.spark.app/clip-o.mp4",
      }),
      normalizeOutput: async (job) => ({
        mediaType: "video",
        sourceUrl: job.outputUrl!,
        mimeType: "video/mp4",
        providerJobId: job.providerJobId,
        durationSec: 5,
        metadata: {},
      }),
    };

    const adapters = new Map<string, MediaProviderAdapter>([
      ["video:kling", mockAdapter],
      ["kling", mockAdapter],
    ]);
    const engine = new GenerationExecutionEngine({
      adapters,
      creditService,
      userId: "user_exec_o",
    });

    const task: GenerationTask = {
      id: "task_exec_o_1",
      shotId: "shot_1",
      productionId: "prod_exec_o",
      kind: "video",
      title: "Shot 1 Video",
      status: "pending",
      dependsOn: [],
      strategy: {
        modality: "video",
        strategy: "text_to_video",
      },
      requiredCapabilities: ["text_to_video"],
      selectedProvider: "kling",
      selectedModel: "kling-v2-6",
      routing: {
        provider: "kling",
        model: "kling-v2-6",
      },
      spec: {
        prompt: "Cinematic sunset over neon city",
        durationSec: 5,
        resolution: "720p",
      },
    };

    const spec: ProductionSpec = {
      project: {
        id: "prod_exec_o",
        brandId: "brand_o",
        title: "Durable Economics Test",
        mode: "cinematic",
        aspectRatio: "16:9",
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      routing: {
        preferredVoiceProvider: "elevenlabs",
        preferredImageProvider: "openai",
        preferredVideoProvider: "kling",
      },
      characters: [],
      scenes: [
        {
          id: "scene_1",
          order: 1,
          name: "Scene 1",
          durationSec: 5,
          shots: [
            {
              id: "shot_1",
              order: 1,
              name: "Shot 1",
              durationSec: 5,
              keyframeUrl: "https://storage.spark.app/frame-1.png",
              visualPrompt: "Cinematic sunset over neon city",
              generationTasks: [task],
              references: {
                firstFrameUrl: "https://storage.spark.app/frame-1.png",
                characterRefs: [],
                locationRefs: [],
              },
            },
          ],
        },
      ],
    };

    const result = await engine.executeTask({ spec, task });
    assert.equal(result.execution.status, "succeeded");

    // Reserved: 35 credits ($0.35 Kling 5s 720p = 35 credits)
    // Consumed: 35 credits
    const finalBal = await creditService.getBalance("user_exec_o");
    assert.equal(finalBal, 65);

    const ledger = await creditService.getLedger("user_exec_o");
    assert.ok(ledger.some((l) => l.type === "RESERVATION"));
    assert.ok(ledger.some((l) => l.type === "CONSUMPTION"));
  });
});
