export const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...opts,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message ?? `Error ${res.status}`);
    return (json.data ?? json) as T;
}
