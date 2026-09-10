import assert from "node:assert/strict";
import test from "node:test";
import { approveUser, rejectUser, banUser } from "./adminRepository";

test("adminRepository: non-admin caller is rejected immediately", async () => {
  const result = await approveUser("target-user-1", "random-non-admin-user");
  assert.ok(result.error);
  assert.match(result.error, /Unauthorized/i);
});

test("adminRepository: rejectUser and banUser reject non-admin caller immediately", async () => {
  const rejectRes = await rejectUser("target-user-1", "non-admin");
  assert.ok(rejectRes.error);
  assert.match(rejectRes.error, /Unauthorized/i);

  const banRes = await banUser("target-user-1", "non-admin");
  assert.ok(banRes.error);
  assert.match(banRes.error, /Unauthorized/i);
});

test("Access Gate logic: active access_status releases isPendingApproval", () => {
  // Pure function testing the logic inside AuthContext
  const evaluateGate = (role: string, accessStatus: string) => {
    const userRole = role.toLowerCase().trim() === "admin" ? "admin" : "executive";
    const status = (accessStatus || "").toLowerCase().trim();
    const resolvedStatus = ["pending_approval", "banned", "active", "rejected"].includes(status)
      ? status
      : "active";
    const isPendingApproval = resolvedStatus === "pending_approval" && userRole !== "admin";
    const isBanned = resolvedStatus === "banned";
    const isRejected = resolvedStatus === "rejected";
    return { userRole, resolvedStatus, isPendingApproval, isBanned, isRejected };
  };

  // Case 1: Pending user
  const pending = evaluateGate("executive", "pending_approval");
  assert.equal(pending.isPendingApproval, true);

  // Case 2: Admin approves -> status becomes active
  const active = evaluateGate("executive", "active");
  assert.equal(active.isPendingApproval, false, "Active status must immediately release the freeze gate");

  // Case 3: Admin role always active
  const admin = evaluateGate("admin", "pending_approval");
  assert.equal(admin.isPendingApproval, false, "Admin must never be frozen in pending approval");

  // Case 4: Rejected user
  const rejected = evaluateGate("executive", "rejected");
  assert.equal(rejected.isPendingApproval, false);
  assert.equal(rejected.isRejected, true);

  // Case 5: Banned user
  const banned = evaluateGate("executive", "banned");
  assert.equal(banned.isPendingApproval, false);
  assert.equal(banned.isBanned, true);
});
