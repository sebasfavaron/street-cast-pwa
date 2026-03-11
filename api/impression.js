import { TEMPORARY_API_NOTE, setApiHeaders } from './_lib/demo-data.js';

export default async function handler(req, res) {
  setApiHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  return res.status(200).json({
    ok: true,
    source: 'temporary-vercel-demo-api',
    note: TEMPORARY_API_NOTE,
    receivedAt: new Date().toISOString(),
    impression: req.body ?? null,
  });
}
