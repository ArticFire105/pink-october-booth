import crypto from 'node:crypto';
const put = async (...args) => (await import('@vercel/blob')).put(...args);

export const config = { api: { bodyParser: false } };
const MAX_BYTES = 6 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function allowedOrigin(origin) {
  if (typeof origin !== 'string') return null;
  return /^https:\/\/pink-october-booth(-[a-z0-9-]+)?\.vercel\.app$/.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : null;
}

export function createUploadHandler(putBlob = put) {
  return async function handler(req, res) {
    const origin = allowedOrigin(req.headers.origin);
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') return res.status(origin ? 204 : 403).end();
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method-not-allowed' });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'storage-unavailable', reason: 'no-token' });
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'image/png') {
      return res.status(400).json({ error: 'invalid-png' });
    }
    if (Number(req.headers['content-length']) > MAX_BYTES) return res.status(413).json({ error: 'image-too-large' });
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of req) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > MAX_BYTES) return res.status(413).json({ error: 'image-too-large' });
        chunks.push(bytes);
      }
    } catch {
      return res.status(400).json({ error: 'invalid-body' });
    }
    const buffer = Buffer.concat(chunks);
    if (!buffer.subarray(0, 8).equals(PNG_MAGIC)) return res.status(400).json({ error: 'invalid-png' });
    const id = `${Date.now()}-${crypto.randomUUID()}`;
    try {
      const { url } = await putBlob(`booth/${id}.png`, buffer, {
        access: 'public', contentType: 'image/png', addRandomSuffix: false,
      });
      return res.status(200).json({ url, id });
    } catch (err) {
      console.error('blob put failed:', err?.name, err?.message);
      return res.status(503).json({ error: 'storage-unavailable', reason: 'put-failed', kind: String(err?.name || 'Error').slice(0, 60) });
    }
  };
}

export default createUploadHandler();
