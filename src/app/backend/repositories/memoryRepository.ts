import type { MemoryItemRow } from "../database.types";
import { deleteRow, insertRow, listByBrand, updateRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";

export async function listMemoryItems(brandId: string): Promise<RepositoryResult<MemoryItemRow[]>> {
  return listByBrand("memory_items", brandId);
}

export async function createMemoryItem(values: Partial<MemoryItemRow>): Promise<RepositoryResult<MemoryItemRow>> {
  return insertRow("memory_items", values);
}

export async function updateMemoryItem(id: string, values: Partial<MemoryItemRow>): Promise<RepositoryResult<MemoryItemRow>> {
  return updateRow("memory_items", id, values);
}

export async function archiveMemoryItem(id: string): Promise<RepositoryResult<MemoryItemRow>> {
  return updateRow("memory_items", id, { archived: true });
}

export async function deleteMemoryItem(id: string): Promise<RepositoryResult<true>> {
  return deleteRow("memory_items", id);
}
