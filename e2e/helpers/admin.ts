import { type APIRequestContext } from "@playwright/test";

/**
 * Fetch the org mapping table from the API for assertion comparisons.
 */
export async function fetchOrgMapping(
  request: APIRequestContext,
  token: string,
): Promise<
  Array<{ branch: string; bm: string; am: string; gm: string; zone: string }>
> {
  const res = await request.get("/api/config/org-mapping", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/**
 * Fetch upload history for assertion comparisons.
 */
export async function fetchUploadHistory(
  request: APIRequestContext,
  token: string,
): Promise<Array<Record<string, unknown>>> {
  const res = await request.get("/api/upload/history", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/**
 * Fetch ingestion status for a specific upload.
 */
export async function fetchIngestionStatus(
  request: APIRequestContext,
  token: string,
  uploadId: string,
): Promise<{ state: string; newLeads?: number; updated?: number; failed?: number }> {
  const res = await request.get(`/api/upload/ingestion-status/${uploadId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/**
 * Update a BM name for a branch via PATCH — used for test cleanup (restoring original values).
 */
export async function patchBranchBm(
  request: APIRequestContext,
  token: string,
  branch: string,
  bm: string,
): Promise<void> {
  await request.patch(`/api/config/org-mapping/${encodeURIComponent(branch)}/bm`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: { bm },
  });
}
