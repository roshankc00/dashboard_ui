export type UrlCheck = {
    urlCheckId: string; url: string; status: string;
    statusCode?: number; responseTimeMs?: number; title?: string; error?: string;
};
export type Batch = {
    id: string; status: string; totalUrls: number; finishedCount: number;
    completedOk: number; failedCount: number; cancelledCount: number;
};