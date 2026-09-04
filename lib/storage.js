const { randomUUID } = require('crypto');

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const PATHNAME = 'visits.json';
const MAX_CLICKS_PER_VISIT = 50;
const MAX_VISITS = 500; // keep the JSON blob small and fast to read/write

const memoryVisits = new Map();

async function readAll() {
  const { get } = require('@vercel/blob');
  try {
    const result = await get(PATHNAME, { access: 'private', useCache: false });
    if (!result) return [];
    return await new Response(result.stream).json();
  } catch (err) {
    return []; // no blob written yet
  }
}

async function writeAll(visits) {
  const { put } = require('@vercel/blob');
  await put(PATHNAME, JSON.stringify(visits), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

async function createVisit({ ip, userAgent }) {
  const id = randomUUID();
  const now = Date.now();
  const record = { id, ip, userAgent, startedAt: now, lastSeenAt: now, clicks: [] };

  if (useBlob) {
    const visits = await readAll();
    visits.unshift(record);
    if (visits.length > MAX_VISITS) visits.length = MAX_VISITS;
    await writeAll(visits);
  } else {
    memoryVisits.set(id, record);
  }
  return id;
}

async function touchVisit(id) {
  if (!id) return;
  const now = Date.now();

  if (useBlob) {
    const visits = await readAll();
    const record = visits.find((v) => v.id === id);
    if (!record) return;
    record.lastSeenAt = now;
    await writeAll(visits);
  } else {
    const record = memoryVisits.get(id);
    if (record) record.lastSeenAt = now;
  }
}

async function addClick(id, label) {
  if (!id || !label) return;
  const now = Date.now();
  const cleanLabel = String(label).slice(0, 200);

  if (useBlob) {
    const visits = await readAll();
    const record = visits.find((v) => v.id === id);
    if (!record || record.clicks.length >= MAX_CLICKS_PER_VISIT) return;
    record.clicks.push({ label: cleanLabel, at: now });
    record.lastSeenAt = now;
    await writeAll(visits);
  } else {
    const record = memoryVisits.get(id);
    if (!record || record.clicks.length >= MAX_CLICKS_PER_VISIT) return;
    record.clicks.push({ label: cleanLabel, at: now });
    record.lastSeenAt = now;
  }
}

async function listVisits() {
  const visits = useBlob ? await readAll() : [...memoryVisits.values()];
  return visits.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

module.exports = { createVisit, touchVisit, addClick, listVisits, isUsingBlob: () => useBlob };
