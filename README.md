# Street Cast PWA

A Progressive Web App for displaying advertising content on Raspberry Pi devices. The PWA polls for video manifests, downloads and caches videos, and plays them in a continuous loop while reporting impressions.

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

Set environment variables:

```bash
DEVICE_ID=device_123
SERVER_URL=https://api.streetcast.com
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
3. Configure Raspberry Pi to open the app in kiosk mode
4. Set up device registration with your server

## Development Phases

- **Phase 1 (MVP)**: Basic video playback with offline capability
- **Phase 2**: Enhanced reliability and monitoring
- **Phase 3**: Advanced features and management
- **Phase 4**: Production deployment and optimization

## License

MIT
