"use client";

import { createBatch } from "@/common";
import { useMutation } from "@tanstack/react-query";

export function useCreateBatch() {
    return useMutation({
        mutationFn: createBatch,
    });
}
