import { authentication } from '@/lib/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request,context:{params:Promise<{action:string}>}){
  try{return await authentication(request,(await context.params).action);}
  catch(error){console.error('Authentication failed',error instanceof Error?error.message:'Unknown error');return Response.json({error:'Sign-in is unavailable. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
