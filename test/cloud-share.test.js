import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadImage, validBlobURL } from '../js/cloud-share.js';

test('cloud upload succeeds or silently falls back, including offline and timeout', async t => {
  for (const [key, value] of Object.entries({ location: { origin: 'https://booth.example' }, navigator: { onLine: true } })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  const blob = new Blob(['png'], { type: 'image/png' });
  const url = 'https://test.public.blob.vercel-storage.com/booth/test.png';
  assert.equal(await uploadImage(blob, { fetchImpl: async (path, options) => {
    assert.equal(path, 'https://pink-october-booth.vercel.app/api/upload');
    assert.equal(options.body, blob);
    assert.equal(options.headers['Content-Type'], 'image/png');
    return { ok: true, json: async () => ({ url }) };
  } }), `${url}?download=1`);
  for (const fetchImpl of [async () => { throw Error(); }, async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw Error(); } }),
    async () => ({ ok: true, json: async () => ({ url: 'https://evil.example/a.png' }) })]) {
    assert.equal(await uploadImage(blob, { fetchImpl }), null);
  }
  assert.equal(await uploadImage(blob, { fetchImpl: () => new Promise(() => {}), timeoutMs: 5 }), null);
  globalThis.navigator.onLine = false;
  assert.equal(await uploadImage(blob, { fetchImpl: () => assert.fail('offline fetch') }), null);
});

test('download URLs must belong to public HTTPS Blob storage', () => {
  for (const url of [null, '', 'javascript:alert(1)', 'http://a.public.blob.vercel-storage.com/a',
    'https://public.blob.vercel-storage.com/a', 'https://a.public.blob.vercel-storage.com.evil.org/a',
    'https://user@a.public.blob.vercel-storage.com/a']) assert.equal(validBlobURL(url), null);
});
