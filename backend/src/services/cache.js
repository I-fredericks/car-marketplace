// Optional Redis cache for hot public reads. Entirely inert when REDIS_URL
// is unset: every get misses and every set is dropped, so local dev and CI
// run without Redis. Values are cached as JSON strings with a TTL.
const Redis = require('ioredis');

let client = null;
let available = false;

if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  client.on('error', (err) => {
    if (available) console.error('Redis cache error (degrading to no cache):', err.message);
    available = false;
  });
  client.on('ready', () => { available = true; });
} else {
  client = null;
}

const getJSON = async (key) => {
  if (!client || !available) return null;
  try {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Cache get failed:', err.message);
    return null;
  }
};

const setJSON = async (key, value, ttlSeconds) => {
  if (!client || !available) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('Cache set failed:', err.message);
  }
};

// Monotonic version counter embedded in cache keys: any vehicle write bumps
// it, which instantly orphans every previously cached response without
// needing to know every key.
let vehicleVersion = 0;
const VEHICLE_VERSION_KEY = 'vehicles:version';

const initVehicleVersion = async () => {
  if (!client || !available) return;
  try {
    const v = await client.get(VEHICLE_VERSION_KEY);
    vehicleVersion = v ? parseInt(v, 10) : 0;
  } catch { /* cache is optional */ }
};

const bumpVehicleVersion = async () => {
  vehicleVersion += 1;
  if (!client || !available) return;
  try {
    await client.incr(VEHICLE_VERSION_KEY);
  } catch { /* cache is optional */ }
};

const currentVehicleVersion = () => vehicleVersion;

// Deterministic cache key from an object regardless of key order
const stableKey = (prefix, obj) => {
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${k}=${obj[k]}`);
  return `${prefix}:v${vehicleVersion}:${parts.join('&')}`;
};

module.exports = {
  getJSON,
  setJSON,
  stableKey,
  bumpVehicleVersion,
  initVehicleVersion,
  currentVehicleVersion,
};
