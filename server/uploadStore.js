import { randomBytes } from 'crypto';
import { del, get, put } from '@vercel/blob';
import { summarize } from '../src/lib/candidates.js';
import { safeFileName } from './excel.js';

// Storage layout in the Vercel Blob store:
//   fecc/index.json              upload history (metadata only, newest first)
//   fecc/datasets/<id>.json      parsed candidates for one upload
//   fecc/files/<id>/<file name>  the original uploaded file
// The newest upload in the history is the active dataset shown on the dashboard and used by the AI.
//
// Connecting a Blob store to the Vercel project adds BLOB_READ_WRITE_TOKEN automatically.
// Without it (local dev), uploads are kept in memory until the server restarts.
// Blob stores can be private or public; we prefer private and fall back automatically.

const INDEX_PATH = 'fecc/index.json';
const datasetPath = (id) => `fecc/datasets/${id}.json`;
const filePath = (id, name) => `fecc/files/${id}/${name}`;
const MAX_HISTORY = 50;
const CACHE_MS = 10_000;

const memory = { index: [], datasets: new Map(), files: new Map() };
let cache = null; // { index, active, at }
let workingAccess = null;

export class StorageError extends Error {}

export function hasPersistentStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function canWrite() {
  if (hasPersistentStorage()) return true;
  if (process.env.VERCEL) throw new StorageError('Storage is not set up. Connect a Vercel Blob store to this project, then redeploy.');
  return false;
}

function accessOrder() {
  const preferred = (process.env.BLOB_ACCESS === 'public' ? 'public' : workingAccess) || 'private';
  return preferred === 'public' ? ['public', 'private'] : ['private', 'public'];
}

const describe = (err) => String(err?.message || err || 'Unknown storage error');

async function blobPut(pathname, body, contentType) {
  const errors = [];
  for (const access of accessOrder()) {
    try {
      await put(pathname, body, { access, addRandomSuffix: false, allowOverwrite: true, contentType, cacheControlMaxAge: 60 });
      workingAccess = access;
      return;
    } catch (err) {
      errors.push(`${access}: ${describe(err)}`);
    }
  }
  throw new StorageError(`Could not save to storage (${errors.join('; ')})`);
}

/** Returns the blob body as a Buffer, or null if it doesn't exist. */
async function blobGet(pathname) {
  const errors = [];
  for (const access of accessOrder()) {
    try {
      const result = await get(pathname, { access, useCache: false });
      workingAccess = access;
      if (!result || !result.stream) return null;
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    } catch (err) {
      if (/not.?found|404/i.test(describe(err))) return null;
      errors.push(`${access}: ${describe(err)}`);
    }
  }
  throw new StorageError(`Could not read from storage (${errors.join('; ')})`);
}

async function readIndex() {
  if (!hasPersistentStorage()) return memory.index;
  const buf = await blobGet(INDEX_PATH);
  if (!buf) return [];
  const parsed = JSON.parse(buf.toString('utf8'));
  return Array.isArray(parsed?.uploads) ? parsed.uploads : [];
}

async function writeIndex(uploads) {
  if (!hasPersistentStorage()) {
    memory.index = uploads;
    return;
  }
  await blobPut(INDEX_PATH, JSON.stringify({ uploads }, null, 2), 'application/json');
}

async function readDataset(id) {
  if (!hasPersistentStorage()) return memory.datasets.get(id) || null;
  const buf = await blobGet(datasetPath(id));
  return buf ? JSON.parse(buf.toString('utf8')) : null;
}

function newId(now) {
  const stamp = new Date(now).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${stamp}-${randomBytes(3).toString('hex')}`;
}

/** Upload history (newest first) plus the active dataset. Cached briefly per instance. */
export async function getState({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache;
  try {
    const index = await readIndex();
    const active = index.length ? await readDataset(index[0].id) : null;
    cache = { index, active, at: Date.now() };
    return cache;
  } catch (err) {
    console.error('Storage read failed:', describe(err));
    if (cache) return cache; // serve the last good copy rather than an empty dashboard
    throw err;
  }
}

export async function getActiveDataset() {
  return (await getState()).active;
}

/** Saves a parsed upload and makes it the active dataset. Returns { upload, dataset }. */
export async function saveUpload({ fileName, buffer, contentType, parsed, now = Date.now() }) {
  const persistent = canWrite();
  const id = newId(now);
  const name = safeFileName(fileName);
  const upload = {
    id,
    fileName: name,
    uploadedAt: new Date(now).toISOString(),
    size: buffer.length,
    sheetName: parsed.sheetName,
    rowCount: parsed.candidates.length,
    columns: parsed.columns,
    warnings: parsed.warnings,
    summary: summarize(parsed.candidates),
  };
  const dataset = { ...upload, candidates: parsed.candidates };

  const index = (await getState({ fresh: true })).index;
  const next = [upload, ...index];
  const dropped = next.slice(MAX_HISTORY);

  if (persistent) {
    await blobPut(filePath(id, name), buffer, contentType || 'application/octet-stream');
    await blobPut(datasetPath(id), JSON.stringify(dataset), 'application/json');
    await writeIndex(next.slice(0, MAX_HISTORY));
    if (dropped.length) await removeBlobs(dropped).catch((err) => console.warn('History cleanup failed:', describe(err)));
  } else {
    memory.files.set(id, { buffer, contentType });
    memory.datasets.set(id, dataset);
    for (const old of dropped) {
      memory.files.delete(old.id);
      memory.datasets.delete(old.id);
    }
    await writeIndex(next.slice(0, MAX_HISTORY));
  }

  cache = { index: next.slice(0, MAX_HISTORY), active: dataset, at: Date.now() };
  return { upload, dataset };
}

async function removeBlobs(uploads) {
  const paths = uploads.flatMap((u) => [datasetPath(u.id), filePath(u.id, u.fileName)]);
  if (paths.length) await del(paths);
}

/** Deletes one upload. If it was active, the next newest becomes active. Returns false if not found. */
export async function deleteUpload(id) {
  const persistent = canWrite();
  const { index } = await getState({ fresh: true });
  const target = index.find((u) => u.id === id);
  if (!target) return false;
  const next = index.filter((u) => u.id !== id);
  await writeIndex(next);
  if (persistent) {
    await removeBlobs([target]).catch((err) => console.warn('Blob delete failed:', describe(err)));
  } else {
    memory.files.delete(id);
    memory.datasets.delete(id);
  }
  cache = null;
  await getState({ fresh: true });
  return true;
}

/** Returns { upload, buffer, contentType } for the original file, or null. */
export async function getUploadFile(id) {
  const { index } = await getState();
  const upload = index.find((u) => u.id === id);
  if (!upload) return null;
  if (!hasPersistentStorage()) {
    const f = memory.files.get(id);
    return f ? { upload, ...f } : null;
  }
  const buffer = await blobGet(filePath(id, upload.fileName));
  if (!buffer) return null;
  const contentType = upload.fileName.toLowerCase().endsWith('.csv')
    ? 'text/csv'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return { upload, buffer, contentType };
}

/** For tests. */
export function __resetUploadStoreForTests() {
  memory.index = [];
  memory.datasets.clear();
  memory.files.clear();
  cache = null;
  workingAccess = null;
}
