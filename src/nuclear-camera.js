import {campusViewInsets} from './camera.js?v=impact20';
import {getNuclearFlightPose,getNuclearCloudEnvelope,NUCLEAR_AFTERMATH_SECONDS} from './nuclear-effects.js?v=mini24b';
export const NUCLEAR_COUNTDOWN_SECONDS=3;
export const NUCLEAR_FALL_SECONDS=3;
export const NUCLEAR_IMPACT_AT=NUCLEAR_COUNTDOWN_SECONDS+NUCLEAR_FALL_SECONDS;
export const NUCLEAR_COMPLETE_AT=NUCLEAR_IMPACT_AT+NUCLEAR_AFTERMATH_SECONDS+.3;

// Cinematic framing covers the impact neighbourhood, not the campus overview bounds.
// The projectile's actual animation pose is the only source for the tracking shot.
export function createNuclearCamera(THREE,camera,{point,worldRadius,groundY=0,azimuth=.16,reducedMotion=false}){
 const cloud=getNuclearCloudEnvelope(worldRadius),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2);
 const target=new THREE.Vector3(),position=new THREE.Vector3(),body=new THREE.Vector3();
 const shot={target,position,distance:0,phase:'countdown',elevation:0};
 const smooth=x=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t);};
 const apply=(distance,elevation)=>{
  shot.distance=distance;shot.elevation=elevation;
  position.set(target.x+Math.sin(azimuth)*Math.cos(elevation)*distance,target.y+Math.sin(elevation)*distance,target.z+Math.cos(azimuth)*Math.cos(elevation)*distance);
  camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld(true);return shot;
 };
 return {update(age){
  if(age<NUCLEAR_COUNTDOWN_SECONDS)return null;
  const flightAge=age-NUCLEAR_COUNTDOWN_SECONDS;
  // Portrait keeps the main cap readable; peripheral ground dust is allowed offscreen.
  const width=camera.view?.fullWidth||1440,height=camera.view?.fullHeight||900,insets=campusViewInsets(width,height);
  const available=Math.max(.35,1-(insets.top+insets.bottom)/height);
  const endDistance=Math.max(cloud.unit*4.6*Math.max(1,.86/available),cloud.radius/(tan*Math.max(.25,camera.aspect)*.95));
  const impactDistance=Math.max(cloud.unit*2.8,Math.min(endDistance*.55,cloud.unit*3.5));
  if(reducedMotion){
   shot.phase=flightAge<NUCLEAR_FALL_SECONDS?'fall':'blast';target.set(point.x,groundY+cloud.unit*1.8,point.z);
   return apply(endDistance,.26);
  }
  if(flightAge<NUCLEAR_FALL_SECONDS){
   const pose=getNuclearFlightPose({point,worldRadius,age:flightAge,impactDelay:NUCLEAR_FALL_SECONDS});
   body.set(pose.position.x,pose.position.y+pose.size*.3,pose.position.z);
   const closeDistance=Math.max(pose.height*1.55,pose.height/(2*tan*available*.72));
   const widen=smooth((flightAge-.65)/1.75),land=smooth((flightAge-2.35)/.65);
   target.copy(body);target.y=THREE.MathUtils.lerp(body.y,groundY+cloud.unit*.2,land);
   shot.phase=flightAge<.65?'projectile':'fall';
   return apply(THREE.MathUtils.lerp(closeDistance,impactDistance,widen),THREE.MathUtils.lerp(.18,.38,widen));
  }
  const post=age-NUCLEAR_IMPACT_AT,develop=smooth(post/3.4);
  target.set(point.x,groundY+cloud.unit*THREE.MathUtils.lerp(.2,1.8,develop),point.z);
  shot.phase=post<3.4?'blast':'cloud';
  return apply(THREE.MathUtils.lerp(impactDistance,endDistance,develop),THREE.MathUtils.lerp(.38,.26,develop));
 }};
}
