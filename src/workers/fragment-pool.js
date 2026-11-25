// A few module workers that prepare building fragments while the campus loads (src/workers/fragment-worker.js).
// run(job) resolves with prepareFragmentJob's data; any worker problem rejects with error.fallback = true, and the caller
// then computes the same job on the main thread (src/engine/campus-engine.js). Without Worker support: null.
const WORKER_URL = new URL('./fragment-worker.js?v=prep43', import.meta.url);

function fallbackError(message) { return Object.assign(new Error(message), { fallback: true }); }
export function defaultPoolSize() { return Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency || 4) - 1)); }

// The worker gets compact copies of the source arrays (templates keep theirs); the copies are transferred, not cloned again.
export function packJob(job, slow = 1) {
  const copies = new Map(), transfer = [];
  const copy = array => { let c = copies.get(array); if (!c) { c = array.slice(); copies.set(array, c); transfer.push(c.buffer); } return c; };
  const attr = a => a && { ...a, array: copy(a.array) };
  const records = job.records.map(r => ({ ...r, position: attr(r.position), normal: attr(r.normal), uv: attr(r.uv), uv1: attr(r.uv1), color: attr(r.color), tangent: attr(r.tangent),
    index: r.index && { count: r.index.count, array: copy(r.index.array) }, sides: r.sides && copy(r.sides) }));
  return { message: { id: job.id, interior: job.interior, cellSize: job.cellSize, interiorPlacement: job.interiorPlacement, materials: job.materials, records, ...(slow > 1 ? { slow } : {}) }, transfer };
}

// slow: measurement only (see fragment-worker.js), 1 = off.
export function createFragmentPool({ size = defaultPoolSize(), url = WORKER_URL, slow = 1 } = {}) {
  if (typeof Worker !== 'function') return null;
  const slots = [], pending = new Map(), stats = { workers: 0, jobs: 0, done: 0, fallbacks: 0, workerMs: 0 };
  let seq = 0, broken = false;
  for (let i = 0; i < size; i++) {
    let worker;
    try { worker = new Worker(url, { type: 'module' }); } catch { broken = true; break; }
    const slot = { worker, busy: 0 };
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.seq); if (!job) return;
      pending.delete(data.seq); slot.busy--;
      if (data.error) { stats.fallbacks++; job.reject(fallbackError(data.error)); }
      else { stats.done++; stats.workerMs += data.out.workerMs || 0; job.resolve(data.out); }
    };
    // A worker that cannot start (module load / syntax error) or crashes: its jobs go back to the main thread.
    worker.onerror = event => {
      event?.preventDefault?.(); broken = true;
      for (const [key, job] of pending) if (job.slot === slot) { pending.delete(key); stats.fallbacks++; job.reject(fallbackError('fragment worker failed')); }
    };
    slots.push(slot);
  }
  if (!slots.length) return null;
  stats.workers = slots.length;
  return {
    stats,
    run(job) {
      if (broken || !slots.length) { stats.fallbacks++; return Promise.reject(fallbackError('fragment worker unavailable')); }
      const slot = slots.reduce((a, b) => (b.busy < a.busy ? b : a)); slot.busy++; stats.jobs++;
      const key = ++seq;
      return new Promise((resolve, reject) => {
        pending.set(key, { resolve, reject, slot });
        try { const { message, transfer } = packJob(job, slow); slot.worker.postMessage({ seq: key, job: message }, transfer); }
        catch (error) { pending.delete(key); slot.busy--; stats.fallbacks++; reject(fallbackError(String(error?.message ?? error))); }
      });
    },
    dispose() { for (const slot of slots) slot.worker.terminate(); slots.length = 0; for (const job of pending.values()) job.reject(fallbackError('fragment pool closed')); pending.clear(); },
  };
}
