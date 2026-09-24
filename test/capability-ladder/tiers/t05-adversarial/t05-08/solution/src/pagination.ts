export interface PaginatedResult<T> {
  data: T[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export function paginate<T>(items: T[], page = 1, pageSize = 10): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = start >= total ? [] : items.slice(start, start + pageSize);

  return {
    data,
    total,
    totalPages,
    page,
    pageSize,
  };
}
