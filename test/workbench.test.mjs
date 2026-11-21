import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, decide, optimize, queue } from '../packages/analysis/index.mjs';
import { fresh } from '../packages/providers/demo.mjs';

test('uses a later FLEX and preserves locked slots',()=>{
  const league=fresh();
  league.players.find(p=>p.id==='p2').locked=true;
  const lineup=optimize(league);
  assert.equal(lineup[1],'p2');
  assert.equal(lineup[6],'p4');
  assert.ok(lineup.includes('p10'));
  assert.ok(!lineup.includes('p7'));
});
test('applies the exact reviewed lineup and rejects duplicate decisions',()=>{
  const league=fresh();
  queue(league,0);
  const p=league.proposals.find(x=>x.kind==='lineup');
  decide(league,p.id,'approve',1);
  assert.equal(p.status,'applied');
  assert.deepEqual(league.lineup,p.lineup);
  assert.equal(league.activity[0].id,p.id);
  assert.throws(()=>decide(league,p.id,'approve',2));
});
test('stale approvals cannot modify the roster',()=>{
  const league=fresh();
  queue(league,0);
  const p=league.proposals.find(x=>x.kind==='lineup');
  const before=[...league.lineup];
  league.revision++;
  decide(league,p.id,'approve',1);
  assert.equal(p.status,'stale');
  assert.deepEqual(league.lineup,before);
});
test('sending a demo trade offer does not transfer ownership',()=>{
  const league=fresh();
  queue(league,0);
  const p=league.proposals.find(x=>x.kind==='trade');
  decide(league,p.id,'approve',1);
  assert.equal(p.status,'offer_sent');
  assert.ok(league.bench.includes('p11'));
  assert.ok(league.opponents[0].players.includes('p13'));
  assert.ok(!analyze(league).some(x=>x.kind==='trade'));
});
