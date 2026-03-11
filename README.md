# Street Cast PWA

A Progressive Web App for displaying advertising content on connected screens. Preferred demo path: open it directly in the TV browser, let the browser cache videos locally, and avoid extra Raspberry Pi hardware unless the TV browser proves insufficient.

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

Preferred runtime config for demos: query params or persisted browser config.

```text
/?serverUrl=https://your-server.example.com&deviceId=tv-demo-01
```

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

1. Build the application: `npm run build`
2. Deploy the `dist` folder to your web server
3. Open the app on the target TV browser with `serverUrl` and `deviceId` query params
4. Verify the first manifest sync downloads videos into browser storage
5. Reload offline and confirm cached playback continues

## Demo Checklist

1. Open `/?serverUrl=...&deviceId=tv-demo-01&debug=true`
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
