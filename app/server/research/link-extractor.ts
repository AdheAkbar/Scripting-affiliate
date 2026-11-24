// Ekstraksi ringan halaman produk (prd.md §2 [1]): fetch 1x, timeout 8 dtk, TANPA bypass anti-bot.
// Gagal (403/429/CAPTCHA/timeout/HTML kosong) -> status "blocked", tidak pernah throw; pipeline lanjut
// dengan foto + deskripsi + riset web. Parser memakai regex meta/JSON-LD, jadi tanpa dependency Cheerio.

export type ExtractResult =
  | { status: "success"; specs: Record<string, string> }
  | { status: "blocked"; reason: string };

const CAPTCHA_HINTS = /captcha|verify you are human|robot check|akses ditolak|access denied|cf-chl|challenge-platform/i;

function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function meta(html: string, key: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
    "i",
  );
  const m = html.match(re);
  const v = m?.[1] ?? m?.[2];
  return v ? decode(v) : undefined;
}

function jsonLdProduct(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1] ?? "");
    } catch {
      continue; // JSON-LD rusak di halaman pihak ketiga: abaikan blok ini, sumber lain masih dicoba
    }
    const nodes = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
    const product = nodes.find((n) => n && (n["@type"] === "Product" || (Array.isArray(n["@type"]) && n["@type"].includes("Product"))));
    if (!product) continue;
    const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);
    const offers = (Array.isArray(product.offers) ? product.offers[0] : product.offers) as Record<string, unknown> | undefined;
    const rating = product.aggregateRating as Record<string, unknown> | undefined;
    const brand = product.brand as Record<string, unknown> | string | undefined;
    const entries: [string, string | undefined][] = [
      ["name", str(product.name)],
      ["description", str(product.description)],
      ["brand", typeof brand === "string" ? brand : str(brand?.name)],
      ["price", str(offers?.price)],
      ["priceCurrency", str(offers?.priceCurrency)],
      ["ratingValue", str(rating?.ratingValue)],
      ["reviewCount", str(rating?.reviewCount ?? rating?.ratingCount)],
    ];
    for (const [k, v] of entries) if (v) out[k] = decode(v);
  }
  return out;
}

export async function extractProductPage(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<ExtractResult> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
      headers: { "Accept-Language": "id-ID,id;q=0.9", Accept: "text/html" },
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    return { status: "blocked", reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : `network: ${String(err)}` };
  }
  if (!res.ok) return { status: "blocked", reason: `http_${res.status}` };
  const html = (await res.text()).slice(0, 2_000_000);
  if (CAPTCHA_HINTS.test(html.slice(0, 20000)) && !/application\/ld\+json/i.test(html)) {
    return { status: "blocked", reason: "captcha" };
  }
  const specs: Record<string, string> = { ...jsonLdProduct(html) };
  const fill = (k: string, v?: string) => {
    if (v && !specs[k]) specs[k] = v;
  };
  fill("name", meta(html, "og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim());
  fill("description", meta(html, "og:description") ?? meta(html, "description"));
  fill("price", meta(html, "product:price:amount") ?? meta(html, "og:price:amount"));
  fill("image", meta(html, "og:image"));
  if (!specs.name && !specs.description) return { status: "blocked", reason: "empty_page" };
  return { status: "success", specs };
}
