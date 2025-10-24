# Bunny Runner Game - AI Agent Instructions

## Project Overview
A cute 3D endless runner game built with Three.js featuring a bunny character, obstacle avoidance, collectibles, combo system, and difficulty levels. Single-file vanilla JavaScript architecture with procedural spawning system.

## Architecture & Core Systems

### Game State Management
- State machine: `loading` → `menu` → `playing` → `paused` / `gameOver`
- All game state in `BunnyRunnerGame` class (`app.js`)
- State changes trigger UI screen visibility via `showScreen(screenId)`
- Music automatically pauses/stops on pause/game over states

### Three.js Scene Structure
- **Camera**: Responsive FOV (85° portrait, 75° landscape) with smooth interpolated positioning
- **Lanes**: Fixed 3-lane system at x-positions `[-2, 0, 2]`
- **Coordinate system**: Player at z=0, obstacles spawn at negative z (e.g., z=-50), move forward with `obstacle.position.z += this.speed`
- **Ground**: Infinite scrolling via chunk regeneration every 20 units

### Continuous Spawning System
**Critical pattern for obstacles and collectibles:**
```javascript
// Time-based spawning with intervals from difficulty config
updateObstacleSpawning(deltaTime) {
    if (currentTime - lastSpawnTime >= nextSpawnTime) {
        createObstacle(bunny.position.z - spawnDistance);
        nextSpawnTime = getRandomObstacleInterval(); // Varies by difficulty + score
    }
    cleanupOldObstacles(); // Remove when behind player with proper disposal
}
```
- Obstacles: Spawn 50 units ahead, remove 20 units behind
- Collectibles: Spawn 45 units ahead with lane conflict avoidance
- Max pool sizes prevent memory leaks (obstacles: 20, collectibles: 15)
- **Progressive difficulty**: Spawn intervals decrease as score increases

### Difficulty System
Three preset configs (`difficultyConfig` object) control:
- Speed progression: `baseSpeed + (score * speedIncrement * 0.1)` capped at `maxSpeed`
- Spawn intervals: `obstacleInterval: [min, max]` in milliseconds (scales with score)
- Collectible frequency increases with score for better rewards
- Applied via `applyDifficultySettings()` on game start

### Combo System
**NEW**: Rewards consecutive collectible pickups:
- 3-second window to maintain combo (`comboTimeout`)
- Score multiplier up to 10x based on `comboCount`
- Visual feedback via floating text and golden combo display in HUD
- Special sound effects at 5+ combo

### Milestone Celebrations
**NEW**: Trigger at score thresholds: 100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000
- Automatic celebration animations with zoom effects
- Haptic feedback on mobile devices
- Milestone sounds distinct from regular collectibles

## Audio Architecture
**Web Audio API only** - no external files:
- `THREE.AudioListener` attached to camera
- Procedural sounds via `OscillatorNode` + `GainNode` + `BiquadFilterNode`
- Example: Jump = sine wave 600→300→400 Hz over 200ms
- Background music: Looping melody with `playBackgroundMelody()` every 8s
- Audio enabled lazily on first user interaction (`enableAudio()`)
- Music stops on pause/game over (resumes on unpause)

## Input & Controls

### Keyboard (Desktop)
```javascript
ArrowLeft/KeyA  → moveLane(-1)
ArrowRight/KeyD → moveLane(1)  
Space/ArrowUp   → jump()
Escape          → pauseGame()
```

### Touch (Mobile)
- **Buttons**: Left/Right/Jump buttons in `.touch-controls` (shown only if `isTouchDevice`)
- **Swipe**: Horizontal (±50px) for lanes, vertical-up for jump
- **Tap**: Single tap anywhere (outside buttons) triggers jump after 150ms delay
- **Haptic feedback**: Vibration patterns for light/medium/heavy/success actions

### Lane Movement
Smooth interpolation: `bunny.position.x += (targetX - currentX) * 0.2` per frame

## Collision Detection
AABB via `THREE.Box3` with forgiving hitboxes:
- Bunny collision box shrunk by 10% for more forgiving gameplay
- `bunnyBox.intersectsBox(obstacleBox)` → gameOver() with haptic feedback
- `bunnyBox.intersectsBox(collectibleBox)` → combo system, sparkle effects

## UI & Styling

### CSS Design System
Built on Perplexity design system tokens (see `:root` in `style.css`):
- Colors: Pastel palette via `--color-pink`, `--color-lavender`, `--color-mint`
- Button variants: `.btn--primary`, `.btn--secondary`, `.btn--outline` (BEM naming with modifiers)
- Responsive: Breakpoints at 480px, 768px; landscape adjustments for height < 500px
- **Animations**: `comboFadeUp`, `milestoneZoom`, `speedPulse`, `comboPulse` for feedback

### Screen Transitions
All UI in `#ui-overlay` with absolute-positioned `.screen` divs:
```javascript
showScreen('game-hud'); // Sets .hidden class on others
```

### Dynamic UI Elements
- Combo display appears when combo > 1 (golden animated box)
- Speed up feedback shows on speed tier changes
- Milestone celebrations overlay screen center

## Memory Management
**Critical for performance**:
- All geometries/materials disposed in `clearWorld()` and `cleanupOldObstacles()`
- Particle system stores geometry/material refs in `userData` for cleanup
- Traverse entire object hierarchy to dispose all children

## Common Modifications

### Adding New Obstacle Types
1. Create geometry in `createObstacle()` switch case
2. Add type to `obstacleTypes` array (line ~632)
3. Set collision via `userData: { type: 'obstacle', obstacleType: 'newType' }`

### Adjusting Difficulty
Edit `difficultyConfig` object (lines ~28-55):
- `baseSpeed`: Initial forward speed
- `acceleration`: Speed increase per score point
- `maxSpeed`: Speed cap
- `obstacleInterval`: [min, max] spawn time in ms

### Spawning Custom Collectibles
Follow pattern in `createContinuousCollectible()`:
- Avoid occupied lanes via `availableLanes` filter
- Position at random lane with `this.lanes[lane]`
- Add to `this.collectibles` array and scene

### Adding New Milestone Thresholds
Edit `this.milestones` array in constructor (add sorted values)

## Performance Notes
- Mobile optimization: Basic shadow maps (`THREE.BasicShadowMap`) on mobile
- Pixel ratio capped at 2x: `Math.min(window.devicePixelRatio, 2)`
- Particle cleanup: `updateParticles()` removes when `life <= 0` with proper disposal
- Camera smoothing prevents jittery movement
- Touch targets minimum 44×44px for accessibility

## File Structure
```
app.js         - All game logic (1800+ lines)
index.html     - UI structure, Three.js r128 CDN
style.css      - Design system + game-specific styles
```

## Best Practices for This Codebase
- **Never** create sound files - extend Web Audio synthesis
- **Always** use the continuous spawning pattern for new game objects
- **Always** dispose geometries/materials when removing objects from scene
- **Test** mobile touch controls and haptic feedback - many users play on phones
- **Maintain** single-class architecture - all logic in `BunnyRunnerGame`
- **Follow** emoji-based UI theme (🐰✨💕) in strings and UI
- **Use** BEM naming for CSS classes (`.btn--primary` not `.btn-primary`)

