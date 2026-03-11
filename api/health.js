import { TEMPORARY_API_NOTE, setApiHeaders } from './_lib/demo-data.js';

export default function handler(req, res) {
  setApiHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return res.status(200).json({
    ok: true,
    source: 'temporary-vercel-demo-api',
    note: TEMPORARY_API_NOTE,
    checkedAt: new Date().toISOString(),
  });
}
