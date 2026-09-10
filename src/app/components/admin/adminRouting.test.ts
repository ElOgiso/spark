import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("AdminLoginPage component exists and exports correctly", () => {
  const adminLoginCode = fs.readFileSync(path.join(__dirname, "AdminLoginPage.tsx"), "utf8");
  assert.ok(adminLoginCode.includes("export function AdminLoginPage"), "AdminLoginPage should export component");
  assert.ok(adminLoginCode.includes("Admin Console Access"), "AdminLoginPage should display Admin Console title");
  assert.ok(adminLoginCode.includes("handleAdminSignIn"), "AdminLoginPage should have handleAdminSignIn handler");
});

test("App.tsx imports AdminLoginPage and wires /admin unauthenticated routing", () => {
  const appCode = fs.readFileSync(path.join(__dirname, "../../App.tsx"), "utf8");
  assert.ok(appCode.includes("import { AdminLoginPage }"), "App.tsx should import AdminLoginPage");
  assert.ok(appCode.includes("const isAdminRoute = currentPage.startsWith(\"/admin\")"), "App.tsx should detect /admin route");
  assert.ok(appCode.includes("<AdminLoginPage"), "App.tsx should render AdminLoginPage for unauthenticated admin route");
  assert.ok(appCode.includes("window.location.pathname.startsWith(\"/admin\")"), "App.tsx should check window.location.pathname");
});

test("App.tsx initializes currentPage from window.location.pathname with popstate listener", () => {
  const appCode = fs.readFileSync(path.join(__dirname, "../../App.tsx"), "utf8");
  assert.ok(appCode.includes("window.addEventListener(\"popstate\""), "App.tsx should listen to popstate events");
  assert.ok(appCode.includes("path.startsWith(\"/admin\")"), "App.tsx should preserve /admin paths from window.location");
});
