export type QueryResult<T> = {
  data: T | null;

  error: string | null;
};