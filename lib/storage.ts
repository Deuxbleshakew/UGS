import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { SQLInputValue } from 'node:sqlite';
import { database, dataDirectory } from '@/scripts/local-store.mjs';

function values(args:unknown[]):SQLInputValue[]{return args.map(value=>{
  if(value==null)return null;
  if(typeof value==='string'||typeof value==='number'||typeof value==='bigint'||value instanceof Uint8Array)return value;
  throw new Error('Unsupported SQL parameter.');
});}
class Statement {
  constructor(private sql:string,private args:SQLInputValue[]=[]){}
  bind(...args:unknown[]){return new Statement(this.sql,values(args));}
  async first<T=Record<string,unknown>>():Promise<T|null>{return database().prepare(this.sql).get(...this.args) as T??null;}
  async all<T=Record<string,unknown>>(){return {results:database().prepare(this.sql).all(...this.args) as T[]};}
  execute(){return {meta:{changes:Number(database().prepare(this.sql).run(...this.args).changes)}};}
  async run(){return this.execute();}
}
export const store={
  prepare:(sql:string)=>new Statement(sql),
  async batch(statements:Statement[]){
    const db=database();db.exec('BEGIN IMMEDIATE');
    try{
      // No awaits inside this transaction: all statements, conditional changes()
      // checks, and audit inserts share the same connection without interleaving.
      const results=statements.map(s=>s.execute());db.exec('COMMIT');return results;
    }catch(error){db.exec('ROLLBACK');throw error;}
  },
};
function proofPath(key:string){
  if(!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key))throw new Error('Invalid proof storage key.');
  return path.join(dataDirectory(),'proofs',...key.split('/'));
}
export const proofStore={
  async put(key:string,bytes:ArrayBuffer){const destination=proofPath(key);await mkdir(path.dirname(destination),{recursive:true,mode:0o700});await writeFile(destination,new Uint8Array(bytes),{flag:'wx',mode:0o600});},
  async get(key:string){try{return {body:new Uint8Array(await readFile(proofPath(key)))};}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}},
  async delete(key:string){try{await unlink(proofPath(key));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}},
};
