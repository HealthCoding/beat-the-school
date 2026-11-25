// One selected weapon, one explicit action: buy & equip, or equip an owned item.
// Never hide the only purchase action behind a disabled button or an unrelated card.
import {ATTACKS} from './weapon-actions.js?v=mini24b';
export function createWeaponShop({document,progress,tools,onEquip=()=>{},onNotify=()=>{},onPurchase=()=>{}}){
 const $=id=>document.getElementById(id);
 const dialog=$('shop-dialog'),cards=new Map();
 let inspected=progress.state.selected,filter='all';
 const toolById=id=>tools.find(tool=>tool.id===id)||tools[0];
 function render(){
  const state=progress.state,tool=toolById(inspected),owned=state.unlocked.includes(tool.id),equipped=state.selected===tool.id;
  $('shop-coins').textContent=state.coins.toLocaleString();
  $('weapon-preview').innerHTML=`<svg aria-hidden="true"><use href="#icon-${tool.id}"/></svg>`;
  $('weapon-name').textContent=tool.name;$('weapon-description').textContent=tool.description;
  const stats=$('weapon-stats');
  if(stats){const reach=tool.radius<3?'좁게 콕':tool.radius<6?'벽 한 움큼':tool.radius<12?'건물 한가득':'캠퍼스 대폭발';const speed=tool.cooldown<.2?'빠른 연타':tool.cooldown<.7?'가벼운 한 방':tool.cooldown<1.5?'묵직한 한 방':'초대형 한 방';stats.textContent=`${ATTACKS[tool.id].hint} · ${reach} · ${speed} · 간격 ${tool.cooldown}초`;}
  $('weapon-price').textContent=progress.testMode?'테스트 · 무료 사용':owned?'내 무기':`${tool.price.toLocaleString()} 코인`;
  $('weapon-balance').textContent=`내 지갑 ${state.coins.toLocaleString()} 코인`;
  $('weapon-action').disabled=false;$('weapon-action').dataset.owned=String(owned);
  $('weapon-action').dataset.affordable=String(progress.testMode||owned||state.coins>=tool.price);
  $('weapon-action').textContent=progress.testMode?(equipped?'장착 중 · 닫기':'무료 장착'):owned?(equipped?'장착 중 · 닫기':'장착'):`${tool.price.toLocaleString()} 코인 · 구매`;
  $('weapon-action').setAttribute('aria-label',`${tool.name} ${$('weapon-action').textContent}`);
  for(const [id,record] of cards){const item=toolById(id),has=state.unlocked.includes(id);record.button.hidden=filter==='owned'&&!has;record.button.dataset.selected=String(id===inspected);record.button.dataset.owned=String(has);record.button.setAttribute('aria-pressed',String(id===inspected));record.status.textContent=state.selected===id?'장착 중':progress.testMode?'테스트 · 무료':has?'보유 중':`${item.price.toLocaleString()} 코인`;}
  for(const button of document.querySelectorAll('[data-shop-filter]'))button.setAttribute('aria-pressed',String(button.dataset.shopFilter===filter));
 }
 function inspect(id){inspected=toolById(id).id;$('weapon-status').textContent='';render();}
 function close(){dialog.close();$('shop-open')?.setAttribute('aria-expanded','false');}
 function refresh(){progress.refresh();render();}
 function open(id){progress.refresh();filter='all';inspect(id||progress.state.selected);if(!dialog.open)dialog.showModal();$('shop-open')?.setAttribute('aria-expanded','true');}
 function activate(){
  progress.refresh();const tool=toolById(inspected),state=progress.state;
  if(progress.testMode){
   if(!progress.select(tool.id)){render();return;}
   onEquip(tool.id);render();close();onNotify(`${tool.name} 장착`);return;
  }
  if(state.unlocked.includes(tool.id)){
   if(!progress.select(tool.id)){render();return;}
   onEquip(tool.id);render();close();onNotify(`${tool.name} 장착`);return;
  }
  const result=progress.unlock(tool.id);
  if(!result.ok){render();const shortfall=Math.max(0,tool.price-progress.state.coins);$('weapon-status').textContent=shortfall?`코인이 ${shortfall.toLocaleString()}개 모자라요.`:'구매하지 못했어요. 다시 선택해 주세요.';return;}
  // An already-owned result can occur after another tab buys the same item.
  // Select again without spending so the actual saved selection matches the HUD.
  if(!progress.select(tool.id)){render();$('weapon-status').textContent='무기를 다시 선택해 주세요.';return;}
  onEquip(tool.id);render();close();onNotify(`${tool.name} 구매 완료! −${result.reason==='owned'?0:tool.price} 코인 · 바로 장착했어요`);onPurchase(tool);
 }
 for(const tool of tools){
  const button=document.createElement('button');button.type='button';button.className='weapon-card';button.dataset.weapon=tool.id;
  const icon=document.createElement('span');icon.className='weapon-card-icon';icon.innerHTML=`<svg aria-hidden="true"><use href="#icon-${tool.id}"/></svg>`;
  const name=document.createElement('strong');name.className='weapon-card-name';name.textContent=tool.name;
  const status=document.createElement('span');status.className='weapon-card-status';button.append(icon,name,status);
  button.addEventListener('click',()=>inspect(tool.id));$('shop-items').append(button);cards.set(tool.id,{button,status});
 }
 for(const button of document.querySelectorAll('[data-shop-filter]'))button.addEventListener('click',()=>{
  filter=button.dataset.shopFilter==='owned'?'owned':'all';if(filter==='owned'&&!progress.state.unlocked.includes(inspected))inspected=progress.state.unlocked.includes(progress.state.selected)?progress.state.selected:'fist';$('weapon-status').textContent='';render();
 });
 $('weapon-action').addEventListener('click',activate);$('shop-close').addEventListener('click',close);$('weapon-return').addEventListener('click',close);
 dialog.addEventListener('close',()=>$('shop-open')?.setAttribute('aria-expanded','false'));
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
 });
 render();return {open,close,render,refresh,inspect,get inspected(){return inspected;}};
}
