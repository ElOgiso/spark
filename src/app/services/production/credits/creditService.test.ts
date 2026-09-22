/**
 * SPARK — Phase 8 / Phase 9
 * CreditService and InMemoryCreditRepository Unit Tests
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { CreditService } from "./creditService";
import { InMemoryCreditRepository } from "./creditRepository";
import { convertUsdToCredits } from "./pricingPolicy";

describe("SPARK CreditService & Reservation System", () => {
  let repo: InMemoryCreditRepository;
  let service: CreditService;

  beforeEach(() => {
    repo = new InMemoryCreditRepository();
    service = new CreditService(repo);
  });

  it("1. Quote calculates credits according to 100 credits/$1 USD with ceiling rounding", () => {
    // Exact
    assert.equal(convertUsdToCredits(0.35), 35);
    assert.equal(convertUsdToCredits(1.0), 100);

    // Fractional ceiling
    assert.equal(convertUsdToCredits(0.001), 1);
    assert.equal(convertUsdToCredits(0.005), 1);
    assert.equal(convertUsdToCredits(0.011), 2);

    // Zero
    assert.equal(convertUsdToCredits(0), 0);

    const quote = service.quote({ estimatedCostUsd: 0.35, generationId: "gen_1" });
    assert.equal(quote.sparkCredits, 35);
    assert.equal(quote.pricingPolicyVersion, "spark-credit-v1.0");
  });

  it("2. Atomic reservation deducts balance and creates RESERVATION ledger entry", async () => {
    await repo.setBalance("user_test", 100);
    const quote = service.quote({ estimatedCostUsd: 0.35, generationId: "gen_1" });

    const res = await service.reserve({
      quote,
      userId: "user_test",
      idempotencyKey: "res_idem_1",
    });

    assert.equal(res.idempotentReplay, false);
    assert.equal(res.reservation.status, "RESERVED");
    assert.equal(res.reservation.amount, 35);

    const balance = await service.getBalance("user_test");
    assert.equal(balance, 65);

    const ledger = await service.getLedger("user_test");
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].type, "RESERVATION");
    assert.equal(ledger[0].delta, -35);
  });

  it("3. Idempotent reservation replay does not double-charge balance", async () => {
    await repo.setBalance("user_test", 100);
    const quote = service.quote({ estimatedCostUsd: 0.35, generationId: "gen_1" });

    const res1 = await service.reserve({
      quote,
      userId: "user_test",
      idempotencyKey: "res_idem_repeat",
    });
    assert.equal(res1.idempotentReplay, false);
    assert.equal(await service.getBalance("user_test"), 65);

    const res2 = await service.reserve({
      quote,
      userId: "user_test",
      idempotencyKey: "res_idem_repeat",
    });
    assert.equal(res2.idempotentReplay, true);
    assert.equal(res2.reservation.id, res1.reservation.id);
    assert.equal(await service.getBalance("user_test"), 65); // Untouched!
  });

  it("4. Settle with lower actual cost refunds unused reserved credits", async () => {
    await repo.setBalance("user_test", 100);
    const quote = service.quote({ estimatedCostUsd: 0.50, generationId: "gen_1" });

    const { reservation } = await service.reserve({
      quote,
      userId: "user_test",
      idempotencyKey: "res_refund_test",
    });
    assert.equal(await service.getBalance("user_test"), 50); // 100 - 50 = 50

    // Actual was only $0.30 (30 credits)
    const { settlement } = await service.settle({
      reservationId: reservation.id,
      userId: "user_test",
      actualProviderCostUsd: 0.30,
    });

    assert.equal(settlement.status, "CONSUMED");
    assert.equal(settlement.consumedCredits, 30);
    assert.equal(settlement.releasedCredits, 20);

    // 50 remaining + 20 refund = 70
    assert.equal(await service.getBalance("user_test"), 70);

    const ledger = await service.getLedger("user_test");
    const releaseTx = ledger.find((t) => t.type === "RELEASE");
    assert.ok(releaseTx);
    assert.equal(releaseTx?.delta, 20);
  });

  it("5. Settle with higher actual cost (overage) deducts additional credits", async () => {
    await repo.setBalance("user_test", 100);
    const quote = service.quote({ estimatedCostUsd: 0.30, generationId: "gen_1" });

    const { reservation } = await service.reserve({
      quote,
      userId: "user_test",
      idempotencyKey: "res_overage_test",
    });
    assert.equal(await service.getBalance("user_test"), 70); // 100 - 30 = 70

    // Actual was $0.50 (50 credits) due to compute overage
    const { settlement } = await service.settle({
      reservationId: reservation.id,
      userId: "user_test",
      actualProviderCostUsd: 0.50,
    });

    assert.equal(settlement.status, "CONSUMED");
    assert.equal(settlement.consumedCredits, 50);

    // 70 remaining - 20 overage = 50
    assert.equal(await service.getBalance("user_test"), 50);

    const ledger = await service.getLedger("user_test");
    const overageTx = ledger.find((t) => t.type === "CONSUMPTION" && t.delta === -20);
    assert.ok(overageTx);
  });

  it("6. Pre-execution cancellation cleanly releases reservation back to user balance", async () => {
    await repo.setBalance("user_test", 100);
    const quote = service.quote({ estimatedCostUsd: 0.35, generationId: "gen_1" });

    const { reservation } = await service.reserve({
      quote,
      userId: "user_test",
      idempotencyKey: "res_cancel_test",
    });
    assert.equal(await service.getBalance("user_test"), 65);

    await service.release({
      reservationId: reservation.id,
      userId: "user_test",
      reason: "User cancelled generation",
    });

    assert.equal(await service.getBalance("user_test"), 100); // Fully restored
    const updated = await repo.getReservation(reservation.id);
    assert.equal(updated?.status, "RELEASED");
  });

  it("7. markPendingUnknown preserves credit hold and records PENDING_UNKNOWN audit", async () => {
    await repo.setBalance("user_test", 100);
    const quote = service.quote({ estimatedCostUsd: 0.35, generationId: "gen_1" });

    const { reservation } = await service.reserve({
      quote,
      userId: "user_test",
      idempotencyKey: "res_unknown_test",
    });
    assert.equal(await service.getBalance("user_test"), 65);

    await service.markPendingUnknown({
      reservationId: reservation.id,
      userId: "user_test",
      reason: "504 Gateway Timeout during submission",
    });

    // CRITICAL: Hold remains, balance stays 65
    assert.equal(await service.getBalance("user_test"), 65);
    const updated = await repo.getReservation(reservation.id);
    assert.equal(updated?.status, "PENDING_UNKNOWN");

    const ledger = await service.getLedger("user_test");
    assert.ok(ledger.some((t) => t.type === "PENDING_UNKNOWN"));
  });

  it("8. Insufficient credits fails safe without deducting or creating reservation", async () => {
    await repo.setBalance("user_poor", 10);
    const quote = service.quote({ estimatedCostUsd: 0.35, generationId: "gen_1" }); // 35 credits needed

    await assert.rejects(
      async () => {
        await service.reserve({
          quote,
          userId: "user_poor",
          idempotencyKey: "res_fail_safe",
        });
      },
      /Insufficient credits/i
    );

    assert.equal(await service.getBalance("user_poor"), 10);
    const ledger = await service.getLedger("user_poor");
    assert.equal(ledger.length, 0);
  });

  it("9. Concurrency: serialized mutex locks prevent race conditions on balance", async () => {
    await repo.setBalance("user_race", 100);

    // Launch 3 simultaneous reservations of 40 credits each
    // Only 2 should succeed (40 + 40 = 80 <= 100). The 3rd must fail (needs 120).
    const attempts = await Promise.allSettled([
      service.reserve({
        quote: service.quote({ estimatedCostUsd: 0.40, generationId: "gen_a" }),
        userId: "user_race",
        idempotencyKey: "race_1",
      }),
      service.reserve({
        quote: service.quote({ estimatedCostUsd: 0.40, generationId: "gen_b" }),
        userId: "user_race",
        idempotencyKey: "race_2",
      }),
      service.reserve({
        quote: service.quote({ estimatedCostUsd: 0.40, generationId: "gen_c" }),
        userId: "user_race",
        idempotencyKey: "race_3",
      }),
    ]);

    const fulfilled = attempts.filter((a) => a.status === "fulfilled");
    const rejected = attempts.filter((a) => a.status === "rejected");

    assert.equal(fulfilled.length, 2);
    assert.equal(rejected.length, 1);
    assert.equal(await service.getBalance("user_race"), 20); // 100 - 80 = 20
  });
});
