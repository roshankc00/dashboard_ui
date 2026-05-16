import { Batch, UrlCheck } from "@/modules/types";

export type BatchDetail = {
    batch: Batch;
    urlChecks: UrlCheck[];
};

export type CreateBatchResult = {
    batchId: string;
    totalUrls: number;
};