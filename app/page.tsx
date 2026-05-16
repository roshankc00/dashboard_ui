"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import { io, Socket } from "socket.io-client";

const API = process.env.NEXT_PUBLIC_API_URL;

type UrlCheck = {
  urlCheckId: string; url: string; status: string;
  statusCode?: number; responseTimeMs?: number; title?: string; error?: string;
};
type Batch = {
  id: string; status: string; totalUrls: number; finishedCount: number;
  completedOk: number; failedCount: number; cancelledCount: number;
};

function parseUrls(input: string) {
  const seen = new Set<string>();
  return input.split(/\r?\n/).map(l => l.trim().split(",")[0]?.trim() ?? "").filter(Boolean)
    .map(u => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).toString(); } catch { return ""; } })
    .filter(u => u && !seen.has(u) && seen.add(u));
}

function isRunning(status: string) {
  return status === "queued" || status === "running";
}

export default function Home() {
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [checks, setChecks] = useState<Map<string, UrlCheck>>(new Map());
  const [sockSt, setSockSt] = useState("idle");
  const [alert, setAlert] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const activeBatch = useRef<string | null>(null);

  const urls = parseUrls(input);


  function getBatchFromUrl() {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("batch");
  }

  function setBatchInUrl(batchId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("batch", batchId);
    window.history.replaceState({ batchId }, "", url);
  }

  function clearBatchFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("batch");
    window.history.replaceState(null, "", url);
  }


  const apiFetch = async (path: string, opts: RequestInit = {}) => {
    const res = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message ?? `Error ${res.status}`);
    return json.data ?? json;
  };

  const getSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;
    const s = io(API, { path: "/socket.io" });
    s.on("connect", () => {
      setSockSt("connected");
      if (activeBatch.current) s.emit("batch:join", activeBatch.current);
    });
    s.on("disconnect", () => setSockSt("reconnecting"));
    s.on("connect_error", () => setSockSt("error"));
    socketRef.current = s;
    return s;
  }, []);

  function leaveBatchRoom(batchId: string) {
    if (!socketRef.current) return;
    socketRef.current.emit("batch:leave", batchId);
    socketRef.current.off("batch:progress");
    socketRef.current.off("batch:urlResult");
    socketRef.current.off("batch:cancelled");
  }

  function watchBatch(batchId: string) {
    activeBatch.current = batchId;
    setSockSt("connecting");
    const s = getSocket();
    s.off("batch:progress"); s.off("batch:urlResult"); s.off("batch:cancelled");

    s.on("batch:progress", (p: Batch & { batchId: string; batchStatus: string }) => {
      if (p.batchId !== batchId) return;
      setBatch(prev => prev ? { ...prev, ...p, status: p.batchStatus } : prev);
      if (!isRunning(p.batchStatus)) {
        leaveBatchRoom(batchId);
        setSockSt("connected");
      }
    });
    s.on("batch:urlResult", (r: UrlCheck & { batchId: string }) => {
      if (r.batchId !== batchId) return;
      setChecks(prev => new Map(prev).set(r.urlCheckId, r));
    });
    s.on("batch:cancelled", ({ batchId: id }: { batchId: string }) => {
      if (id !== batchId) return;
      setBatch(prev => prev ? { ...prev, status: "cancelled" } : prev);
      leaveBatchRoom(batchId);
    });

    if (s.connected) { s.emit("batch:join", batchId); setSockSt("connected"); }
  }

  const startLiveBatch = useCallback(async (batchId: string, opts: { persistUrl?: boolean; quiet?: boolean } = {}) => {
    const { persistUrl = true, quiet = false } = opts;

    // stop any previous watch  
    if (activeBatch.current) leaveBatchRoom(activeBatch.current);
    activeBatch.current = batchId;
    setSockSt("connecting");

    try {
      const detail = await apiFetch(`/api/batches/${batchId}`);
      setBatch(detail.batch);
      setChecks(new Map(detail.urlChecks.map((c: UrlCheck) => [c.urlCheckId, c])));
      if (persistUrl) setBatchInUrl(batchId);

      if (!isRunning(detail.batch.status)) {
        // batch already finished — just show results, no socket needed
        setSockSt("connected");
        if (!quiet) setAlert({ msg: `Batch restored (${detail.batch.status}).`, ok: true });
        return;
      }

      if (!quiet) setAlert({ msg: "Batch restored — live updates connected.", ok: true });
      watchBatch(batchId);
    } catch (e: unknown) {
      setSockSt("error");
      setAlert({ msg: (e as Error).message, ok: false });
      clearBatchFromUrl();
    }
  }, [getSocket]);

  useEffect(() => {
    const id = getBatchFromUrl();
    if (id) void startLiveBatch(id, { quiet: true });

    const onPopState = () => {
      const next = getBatchFromUrl();
      if (next && next !== activeBatch.current) {
        void startLiveBatch(next, { quiet: true });
      } else if (!next) {
        if (activeBatch.current) leaveBatchRoom(activeBatch.current);
        activeBatch.current = null;
        setBatch(null);
        setChecks(new Map());
        setSockSt("idle");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [startLiveBatch]);

  const submit = async () => {
    if (!urls.length) return setAlert({ msg: "No valid URLs found.", ok: false });
    setLoading(true); setAlert(null);
    try {
      const { batchId, totalUrls } = await apiFetch("/api/batches", { method: "POST", body: JSON.stringify({ input }) });
      setAlert({ msg: `Batch created — checking ${totalUrls} URL(s).`, ok: true });
      await startLiveBatch(batchId);
    } catch (e: unknown) { setAlert({ msg: (e as Error).message, ok: false }); }
    finally { setLoading(false); }
  };

  const clear = () => {
    setInput(""); setFileName(""); setBatch(null); setChecks(new Map()); setAlert(null);
    if (activeBatch.current) leaveBatchRoom(activeBatch.current);
    activeBatch.current = null;
    socketRef.current?.disconnect(); socketRef.current = null;
    setSockSt("idle");
    clearBatchFromUrl();
  };

  const loadFile = (f: File) => {
    const r = new FileReader();
    r.onload = () => { setInput(String(r.result ?? "")); setFileName(f.name); };
    r.readAsText(f);
  };

  const checkList = Array.from(checks.values());
  const pct = batch?.totalUrls ? Math.round((batch.finishedCount / batch.totalUrls) * 100) : 0;
  const running = batch ? isRunning(batch.status) : false;

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px", fontFamily: "sans-serif", fontSize: 14, color: "#111" }}>

      {/* header start */}
      <h2 style={{ marginBottom: 4 }}>URL Batch Checker</h2>
      <p style={{ color: "#666", marginBottom: 20 }}>
        Paste URLs or upload a CSV — one URL per line.
        Refresh-safe: batch state is saved in the URL and restored from the API.
      </p>
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
            ● {sockSt}
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
            <button onClick={() => activeBatch.current && apiFetch(`/api/batches/${activeBatch.current}/cancel`, { method: "POST" })}
              style={{ padding: "4px 12px", cursor: "pointer" }}>Cancel</button>
          )}
          {batch.status === "completed" && batch.failedCount > 0 && (
            <button onClick={async () => {
              if (!activeBatch.current) return;
              await apiFetch(`/api/batches/${activeBatch.current}/retry-failed`, { method: "POST" });
              setBatch(b => b ? { ...b, status: "running" } : b);
              watchBatch(activeBatch.current!);
            }} style={{ padding: "4px 12px", cursor: "pointer" }}>Retry failed</button>
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