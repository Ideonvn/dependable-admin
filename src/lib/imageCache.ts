const CACHE_NAME = 'profile-image-cache-v1';

export async function fetchImageCached(url: string, token: string): Promise<string> {
  if (typeof caches === 'undefined') {
    return fetchDirect(url, token);
  }

  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(url);

  if (cached) {
    const blob = await cached.blob();
    return URL.createObjectURL(blob);
  }

  return fetchDirect(url, token, cache);
}

async function fetchDirect(url: string, token: string, cache?: Cache): Promise<string> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch image');
  }

  if (cache) {
    await cache.put(url, response.clone());
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
