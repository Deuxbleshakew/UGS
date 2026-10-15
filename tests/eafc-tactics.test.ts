// Run: npx esbuild tests/eafc-tactics.test.ts --bundle --platform=node --format=esm --alias:@=. --outfile=_t.mjs && node _t.mjs && rm _t.mjs
// Covers: the three recorded codes, every formation, every role/focus option at every position, import->export round trips,
// rejection of structurally valid codes with invalid formation/position combinations, and formation-switch remapping.
import {encode,decode} from '@/lib/eafc-tactic-code';
import {FORMATIONS,encodeTactic,decodeTactic,defaultTactic,defaultRoles,remapRoles,optionsFor,layoutFor,formationByKey,formationLabel,type EaTactic} from '@/lib/eafc-tactics';
let ok=0,bad=0;const t=(n:string,c:boolean)=>{c?ok++:(bad++,console.log('FAIL',n));};
const thr=(f:()=>unknown)=>{try{f();return '';}catch(e:any){return String(e.message);}};
// 1. recorded regression codes (config-aware)
const o=decodeTactic('bJ1HxNuTxs57');
t('orig formation 4411-2',o.formationKey==='4411-2');t('orig height',o.lineHeight===50);t('orig buildup',o.buildUp==='Short Passing');t('orig roles',o.roleIds.join()==='4,10,9,9,9,0,7,7,0,1,7');
t('orig re-export',encodeTactic(o)==='bJ1HxNuTxs57');
t('h60',encodeTactic({...o,lineHeight:60})==='$J@R7X4d72TG');t('h60 import',decodeTactic('$J@R7X4d72TG').lineHeight===60);
const z:EaTactic={formationKey:'352',buildUp:'Balanced',lineHeight:50,roleIds:Array(11).fill(0)};
t('352 zeros',encodeTactic(z)==='jQ?h5nzptf@j');t('352 id 27',formationByKey('352')!.eaId===27);
// 2. every formation: layout, defaults valid, round trip
t('29 formations',FORMATIONS.length===29);
for(const f of FORMATIONS){
  const d=defaultTactic(f.key);const c=encodeTactic(d);const b=decodeTactic(c);
  t('default rt '+f.key,JSON.stringify(b)===JSON.stringify(d)&&encodeTactic(b)===c);
  const L=layoutFor(f.key);t('layout '+f.key,L.length===11&&L.every((p,i)=>p&&p.pos===f.positions[i].pos&&p.x>=5&&p.x<=95));
  // no two cards on top of each other
  for(let i=0;i<11;i++)for(let j=i+1;j<11;j++)if(L[i].y===L[j].y&&Math.abs(L[i].x-L[j].x)<10)t('overlap '+f.key,false);
  // 3. every option at every position, one at a time
  f.positions.forEach((p,i)=>{for(const op of optionsFor(p.pos)){const x={...d,roleIds:d.roleIds.map((r,k)=>k===i?op.id:r)};
    const code=encodeTactic(x);const y=decodeTactic(code);t(`opt ${f.key} ${p.pos}#${i} ${op.id}`,JSON.stringify(y)===JSON.stringify(x)&&encodeTactic(y)===code);}
    // one past the last valid option must be rejected
    const n=optionsFor(p.pos).length;if(n<16)t(`reject ${f.key} ${p.pos} id ${n}`,thr(()=>encodeTactic({...d,roleIds:d.roleIds.map((r,k)=>k===i?n:r)})).includes('not valid for'));});
  // 4. structurally valid raw code with an invalid role for the position must be rejected on import
  const raw=encode({formationId:f.eaId,buildUpId:0,lineHeight:50,roles:d.roleIds.map((r,k)=>k===0?9:r)}); // GK has only 0-4
  t('import rejects bad GK '+f.key,thr(()=>decodeTactic(raw)).includes('not valid for GK'));
}
// 5. other rejections
t('unknown formation id',thr(()=>decodeTactic(encode({formationId:26,buildUpId:0,lineHeight:50,roles:Array(11).fill(0)}))).includes('not in the supported list'));
t('formation id 0',thr(()=>decodeTactic(encode({formationId:0,buildUpId:0,lineHeight:50,roles:Array(11).fill(0)}))).length>0);
t('buildup 3',thr(()=>encode({formationId:27,buildUpId:3,lineHeight:50,roles:Array(11).fill(0)})).length>0);
t('bad checksum',thr(()=>decodeTactic('bJ1HxNuTxs58')).includes('Checksum'));
t('height 0',thr(()=>encodeTactic({...z,lineHeight:0})).includes('1 to 100'));t('height 101',thr(()=>encodeTactic({...z,lineHeight:101})).includes('1 to 100'));t('height 50.5',thr(()=>encodeTactic({...z,lineHeight:50.5})).length>0);
t('unsupported formation',thr(()=>encodeTactic({...z,formationKey:'9-9-9'})).includes('Unsupported'));
t('ten roles',thr(()=>encodeTactic({...z,roleIds:Array(10).fill(0)})).includes('eleven'));
t('bad buildup name',thr(()=>encodeTactic({...z,buildUp:'Fast' as any})).includes('Build-up'));
// 6. remap reports resets and never silently substitutes
const r=remapRoles('433',defaultRoles('433'),'352');t('remap valid',r.roleIds.length===11&&encodeTactic({formationKey:'352',buildUp:'Balanced',lineHeight:50,roleIds:r.roleIds}).length===12);
t('remap reports',r.reset.length>0&&r.reset.every(x=>typeof x==='string'));
const same=remapRoles('442',defaultRoles('442'),'442-2');console.log('442->442-2 reset:',same.reset.join(','),'| 433->352 reset:',r.reset.join(','));
// 7. importing then exporting every default reproduces; label sanity
t('labels',formationLabel('433')==='4-3-3'&&formationLabel('433-2')==='4-3-3 (2)'&&formationLabel('41212')==='4-1-2-1-2'&&formationLabel('352')==='3-5-2'&&formationLabel('4411-2')==='4-4-1-1 (2)');
// remap by position type
{const d=defaultRoles('442');const m=remapRoles('442',d,'4231');console.log('442->4231 reset:',m.reset.join(','));
 const k=remapRoles('442',d,'442');t('same formation nothing reset',k.reset.length===0&&k.roleIds.join()===d.join());
 const s2=remapRoles('352',defaultRoles('352'),'532');console.log('352->532 reset:',s2.reset.join(','));}

// the raw codec on its own (no configuration): the three recorded codes + random round trips
{const a=decode('bJ1HxNuTxs57');t('raw orig',a.formationId===18&&a.lineHeight===50&&a.buildUpId===2&&a.roles.join()==='4,10,9,9,9,0,7,7,0,1,7');
 let sd=12345;const rnd=(n:number)=>{sd=(sd*1103515245+12345)&0x7fffffff;return sd%n;};
 for(let i=0;i<2000;i++){const x={formationId:rnd(1024),buildUpId:rnd(3),lineHeight:1+rnd(100),roles:Array.from({length:11},()=>rnd(16))};const y=decode(encode(x));t('raw rt'+i,x.formationId===y.formationId&&x.buildUpId===y.buildUpId&&x.lineHeight===y.lineHeight&&x.roles.join()===y.roles.join());}}
console.log(ok,'passed',bad,'failed');
if(bad)process.exit(1);
