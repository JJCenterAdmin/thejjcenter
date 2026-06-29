// Vercel serverless function — fetches The JJ Center's volunteer listings from Idealist
// Deployed at: /api/idealist-listings
// Cached at the edge for 1 hour to avoid hammering Idealist

const ORG_ID   = '45ee5baed0db4744bff95f53154528a8';
const ORG_SLUG = 'the-jj-center-inc-washington';
const ORG_PAGE = `https://www.idealist.org/en/nonprofit/${ORG_ID}-${ORG_SLUG}`;

// Known Idealist internal API endpoints to try in order
const ENDPOINTS = [
  // Primary: Idealist search API filtered to this org's volunteer ops
  `https://www.idealist.org/api/v1/search?type=VOLOP&organizationId=${ORG_ID}&limit=50`,
  // Alternate slug format some Idealist versions use
  `https://www.idealist.org/api/v1/actions?type=VOLOP&organizationId=${ORG_ID}&limit=50`,
  // Org-scoped listing endpoint
  `https://www.idealist.org/api/v1/organizations/${ORG_ID}/listings?type=VOLOP&limit=50`,
];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; JJCenter-Dashboard/1.0)',
  'Accept': 'application/json',
  'Referer': ORG_PAGE,
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
  };
}

// Normalize a listing object from different possible Idealist response shapes
function normalize(item) {
  const id    = item.id   || item._id   || item.listingId || '';
  const title = item.name || item.title || item.listing_name || '';
  const slug  = item.slug || item.urlSlug || '';
  const city  = item.city || item.location?.city || '';
  const state = item.state || item.location?.state || '';
  const remote = item.isRemote || item.remote || false;

  // Build the Idealist URL for this listing
  let url = '';
  if (id && slug) {
    url = `https://www.idealist.org/en/volunteer-opportunity/${id}-${slug}`;
  } else if (id) {
    url = `https://www.idealist.org/en/volunteer-opportunity/${id}`;
  } else {
    url = ORG_PAGE + '?tab=VOLOP#opportunities';
  }

  const location = remote ? 'Remote'
    : (city && state) ? `${city}, ${state}`
    : city || state || 'Washington, DC';

  return { title, url, location };
}

// Try each endpoint until one returns usable data
async function fetchListings() {
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, { headers: FETCH_HEADERS });
      if (!res.ok) continue;

      const json = await res.json();

      // Idealist responses vary — handle different shapes
      const items =
        json.results   ||   // search API
        json.listings  ||   // listings API
        json.actions   ||   // actions API
        json.data?.results ||
        json.data      ||
        (Array.isArray(json) ? json : null);

      if (Array.isArray(items) && items.length > 0) {
        return items
          .filter(i => i && (i.name || i.title))
          .map(normalize);
      }
    } catch (_) {
      // try next endpoint
    }
  }
  return null; // all endpoints failed
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  try {
    const listings = await fetchListings();

    if (listings && listings.length > 0) {
      res.writeHead(200, corsHeaders(origin));
      res.end(JSON.stringify({ ok: true, listings, source: 'idealist-api' }));
    } else {
      // All API endpoints failed — return fallback so dashboard can show direct link
      res.writeHead(200, corsHeaders(origin));
      res.end(JSON.stringify({
        ok: false,
        listings: [],
        fallbackUrl: ORG_PAGE + '?tab=VOLOP#opportunities',
        message: 'Could not fetch live listings — Idealist API unavailable.'
      }));
    }
  } catch (err) {
    res.writeHead(500, corsHeaders(origin));
    res.end(JSON.stringify({ ok: false, listings: [], error: err.message }));
  }
}
