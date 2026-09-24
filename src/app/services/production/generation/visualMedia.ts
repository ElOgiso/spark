import type { ShotSpec } from "../specification/shotSpec";

/** Non-generative media stays on the existing shot/keyframe task and asset spine. */
type VisualShot = Pick<ShotSpec, "id" | "durationSec" | "visualPlan">;

export function usesSourceVisual(shot: VisualShot): boolean {
  return Boolean(shot.visualPlan && !["IMAGE", "VIDEO"].includes(shot.visualPlan.kind));
}

export function validateSourceVisual(shot: VisualShot): void {
  if (!usesSourceVisual(shot)) return;
  const plan = shot.visualPlan!;
  const fail = (reason: string): never => { throw new Error(`${plan.kind} sourcing/rendering for shot ${shot.id}: ${reason}; paused before provider spend.`); };
  if (!Number.isFinite(shot.durationSec) || shot.durationSec <= 0) fail("positive duration required");
  if (plan.source) {
    let url: URL;
    try { url = new URL(plan.source.url); } catch { return fail("invalid source URL"); }
    if (url.protocol !== "https:" || url.username || url.password) fail("durable HTTPS media URL required");
    if (!["image", "video"].includes(plan.source.mediaType)) fail("image or video source required");
    if (!plan.source.attribution?.trim()) fail("source attribution required");
    return;
  }
  const g = plan.graphic;
  if (!g?.title?.trim()) return fail("supply media or structured graphic content");
  if (g.title.length > 96 || (g.sourceLabel?.length || 0) > 76) fail("title or source label exceeds the readable graphic bounds");
  if (plan.kind === "CHART") {
    if (!g.sourceLabel?.trim() || !g.bars?.length || g.bars.length > 12 || g.bars.some(b => !b.label?.trim() || b.label.length > 22 || !Number.isFinite(b.value) || b.value < 0)) fail("chart requires a source and 1–12 labelled nonnegative finite values");
  } else if (plan.kind === "MAP") {
    if (!g.sourceLabel?.trim() || !g.points?.length || g.points.length > 12 || g.points.some(p => !p.label?.trim() || p.label.length > 22 || !Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180 || !Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90)) fail("map requires a source and valid labelled coordinates");
  } else if (plan.kind === "TEXT") {
    if (!g.text?.trim() || g.text.length > 700) fail("text content required");
  } else if (plan.kind === "MOTION_GRAPHIC") {
    if (!g.steps?.length || g.steps.length > 8 || g.steps.some(s => !s?.trim() || s.length > 80)) fail("1–8 animation steps required");
  } else fail("supply an existing media source");
}

const escapeXml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));

/** Deterministic factual plate; animation reveals steps in the shared compiler. */
export function renderVisualGraphicSvg(shot: VisualShot, progress = 1): string {
  validateSourceVisual(shot);
  const g = shot.visualPlan?.graphic;
  if (!g) throw new Error("Structured graphic required");
  const text = (x: number, y: number, value: string, size = 28) => `<text x="${x}" y="${y}" fill="#ffffff" font-size="${size}" font-family="sans-serif">${escapeXml(value)}</text>`;
  const lines = (value: string, y: number) => value.match(/.{1,48}(?:\s|$)|.{1,48}/g)?.map((s, i) => text(70, y + i * 42, s.trim())).join("") || "";
  let body = lines(g.title, 90);
  if (shot.visualPlan!.kind === "CHART") {
    const max = Math.max(1, ...g.bars!.map(b => b.value));
    g.bars!.forEach((bar, i) => {
      const y = 230 + i * 55;
      body += text(70, y, bar.label.slice(0, 22), 22) + `<rect x="390" y="${y - 24}" width="${bar.value / max * 480}" height="30" fill="#67d9ff"/>` + text(890, y, String(bar.value), 22);
    });
  } else if (shot.visualPlan!.kind === "MAP") {
    const points = g.points!.map(p => ({ ...p, x: 100 + (p.longitude + 180) / 360 * 860, y: 260 + (90 - p.latitude) / 180 * 550 }));
    body += text(70, 210, "Geographic route · schematic", 22);
    body += `<polyline points="${points.map(p => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="#67d9ff" stroke-width="4"/>`;
    points.forEach(p => { body += `<circle cx="${p.x}" cy="${p.y}" r="7" fill="#67d9ff"/>` + text(p.x - 25, p.y + 35, p.label.slice(0, 22), 20); });
  } else if (shot.visualPlan!.kind === "MOTION_GRAPHIC") {
    const visible = Math.max(1, Math.ceil(Math.min(1, Math.max(0, progress)) * g.steps!.length));
    g.steps!.slice(0, visible).forEach((step, i) => { body += lines(`${i + 1}. ${step}`, 260 + i * 85); });
  } else body += lines(g.text || "", 300);
  body += text(70, 1030, (g.sourceLabel || "").slice(0, 76), 18);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="#0b0f17"/>${body}</svg>`;
}

export async function renderVisualGraphic(shot: VisualShot, progress = 1): Promise<string> {
  const svg = renderVisualGraphicSvg(shot, progress);
  if (typeof document === "undefined") throw new Error("Graphic rendering requires a browser canvas");
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Graphic canvas unavailable");
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}
