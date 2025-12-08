# Google Analytics Setup Guide

## Quick Setup (5 minutes)

### 1. Create Google Analytics Account

1. Go to https://analytics.google.com/
2. Click "Start measuring"
3. Create an account name (e.g., "Bunny Runner")
4. Configure data sharing settings
5. Click "Next"

### 2. Create a Property

1. Enter property name: "Bunny Runner"
2. Select timezone and currency
3. Click "Next"
4. Select industry: "Games"
5. Select business size
6. Click "Create"
7. Accept Terms of Service

### 3. Set Up Web Stream

1. Select "Web" platform
2. Enter your website URL (e.g., https://yourdomain.com)
3. Enter stream name: "Bunny Runner Web"
4. Click "Create stream"

### 4. Get Your Measurement ID

1. After creating the stream, you'll see your **Measurement ID** (starts with `G-`)
2. Example: `G-ABC123XYZ`
3. Copy this ID

### 5. Update Your Game Files

Replace `G-XXXXXXXXXX` with your actual Measurement ID in:

**File: `index.html` (line ~14)**
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YOUR_ID_HERE"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-YOUR_ID_HERE');
</script>
```

**File: `mobile/index.html` (line ~16)**
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YOUR_ID_HERE"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-YOUR_ID_HERE');
</script>
```

### 6. Deploy and Test

1. Deploy your game to your web server
2. Play a game session
3. Wait 24-48 hours for data to appear in Google Analytics
4. Check Reports > Realtime to see live users

## What's Being Tracked

### Automatic Tracking
- Page views
- User sessions
- Geographic location
- Device type (desktop/mobile)
- Browser and OS
- Traffic sources

### Custom Events
- **game_start**: When player starts a game
  - Parameter: `difficulty` (easy/medium/hard)
- **game_over**: When player dies
  - Parameters: `score`, `difficulty`
- **milestone**: When player reaches score milestones
  - Parameters: `score` (100, 250, 500, etc.), `difficulty`

## Viewing Your Data

### Realtime Reports
- Go to Reports > Realtime
- See users playing right now
- View events as they happen

### Engagement Reports
- Go to Reports > Engagement > Events
- See `game_start`, `game_over`, `milestone` events
- View event counts and parameters

### User Reports
- Go to Reports > User > Demographics
- See player locations, devices, languages

## Tips

- Data takes 24-48 hours to fully process
- Use Realtime view for immediate testing
- Check Debug view for detailed event tracking
- Enable Google Signals for cross-device tracking

## Privacy

This basic implementation:
- ✅ Tracks anonymous user behavior
- ✅ GDPR compliant by default
- ❌ No personal information collected
- ❌ No cookies for EU users (if configured)

Consider adding a cookie consent banner for EU compliance.
