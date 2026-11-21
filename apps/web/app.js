let data, active='lineup', busy=false;
const $=id=>document.getElementById(id);
const text=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Number(value).toFixed(1);
const status={pending:'Pending review',rejected:'Rejected',stale:'Stale · run analysis again',applied:'Applied',offer_sent:'Demo offer sent'};
const fields = ['Slot','Player','Season avg.','Last game','Week projection'];
const table=(rows)=>`<div class="table"><table><thead><tr>${fields.map(f=>`<th scope="col">${f}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
function render(){
  const {league,suggestions}=data;
  const byId=Object.fromEntries(league.players.map(p=>[p.id,p]));
  const name=id=>text(byId[id].name);
  const pending=league.proposals.filter(p=>p.status==='pending');
  const next=suggestions.find(p=>p.kind==='lineup');
  const current=league.lineup.reduce((n,id)=>n+byId[id].projected,0);
  $('context').textContent=league.name+' · Week '+league.week;
  $('count').textContent=pending.length;
  $('metrics').innerHTML=[['Record',league.record],['Current projection',fmt(current)],['Optimized projection',fmt(current+(next?.projectedDelta??0))]].map(([label,value])=>`<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
  document.querySelectorAll('nav button').forEach(btn=>{
    const selected=btn.dataset.view===active;
    btn.classList.toggle('selected',selected);
    btn.setAttribute('aria-pressed',selected);
  });
  const row=(id,slot,change='')=>{
    const p=byId[id];
    return `<tr><td>${slot}</td><td>${name(id)}${change}</td><td>${fmt(p.average)}</td><td>${fmt(p.last)}</td><td>${fmt(p.projected)}</td></tr>`;
  };
  const changes=p=>p.lineup.map((id,i)=>id===league.lineup[i]?'':`<li>${league.slots[i]} · ${name(league.lineup[i])} to ${name(id)}</li>`).join('');
  const trade=p=>`<p>Give <strong>${p.give.map(name).join(', ')}</strong> · Receive <strong>${p.receive.map(name).join(', ')}</strong></p><p class="muted">${text(p.reason)}</p>`;
  let html;
  if(active==='lineup') {
    html=`<h2>Starting lineup</h2><p class="muted">Compare current starters with the suggested lineup for Week ${league.week}.</p>`+
      table(league.lineup.map((id,i)=>row(id,league.slots[i],next?.lineup[i]!==id&&next?` <span class="changed">→ ${name(next.lineup[i])}</span>`:'')))+
      `<h3>Bench</h3>`+table(league.bench.map(id=>row(id,'BENCH')));
  } else if(active==='trades') {
    const ideas=suggestions.filter(p=>p.kind==='trade');
    html='<h2>Trade ideas</h2>'+ (ideas.length?ideas.map(p=>`<article class="card"><h3>${text(league.opponents.find(o=>o.id===p.opponentId).name)}</h3>${trade(p)}</article>`).join(''):'<p class="muted">No new trade ideas.</p>');
  } else if(active==='queue') {
    html='<h2>Review queue</h2>'+ (pending.length?pending.map(p=>`<article class="card"><h3>${text(p.title)}</h3><p class="meta">Week ${p.week} · Expires ${new Date(p.expiresAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</p>${p.kind==='lineup'?`<ul>${changes(p)}</ul><p>Projected change ${p.projectedDelta>=0?'+':''}${fmt(p.projectedDelta)}</p>`:trade(p)}<div class="actions"><button class="primary" data-action="approve" data-id="${p.id}">${p.kind==='trade'?'Approve demo offer':'Approve lineup'}</button><button class="secondary" data-action="reject" data-id="${p.id}">Reject</button></div></article>`).join(''):'<p class="muted">Run analysis to queue lineup and trade proposals for review.</p>');
  } else {
    const history=[...league.proposals].reverse().filter(p=>p.status!=='pending');
    html='<h2>Activity</h2>'+ (history.length?history.map(p=>`<article class="card"><h3>${text(p.title)}</h3><p>${status[p.status]}</p></article>`).join(''):'<p class="muted">No proposals have been reviewed yet.</p>');
  }
  $('view').innerHTML=html;
  document.querySelectorAll('button[data-action]').forEach(btn=>btn.disabled=busy);
  $('analyze').disabled=busy;
  $('reset').disabled=busy;
}
async function request(path,body,message){
  if(busy)return;
  busy=true;
  if(data)render();
  try{
    const response=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error);
    data=result;
    if(path==='/api/analyze')active='queue';
    if(path==='/api/reset')active='lineup';
    $('notice').textContent=path==='/api/decision'?(status[data.league.proposals.find(p=>p.id===body.id)?.status]??'Proposal updated.'):message;
  }catch(error){$('notice').textContent=error.message;}
  finally{busy=false;if(data)render();}
}
document.querySelector('nav').addEventListener('click',event=>{
  const view=event.target.closest('button')?.dataset.view;
  if(view&&data){active=view;render();}
});
$('view').addEventListener('click',event=>{
  const btn=event.target.closest('button[data-action]');
  if(btn)request('/api/decision',{id:btn.dataset.id,action:btn.dataset.action},'');
});
$('analyze').onclick=()=>request('/api/analyze',{},'Analysis complete.');
$('reset').onclick=()=>request('/api/reset',{},'Demo reset.');
request('/api/league',undefined,'');
