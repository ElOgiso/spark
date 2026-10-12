import test from "node:test";
import assert from "node:assert/strict";
import { projectSparkHome } from "./sparkHomeProjection";
const production = (id: string, status = "Drafting", brandId = "b1", dateCreated = "2026-10-12") => ({ id, title:id, status, brandId, dateCreated, scenes: [] } as any);
const job = (id: string, status: string, extra = {}) => ({ id, status, productionId:"p1", platform:"youtube", scheduledTime:"2026-10-13T10:00:00Z", title:id, ...extra } as any);

test("Home counts job evidence, never magic IDs or a Published production label", () => {
  const model = projectSparkHome({ brandId:"b1", productions:[production("p1","Published"),production("p7","Approved"),production("other","Ready for Review","b2")],reviews:[],jobs:[job("s","Scheduled"),job("published","Published"),job("export","Export Ready"),job("invalid","Scheduled",{scheduledTime:"invalid"})] });
  assert.equal(model.scheduled.length,1);
  assert.equal(model.verifiedPosts,0);
  assert.equal(model.needsReview.length,0);
  assert.equal(model.productions.length,2);
});
test("Home shares the profile receipt authority and deduplicates exact destinations", () => {
  const receipt={accountId:"channel",platformPostId:"post",postUrl:"https://youtube.com/watch?v=post"};
  const model=projectSparkHome({brandId:"b1",productions:[production("p1")],reviews:[],jobs:[job("a","Published",receipt),job("b","Published",receipt),job("c","Published",{...receipt,postUrl:"http://unsafe"}),job("d","Published",{...receipt,productionId:"unknown"})]});
  assert.equal(model.verifiedPosts,1);
});
test("Home sorts current work, deduplicates pending reviews and is workspace-isolated", () => {
  const productions=[production("old","Drafting","b1","2026-09-01"),production("new","Failed"),production("elsewhere","Generating","b2")];
  const model=projectSparkHome({brandId:"b1",productions,reviews:[{productionId:"old",status:"Pending Review"},{productionId:"old",status:"Pending Review"}] as any,jobs:[]});
  assert.equal(model.needsReview.length,1);
  assert.equal(model.needsAttention.length,1);
  assert.equal(model.latest[0].id,"new");
  assert.equal(productions[0].id,"old");
  assert.deepEqual(projectSparkHome({brandId:"b2",productions,reviews:[],jobs:[]}).latest.map(p=>p.id),["elsewhere"]);
});
