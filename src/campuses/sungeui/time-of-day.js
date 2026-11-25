// School-scoped shadow precision: verified at the final day/golden camera.
// The common time-of-day updater does not overwrite these two bias values.
// Keep receiveShadow and castShadow enabled on all authored buildings.
import {createTimeOfDay as commonTimeOfDay} from '../../time-of-day.js';
export * from '../../time-of-day.js';
export function createTimeOfDay(options){
 const result=commonTimeOfDay(options);
 options.sun.shadow.normalBias=0;
 options.sun.shadow.bias=-.001;
 return result;
}
