# Street Cast PWA

A Progressive Web App for displaying advertising content on connected screens. Preferred deployment path: host the PWA on Vercel and point it at the real `street-cast-server` deployment.

## Features

- **Offline-First**: Continues playing cached videos when network is unavailable
- **Video Caching**: Intelligent caching with automatic cleanup
- **Impression Tracking**: Reliable impression reporting with retry logic
- **Kiosk Mode**: Optimized for fullscreen display
- **TypeScript**: Full type safety and modern development experience

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development

```bash
# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

## Configuration

Preferred runtime config: `VITE_SERVER_URL` for real deployments, with optional query params for local/dev overrides.

On local Vite dev hosts (`127.0.0.1` or `localhost`), the app now defaults to `http://<same-host>:3050` when `serverUrl` is omitted. Override with `?serverUrl=...` or `?serverPort=...` if your API runs elsewhere.

```text
/?serverUrl=https://your-server.example.com&deviceId=tv-demo-01
/?deviceId=tv-demo-01&serverPort=3050
```

The app persists the last working config in browser storage, so the TV can reopen the same URL later and continue using cached videos offline.

Recommended Vite env vars:

```bash
VITE_DEVICE_ID=device_123
VITE_SERVER_URL=https://your-street-cast-server.vercel.app
```

## Project Structure

```
src/
├── app.ts                 # Main application logic
├── video-manager.ts       # Video playback and caching
├── impression-tracker.ts  # Impression reporting
├── types/
│   └── index.ts          # TypeScript type definitions
└── utils/
    └── storage.ts        # IndexedDB utilities
```

## API Integration

### Manifest Endpoint

```
GET /api/manifest/[deviceId]
```

### Impression Endpoint

```
POST /api/impression
```

## Deployment

### Vercel

1. Import the repo in Vercel
2. Keep the default Vite build command or use `npm run build`
3. Keep `dist` as the output directory
4. Add environment variable `VITE_SERVER_URL=https://your-street-cast-server.vercel.app`
5. Deploy
6. Open `https://your-project.vercel.app/?deviceId=demo-tv&debug=true`

The real API is expected to be served by the deployed `street-cast-server` app:

- `GET /api/manifest/[deviceId]`
- `POST /api/impression`
- `GET /api/health`

## Demo Checklist

1. Open `/?deviceId=tv-demo-01&debug=true`
2. Confirm the first creative plays
3. Disconnect network or block the API
4. Reload and confirm cached playback still works
5. Reconnect and verify manifest refresh resumes automatically

## Development Phases

- **Phase 1 (MVP)**: Basic video playback with offline capability
- **Phase 2**: Enhanced reliability and monitoring
- **Phase 3**: Advanced features and management
- **Phase 4**: Production deployment and optimization

## License

MIT
