export function validBlobURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com') &&
      !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

export async function uploadImage(blob, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  let timer;
  try {
    if (globalThis.navigator?.onLine === false) return null;
    const controller = new AbortController();
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs);
    });
    const upload = async () => {
      const response = await fetchImpl('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob, signal: controller.signal,
      });
      if (!response.ok) return null;
      const url = validBlobURL((await response.json()).url);
      return url ? `${globalThis.location.origin}/p.html?u=${encodeURIComponent(url)}` : null;
    };
    return await Promise.race([upload(), timeout]);
  } catch { return null; }
  finally { clearTimeout(timer); }
}
