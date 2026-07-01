// Vercel serverless function — fetches The JJ Center's volunteer listings from Idealist
// Strategy 1: Extract __NEXT_DATA__ embedded JSON from Idealist's SSR page
// Strategy 2: Claude AI parses the raw HTML if NEXT_DATA isn't usable
// Cached at the Vercel edge for 1 hour

const ORG_ID   = '45ee5baed0db4744bff95f53154528a8';
const ORG_SLUG = 'the-jj-center-inc-washington';
const ORG_PAGE_URL = `https://www.idealist.org/en/nonprofit/${ORG_ID}-${ORG_SLUG}?tab=VOLOP`;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
  };
}

// Fetch the Idealist org page HTML (it's Next.js SSR so listings are in the HTML)
async function fetchPageHtml() {
  const res = await fetch(ORG_PAGE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`Idealist returned ${res.status}`);
  return res.text();
}

// Strategy 1: Pull listings from Next.js __NEXT_DATA__ embedded JSON
function extractFromNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;

  let nextData;
  try { nextData = JSON.parse(match[1]); } catch (_) { return null; }

  // Walk the Next.js page props looking for volunteer opportunity arrays
  const json = JSON.stringify(nextData);

  // Idealist embeds listings in various prop paths — try to find arrays of VOLOP objects
  function findListings(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
      const volops = obj.filter(i =>
        i && typeof i === 'object' &&
        (i.type === 'VOLOP' || i.listingType === 'VOLOP' || i.actionType === 'VOLOP') &&
        (i.name || i.title)
      );
      if (volops.length > 0) return volops;
    }
    for (const key of Object.keys(obj)) {
      const result = findListings(obj[key]);
      if (result) return result;
    }
    return null;
  }

  const items = findListings(nextData);
  if (!items || items.length === 0) return null;

  return items.map(item => {
    const id    = item.id || item._id || '';
    const slug  = item.slug || item.urlSlug || '';
    const title = item.name || item.title || '';
    const city  = item.city || item.location?.city || '';
    const state = item.state || item.location?.state || '';
    const remote = item.isRemote || item.remote || false;
    const location = remote ? 'Remote (United States)'
      : (city && state) ? `${city}, ${state}`
      : city || state || 'Washington, DC';
    const url = (id && slug)
      ? `https://www.idealist.org/en/volunteer-opportunity/${id}-${slug}`
      : (id ? `https://www.idealist.org/en/volunteer-opportunity/${id}` : ORG_PAGE_URL);
    return { title, url, location };
  }).filter(i => i.title);
}

// Strategy 2: Ask Claude to extract listings from the raw HTML
async function extractWithClaude(html) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // Trim HTML to a manageable size — keep the body, drop scripts/styles
  const trimmed = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 40000); // Claude context limit safety

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract all volunteer opportunity listings from this Idealist nonprofit page for "The JJ Center". Return ONLY a JSON array, no other text. Each item: {"title":"...", "url":"...", "location":"..."}. For URLs use the full idealist.org URL if visible, otherwise use "${ORG_PAGE_URL}". Page text:\n\n${trimmed}`
      }]
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.content?.[0]?.text || '';

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;
    const listings = JSON.parse(jsonMatch[0]);
    if (Array.isArray(listings) && listings.length > 0) return listings;
  } catch (_) {}
  return null;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  const fallback = {
    ok: false,
    listings: [],
    fallbackUrl: ORG_PAGE_URL,
  };

  try {
    const html = await fetchPageHtml();

    // Strategy 1: __NEXT_DATA__
    let listings = extractFromNextData(html);

    // Strategy 2: Claude AI parser (requires ANTHROPIC_API_KEY in Vercel env vars)
    if (!listings || listings.length === 0) {
      listings = await extractWithClaude(html);
    }

    if (listings && listings.length > 0) {
      res.writeHead(200, corsHeaders(origin));
      res.end(JSON.stringify({ ok: true, listings }));
    } else {
      res.writeHead(200, corsHeaders(origin));
      res.end(JSON.stringify(fallback));
    }
  } catch (err) {
    res.writeHead(200, corsHeaders(origin));
    res.end(JSON.stringify({ ...fallback, error: err.message }));
  }
}
