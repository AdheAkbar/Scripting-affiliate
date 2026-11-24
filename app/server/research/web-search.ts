// Pencarian web untuk riset tren & produk lewat Tavily (API search untuk LLM, ada kuota gratis bulanan).
// 9router tidak menyediakan web search yang bisa dipanggil dari server, jadi riset dicari di sini lalu dirangkum LLM.
import type { SearchResult } from "../ai/llm";

export function createTavilySearch(apiKey: string, fetchImpl: typeof fetch = fetch) {
  return async (query: string): Promise<SearchResult[]> => {
    const res = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, max_results: 5, search_depth: "basic", topic: "general" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string; published_date?: string }[] };
    return (data.results ?? []).flatMap((r) =>
      r.url ? [{ title: r.title ?? r.url, url: r.url, content: r.content ?? "", publishedDate: r.published_date }] : [],
    );
  };
}
