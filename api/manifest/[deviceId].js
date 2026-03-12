import { createDemoManifest, setApiHeaders } from '../_lib/demo-data.js';

export default function handler(req, res) {
  setApiHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const deviceId = req.query.deviceId || 'demo-tv';
  return res.status(200).json(createDemoManifest(deviceId));
}
