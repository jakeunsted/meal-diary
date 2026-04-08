export interface ApiResponse<T> {
  data: T;
  headers: Record<string, string>;
}
