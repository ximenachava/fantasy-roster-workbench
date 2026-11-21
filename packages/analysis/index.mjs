import { randomUUID } from 'node:crypto';

export const eligible = (slot, player) =>
  slot === player.position || (slot === 'FLEX' && ['RB','WR','TE'].includes(player.position));

const weight = p => 0.55 * p.projected + 0.35 * p.average + 0.10 * p.last;
export const total = (ids, byId) => Math.round(ids.reduce((sum,id) => sum + byId[id].projected,0)*10)/10;
export const playersById = league => Object.fromEntries(league.players.map(p => [p.id,p]));

export function optimize(league) {
  const byId = playersById(league);
  const pool = [...league.lineup,...league.bench];
  const locked = new Set(league.lineup.filter(id => byId[id].locked));
  let best;
  function visit(index, ids, used, score) {
    if (index === league.slots.length) {
      const flexKickoff = byId[ids[league.slots.indexOf('FLEX')]].kickoff;
      const changes = ids.filter((id,i)=>id!==league.lineup[i]).length;
      if (!best || score > best.score + 1e-8 ||
        (Math.abs(score-best.score)<1e-8 && (flexKickoff>best.flexKickoff ||
        (flexKickoff===best.flexKickoff && changes<best.changes)))) {
        best = { ids:[...ids],score,flexKickoff,changes };
      }
      return;
    }
    const current = league.lineup[index];
    const candidates = locked.has(current) ? [current] : pool.filter(id=>!locked.has(id) && !byId[id].locked);
    for (const id of candidates) {
      if (used.has(id) || !eligible(league.slots[index],byId[id])) continue;
      ids.push(id);
      used.add(id);
      visit(index+1,ids,used,score+weight(byId[id]));
      used.delete(id);
      ids.pop();
    }
  }
  visit(0,[],new Set(),0);
  return best?.ids ?? [...league.lineup];
}

export function analyze(league) {
  const byId = playersById(league);
  const lineup = optimize(league);
  const projectedDelta = Math.round((total(lineup,byId)-total(league.lineup,byId))*10)/10;
  const proposals = [];
  if (lineup.some((id,i)=>id!==league.lineup[i])) {
    proposals.push({ kind:'lineup', title:'Optimize starting lineup', lineup, projectedDelta });
  }
  if (league.bench.includes('p11') && league.opponents[0].players.includes('p13') &&
    !league.activity.some(event=>event.kind==='trade' && event.status==='offer_sent')) {
    proposals.push({
      kind:'trade', title:'Offer a depth RB for Noah Brooks', opponentId:'north',
      give:['p11'], receive:['p13'],
      reason:'Brooks has averaged 13.8 points per game versus Porter’s 8.3. This opening offer gives North End a depth replacement, but Brooks has outscored Porter and the other manager may decline.'
    });
  }
  return proposals;
}

export function queue(league, now = Date.now()) {
  const outstanding = league.proposals.filter(p=>p.status==='pending' && p.revision===league.revision && p.expiresAt>now);
  const queued = analyze(league).filter(p=>!outstanding.some(existing=>existing.kind===p.kind));
  league.proposals.push(...queued.map(p=>({
    ...p,id:randomUUID(),week:league.week,revision:league.revision,expiresAt:now+30*60_000,status:'pending'
  })));
}

export function decide(league,id,action,now = Date.now()) {
  const p = league.proposals.find(item=>item.id===id);
  if (!p || p.status!=='pending') throw new Error('This proposal has already been resolved or does not exist.');
  if (action==='reject') { p.status='rejected'; return; }
  if (action!=='approve') throw new Error('Unknown action.');
  if (p.revision!==league.revision || p.week!==league.week || p.expiresAt<=now) {
    p.status='stale';
    return;
  }
  const byId=playersById(league);
  if (p.kind==='lineup') {
    const pool=[...league.lineup,...league.bench];
    const valid=p.lineup.length===league.slots.length && new Set(p.lineup).size===p.lineup.length &&
      p.lineup.every((id,i)=>pool.includes(id) && eligible(league.slots[i],byId[id]) &&
        (!(byId[id].locked || byId[league.lineup[i]].locked) || id===league.lineup[i]));
    if (!valid) {p.status='stale';return;}
    league.lineup=[...p.lineup];
    league.bench=pool.filter(id=>!league.lineup.includes(id));
    league.revision++;
    p.status='applied';
  } else {
    const rival=league.opponents.find(x=>x.id===p.opponentId);
    if (!rival || !p.give.every(id=>league.bench.includes(id) || league.lineup.includes(id)) ||
       !p.receive.every(id=>rival.players.includes(id)) ||
       [...p.give,...p.receive].some(id=>byId[id].locked)) {
      p.status='stale';
      return;
    }
    p.status='offer_sent';
  }
  league.activity.unshift({id:p.id,kind:p.kind,title:p.title,status:p.status,at:now});
}
