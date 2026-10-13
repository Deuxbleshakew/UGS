// Compatibility aliases for unused starter helpers. Render authentication never
// trusts externally supplied oai-authenticated-* headers.
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{const user=await getCurrentUser();return user?{...user,fullName:user.displayName}:null;}
export async function requireChatGPTUser(_returnTo:string){const user=await getChatGPTUser();if(!user)redirect('/login');return user;}
export function chatGPTSignInPath(_returnTo:string){return '/login';}
export function chatGPTSignOutPath(_returnTo='/'){return '/login';}
