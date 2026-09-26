/**
 * Seeds the existing ReferenceGraph and StyleBible from identity SPARK already has.
 * Does not create a second graph or a second style system.
 */

import type { CharacterMaster } from "./assetSpec";
import {
  createEmptyReferenceGraph,
  type ReferenceGraph,
  type ReferenceNode,
} from "./referenceGraph";
import {
  createDefaultStyleBible,
  resolveStyleBible,
  type StyleBible,
} from "./styleBible";

export interface IdentitySeedInput {
  productionId: string;
  brandId?: string;
  look?: string;
  characters?: CharacterMaster[];
  locations?: Array<{ id: string; name?: string; description?: string }>;
  sourceVideoUrl?: string;
  sourceVideoLabel?: string;
  sourceVideoNotes?: string;
  existingGraph?: ReferenceGraph | null;
}

function pushNode(graph: ReferenceGraph, node: ReferenceNode) {
  if (graph.nodes.some((n) => n.id === node.id)) return;
  graph.nodes.push(node);
}

export function seedReferenceGraph(input: IdentitySeedInput): ReferenceGraph {
  const graph = input.existingGraph?.nodes
    ? {
        ...input.existingGraph,
        nodes: [...input.existingGraph.nodes],
        edges: [...(input.existingGraph.edges || [])],
      }
    : createEmptyReferenceGraph(input.productionId);

  for (const character of input.characters || []) {
    const urls = character.approvedReferenceUrls?.filter(Boolean) || [];
    const id = `ref_char_${character.identity.ref}`;
    pushNode(graph, {
      id,
      type: urls.length ? "CHARACTER_SHEET" : "CHARACTER_IDENTITY",
      role: "REQUIRED",
      scope: "CHARACTER",
      masterRef: character.identity.ref,
      url: urls[0],
      label: character.name,
      description: character.description,
      entityId: character.identity.ref,
      metadata: urls.length > 1 ? { extraUrls: urls.slice(1) } : undefined,
    });
  }

  for (const location of input.locations || []) {
    if (!location?.id) continue;
    pushNode(graph, {
      id: `ref_loc_${location.id}`,
      type: "LOCATION",
      role: "PREFERRED",
      scope: "PRODUCTION",
      label: location.name || location.id,
      description: location.description,
      entityId: location.id,
    });
  }

  const sourceUrl = input.sourceVideoUrl?.trim();
  if (sourceUrl) {
    pushNode(graph, {
      id: `ref_vid_${input.productionId}`,
      type: "SOURCE_VIDEO",
      role: "PREFERRED",
      scope: "PRODUCTION",
      url: sourceUrl,
      label: input.sourceVideoLabel || "Source video",
      description: input.sourceVideoNotes || "Accepted source understanding",
      entityId: input.productionId,
      metadata: { from: "spark.researchContext" },
    });
  }

  graph.updatedAt = new Date().toISOString();
  return graph;
}

export function seedStyleBible(input: {
  productionId: string;
  brandId?: string;
  look?: string;
  existing?: StyleBible | null;
}): StyleBible {
  if (input.existing?.provenanceMap?.visualLanguage === "BRAND") {
    return input.existing;
  }
  const defaults = createDefaultStyleBible(input.productionId, input.brandId);
  const look = input.look?.trim();
  if (!look) return input.existing || defaults;
  const resolved = resolveStyleBible({
    brandStyle: {
      visualLanguage: { ...defaults.visualLanguage, aesthetic: look },
    },
  });
  return {
    ...resolved.bible,
    id: `style_${input.productionId}`,
    productionId: input.productionId,
    brandId: input.brandId,
    provenanceMap: { ...resolved.bible.provenanceMap, ...resolved.provenance },
  };
}
