# Changelog

All notable changes to this project will be documented in this file.

## [0.0.4] - 2025-01-03

### Features

- **popup:** Show disabled state when not on YouTube Music instead of full UI

### Bug Fixes

- **popup:** Handle connection errors when content script is unavailable

### Performance

- **content:** Fix memory leak - clear setInterval on cleanup
- **content:** Prevent duplicate History API wrapping on script re-run
- **content:** Prevent duplicate style injection
- **content:** Optimize MutationObserver to only watch playlist container instead of entire body
- **content:** Fix debounce timeout leak in MutationObserver callback
- **content:** Consolidate DOM cleanup queries into single selector
- **popup:** Add useMemo for phase time range calculations

## [0.0.3] - 2025-01-03

### Features

- **presets:** Add Quick 2h, Medium 4h, and Extended 6h duration presets with unique phase names
  - Quick 2h: Intro, Body, Outro (3 phases)
  - Medium 4h: Opening, Main, Closing (3 phases)
  - Extended 6h: Warm-up, Build, Drop, Cool (4 phases)
- **journey:** Allow users to name their journey with automatic playlist URL linking
- **journey:** Auto-restore saved journey settings when returning to the same playlist
- **export:** Export tracklist as JSON with full track details (name, artist, duration, timing, phase info, YouTube URL)
- **persistence:** Auto-save form state (draft) when popup closes, restore on next open
- **navigation:** Detect playlist URL changes and load appropriate saved journey
- **navigation:** Show warning when navigated away from active session's playlist

### Bug Fixes

- **export:** Fix track extraction for different YouTube Music page layouts
- **ui:** Fix preset list styling - name now takes full width with dots and delete aligned right
- **ui:** Improve "Restore Defaults" button styling

### Changes

- **ui:** Duration is now read-only display (edit phases directly instead)
- **ui:** Remove AM/PM restrictions on sunrise/sunset times for polar region support
- **performance:** Use History API events for URL change detection instead of polling

## [0.0.2] - 2025-01-02

### Bug Fixes

- Fix edit time functionality

## [0.0.1] - 2025-01-02

### Features

- Initial release
- YouTube Music playlist phase tracking
- Customizable phases with colors and durations
- Sunrise and sunset time markers
- Visual track highlighting based on journey phase
- Hover popover showing simulated time and phase info
- Preset management (save, load, delete)
