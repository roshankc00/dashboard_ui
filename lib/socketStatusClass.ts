import { cn } from "./utils";

export const socketStatusClass = (sockSt: string) => {
    return cn(
        "text-xs",
        sockSt === "connected" && "text-green-600",
        sockSt === "error" && "text-red-600",
        sockSt !== "connected" && sockSt !== "error" && "text-orange-500",
    );
}