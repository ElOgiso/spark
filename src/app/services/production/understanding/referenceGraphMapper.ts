/**
 * ReferenceGraph Mapper — Enriches existing canonical ReferenceGraph from Video Understanding.
 *
 * Bridges Phase 16 Video Understanding with:
 * - src/app/services/production/specification/referenceGraph.ts
 *
 * DO NOT create a second reference graph. This mapper works directly on the canonical ReferenceGraph contract.
 */

import type {
  ReferenceGraph,
  ReferenceNode,
  ReferenceEdge,
  ReferenceRole,
  ReferenceScope,
} from "../specification/referenceGraph";
import type { StructuredVideoUnderstanding } from "./types";

export interface EnrichReferenceGraphOptions {
  sceneId?: string;
  shotId?: string;
  defaultRole?: ReferenceRole;
  scope?: ReferenceScope;
}

/**
 * Enriches an existing canonical ReferenceGraph with verified semantic evidence
 * from a StructuredVideoUnderstanding result.
 */
export function enrichReferenceGraphFromVideo(
  graph: ReferenceGraph,
  understanding: StructuredVideoUnderstanding,
  options: EnrichReferenceGraphOptions = {}
): ReferenceGraph {
  const role: ReferenceRole = options.defaultRole || "PREFERRED";
  const scope: ReferenceScope = options.scope || (options.shotId ? "SHOT" : options.sceneId ? "SCENE" : "PRODUCTION");
  const entityId = options.shotId || options.sceneId || graph.productionId;

  const nextNodes: ReferenceNode[] = [...graph.nodes];
  const nextEdges: ReferenceEdge[] = [...graph.edges];
  const existingNodeIds = new Set(graph.nodes.map((n) => n.id));

  const addNodeSafe = (node: ReferenceNode) => {
    if (!existingNodeIds.has(node.id)) {
      existingNodeIds.add(node.id);
      nextNodes.push(node);
    }
  };

  // 1. Source Video Node
  const sourceVideoNodeId = `ref_vid_${understanding.id}`;
  addNodeSafe({
    id: sourceVideoNodeId,
    type: "SOURCE_VIDEO",
    role,
    scope,
    url: understanding.source.url,
    label: `Source Video (${understanding.source.kind})`,
    description: understanding.summary.narrativeSummary || "Source video understanding reference",
    entityId,
    metadata: {
      sourceKind: understanding.source.kind,
      confidence: understanding.confidence,
      durationSec: understanding.durationSec,
    },
  });

  // 2. Character / Person Subject Nodes
  for (let i = 0; i < understanding.summary.subjects.length; i++) {
    const subj = understanding.summary.subjects[i];
    if (subj.category === "person" || subj.category === "character") {
      const charNodeId = `ref_subj_${understanding.id}_${i}`;
      addNodeSafe({
        id: charNodeId,
        type: "CHARACTER",
        role: subj.role === "primary" ? "REQUIRED" : "PREFERRED",
        scope,
        label: subj.label,
        description: subj.appearance || `Observed ${subj.category} from video reference`,
        entityId,
        metadata: {
          confidence: subj.confidence,
          provenance: subj.provenance,
        },
      });

      nextEdges.push({
        id: `edge_${sourceVideoNodeId}_${charNodeId}`,
        fromNodeId: sourceVideoNodeId,
        toNodeId: charNodeId,
        type: "DERIVED_FROM",
      });
    } else if (subj.category === "location") {
      const locNodeId = `ref_loc_${understanding.id}_${i}`;
      addNodeSafe({
        id: locNodeId,
        type: "LOCATION",
        role: "PREFERRED",
        scope,
        label: subj.label,
        description: `Observed location from video reference`,
        entityId,
        metadata: { confidence: subj.confidence },
      });

      nextEdges.push({
        id: `edge_${sourceVideoNodeId}_${locNodeId}`,
        fromNodeId: sourceVideoNodeId,
        toNodeId: locNodeId,
        type: "LOCATION_OF",
      });
    }
  }

  // 3. Object / Prop Nodes
  for (let i = 0; i < understanding.summary.objects.length; i++) {
    const obj = understanding.summary.objects[i];
    const objNodeId = `ref_obj_${understanding.id}_${i}`;
    addNodeSafe({
      id: objNodeId,
      type: "OBJECT",
      role: obj.importance === "primary" ? "REQUIRED" : "PREFERRED",
      scope,
      label: obj.label,
      description: `Observed prop/object: ${obj.label} (state: ${obj.state || "active"})`,
      entityId,
      metadata: { confidence: obj.confidence, state: obj.state },
    });
  }

  // 4. Style Reference Node
  if (understanding.summary.visualStyle?.visualStyle || understanding.summary.visualStyle?.aesthetic) {
    const styleNodeId = `ref_style_${understanding.id}`;
    addNodeSafe({
      id: styleNodeId,
      type: "STYLE",
      role: "PREFERRED",
      scope,
      label: understanding.summary.visualStyle.visualStyle || "Video Visual Style",
      description: `Aesthetic: ${understanding.summary.visualStyle.aesthetic || "naturalistic"}`,
      entityId,
      metadata: {
        confidence: understanding.summary.visualStyle.confidence,
        texture: understanding.summary.visualStyle.texture,
      },
    });

    nextEdges.push({
      id: `edge_${sourceVideoNodeId}_${styleNodeId}`,
      fromNodeId: sourceVideoNodeId,
      toNodeId: styleNodeId,
      type: "STYLE_OF",
    });
  }

  // 5. Start / End Boundary Frame Nodes (when evidence frames exist)
  const firstSeg = understanding.segments[0];
  const lastSeg = understanding.segments[understanding.segments.length - 1];

  if (firstSeg?.startState?.visualState) {
    const startNodeId = `ref_start_${understanding.id}`;
    addNodeSafe({
      id: startNodeId,
      type: "START_FRAME",
      role: "PREFERRED",
      scope,
      label: "Start Frame State",
      description: firstSeg.startState.visualState,
      entityId,
      metadata: {
        subjectPosition: firstSeg.startState.subjectPosition,
        framing: firstSeg.startState.cameraFraming,
      },
    });
  }

  if (lastSeg?.endState?.visualState) {
    const endNodeId = `ref_end_${understanding.id}`;
    addNodeSafe({
      id: endNodeId,
      type: "END_FRAME",
      role: "PREFERRED",
      scope,
      label: "End Frame State",
      description: lastSeg.endState.visualState,
      entityId,
      metadata: {
        subjectPosition: lastSeg.endState.subjectPosition,
        framing: lastSeg.endState.cameraFraming,
      },
    });
  }

  return {
    ...graph,
    nodes: nextNodes,
    edges: nextEdges,
    updatedAt: new Date().toISOString(),
  };
}
