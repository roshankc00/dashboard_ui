"use client";
import { useState, useMemo } from "react";
import { Batch, UrlCheck } from "../types";
import { parseUrls } from "@/lib/parseUrls";
import { isRunning } from "@/lib/isRunning";
import { clearBatchFromUrl } from "@/lib/urls";
import Header from "../home/Header";
import { useSocket } from "@/hooks/useSocket";

export default function Home() {
    const [input, setInput] = useState("");
    const [fileName, setFileName] = useState("");
    const [batch, setBatch] = useState<Batch | null>(null);
    const [checks, setChecks] = useState<Map<string, UrlCheck>>(new Map());
    const [sockSt, setSockSt] = useState("idle");
    const [alert, setAlert] = useState<{ msg: string; ok: boolean } | null>(null);
    const [loading, setLoading] = useState(false);

    const { startLiveBatch, watchBatch, disconnectSocket, activeBatchRef, apiFetch } = useSocket({
        setBatch,
        setChecks,
        setAlert,
        setSockSt,
    });

    const urls = useMemo(() => parseUrls(input), [input]);

    const submit = async () => {
        if (!urls.length) return setAlert({ msg: "No valid URLs found.", ok: false });
        setLoading(true);
        setAlert(null);
        try {
            const { batchId, totalUrls } = await apiFetch("/api/batches", { method: "POST", body: JSON.stringify({ input }) });
            setAlert({ msg: `Batch created — checking ${totalUrls} URL(s).`, ok: true });
            await startLiveBatch(batchId);
        } catch (e: unknown) {
            setAlert({ msg: (e as Error).message, ok: false });
        } finally {
            setLoading(false);
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
        <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px", fontFamily: "sans-serif", fontSize: 14, color: "#111" }}>

            {/* header start */}
            <Header />
            {/* header end */}

            {/* alert start */}
            {alert && (
                <p style={{ marginBottom: 12, color: alert.ok ? "green" : "red" }}>{alert.msg}</p>
            )}
            {/* alert end */}

            {/* drop zone start */}
            <div
                onClick={() => document.getElementById("fi")?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
                style={{ border: "1px dashed #bbb", borderRadius: 4, padding: "20px", textAlign: "center", cursor: "pointer", marginBottom: 8, color: "#555" }}>
                <input id="fi" type="file" accept=".csv,.txt" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
                Drop a .csv / .txt here or click to browse
                {fileName && <span style={{ marginLeft: 8, color: "green" }}>({fileName})</span>}
            </div>
            {/* drop zone end */}

            {/* paste input start */}
            <textarea
                value={input} onChange={e => setInput(e.target.value)}
                placeholder={"Website URLs"}
                style={{ width: "100%", height: 100, fontFamily: "monospace", fontSize: 12, padding: 8, boxSizing: "border-box", border: "1px solid #ccc", borderRadius: 4, resize: "vertical", marginBottom: 8 }} />
            {urls.length > 0 && <p style={{ color: "#555", marginBottom: 8 }}>{urls.length} unique URL(s)</p>}
            {/* paste input end */}

            {/* actions start */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                <button onClick={submit} disabled={loading} style={{ padding: "6px 16px", cursor: "pointer" }}>
                    {loading ? "Submitting…" : "Start"}
                </button>
                <button onClick={clear} style={{ padding: "6px 16px", cursor: "pointer" }}>Clear</button>
            </div>
            {/* actions end */}

            {batch && (<>
                {/* batch header start */}
                <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <span style={{ color: "#555" }}>Batch: </span>
                        <code style={{ fontSize: 12 }}>{batch.id}</code>
                        <span style={{
                            marginLeft: 8, textTransform: "uppercase", fontSize: 12, fontWeight: "bold",
                            color: batch.status === "completed" ? "green" : batch.status === "cancelled" ? "orange" : batch.status === "running" ? "blue" : "#555"
                        }}>
                            {batch.status}
                        </span>
                    </div>
                    <span style={{ fontSize: 12, color: sockSt === "connected" ? "green" : sockSt === "error" ? "red" : "orange" }}>
                        {sockSt}
                    </span>
                </div>
                {/* batch header end */}

                {/* stats start */}
                <p style={{ color: "#555", marginBottom: 6 }}>
                    {batch.finishedCount}/{batch.totalUrls} done &nbsp;·&nbsp;
                    <span style={{ color: "green" }}>{batch.completedOk} ok</span> &nbsp;·&nbsp;
                    <span style={{ color: "red" }}>{batch.failedCount} failed</span> &nbsp;·&nbsp;
                    {batch.cancelledCount} cancelled
                </p>
                {/* stats end */}

                {/* progress bar start */}
                <progress value={pct} max={100} style={{ width: "100%", marginBottom: 10, display: "block" }} />
                {/* progress bar end */}

                {/* batch actions start */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {running && (
                        <button
                            onClick={() => activeBatchRef.current && apiFetch(`/api/batches/${activeBatchRef.current}/cancel`, { method: "POST" })}
                            style={{ padding: "4px 12px", cursor: "pointer" }}
                        >
                            Cancel
                        </button>
                    )}
                    {batch.status === "completed" && batch.failedCount > 0 && (
                        <button
                            onClick={async () => {
                                const batchId = activeBatchRef.current ?? batch.id;
                                await apiFetch(`/api/batches/${batchId}/retry-failed`, { method: "POST" });
                                activeBatchRef.current = batchId;
                                setBatch(b => (b ? { ...b, status: "running" } : b));
                                watchBatch(batchId);
                            }}
                            style={{ padding: "4px 12px", cursor: "pointer" }}
                        >
                            Retry failed
                        </button>
                    )}
                </div>
                {/* batch actions end */}

                {/* results table start */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: "1px solid #ddd", color: "#555" }}>
                            <th style={{ textAlign: "left", padding: "4px 8px 4px 0" }}>URL</th>
                            <th style={{ textAlign: "left", padding: "4px 8px 4px 0" }}>Status</th>
                            <th style={{ textAlign: "left", padding: "4px 8px 4px 0" }}>Code</th>
                            <th style={{ textAlign: "left", padding: "4px 8px 4px 0" }}>Time</th>
                            <th style={{ textAlign: "left", padding: "4px 0" }}>Title / Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        {checkList.map(c => (
                            <tr key={c.urlCheckId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                <td style={{ padding: "4px 8px 4px 0", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 11 }} title={c.url}>{c.url}</td>
                                <td style={{ padding: "4px 8px 4px 0", color: c.status === "completed" ? "green" : c.status === "failed" ? "red" : c.status === "running" ? "blue" : "#555" }}>{c.status}</td>
                                <td style={{ padding: "4px 8px 4px 0" }}>{c.statusCode ?? "—"}</td>
                                <td style={{ padding: "4px 8px 4px 0" }}>{c.responseTimeMs != null ? `${c.responseTimeMs}ms` : "—"}</td>
                                <td style={{ padding: "4px 0", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#555" }}>{c.title || c.error || "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {/* results table end */}

            </>)}
        </div>
    );
}
