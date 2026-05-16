"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { batchDetailQuery } from "./keys";

export function useGetBatch() {
    const queryClient = useQueryClient();

    return useCallback(
        (batchId: string) => queryClient.fetchQuery(batchDetailQuery(batchId)),
        [queryClient],
    );
}
