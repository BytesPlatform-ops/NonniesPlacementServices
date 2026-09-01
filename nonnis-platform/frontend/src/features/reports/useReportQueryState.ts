"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface ReportQueryState {
  values: Record<string, string>;
  page: number;
  setValue: (key: string, value: string | undefined) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

/**
 * Report filter state persisted in the URL query string, so a refresh preserves
 * the report and the link can be copied/shared. Any filter change resets the
 * page. On a fresh visit (no query at all) the provided defaults (e.g. a
 * last-30-days range) are written into the URL once so the default is visible.
 */
export function useReportQueryState(defaults: Record<string, string> = {}): ReportQueryState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultsRef = useRef(defaults);
  const appliedDefaults = useRef(false);

  const values = useMemo(() => {
    const obj: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  }, [searchParams]);

  const writeParams = useCallback(
    (next: URLSearchParams) => {
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  useEffect(() => {
    if (appliedDefaults.current) return;
    appliedDefaults.current = true;
    const d = defaultsRef.current;
    if (searchParams.toString() === "" && Object.keys(d).length > 0) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(d)) if (v) params.set(k, v);
      writeParams(params);
    }
  }, [searchParams, writeParams]);

  const setValue = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
      params.delete("page");
      writeParams(params);
    },
    [searchParams, writeParams],
  );

  const setPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) params.delete("page");
      else params.set("page", String(page));
      writeParams(params);
    },
    [searchParams, writeParams],
  );

  const reset = useCallback(() => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(defaultsRef.current)) if (v) params.set(k, v);
    writeParams(params);
  }, [writeParams]);

  const page = Number(values.page ?? "1") || 1;
  return { values, page, setValue, setPage, reset };
}
