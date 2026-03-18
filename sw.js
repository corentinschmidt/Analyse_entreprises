const CACHE = 'stockscore-v5';
const ASSETS = ['./stockscore_v5.html'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  // Network first for API calls, cache first for app shell
  var url = e.request.url;
  var isApi = url.includes('groq.com') || url.includes('tavily.com')
    || url.includes('newsapi.org') || url.includes('yahoo.com')
    || url.includes('fda.gov') || url.includes('clinicaltrials.gov');

  if(isApi){
    // Always network for real-time data
    e.respondWith(fetch(e.request).catch(function(){ return new Response('', {status: 503}); }));
    return;
  }

  // Cache first for app files
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(resp){
        if(resp.ok){
          var clone = resp.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        }
        return resp;
      }).catch(function(){ return cached || new Response('Offline', {status: 503}); });
    })
  );
});
