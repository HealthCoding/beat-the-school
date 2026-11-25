// Module worker: one building's fragment preparation (interior fill + clipping + vertex sharing) off the main thread.
// The same functions run on the main thread when no worker is available, so the output is identical either way.
// Imports carry the main thread's ?v= tags (same files, separate realm here).
import { prepareFragmentJob, fragmentDataBuffers } from '../model-destruction.js?v=lz69';
import * as interior from '../interior-fill.js?v=interior24';

self.onmessage = ({ data: { seq, job } }) => {
  try {
    const started = performance.now(), out = prepareFragmentJob(job, job.interior ? interior : null);
    out.workerMs = performance.now() - started;
    // Measurement only (?prepSlow=4 from the page): DevTools CPU throttling does not reach workers, so a throttled-phone
    // run stretches the worker's work by spinning the same core (slow - 1) times as long. Never set by the game itself.
    if (job.slow > 1) { const until = performance.now() + out.workerMs * (job.slow - 1); while (performance.now() < until); out.workerMs *= job.slow; }
    self.postMessage({ seq, out }, fragmentDataBuffers(out));
  } catch (error) { self.postMessage({ seq, error: String(error?.message ?? error) }); }
};
