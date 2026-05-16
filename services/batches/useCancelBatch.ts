"use client";

import { cancelBatch } from "@/common";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { batchKeys } from "./keys";

export function useCancelBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: cancelBatch,
        mutationKey: [...batchKeys.all, "cancel"],
        onSuccess: (_, batchId) => {
            queryClient.invalidateQueries({ queryKey: batchKeys.detail(batchId) });
        },
    });
}
