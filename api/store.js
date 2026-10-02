export function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return {
    url,
    key,
    configured: Boolean(url && key),
    partial: Boolean(url || key) && !(url && key),
  };
}

async function request(url, { method, key, body, prefer }) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  return { ok: response.ok, status: response.status, payload };
}

function rowFrom(payload) {
  if (Array.isArray(payload)) return payload[0] || null;
  if (payload && typeof payload === 'object') return payload;
  return null;
}

export async function insertRsvp(record) {
  const { url, key } = supabaseConfig();
  const result = await request(`${url}/rest/v1/rsvps`, {
    method: 'POST',
    key,
    body: record,
    prefer: 'return=representation',
  });
  return { ...result, row: rowFrom(result.payload) };
}

export async function patchRsvp(id, fields) {
  const { url, key } = supabaseConfig();
  return request(`${url}/rest/v1/rsvps?id=eq.${id}`, {
    method: 'PATCH',
    key,
    body: fields,
    prefer: 'return=minimal',
  });
}

export async function claimNotification(id) {
  const { url, key } = supabaseConfig();
  const claimBody = {
    notification_status: 'sending',
    notification_claimed_at: new Date().toISOString(),
    notification_error: null,
  };
  const fresh = await request(
    `${url}/rest/v1/rsvps?id=eq.${id}&notification_status=in.(pending,failed,unconfigured)`,
    { method: 'PATCH', key, body: claimBody, prefer: 'return=representation' },
  );
  if (!fresh.ok) return { ok: false, claimed: false };
  if (Array.isArray(fresh.payload) && fresh.payload.length > 0) return { ok: true, claimed: true };

  const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const stale = await request(
    `${url}/rest/v1/rsvps?id=eq.${id}&notification_status=eq.sending&notification_claimed_at=lt.${encodeURIComponent(staleBefore)}`,
    { method: 'PATCH', key, body: claimBody, prefer: 'return=representation' },
  );
  if (!stale.ok) return { ok: false, claimed: false };
  return { ok: true, claimed: Array.isArray(stale.payload) && stale.payload.length > 0 };
}

const RSVP_COLUMNS = 'id,created_at,name,email,event,attendance,meal,additional_guests,total_attending,guests,dietary,message,notification_status,notification_error,notification_claimed_at';

export async function getRsvp({ id, email }) {
  const { url, key } = supabaseConfig();
  const filter = id ? `id=eq.${id}` : `email=eq.${encodeURIComponent(email)}`;
  const result = await request(`${url}/rest/v1/rsvps?${filter}&select=${RSVP_COLUMNS}`, { method: 'GET', key });
  if (!result.ok || !Array.isArray(result.payload)) return null;
  return result.payload[0] || null;
}
