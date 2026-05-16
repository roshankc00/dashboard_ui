export const isRunning = (status: string): boolean => {
    return status === "queued" || status === "running";
}