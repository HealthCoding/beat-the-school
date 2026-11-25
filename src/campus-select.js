// Chooses which campus package the game loads and imports only that one.
// `/` is the default campus; another campus page declares itself with <meta name="bts-campus" content="…">.
// `?campus=` is honoured on local development hosts only, so unpublished campuses never show from a URL.
import { CAMPUSES, DEFAULT_CAMPUS } from './campuses/registry.js?v=sg01';

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])$/;

export function selectedCampusId({ meta, search, hostname } = {}) {
  let id = meta;
  if (id === undefined) { try { id = globalThis.document?.querySelector?.('meta[name="bts-campus"]')?.content; } catch { id = undefined; } }
  const host = hostname ?? globalThis.location?.hostname ?? '';
  if (LOCAL_HOSTS.test(host)) {
    const query = new URLSearchParams(search ?? globalThis.location?.search ?? '').get('campus');
    if (query) id = query;
  }
  if (!Object.hasOwn(CAMPUSES, id ?? '')) return DEFAULT_CAMPUS;
  // Unfinished campuses are only reachable as a local preview.
  return CAMPUSES[id].status === 'ready' || LOCAL_HOSTS.test(host) ? id : DEFAULT_CAMPUS;
}

export async function loadCampusPackage(id = selectedCampusId(), { hostname = globalThis.location?.hostname ?? '' } = {}) {
  const entry = CAMPUSES[id];
  if (!entry || (entry.status !== 'ready' && !LOCAL_HOSTS.test(hostname))) throw new Error(`알 수 없는 캠퍼스예요: ${id}`);
  // Dynamic import lives here (a real module URL) so the game can run from a data: URL in checks.
  const module = await import(new URL(entry.path, new URL('./campuses/', import.meta.url)).href);
  const pkg = module.default ?? Object.values(module)[0];
  if (!pkg?.placements?.length) throw new Error(`캠퍼스 패키지가 비어 있어요: ${id}`);
  return pkg;
}
