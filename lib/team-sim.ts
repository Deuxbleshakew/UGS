import {createHash} from 'node:crypto';

// Deterministic simulation of one home-and-away tie. Same seed + same inputs = same result, so it can be audited.
export type SimTie={l1Low:number;l1High:number;l2Low:number;l2High:number;pensLow:number|null;pensHigh:number|null;winner:'low'|'high'};
const BASE_GOALS=1.35,HOME_EDGE=1.1,PEN_RATE=0.76;
function rngFor(seed:string,label:string){
  let a=createHash('sha256').update(seed+'|'+label).digest().readUInt32BE(0);
  return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
function poisson(lambda:number,rng:()=>number){const limit=Math.exp(-lambda);let k=0,p=1;do{k++;p*=rng();}while(p>limit&&k<20);return k-1;}
/** Goals for each side: strength decides the expectation (square-root damped so upsets stay possible). */
function leg(hostStrength:number,guestStrength:number,rng:()=>number){
  const r=Math.sqrt(hostStrength/guestStrength);
  return {host:poisson(BASE_GOALS*r*HOME_EDGE,rng),guest:poisson(BASE_GOALS/r/HOME_EDGE,rng)};
}
export function simulateTie(seed:string,position:number,lowStrength:number,highStrength:number):SimTie{
  const rng=rngFor(seed,'tie'+position);
  const first=leg(lowStrength,highStrength,rng);   // the lower seed hosts the first leg
  const second=leg(highStrength,lowStrength,rng);  // the higher seed hosts the return leg
  const l1Low=first.host,l1High=first.guest,l2High=second.host,l2Low=second.guest;
  const aggLow=l1Low+l2Low,aggHigh=l1High+l2High;
  if(aggLow!==aggHigh)return {l1Low,l1High,l2Low,l2High,pensLow:null,pensHigh:null,winner:aggLow>aggHigh?'low':'high'};
  // Level on aggregate: no away goals. Five kicks each, then sudden death.
  let pl=0,ph=0;
  for(let i=0;i<5;i++){if(rng()<PEN_RATE)pl++;if(rng()<PEN_RATE)ph++;}
  let guard=0;
  while(pl===ph&&guard++<50){const a=rng()<PEN_RATE,b=rng()<PEN_RATE;if(a)pl++;if(b)ph++;}
  if(pl===ph)pl++; // practically unreachable; keeps the result well defined
  return {l1Low,l1High,l2Low,l2High,pensLow:pl,pensHigh:ph,winner:pl>ph?'low':'high'};
}
/** Best v worst pairing of the playoff teams: the first playoff rank meets the last, and so on. */
export function pairRanks(firstPlayoffRank:number,lastRank:number){
  const pairs:{position:number;high:number;low:number}[]=[];
  for(let hi=firstPlayoffRank,lo=lastRank,p=1;hi<lo;hi++,lo--,p++)pairs.push({position:p,high:hi,low:lo});
  return pairs;
}
