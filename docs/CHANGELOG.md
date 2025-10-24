# Bunny Runner - Mobile & Desktop Versions 🐰✨

## Directory Structure

```
cute-runner-game/
├── index.html          # Desktop version
├── style.css           # Desktop styles
├── app.js              # Shared game logic
├── redirect.js         # Device detection & redirect
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
└── mobile/            # Mobile-optimized version
    ├── index.html     # Mobile HTML (simplified, touch-optimized)
    ├── style-mobile.css  # Mobile-specific styles
    ├── app.js         # Same game logic
    ├── manifest.json  # PWA manifest
    └── sw.js          # Service worker
```

## How It Works

### Automatic Device Detection
- `redirect.js` detects the user's device on page load
- Mobile users (phones/tablets) → automatically redirected to `/mobile/`
- Desktop users → stay on root `/index.html`
- Users trying to access wrong version are automatically redirected

### Mobile Version Optimizations
- **Always-visible touch controls** (no keyboard hints)
- **Larger touch targets** (70px buttons)
- **Compact UI** with reduced spacing (30-40% less padding)
- **Optimized positioning** for milestone progress and achievements
- **Bigger countdown** (6rem minimum vs 5rem)
- **Simplified text** (shorter labels, smaller fonts)
- **Fullscreen by default** in settings
- **No keyboard-specific features**

### Desktop Version Features
- **Keyboard controls** with hints
- **Mouse support**
- **Larger text and spacing**
- **More detailed tutorial** with keyboard shortcuts
- **Optional touch controls** (hidden by default)

## Usage

### Serve Both Versions
```bash
# From the root directory
python -m http.server 8000

# Desktop: http://localhost:8000
# Mobile: http://localhost:8000/mobile/ (or auto-redirected)
```

### Testing
- **Desktop**: Use regular browser
- **Mobile**: Use device or browser DevTools mobile emulation
- **Override**: Add `?force=desktop` or `?force=mobile` to URL (TODO: implement)

## Key Differences

| Feature | Desktop | Mobile |
|---------|---------|--------|
| Controls | Keyboard + optional touch | Touch only |
| Layout | Spacious (normal padding) | Compact (30-40% less) |
| Fullscreen | Optional | Encouraged |
| Keyboard Hints | Visible (toggleable) | Hidden |
| Touch Buttons | Hidden by default | Always visible |
| Countdown Size | 5rem-12rem | 6rem-12rem |
| Progress Bar | 160px from top | 100px from top |
| Tutorial | Full keyboard details | Touch-focused |

## Development Notes

- Both versions share `app.js` (no code changes needed)
- Mobile CSS extends desktop CSS with overrides
- Service workers cache version-specific assets
- LocalStorage is shared between versions (same domain)
- PWA manifest works for both versions

## Future Enhancements

- [ ] URL parameter to force desktop/mobile mode
- [ ] Separate analytics for mobile vs desktop
- [ ] Mobile-specific achievement system
- [ ] Portrait mode optimizations
- [ ] iPad-specific tweaks
