// Reviewer-owned check for lib/schedule-labels.ts. The local assistant must NOT edit this file.
// Run from the project root:  node scripts/check-schedule-labels.mjs
// Needs Node 22.18+ (TypeScript type stripping). On older Node: node --experimental-strip-types scripts/check-schedule-labels.mjs
import assert from 'node:assert/strict';
const {proposalStatusLabel,timeUntil}=await import('../lib/schedule-labels.ts');
let passed=0;
const t=(name,fn)=>{try{fn();passed++;console.log('PASS',name);}catch(e){console.log('FAIL',name,'\n  ',e.message.split('\n')[0]);process.exitCode=1;}};

const expected={
  awaiting_opponent:['Waiting for opponent','pending'],
  awaiting_owner:['Waiting for owner approval','pending'],
  accepted:['Accepted','good'],
  declined:['Declined','bad'],
  countered:['Counter-proposed','neutral'],
  withdrawn:['Withdrawn','neutral'],
  rejected:['Rejected by owner','bad'],
  superseded:['Closed (kickoff changed)','neutral'],
  expired:['Expired','neutral'],
};
for(const [status,[label,tone]] of Object.entries(expected))t('status '+status,()=>assert.deepEqual(proposalStatusLabel(status),{label,tone}));
t('unknown status is echoed, neutral',()=>assert.deepEqual(proposalStatusLabel('mystery'),{label:'mystery',tone:'neutral'}));
t('empty status',()=>assert.deepEqual(proposalStatusLabel(''),{label:'Unknown',tone:'neutral'}));
t('inherited object keys are not statuses',()=>assert.deepEqual(proposalStatusLabel('constructor'),{label:'constructor',tone:'neutral'}));

const now='2026-11-01T12:00:00.000Z',at=ms=>new Date(Date.parse(now)+ms).toISOString();
const MIN=60000,H=60*MIN,D=24*H;
const cases=[
  [-1,'Time has passed'],[0,'Time has passed'],[-5*D,'Time has passed'],
  [1,'in under a minute'],[59*1000,'in under a minute'],
  [MIN,'in 1 min'],[45*MIN,'in 45 min'],[59*MIN+59000,'in 59 min'],
  [H,'in 1 h'],[H+30*MIN,'in 1 h 30 min'],[23*H+59*MIN,'in 23 h 59 min'],
  [D,'in 1 d'],[D+H,'in 1 d 1 h'],[2*D+3*H+59*MIN,'in 2 d 3 h'],[30*D,'in 30 d'],
];
for(const [ms,text] of cases)t(`timeUntil ${ms}ms -> ${text}`,()=>assert.equal(timeUntil(at(ms),now),text));
t('invalid target',()=>assert.equal(timeUntil('nope',now),''));
t('invalid now',()=>assert.equal(timeUntil(now,'nope'),''));
t('empty target',()=>assert.equal(timeUntil('',now),''));
console.log(`\n${passed} passed${process.exitCode?' — SOME FAILED':''}`);
