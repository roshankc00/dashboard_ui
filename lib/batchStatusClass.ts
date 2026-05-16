import { cn } from "./utils";

export const batchStatusClass = (status: string) => {
    return cn(
        "ml-2 text-xs font-bold uppercase",
        status === "completed" && "text-green-600",
        status === "cancelled" && "text-orange-500",
        status === "running" && "text-blue-600",
        !["completed", "cancelled", "running"].includes(status) && "text-muted-foreground",
    );
}