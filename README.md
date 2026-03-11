# Street Cast PWA

A Progressive Web App for displaying advertising content on connected screens. Preferred demo path: open it directly in the TV browser, let the browser cache videos locally, and avoid extra Raspberry Pi hardware unless the TV browser proves insufficient.

The repo currently includes a temporary `api/` folder for Vercel demo deployment. That API is intentionally provisional and should later be replaced by `street-cast-server`.

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

Preferred runtime config for demos: same-origin API by default, with optional query params for local/dev overrides.

```text
/?deviceId=tv-demo-01
/?serverUrl=https://your-server.example.com&deviceId=tv-demo-01
```

When `serverUrl` is omitted, the app uses the same origin. This is the intended Vercel demo setup with the temporary local `api/` routes.

The app persists the last working config in browser storage, so the TV can reopen the same URL later and continue using cached videos offline.

Build-time config is still supported with Vite env vars:

```bash
VITE_DEVICE_ID=device_123
VITE_SERVER_URL=https://api.streetcast.com
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

### Vercel Demo

1. Import the repo in Vercel
2. Keep the default Vite build command or use `npm run build`
3. Keep `dist` as the output directory
4. Deploy
5. Open `https://your-project.vercel.app/?deviceId=demo-tv&debug=true`

The Vercel deployment uses the temporary same-origin `api/` routes in this repo:

- `GET /api/manifest/[deviceId]`
- `POST /api/impression`
- `GET /api/health`

These routes are demo-only and should be replaced by `street-cast-server` later.

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
