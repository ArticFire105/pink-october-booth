const list = async (...args) => (await import('@vercel/blob')).list(...args);
const del = async (...args) => (await import('@vercel/blob')).del(...args);

export function createCleanupHandler(listBlobs = list, deleteBlobs = del) {
  return async function handler(req, res) {
    if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let cursor, deleted = 0;
    try {
      do {
        const page = await listBlobs({ prefix: 'booth/', ...(cursor ? { cursor } : {}) });
        const expired = page.blobs.filter(blob => new Date(blob.uploadedAt).getTime() < cutoff);
        if (expired.length) {
          await deleteBlobs(expired.map(blob => blob.url));
          deleted += expired.length;
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return res.status(200).json({ deleted });
    } catch {
      return res.status(503).json({ error: 'storage-unavailable' });
    }
  };
}

export default createCleanupHandler();
