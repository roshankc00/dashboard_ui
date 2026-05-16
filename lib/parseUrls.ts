export const parseUrls = (input: string): string[] => {
    const seen = new Set<string>();
    return input.split(/\r?\n/).map(l => l.trim().split(",")[0]?.trim() ?? "").filter(Boolean)
        .map(u => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).toString(); } catch { return ""; } })
        .filter(u => u && !seen.has(u) && seen.add(u));
}