"use client";

import { retryFailedBatch } from "@/common";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { batchKeys } from "./keys";

export function useRetryFailedBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: retryFailedBatch,
        mutationKey: [...batchKeys.all, "retry-failed"],
        onSuccess: async (_, batchId) => {
            await queryClient.resetQueries({ queryKey: batchKeys.detail(batchId) });
        },
    });
}
