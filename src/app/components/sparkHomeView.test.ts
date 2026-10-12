import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, existsSync } from "node:fs";
import { SparkHomeView } from "./SparkHomeView";
import { projectSparkHome } from "../services/production/ui/sparkHomeProjection";
const empty=projectSparkHome({productions:[],reviews:[],jobs:[]});
function render(status: "loading"|"ready"|"error"|"local", model=empty) {
  return renderToStaticMarkup(createElement(SparkHomeView,{brandName:"Test Spark",purpose:"Native stories",useCase:"Films",model,status,onNavigate:()=>{},onChat:()=>{},onRefresh:()=>{}}));
}
test("Home loading is not a fabricated empty workspace", () => {
  const html=render("loading");
  assert.match(html,/Loading your current work/);
  assert.doesNotMatch(html,/Make your first production|Verified posts/);
});
test("Home has honest empty/error/local states and actionable retry", () => {
  assert.match(render("ready"),/Make your first production/);
  assert.match(render("error"),/Workspace refresh failed|Retry refresh/);
  assert.doesNotMatch(render("error"),/Make your first production/);
  assert.match(render("local"),/not cloud-verified/);
});
test("Home renders actual work without invented performance or readiness", () => {
  const model=projectSparkHome({productions:[{id:"p1",title:"Actual film",status:"Generating",dateCreated:"2026-10-12",scenes:[]}] as any,reviews:[],jobs:[]});
  const html=render("ready",model);
  assert.match(html,/Actual film/);
  assert.match(html,/Generating/);
  assert.doesNotMatch(html,/Monthly Views|Revenue|120 views|Ready for Review/);
});
test("mobile and desktop mount the same Home; discarded feature variants are removed", () => {
  assert.match(readFileSync("src/app/components/mobile/MobileHome.tsx","utf8"),/<SparkHome compactChrome/);
  assert.equal(existsSync("src/app/components/DesktopSparkMediaHome.tsx"),false);
  assert.equal(existsSync("src/app/components/mobile/DonorSparkMediaHome.tsx"),false);
  const css=readFileSync("src/styles/spark-home.css","utf8");
  assert.match(css,/@media\(max-width:767px\)/);
  assert.match(css,/focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
});
