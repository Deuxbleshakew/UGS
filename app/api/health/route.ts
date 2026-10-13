import { database } from '@/scripts/local-store.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{database().prepare('SELECT 1').get();return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable'},{status:503});}}
