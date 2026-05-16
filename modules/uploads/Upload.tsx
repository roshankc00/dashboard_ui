"use client";

import { useState, useMemo } from "react";
import { Batch, UrlCheck } from "../types";
import { parseUrls } from "@/lib/parseUrls";
import { isRunning } from "@/lib/isRunning";
import { clearBatchFromUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";
import Header from "../home/Header";
import { useSocket } from "@/hooks/useSocket";
import { useCancelBatch, useCreateBatch, useRetryFailedBatch } from "@/services";
import { Button } from "@/components/ui/button";
import { batchStatusClass } from "@/lib/batchStatusClass";
import { socketStatusClass } from "@/lib/socketStatusClass";
import { checkStatusClass } from "@/lib/checkStatusClass";

export const Uploads = () => {
    const [input, setInput] = useState("");
    const [fileName, setFileName] = useState("");
    const [batch, setBatch] = useState<Batch | null>(null);
    const [checks, setChecks] = useState<Map<string, UrlCheck>>(new Map());
    const [sockSt, setSockSt] = useState("idle");
    const [alert, setAlert] = useState<{ msg: string; ok: boolean } | null>(null);
    const createBatch = useCreateBatch();
    const cancelBatch = useCancelBatch();
    const retryFailedBatch = useRetryFailedBatch();

    const { startLiveBatch, disconnectSocket, activeBatchRef } = useSocket({
        setBatch,
        setChecks,
        setAlert,
        setSockSt,
    });

    const urls = useMemo(() => parseUrls(input), [input]);

    const submit = async () => {
        if (!urls.length) return setAlert({ msg: "No valid URLs found.", ok: false });
        setAlert(null);
        try {
            const { batchId, totalUrls } = await createBatch.mutateAsync(input);
            setAlert({ msg: `Batch created — checking ${totalUrls} URL(s).`, ok: true });
            await startLiveBatch(batchId);
        } catch (e: unknown) {
            setAlert({ msg: (e as Error).message, ok: false });
        }
    };

    const clear = () => {
        setInput("");
        setFileName("");
        setBatch(null);
        setChecks(new Map());
        setAlert(null);
        disconnectSocket();
        clearBatchFromUrl();
    };

    const loadFile = (f: File) => {
        const r = new FileReader();
        r.onload = () => {
            setInput(String(r.result ?? ""));
            setFileName(f.name);
        };
        r.readAsText(f);
    };

    const checkList = Array.from(checks.values());
    const pct = batch?.totalUrls ? Math.round((batch.finishedCount / batch.totalUrls) * 100) : 0;
    const running = batch ? isRunning(batch.status) : false;

    return (
        <div className="mx-auto max-w-[720px] px-4 py-10 text-sm text-foreground">

            <Header />

            {alert && (
                <p className={cn("mb-3", alert.ok ? "text-green-600" : "text-red-600")}>
                    {alert.msg}
                </p>
            )}

            <div
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && document.getElementById("fi")?.click()}
                onClick={() => document.getElementById("fi")?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) loadFile(f);
                }}
                className="mb-2 cursor-pointer rounded border border-dashed border-border px-5 py-5 text-center text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50"
            >
                <input
                    id="fi"
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) loadFile(f);
                    }}
                />
                Drop a .csv / .txt here or click to browse
                {fileName && <span className="ml-2 text-green-600">({fileName})</span>}
            </div>

            <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Website URLs"
                className="mb-2 box-border h-[100px] w-full resize-y rounded border border-input bg-background px-2 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {urls.length > 0 && (
                <p className="mb-2 text-muted-foreground">{urls.length} unique URL(s)</p>
            )}

            <div className="mb-6 flex gap-2">
                <Button onClick={submit} disabled={createBatch.isPending}>
                    {createBatch.isPending ? "Submitting…" : "Start"}
                </Button>
                <Button variant="outline" onClick={clear}>
                    Clear
                </Button>
            </div>

            {batch && (
                <>
                    <div className="mb-2 flex items-center justify-between">
                        <div>
                            <span className="text-muted-foreground">Batch: </span>
                            <code className="text-xs">{batch.id}</code>
                            <span className={batchStatusClass(batch.status)}>{batch.status}</span>
                        </div>
                        <span className={socketStatusClass(sockSt)}>{sockSt}</span>
                    </div>

                    <p className="mb-1.5 text-muted-foreground">
                        {batch.finishedCount}/{batch.totalUrls} done ·{" "}
                        <span className="text-green-600">{batch.completedOk} ok</span> ·{" "}
                        <span className="text-red-600">{batch.failedCount} failed</span> ·{" "}
                        {batch.cancelledCount} cancelled
                    </p>

                    <progress value={pct} max={100} className="mb-2.5 block h-2 w-full" />

                    <div className="mb-3 flex gap-2">
                        {running && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => activeBatchRef.current && cancelBatch.mutate(activeBatchRef.current)}
                                disabled={cancelBatch.isPending}
                            >
                                {cancelBatch.isPending ? "Cancelling…" : "Cancel"}
                            </Button>
                        )}
                        {batch.status === "completed" && batch.failedCount > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    const batchId = activeBatchRef.current ?? batch.id;
                                    try {
                                        await retryFailedBatch.mutateAsync(batchId);
                                        await startLiveBatch(batchId, { quiet: true, refresh: true });
                                    } catch (e: unknown) {
                                        setAlert({ msg: (e as Error).message, ok: false });
                                    }
                                }}
                                disabled={retryFailedBatch.isPending}
                            >
                                {retryFailedBatch.isPending ? "Retrying…" : "Retry failed"}
                            </Button>
                        )}
                    </div>

                    <table className="w-full border-collapse text-[13px]">
                        <thead>
                            <tr className="border-b border-border text-muted-foreground">
                                <th className="py-1 pr-2 text-left">URL</th>
                                <th className="py-1 pr-2 text-left">Status</th>
                                <th className="py-1 pr-2 text-left">Code</th>
                                <th className="py-1 pr-2 text-left">Time</th>
                                <th className="py-1 text-left">Title / Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {checkList.map(c => (
                                <tr key={c.urlCheckId} className="border-b border-border/50">
                                    <td
                                        className="max-w-[200px] truncate py-1 pr-2 font-mono text-[11px]"
                                        title={c.url}
                                    >
                                        {c.url}
                                    </td>
                                    <td className={cn("py-1 pr-2", checkStatusClass(c.status))}>
                                        {c.status}
                                    </td>
                                    <td className="py-1 pr-2">{c.statusCode ?? "—"}</td>
                                    <td className="py-1 pr-2">
                                        {c.responseTimeMs != null ? `${c.responseTimeMs}ms` : "—"}
                                    </td>
                                    <td
                                        className="max-w-[200px] truncate py-1 text-muted-foreground"
                                        title={c.title || c.error || undefined}
                                    >
                                        {c.title || c.error || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
}
