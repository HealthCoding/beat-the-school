// Page-scoped bridge for local review while the shared registry has no entry.
import campus from './index.js';
export function selectedCampusId(){return 'gwnuGangneung'}
export async function loadCampusPackage(){
 if(!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(globalThis.location?.hostname||''))throw Error('이 캠퍼스는 로컬 검토용이에요.');
 return campus;
}
