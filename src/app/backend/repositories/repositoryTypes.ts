export type BackendSource = "supabase" | "local" | "unconfigured";

export type RepositoryResult<T> = {
  data: T | null;
  error: string | null;
  source: BackendSource;
};

export function unconfiguredResult<T>(): RepositoryResult<T> {
  return {
    data: null,
    error: null,
    source: "unconfigured",
  };
}

export function repositoryError<T>(): RepositoryResult<T> {
  return {
    data: null,
    error: "Backend data is unavailable. Spark is using local state.",
    source: "supabase",
  };
}
