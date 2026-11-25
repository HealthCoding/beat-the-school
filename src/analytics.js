// Vercel Web Analytics custom events (static-HTML form: va('event',{name,data}), docs: vercel.com/docs/analytics/custom-events).
// The <head> stub defines window.va only off localhost, so local play sends nothing. Never let analytics break the game.
export function track(name,data){
 try{if(typeof window!=='undefined'&&typeof window.va==='function')window.va('event',data?{name,data}:{name});}catch{}
}
