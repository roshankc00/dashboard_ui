import { API_URL } from "@/common";
import { isRunning } from "@/lib/isRunning";
import { clearBatchFromUrl, getBatchFromUrl, setBatchInUrl } from "@/lib/urls";
import { Batch, UrlCheck } from "@/modules/types";
import { useGetBatch } from "@/services";
import { useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

type UseSocketOptions = {
    setBatch: React.Dispatch<React.SetStateAction<Batch | null>>;
    setChecks: React.Dispatch<React.SetStateAction<Map<string, UrlCheck>>>;
    setAlert: (alert: { msg: string; ok: boolean } | null) => void;
    setSockSt: (sockSt: string) => void;
};

export function useSocket({ setBatch, setChecks, setAlert, setSockSt }: UseSocketOptions) {
    const getBatch = useGetBatch();
    const socketRef = useRef<Socket | null>(null);
    const activeBatchRef = useRef<string | null>(null);

    const leaveBatchRoom = useCallback((batchId: string) => {
        if (!socketRef.current) return;
        socketRef.current.emit("batch:leave", batchId);
        socketRef.current.off("batch:progress");
        socketRef.current.off("batch:urlResult");
        socketRef.current.off("batch:cancelled");
    }, []);

    const getSocket = useCallback(() => {
        if (socketRef.current) return socketRef.current;
        const s = io(API_URL, { path: "/socket.io" });
        s.on("connect", () => {
            setSockSt("connected");
            if (activeBatchRef.current) s.emit("batch:join", activeBatchRef.current);
        });
        s.on("disconnect", () => setSockSt("reconnecting"));
        s.on("connect_error", () => setSockSt("error"));
        socketRef.current = s;
        return s;
    }, [setSockSt]);

    const watchBatch = useCallback((batchId: string) => {
        activeBatchRef.current = batchId;
        setSockSt("connecting");
        const s = getSocket();
        s.off("batch:progress");
        s.off("batch:urlResult");
        s.off("batch:cancelled");

        s.on("batch:progress", (p: Batch & { batchId: string; batchStatus: string }) => {
            if (p.batchId !== batchId) return;
            setBatch(prev => (prev ? { ...prev, ...p, status: p.batchStatus } : prev));
            if (!isRunning(p.batchStatus)) {
                leaveBatchRoom(batchId);
                activeBatchRef.current = null;
                setSockSt("connected");
            }
        });
        s.on("batch:urlResult", (r: UrlCheck & { batchId: string }) => {
            if (r.batchId !== batchId) return;
            setChecks(prev => new Map(prev).set(r.urlCheckId, r));
        });
        s.on("batch:cancelled", ({ batchId: id }: { batchId: string }) => {
            if (id !== batchId) return;
            setBatch(prev => (prev ? { ...prev, status: "cancelled" } : prev));
            leaveBatchRoom(batchId);
            activeBatchRef.current = null;
        });

        if (s.connected) {
            s.emit("batch:join", batchId);
            setSockSt("connected");
        }
    }, [getSocket, leaveBatchRoom, setBatch, setChecks, setSockSt]);

    const startLiveBatch = useCallback(async (
        batchId: string,
        opts: { persistUrl?: boolean; quiet?: boolean; refresh?: boolean } = {},
    ) => {
        const { persistUrl = true, quiet = false, refresh = false } = opts;

        if (activeBatchRef.current) leaveBatchRoom(activeBatchRef.current);
        activeBatchRef.current = batchId;
        setSockSt("connecting");

        try {
            const detail = await getBatch(batchId, { refresh });
            setBatch(detail.batch);
            setChecks(new Map(detail.urlChecks.map((c: UrlCheck) => [c.urlCheckId, c])));
            if (persistUrl) setBatchInUrl(batchId);

            if (!isRunning(detail.batch.status)) {
                activeBatchRef.current = null;
                setSockSt("connected");
                if (!quiet) setAlert({ msg: `Batch restored (${detail.batch.status}).`, ok: true });
                return;
            }

            if (!quiet) setAlert({ msg: "Batch restored — live updates connected.", ok: true });
            watchBatch(batchId);
        } catch (e: unknown) {
            activeBatchRef.current = null;
            setSockSt("error");
            setAlert({ msg: (e as Error).message, ok: false });
            clearBatchFromUrl();
        }
    }, [getBatch, leaveBatchRoom, setBatch, setChecks, setAlert, setSockSt, watchBatch]);

    const disconnectSocket = useCallback(() => {
        if (activeBatchRef.current) leaveBatchRoom(activeBatchRef.current);
        activeBatchRef.current = null;
        socketRef.current?.disconnect();
        socketRef.current = null;
        setSockSt("idle");
    }, [leaveBatchRoom, setSockSt]);

    useEffect(() => {
        const id = getBatchFromUrl();
        if (id) void startLiveBatch(id, { quiet: true });

        const onPopState = () => {
            const next = getBatchFromUrl();
            if (next && next !== activeBatchRef.current) {
                void startLiveBatch(next, { quiet: true });
            } else if (!next) {
                if (activeBatchRef.current) leaveBatchRoom(activeBatchRef.current);
                activeBatchRef.current = null;
                setBatch(null);
                setChecks(new Map());
                setSockSt("idle");
            }
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [startLiveBatch, leaveBatchRoom, setBatch, setChecks, setSockSt]);

    return { startLiveBatch, watchBatch, disconnectSocket, activeBatchRef };
}
