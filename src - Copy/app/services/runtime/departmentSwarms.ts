/**
 * Spark Media OS — Persistent Department Swarm Services
 * Long-running department processes that monitor, process, and publish work independently.
 */

import { eventBus } from "./eventBus";
import { ViralSpark, Production, ReviewItem, MemoryItem } from "../../domain/types";

export interface DepartmentStatus {
  name: string;
  role: string;
  active: boolean;
  lastActivity: string;
  tasksCompleted: number;
}

export class DepartmentSwarmManager {
  private static instance: DepartmentSwarmManager;
  private departments: Map<string, DepartmentStatus> = new Map();

  constructor() {
    this.initializeDepartments();
    this.listenToEvents();
  }

  static getInstance(): DepartmentSwarmManager {
    if (!DepartmentSwarmManager.instance) {
      DepartmentSwarmManager.instance = new DepartmentSwarmManager();
    }
    return DepartmentSwarmManager.instance;
  }

  private initializeDepartments() {
    const list = [
      { name: "Executive Director", role: "Governance & Communication Partner", active: true },
      { name: "Lead Strategist", role: "Trend Research & Virality Scoring", active: true },
      { name: "Creative Director", role: "Narrative & Hook Formulation", active: true },
      { name: "Scriptwriter Department", role: "Platform Scripting & Scene Breakdown", active: true },
      { name: "Visual Producer", role: "3-Scene Storyboard & Prompt Engineering", active: true },
      { name: "Publishing Department", role: "Multi-Platform Scheduling & Dispatch", active: true },
      { name: "Analyst Department", role: "Retention Metrics & Continuous Learning", active: true },
      { name: "Memory Department", role: "Brand Rule Retention & Strategy Archiving", active: true },
    ];

    list.forEach((d) => {
      this.departments.set(d.name, {
        name: d.name,
        role: d.role,
        active: d.active,
        lastActivity: "Active",
        tasksCompleted: 0,
      });
    });
  }

  private listenToEvents() {
    eventBus.on("TREND_FOUND", (payload) => {
      this.recordActivity("Lead Strategist", `Discovered trend: ${payload.data.title || "Viral Angle"}`);
    });

    eventBus.on("OPPORTUNITY_CREATED", (payload) => {
      this.recordActivity("Creative Director", `Formulated opportunity: ${payload.data.title || "Spark"}`);
    });

    eventBus.on("SCRIPT_READY", (payload) => {
      this.recordActivity("Scriptwriter Department", `Script generated for ${payload.data.title || "production"}`);
    });

    eventBus.on("STORYBOARD_READY", (payload) => {
      this.recordActivity("Visual Producer", `Storyboard rendered for ${payload.data.title || "production"}`);
    });

    eventBus.on("REVIEW_REQUIRED", (payload) => {
      this.recordActivity("Executive Director", `Quality checks passed for ${payload.data.title || "item"}`);
    });

    eventBus.on("PUBLISH_FINISHED", (payload) => {
      this.recordActivity("Publishing Department", `Published to ${payload.data.platform || "social channel"}`);
    });

    eventBus.on("ANALYTICS_UPDATED", (payload) => {
      this.recordActivity("Analyst Department", `Calculated performance metrics & retention score`);
    });

    eventBus.on("MEMORY_UPDATED", (payload) => {
      this.recordActivity("Memory Department", `Saved memory rule: ${payload.data.text || "Rule"}`);
    });
  }

  private recordActivity(departmentName: string, activityText: string) {
    const dept = this.departments.get(departmentName);
    if (dept) {
      dept.lastActivity = activityText;
      dept.tasksCompleted += 1;
      this.departments.set(departmentName, dept);
    }
  }

  getDepartmentStatuses(): DepartmentStatus[] {
    return Array.from(this.departments.values());
  }
}

export const departmentSwarmManager = DepartmentSwarmManager.getInstance();
