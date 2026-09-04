const CACHE_NAME = 'bunny-runner-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/styles/game.css',
  '/assets/scripts/game.js',
  '/assets/scripts/modules/AudioSynth.js',
  '/assets/scripts/modules/ProceduralModels.js',
  '/assets/scripts/modules/PhysicsEngine.js',
  '/assets/scripts/modules/WorldManager.js',
  '/assets/scripts/modules/InputController.js',
  '/assets/scripts/modules/ParticleSystem.js',
  '/assets/scripts/modules/StorageManager.js',
  '/assets/scripts/modules/UIController.js',
  '/assets/scripts/modules/AnalyticsManager.js',
  '/assets/manifest.json',
  '/assets/icons/favicon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

// Install event - cache files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
