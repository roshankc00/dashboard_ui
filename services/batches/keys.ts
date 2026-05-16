import { getBatch } from "@/common";
import { queryOptions } from "@tanstack/react-query";

export const batchKeys = {
    all: ["batches"] as const,
    detail: (id: string) => [...batchKeys.all, "detail", id] as const,
};

export function batchDetailQuery(batchId: string) {
    return queryOptions({
        queryKey: batchKeys.detail(batchId),
        queryFn: () => getBatch(batchId),
    });
}
