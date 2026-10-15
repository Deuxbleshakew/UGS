import { discordRoute } from '@/lib/discord';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{action:string}>};
async function run(request:Request,context:Context){
  const action=(await context.params).action;
  try{return await discordRoute(request,action);}
  catch(error){
    console.error('Discord connection failed',error instanceof Error?error.message:'Unknown error');
    if(action==='callback')return new Response(null,{status:303,headers:{Location:'/login?discord=failed','Cache-Control':'no-store'}});
    return Response.json({error:'Discord is unavailable right now. Please retry.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
export async function GET(request:Request,context:Context){return run(request,context);}
export async function POST(request:Request,context:Context){return run(request,context);}
