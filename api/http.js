export function readJson(req) {
  try {
    if (Number(req.headers['content-length']) > 16000) return { error: 'too_large' };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (JSON.stringify(body ?? '').length > 16000) return { error: 'too_large' };
    return { body };
  } catch {
    return { error: 'invalid' };
  }
}

export function sendJson(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(payload);
}
