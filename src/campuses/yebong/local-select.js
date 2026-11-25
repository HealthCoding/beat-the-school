// Page-scoped, local-only bridge until the shared registry is updated.
import campus from './index.js';
export function selectedCampusId() { return 'yebong'; }
export async function loadCampusPackage() {
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(globalThis.location?.hostname || '')) throw new Error('이 캠퍼스는 로컬 검토용이에요.');
  return campus;
}
