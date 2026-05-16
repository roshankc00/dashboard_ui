"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { batchDetailQuery, batchKeys } from "./keys";

export function useGetBatch() {
    const queryClient = useQueryClient();

    return useCallback(
        async (batchId: string, options?: { refresh?: boolean }) => {
            if (options?.refresh) {
                await queryClient.resetQueries({ queryKey: batchKeys.detail(batchId) });
            }
            return queryClient.fetchQuery({
                ...batchDetailQuery(batchId),
                staleTime: options?.refresh ? 0 : undefined,
            });
        },
        [queryClient],
    );
}
