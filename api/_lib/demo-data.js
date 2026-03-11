export const TEMPORARY_API_NOTE =
  'Temporary demo API hosted inside street-cast-pwa for Vercel deployment. Replace with street-cast-server later.';

export function createDemoManifest(deviceId = 'demo-tv') {
  return {
    version: 'demo-2026-03-11-2',
    deviceId,
    source: 'temporary-vercel-demo-api',
    notes: [TEMPORARY_API_NOTE],
    creatives: [
      {
        id: 'creative-bunny',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        duration: 10,
        campaignId: 'campaign-demo-1',
        campaignName: 'Big Buck Bunny',
      },
      {
        id: 'creative-elephants',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        duration: 10,
        campaignId: 'campaign-demo-2',
        campaignName: 'Elephants Dream',
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function setApiHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
