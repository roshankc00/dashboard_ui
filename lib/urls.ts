export const getBatchFromUrl = (): string | null => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("batch");
}

export const setBatchInUrl = (batchId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("batch", batchId);
    window.history.replaceState({ batchId }, "", url);
}

export const clearBatchFromUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("batch");
    window.history.replaceState(null, "", url);
}
