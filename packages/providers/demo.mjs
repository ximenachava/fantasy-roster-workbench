import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const fixture = new URL('../../fixtures/league.json',import.meta.url);
const folder = new URL('../../.runtime/',import.meta.url);
const file = new URL('league.json',folder);
const temp = new URL('league.tmp.json',folder);
export const fresh = () => JSON.parse(readFileSync(fixture,'utf8'));
export function load() {
  try { return JSON.parse(readFileSync(file,'utf8')); }
  catch (error) { if (error.code!=='ENOENT') throw error; return fresh(); }
}
export function save(league) {
  mkdirSync(folder,{recursive:true});
  writeFileSync(temp,JSON.stringify(league,null,2));
  renameSync(temp,file);
}
