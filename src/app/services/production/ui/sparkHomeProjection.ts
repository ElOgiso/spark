import type { Production, PublishJob, ReviewItem } from "../../../domain/types";
import { publishedSparkPosts, normalizeSocialPlatform } from "../../../domain/sparkExperience";

/** Read-only operational projection. Never transitions jobs or invents performance. */
export function projectSparkHome(input: {
  brandId?: string;
  productions: Production[];
  reviews: ReviewItem[];
  jobs: PublishJob[];
}) {
  const productions = input.productions.filter(p => !input.brandId || !p.brandId || p.brandId === input.brandId);
  const ids = new Set(productions.map(p => p.id));
  const jobs = input.jobs.filter(j => ids.has(j.productionId));
  const reviewIds = new Set(input.reviews.filter(r => ids.has(r.productionId) && r.status === "Pending Review").map(r => r.productionId));
  const needsReview = productions.filter(p => reviewIds.has(p.id) || p.status === "Ready for Review");
  const needsAttention = productions.filter(p => ["Failed", "Needs Edit"].includes(p.status) || Boolean(p.lastError));
  const inProgress = productions.filter(p => p.isGeneratingAssets || ["Drafting", "Generating"].includes(p.status));
  const scheduled = jobs.filter(j => j.status === "Scheduled" && Number.isFinite(Date.parse(j.scheduledTime)));
  const failedJobs = jobs.filter(j => j.status === "Failed" || j.status === "Needs Review");
  const destinations = new Map<string, { channelId: string; platform: string }>();
  for (const j of jobs) {
    if (j.accountId) destinations.set(`${normalizeSocialPlatform(j.platform)}:${j.accountId}`, { channelId: j.accountId, platform: j.platform });
  }
  const verifiedPosts = [...destinations.values()].reduce((total, account) => total + publishedSparkPosts(productions, jobs, input.brandId, account).length, 0);
  const latest = [...productions].sort((a,b) => (Date.parse(b.dateCreated) || 0) - (Date.parse(a.dateCreated) || 0)).slice(0,6);
  return { productions, needsReview, needsAttention, inProgress, scheduled, failedJobs, verifiedPosts, latest };
}
