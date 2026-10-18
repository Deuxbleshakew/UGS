'use client';
import {useCallback, useEffect, useState} from 'react';
import {Copy, Link2} from 'lucide-react';
import {api} from './ui';
import type {JoinLinkState} from '@/lib/join-link';

/** Owner controls for the shared join link: create or replace it, switch it on or off, limit its life and uses. */
export default function JoinLinkPanel({tournamentId}: {tournamentId: string}) {
  const [link, setLink] = useState<JoinLinkState | null>(null), [days, setDays] = useState('7'), [max, setMax] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  const base = `tournament/${tournamentId}/join-link`;
  const load = useCallback(() => api<JoinLinkState>(base).then(setLink).catch(e => setError((e as Error).message)), [base]);
  useEffect(() => {void load();}, [load]);
  async function act(action: 'create' | 'enable' | 'disable') {
    setBusy(true); setError(''); setCopied(false);
    try {setLink(await api<JoinLinkState>(base, {action, expiresDays: days === 'never' ? null : Number(days), maxUses: max.trim() ? Number(max) : null}));}
    catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  const url = link?.token ? `${window.location.origin}/join#code=${link.token}` : '';
  async function copy() {
    try {await navigator.clipboard.writeText(url); setCopied(true);} catch {setError('Select the link and copy it manually.');}
  }
  const status = !link?.exists ? 'No join link yet' : !link.enabled ? 'Switched off' : link.expired ? 'Expired' : link.full ? 'Full: limit reached' : 'Active';
  return <div className="join-link-panel">
    <h3 className="form-section-title"><Link2 size={16}/> Universal join link</h3>
    <p className="fine-print">One link for everyone. Anyone who opens it can create their own account and is added to this tournament as a player. Switch it off whenever you like.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    {link?.exists && <>
      <p className="notice" role="status"><b>{status}</b>{link.expiresAt ? ` · expires ${new Date(link.expiresAt).toLocaleDateString()}` : ' · no expiry'} · {link.uses} joined{link.maxUses ? ` of ${link.maxUses}` : ''}</p>
      <label className="field">Join link<input readOnly value={url} onFocus={event => event.target.select()}/></label>
      <div className="confirm-actions">
        <button type="button" className="btn secondary" onClick={() => void copy()} disabled={busy}><Copy size={15}/>{copied ? 'Copied' : 'Copy link'}</button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => void act(link.enabled ? 'disable' : 'enable')}>{link.enabled ? 'Switch off' : 'Switch on'}</button>
      </div></>}
    <div className="join-link-options">
      <label className="field">Expires after<select value={days} onChange={e => setDays(e.target.value)} disabled={busy}><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="never">Never</option></select></label>
      <label className="field">Max people <span className="muted">optional</span><input type="number" min={1} max={500} inputMode="numeric" value={max} onChange={e => setMax(e.target.value)} disabled={busy} placeholder="No limit"/></label>
    </div>
    <button type="button" className="btn primary" disabled={busy} onClick={() => void act('create')}>{link?.exists ? 'Make a new link (replaces the old one)' : 'Create join link'}</button>
  </div>;
}
