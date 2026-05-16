"use client";

import { retryFailedBatch } from "@/common";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { batchKeys } from "./keys";

export function useRetryFailedBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: retryFailedBatch,
        mutationKey: [...batchKeys.all, "retry-failed"],
        onSuccess: (_, batchId) => {
            queryClient.invalidateQueries({ queryKey: batchKeys.detail(batchId) });
        },
    });
}
