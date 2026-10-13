import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import upload, { createUploadHandler, config } from '../api/upload.js';
import cleanup, { createCleanupHandler } from '../api/cleanup.js';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function request(chunks = [], method = 'POST', headers = { 'content-type': 'image/png' }) {
  return Object.assign(Readable.from(chunks), { method, headers });
}
function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
function env(t, key, value) {
  const previous = process.env[key];
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
  t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
}

test('upload validates method, storage, MIME, magic and streamed size without network', async t => {
  env(t, 'BLOB_READ_WRITE_TOKEN', undefined);
  assert.deepEqual(config, { api: { bodyParser: false } });
  let res = await upload(request([], 'GET'), response());
  assert.equal(res.code, 405); assert.equal(res.headers.Allow, 'POST');
  res = await upload(request(), response());
  assert.equal(res.code, 503); assert.deepEqual(res.body, { error: 'storage-unavailable', reason: 'no-token' });
  process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  for (const req of [request([Buffer.from('invalid')]), request([png], 'POST', { 'content-type': 'text/plain' }), request()]) {
    assert.equal((await upload(req, response())).code, 400);
  }
  assert.equal((await upload(request([png, Buffer.alloc(6 * 1024 * 1024)]), response())).code, 413);
  assert.equal((await upload(request([], 'POST', { 'content-type': 'image/png', 'content-length': '7000000' }), response())).code, 413);
});

test('upload streams PNG and returns pathname id; storage failures are quiet', async t => {
  env(t, 'BLOB_READ_WRITE_TOKEN', 'test-token');
  const handler = createUploadHandler(async (path, buffer, options) => {
    assert.match(path, /^booth\/[A-Za-z0-9_-]{16}\.png$/);
    assert.deepEqual(buffer, png);
    assert.deepEqual(options, { access: 'public', contentType: 'image/png', addRandomSuffix: false });
    return { url: `https://test.public.blob.vercel-storage.com/${path}` };
  });
  const res = await handler(request([png.subarray(0, 3), png.subarray(3)]), response());
  assert.equal(res.code, 200); assert.ok(res.body.url.endsWith(`/booth/${res.body.id}.png`));
  assert.equal((await createUploadHandler(async () => { throw Error(); })(request([png]), response())).code, 503);
});

test('cleanup denies missing or wrong secrets without network', async t => {
  env(t, 'CRON_SECRET', undefined);
  assert.equal((await cleanup({ headers: { authorization: 'Bearer undefined' } }, response())).code, 401);
  process.env.CRON_SECRET = 'secret';
  for (const authorization of [undefined, 'Bearer wrong', 'secret']) {
    assert.equal((await cleanup({ headers: { authorization } }, response())).code, 401);
  }
});

test('cleanup follows pagination and deletes only expired blobs', async t => {
  env(t, 'CRON_SECRET', 'secret');
  const deleted = [], calls = [];
  const handler = createCleanupHandler(async options => {
    calls.push(options);
    return { blobs: [{ url: options.cursor ? 'old2' : 'old1', uploadedAt: new Date(Date.now() - 25 * 3600000) },
      { url: 'fresh', uploadedAt: new Date() }], hasMore: !options.cursor, cursor: 'next' };
  }, async urls => deleted.push(...urls));
  const res = await handler({ headers: { authorization: 'Bearer secret' } }, response());
  assert.deepEqual(res.body, { deleted: 2 });
  assert.deepEqual(deleted, ['old1', 'old2']);
  assert.deepEqual(calls, [{ prefix: 'booth/' }, { prefix: 'booth/', cursor: 'next' }]);
});

import { allowedOrigin } from '../api/upload.js';
test('upload CORS allows booth origins only', async () => {
  for (const o of ['http://localhost:8742', 'http://127.0.0.1:5500', 'https://pink-october-booth.vercel.app', 'https://pink-october-booth-abc123-artic-fire105.vercel.app'])
    assert.equal(allowedOrigin(o), o);
  for (const o of ['https://evil.com', 'https://pink-october-booth.vercel.app.evil.com', 'https://xpink-october-booth.vercel.app', undefined])
    assert.equal(allowedOrigin(o), null);
  const headers = {}; let code;
  const res = { setHeader: (k, v) => { headers[k] = v; }, status(c) { code = c; return this; }, end() {} };
  await createUploadHandler(async () => ({}))({ method: 'OPTIONS', headers: { origin: 'http://localhost:8742' } }, res);
  assert.equal(code, 204); assert.equal(headers['Access-Control-Allow-Origin'], 'http://localhost:8742');
});
