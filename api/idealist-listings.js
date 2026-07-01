// Vercel serverless function — auto-fetches The JJ Center's volunteer listings from Idealist
// Parses the server-rendered HTML for volunteer opportunity links — no API key needed.
// Results cached at the Vercel edge for 1 hour so listings stay fresh automatically.

const ORG_ID      = '45ee5baed0db4744bff95f53154528a8';
const ORG_SLUG    = 'the-jj-center-inc-washington';
const ORG_PAGE    = `https://www.idealist.org/en/nonprofit/${ORG_ID}-${ORG_SLUG}?tab=VOLOP`;
const VOLOP_BASE  = 'https://www.idealist.org/en/volunteer-opportunity/';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
  };
}

async function fetchListings() {
  const res = await fetch(ORG_PAGE, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  });

  if (!res.ok) throw new Error(`Idealist page returned ${res.status}`);
  const html = await res.text();

  // ── Strategy 1: regex-scan HTML for volunteer opportunity anchor tags ──
  // Idealist SSR embeds <a href="/en/volunteer-opportunity/ID-slug">Title</a>
  const listings = [];
  const seen = new Set();

  // Match anchor tags containing a volunteer-opportunity path
  const anchorRe = /<a[^>]+href="(\/en\/volunteer-opportunity\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    const href  = m[1];
    const inner = m[2].replace(/<[^>]+>/g, '').trim(); // strip nested tags
    if (!inner || seen.has(href)) continue;
    seen.add(href);
    listings.push({
      title: decodeHtmlEntities(inner),
      url:   'https://www.idealist.org' + href,
      location: '',
    });
  }

  if (listings.length > 0) return listings;

  // ── Strategy 2: extract from __NEXT_DATA__ embedded JSON ──
  const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (ndMatch) {
    try {
      const nd = JSON.parse(ndMatch[1]);
      const found = findVolops(nd);
      if (found && found.length > 0) return found;
    } catch (_) {}
  }

  return [];
}

// Recursively search Next.js page data for VOLOP objects
function findVolops(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    const hits = obj.filter(i =>
      i && typeof i === 'object' &&
      (i.type === 'VOLOP' || i.listingType === 'VOLOP' || i.actionType === 'VOLOP') &&
      (i.name || i.title)
    );
    if (hits.length > 0) return hits.map(normalizeNextItem);
    for (const item of obj) {
      const r = findVolops(item);
      if (r) return r;
    }
    return null;
  }
  for (const key of Object.keys(obj)) {
    const r = findVolops(obj[key]);
    if (r) return r;
  }
  return null;
}

function normalizeNextItem(item) {
  const id    = item.id || item._id || '';
  const slug  = item.slug || item.urlSlug || '';
  const title = item.name || item.title || '';
  const city  = item.city || item.location?.city || '';
  const state = item.state || item.location?.state || '';
  const remote = item.isRemote || item.remote || false;
  const location = remote ? 'Remote' : (city && state) ? `${city}, ${state}` : city || state || '';
  const url = id && slug ? `${VOLOP_BASE}${id}-${slug}` : id ? `${VOLOP_BASE}${id}` : ORG_PAGE;
  return { title, url, location };
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  try {
    const listings = await fetchListings();

    if (listings.length > 0) {
      res.writeHead(200, corsHeaders(origin));
      res.end(JSON.stringify({ ok: true, listings }));
    } else {
      res.writeHead(200, corsHeaders(origin));
      res.end(JSON.stringify({ ok: false, listings: [], fallbackUrl: ORG_PAGE }));
    }
  } catch (err) {
    res.writeHead(200, corsHeaders(origin));
    res.end(JSON.stringify({ ok: false, listings: [], fallbackUrl: ORG_PAGE, error: err.message }));
  }
}
