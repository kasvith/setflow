# Setflow

A Chrome extension for YouTube Music that helps you visualize and track journey phases on playlists. Perfect for planning long listening sessions with distinct phases, sunrise/sunset markers, and time simulation.

## Features

- **Phase Tracking**: Define custom phases with names, durations, and colors
- **Visual Indicators**: Tracks are highlighted with phase colors on YouTube Music playlists
- **Time Simulation**: Hover over tracks to see simulated time progression
- **Celestial Events**: Mark sunrise/sunset times with countdown indicators
- **Presets**: Save and load phase configurations
- **Duration Presets**: Quick 8h or 12h journey templates

## Installation

### From GitHub Releases (Recommended)

1. Go to the [Releases](../../releases) page
2. Download the latest `setflow-extension.zip`
3. Extract the zip file
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" (toggle in top right)
6. Click "Load unpacked"
7. Select the extracted folder

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/setflow.git
   cd setflow
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Usage

1. Click the Setflow extension icon in Chrome
2. Configure your journey:
   - Set a start time (optional, defaults to now)
   - Choose a duration preset (8h, 12h) or customize phases
   - Add sunrise/sunset times if desired
3. Click "Start Planning"
4. Open a playlist on YouTube Music - tracks will be highlighted with phase colors
5. Hover over tracks to see time simulation and phase info

## Development

```bash
# Install dependencies
pnpm install

# Development build with watch
pnpm dev

# Production build
pnpm build

# Type checking
pnpm typecheck
```

## Tech Stack

- React + TypeScript
- Vite + CRXJS (Chrome Extension build)
- Chrome Extension Manifest V3

## License

MIT
