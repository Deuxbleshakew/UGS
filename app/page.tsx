import TournamentApp from './tournament-app';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Page() { if(!await getCurrentUser())redirect('/login');return <TournamentApp/>; }
