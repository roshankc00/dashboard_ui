import { cn } from "./utils";

export const checkStatusClass = (status: string) => {
    return cn(
        status === "completed" && "text-green-600",
        status === "failed" && "text-red-600",
        status === "running" && "text-blue-600",
        !["completed", "failed", "running"].includes(status) && "text-muted-foreground",
    );
}