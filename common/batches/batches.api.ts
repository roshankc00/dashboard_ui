import { apiFetch } from "../client";
import { BatchDetail, CreateBatchResult } from "./types";


export function createBatch(input: string) {
    return apiFetch<CreateBatchResult>("/api/batches", {
        method: "POST",
        body: JSON.stringify({ input }),
    });
}

export function getBatch(batchId: string) {
    return apiFetch<BatchDetail>(`/api/batches/${batchId}`);
}

export function cancelBatch(batchId: string) {
    return apiFetch(`/api/batches/${batchId}/cancel`, { method: "POST" });
}

export function retryFailedBatch(batchId: string) {
    return apiFetch(`/api/batches/${batchId}/retry-failed`, { method: "POST" });
}
