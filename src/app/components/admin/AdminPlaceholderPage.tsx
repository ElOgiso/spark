import React from "react";
import { AdminShell } from "./AdminShell";

interface AdminPlaceholderPageProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export function AdminPlaceholderPage({ currentPath = "/admin/inbox", onNavigate }: AdminPlaceholderPageProps) {
  return <AdminShell currentPath={currentPath} onNavigate={onNavigate} />;
}

