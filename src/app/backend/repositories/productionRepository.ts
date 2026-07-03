import type { ProductionRow, ViralSparkRow } from "../database.types";
import { deleteRow, insertRow, listByBrand, updateRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";

export async function listProductions(brandId: string): Promise<RepositoryResult<ProductionRow[]>> {
  return listByBrand("productions", brandId);
}

export async function createProduction(values: Partial<ProductionRow>): Promise<RepositoryResult<ProductionRow>> {
  return insertRow("productions", values);
}

export async function updateProduction(id: string, values: Partial<ProductionRow>): Promise<RepositoryResult<ProductionRow>> {
  return updateRow("productions", id, values);
}

export async function deleteProduction(id: string): Promise<RepositoryResult<true>> {
  return deleteRow("productions", id);
}

export async function listViralSparks(brandId: string): Promise<RepositoryResult<ViralSparkRow[]>> {
  return listByBrand("viral_sparks", brandId);
}

export async function createViralSpark(values: Partial<ViralSparkRow>): Promise<RepositoryResult<ViralSparkRow>> {
  return insertRow("viral_sparks", values);
}
