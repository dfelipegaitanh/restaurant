# Modern Web Guidance (Local Extract for Frontend & KDS)

## Core Principles
1. **Modals & Overlays**: Use native `<dialog>` element with `.showModal()` for modal dialogs (traps focus, provides backdrop `::backdrop`, ESC to cancel) or Popover API (`popover="auto"` or `popover="manual"`) for light-dismiss overlays. Never import bloated third-party modal libraries.
2. **Touch Targets**: Minimum interactive touch area of 48x48 CSS pixels (`min-h-[48px] min-w-[48px]`) to ensure ergonomic use on tablets in high-pace restaurant environments.
3. **Screen Wake Lock**: Use `navigator.wakeLock.request('screen')` on KDS display. Handle `release` event and re-request wake lock on page visibility change (`document.addEventListener('visibilitychange')`).
4. **Web Audio API**: Synthesize tones directly using `AudioContext`, `OscillatorNode`, and `GainNode`. Avoid external MP3/WAV assets to prevent network/asset loading failures in noisy or offline environments. Handle browser autoplay policies (resume `AudioContext` on user gesture if suspended).
5. **View Transitions API**: Use `document.startViewTransition(() => updateDOM())` for fluid 60 FPS transitions between Kanban columns when orders move state. Provide graceful fallback for browsers without support (`if (!document.startViewTransition) { updateDOM(); }`).
6. **Persistence & Offline Resilience**: Use `localStorage` with JSON serialization and schema versioning for client cart. Ensure cart recovery on accidental page refresh or tablet reboot.
7. **Idempotency**: Generate UUID v4 (`crypto.randomUUID()`) per checkout attempt before firing the request. Store idempotency key with order payload.
