import { useMemo, useState } from 'react';

/** Client-side pagination over an already-filtered array. */
export function usePagination(items, pageSize = 12) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => (items || []).slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return {
    page: safePage,
    totalPages,
    pageItems,
    setPage,
    next: () => setPage((p) => Math.min(p + 1, totalPages)),
    prev: () => setPage((p) => Math.max(p - 1, 1)),
    reset: () => setPage(1),
  };
}
