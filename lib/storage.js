const { randomUUID } = require('crypto');

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const PATHNAME = 'visits.json';
const MAX_CLICKS_PER_VISIT = 50;
const MAX_VISITS = 500; // keep the JSON blob small and fast to read/write
const MAX_WRITE_ATTEMPTS = 6;

const memoryVisits = new Map();

// Read-modify-write on a single JSON blob would silently lose data if two
// requests raced (both read the same version, both write, second wins and
// erases the first). This reads with the current ETag and writes with
// `ifMatch`, retrying with fresh data whenever another request won the race
// in between — so a busy site (many visitors at once) doesn't drop visits.
async function updateVisits(mutate) {
  const { get, put, BlobPreconditionFailedError } = require('@vercel/blob');

  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    let visits = [];
    let etag;

    const result = await get(PATHNAME, { access: 'private', useCache: false });
    if (result) {
      etag = result.blob.etag;
      visits = await new Response(result.stream).json();
    }

    const changed = mutate(visits);
    if (!changed) return; // nothing to write (e.g. visit id not found yet)

    const putOptions = {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    };
    if (etag) putOptions.ifMatch = etag;

    try {
      await put(PATHNAME, JSON.stringify(visits), putOptions);
      return;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError && attempt < MAX_WRITE_ATTEMPTS - 1) {
        continue; // someone else wrote first — re-read and retry
      }
      throw err;
    }
  }
}

async function createVisit({ ip, userAgent }) {
  const id = randomUUID();
  const now = Date.now();
  const record = { id, ip, userAgent, startedAt: now, lastSeenAt: now, clicks: [] };

  if (useBlob) {
    await updateVisits((visits) => {
      visits.unshift(record);
      if (visits.length > MAX_VISITS) visits.length = MAX_VISITS;
      return true;
    });
  } else {
    memoryVisits.set(id, record);
  }
  return id;
}

async function touchVisit(id) {
  if (!id) return;
  if (useBlob) {
    await updateVisits((visits) => {
      const record = visits.find((v) => v.id === id);
      if (!record) return false;
      record.lastSeenAt = Date.now();
      return true;
    });
  } else {
    const record = memoryVisits.get(id);
    if (record) record.lastSeenAt = Date.now();
  }
}

async function addClick(id, label) {
  if (!id || !label) return;
  const cleanLabel = String(label).slice(0, 200);

  if (useBlob) {
    await updateVisits((visits) => {
      const record = visits.find((v) => v.id === id);
      if (!record || record.clicks.length >= MAX_CLICKS_PER_VISIT) return false;
      record.clicks.push({ label: cleanLabel, at: Date.now() });
      record.lastSeenAt = Date.now();
      return true;
    });
  } else {
    const record = memoryVisits.get(id);
    if (!record || record.clicks.length >= MAX_CLICKS_PER_VISIT) return;
    record.clicks.push({ label: cleanLabel, at: Date.now() });
    record.lastSeenAt = Date.now();
  }
}

async function listVisits() {
  if (useBlob) {
    const { get } = require('@vercel/blob');
    const result = await get(PATHNAME, { access: 'private', useCache: false });
    const visits = result ? await new Response(result.stream).json() : [];
    return visits.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }
  return [...memoryVisits.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

module.exports = { createVisit, touchVisit, addClick, listVisits, isUsingBlob: () => useBlob };
