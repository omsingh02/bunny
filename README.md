# 🐰 Bunny Runner - Cute Endless Adventure

A delightful 3D endless runner game built with Three.js featuring an adorable bunny character, intuitive controls, and engaging gameplay mechanics.

## 🎮 Features

- **3D Graphics**: Powered by Three.js for smooth WebGL rendering
- **Responsive Design**: Optimized separate versions for desktop and mobile
- **Progressive Web App**: Installable with offline support
- **Touch & Swipe Controls**: Mobile-optimized gesture controls
- **Combo System**: Multiplier rewards for consecutive collectibles
- **Achievements**: Unlock rewards and track progress
- **Leaderboard**: Track top scores across difficulty levels
- **Difficulty Modes**: Easy, Medium, Hard with different speeds and challenges

## 📁 Project Structure

```
cute-runner-game/
├── index.html                  # Desktop game entry point
├── mobile/
│   └── index.html             # Mobile game entry point
├── assets/
│   ├── icons/
│   │   ├── favicon.svg        # Desktop favicon
│   │   └── favicon-mobile.svg # Mobile favicon
│   ├── scripts/
│   │   ├── desktop.js         # Desktop game logic
│   │   ├── mobile.js          # Mobile game logic
│   │   ├── redirect.js        # Device detection & routing
│   │   ├── sw.js              # Desktop service worker
│   │   └── sw-mobile.js       # Mobile service worker
│   ├── styles/
│   │   ├── desktop.css        # Desktop styles
│   │   └── mobile.css         # Mobile styles
│   ├── manifest.json          # Desktop PWA manifest
│   └── manifest-mobile.json   # Mobile PWA manifest
├── docs/
│   └── CHANGELOG.md           # Version history and changes
└── .github/
    └── copilot-instructions.md # AI agent development guidelines
```

## 🚀 Getting Started

### Running Locally

1. Clone or download this repository
2. Serve the files using any static file server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js http-server
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```
3. Open `http://localhost:8000` in your browser
4. The game automatically detects your device and redirects to the appropriate version

### Desktop Controls

- **Arrow Keys / A,D**: Move between lanes
- **Space / Arrow Up**: Jump
- **Escape**: Pause game

### Mobile Controls

- **Touch Buttons**: Left, Right, Jump at bottom of screen
- **Swipe Gestures**: 
  - Swipe Left/Right to change lanes
  - Swipe Up to jump
  - Quick tap anywhere to jump

## 🎯 Game Mechanics

### Scoring
- Base points for distance traveled
- Collectible gems: 10 points each
- Combo multiplier: Up to 10x for consecutive collections
- Milestone celebrations at 100, 250, 500, 750, 1000+

### Difficulty Levels
- **Easy**: Relaxed Garden Stroll - Slower pace for beginners
- **Medium**: Happy Run - Balanced challenge
- **Hard**: Speed Bunny Challenge - Fast-paced expert mode

### Achievements
- Baby Steps: Make your first jump
- Century Run: Reach 100 points
- Half Marathon: Reach 500 points
- Legend: Reach 1000 points
- Combo Master: 5x combo streak
- Combo God: 10x combo streak
- Dodging Expert: Score 50 without hitting obstacles
- Speed Demon: Reach maximum speed

## 🛠️ Technology Stack

- **Three.js r128**: 3D graphics rendering
- **Vanilla JavaScript**: No framework dependencies
- **CSS3**: Modern styling with custom properties
- **Web Audio API**: Procedural sound effects and music
- **Service Workers**: PWA offline capabilities
- **LocalStorage**: Settings and progress persistence

## 📱 PWA Features

- Installable on desktop and mobile devices
- Offline play support
- Fullscreen mode
- Custom app icons
- Native-like experience

## 🎨 Customization

The game uses CSS custom properties for easy theming. Key variables in styles:
- `--color-pink`, `--color-lavender`, `--color-mint`: Theme colors
- `--font-size-*`: Typography scale
- `--space-*`: Spacing system
- `--radius-*`: Border radius values

## 📄 License

This project is open source and available for personal and educational use.

## 🤝 Contributing

Feel free to submit issues, fork the repository, and create pull requests for any improvements.

## 🙏 Credits

Built with ❤️ using Three.js and modern web technologies.
