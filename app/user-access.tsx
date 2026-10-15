'use client';
import {useState, type FormEvent} from 'react';
import {Copy, Plus, ShieldCheck, Users} from 'lucide-react';
import {api, type AppState} from './ui';
import type {AccountAccessRow} from '@/lib/account-access';
import ViewerAccess from './viewer-access';

/** Two-step control: click, give a reason, confirm. Used for disabling an account and removing a member. */
function Confirmed({label, confirmLabel, prompt, busy, danger = true, onConfirm}: {label: string; confirmLabel: string; prompt: string; busy: boolean; danger?: boolean; onConfirm: (reason: string) => Promise<void>}) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState('');
  if (!open) return <button type="button" className="btn secondary small" disabled={busy} onClick={() => setOpen(true)}>{label}</button>;
  return <form className="confirm-box" onSubmit={event => {event.preventDefault(); void onConfirm(reason.trim()).then(() => {setOpen(false); setReason('');});}}>
    <label className="field">{prompt}<input value={reason} onChange={event => setReason(event.target.value)} required minLength={3} maxLength={300} autoComplete="off" disabled={busy}/></label>
    <div className="confirm-actions">
      <button className={danger ? 'btn danger' : 'btn primary'} disabled={busy || reason.trim().length < 3}>{confirmLabel}</button>
      <button type="button" className="btn secondary" disabled={busy} onClick={() => {setOpen(false); setReason('');}}>Cancel</button>
    </div>
  </form>;
}

type AccessResponse = {token: string | null; existingAccount: boolean; username: string};

function UsernameAssignment({entry, busy, onAssign, onDisable, onEnable, onDecide}: {entry: AccountAccessRow; busy: boolean; onAssign: (entry: AccountAccessRow, username: string) => Promise<void>; onDisable: (entry: AccountAccessRow, reason: string) => Promise<void>; onEnable: (entry: AccountAccessRow) => Promise<void>; onDecide: (entry: AccountAccessRow, decision: 'approve' | 'reject') => Promise<void>}) {
  const [username, setUsername] = useState('');
  return <div className="username-account">
    <div><b>{entry.name}{entry.owner ? ' · Owner' : ''}</b><small>{entry.email || 'No email provided'}</small><small>{entry.disabled ? 'Disabled' : entry.status === 'active' ? 'Active account' : 'Pending activation'}{entry.participation === 'no' ? ' · Viewer by choice' : ''}</small>{entry.disabled && entry.disabledReason && <small>Reason: {entry.disabledReason}</small>}</div>
    {entry.username ? <div className="username-assigned"><b>@{entry.username}</b><small>Username reserved</small></div> : <form onSubmit={event => {event.preventDefault(); void onAssign(entry, username);}}>
      <label className="field">Username for {entry.name}<input value={username} onChange={event => setUsername(event.target.value)} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy}/></label>
      <button className="btn secondary" disabled={busy || username.trim().length < 3}>Assign username</button>
    </form>}
    {entry.accountId && entry.participation === 'pending' && !entry.disabled && <div className="confirm-box"><small>{entry.name} asked to take part in the tournament.</small><div className="confirm-actions"><button type="button" className="btn primary small" disabled={busy} onClick={() => void onDecide(entry, 'approve')}>Approve</button><button type="button" className="btn secondary small" disabled={busy} onClick={() => void onDecide(entry, 'reject')}>Keep as viewer</button></div></div>}
    {entry.accountId && !entry.owner && (entry.disabled
      ? <button type="button" className="btn secondary small" disabled={busy} onClick={() => void onEnable(entry)}>Re-enable account</button>
      : <Confirmed label="Disable account" confirmLabel="Disable this account" prompt={`Reason for disabling ${entry.name} (kept in the audit log)`} busy={busy} onConfirm={reason => onDisable(entry, reason)}/>)}
  </div>;
}

export default function UserAccess({state, onRefresh}: {state: AppState | null; onRefresh: () => Promise<unknown>}) {
  const [profile, setProfile] = useState('new'), [name, setName] = useState(''), [username, setUsername] = useState(''), [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [activation, setActivation] = useState(''), [activationUsername, setActivationUsername] = useState(''), [copied, setCopied] = useState(false);
  const owner = !!state?.user.isOwner, admin = owner && state?.member?.role === 'admin', creating = profile === 'new';
  const pendingMigration = !creating && state?.members?.some(member => member.player_id === profile && !member.username);
  function clearFeedback() {setMessage(''); setError(''); setActivation(''); setActivationUsername(''); setCopied(false);}
  function showAccess(access: AccessResponse) {
    if (access.token) {
      setActivation(window.location.origin + '/activate#token=' + access.token);
      setActivationUsername(access.username);
    }
    setMessage(access.existingAccount
      ? `Access is ready for @${access.username}. Use that username with the existing password. Active sessions are preserved.`
      : `@${access.username} is reserved. Share the private link and username so this player can choose a password. Any previous activation link for this username is replaced.`);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!admin || !state?.tournament || busy) return;
    setBusy(true); clearFeedback();
    try {
      const endpoint = `tournament/${state.tournament.id}/${creating ? 'users' : 'invite'}`;
      const access = await api<AccessResponse>(endpoint, creating ? {name, username, email} : {username, email, playerId: profile});
      showAccess(access); setName(''); setUsername(''); setEmail(''); setProfile('new');
      await onRefresh();
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function assign(entry: AccountAccessRow, value: string) {
    if (!owner || busy) return;
    setBusy(true); clearFeedback();
    try {
      const target = entry.accountId ? {accountId: entry.accountId} : {memberId: entry.memberId};
      const access = await api<AccessResponse>('accounts/username', {...target, username: value});
      showAccess(access); setProfile('new'); setUsername(''); setEmail('');
      await onRefresh();
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function run(work: () => Promise<string>) {
    if (!owner || busy) return;
    setBusy(true); clearFeedback();
    try {setMessage(await work()); await onRefresh();} catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  const disable = (entry: AccountAccessRow, reason: string) => run(async () => {
    const r = await api<{sessionsEnded: number; friendliesClosed: number; proposalsWithdrawn: number; discordUnlinked: boolean}>('accounts/disable', {accountId: entry.accountId, reason, confirm: true});
    return `${entry.name} is disabled and signed out. Closed ${r.friendliesClosed} friendl${r.friendliesClosed === 1 ? 'y' : 'ies'} and withdrew ${r.proposalsWithdrawn} kickoff proposal${r.proposalsWithdrawn === 1 ? '' : 's'}${r.discordUnlinked ? '; Discord was unlinked' : ''}. Results, Elo and history are untouched.`;
  });
  const enable = (entry: AccountAccessRow) => run(async () => {
    await api('accounts/enable', {accountId: entry.accountId});
    return `${entry.name} can sign in again with the same password. Their profile picture and Discord link were removed and must be set up again.`;
  });
  const decide = (entry: AccountAccessRow, decision: 'approve' | 'reject') => run(async () => {
    await api('accounts/participation', {accountId: entry.accountId, decision});
    return decision === 'approve' ? `${entry.name} can now take part. Give them player access below if they do not have it yet.` : `${entry.name} stays a viewer.`;
  });
  const removeMember = (id: string, name: string, reason: string) => run(async () => {
    const r = await api<{openMatches: number}>(`tournament/${state?.tournament?.id}/members/remove`, {memberId: id, reason, confirm: true});
    return `${name} was removed from this tournament. ${r.openMatches ? `${r.openMatches} unfinished match${r.openMatches === 1 ? ' is' : 'es are'} left without a signed-in participant; you can still schedule and report ${r.openMatches === 1 ? 'it' : 'them'}.` : 'Their results and history stay.'}`;
  });
  function chooseProfile(value: string) {
    setProfile(value); clearFeedback();
    const entry = state?.accountAccess?.find(account => account.playerId === value);
    const member = state?.members?.find(account => account.player_id === value);
    setUsername(entry?.username ?? member?.username ?? '');
    setEmail(entry?.email ?? member?.email ?? '');
  }
  async function copy() {
    try {await navigator.clipboard.writeText(activation); setCopied(true);}
    catch {setError('Select the private link and copy it manually.');}
  }
  return <section className="panel settings-card user-access-panel">
    <span className="setting-icon"><Users size={23}/></span><h2>Users & access</h2>
    {owner ? <>
      <p>Your account is the only admin. Reserve usernames and share activation links privately. Email is optional for new users.</p>
      <div className="notice"><ShieldCheck size={17}/><span>Usernames use 3–24 letters, numbers or underscores. They are case-insensitive and fixed once assigned.</span></div>
      {admin && state?.tournament ? <form onSubmit={event => void save(event)}>
        <label className="field">Player profile<select value={profile} disabled={busy} onChange={event => chooseProfile(event.target.value)}><option value="new">Create a new player</option><optgroup label="Existing players">{(state.players ?? []).map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</optgroup></select></label>
        {creating && <label className="field">Display name<input value={name} onChange={event => setName(event.target.value)} maxLength={80} required disabled={busy} autoComplete="off"/></label>}
        <label className="field">Username<input value={username} onChange={event => setUsername(event.target.value)} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" required disabled={busy} autoComplete="off" autoCapitalize="none" spellCheck={false}/></label>
        <label className="field">Email <span className="muted">optional</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} disabled={busy} autoComplete="off"/></label>
        {pendingMigration && <p className="notice">This player already has an email-based account or invitation. Assign its username in the account list below first.</p>}
        <button className="btn primary" disabled={busy || pendingMigration || username.trim().length < 3 || (creating && !name.trim())}><Plus size={16}/>{busy ? 'Saving…' : creating ? 'Reserve player account' : 'Grant access / refresh link'}</button>
      </form> : <p className="notice">Create or select a tournament to invite players. You can assign usernames to existing accounts below.</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {activation && <div className="activation-access"><label className="field">Private activation link for @{activationUsername} · valid for 72 hours<input readOnly value={activation} onFocus={event => event.target.select()}/></label><button className="btn secondary" onClick={() => void copy()}><Copy size={15}/>{copied ? 'Copied' : 'Copy private link'}</button><p className="fine-print">Share the link and username directly with this player. The app does not send email.</p></div>}
      <h3 className="form-section-title">Accounts & usernames</h3>
      <p className="fine-print">Assign your own username here too. Existing accounts keep their passwords and history. Email sign-in ends for an account when you assign its username. Assigning a pending invitation replaces its old link.</p>
      <div className="username-accounts">{(state?.accountAccess ?? []).map(entry => <UsernameAssignment key={entry.key} entry={entry} busy={busy} onAssign={assign} onDisable={disable} onEnable={enable} onDecide={decide}/>)}</div>
      {!!state?.members?.length && <><h3 className="form-section-title">Selected tournament users</h3><div className="member-list">{state.members.map(member => <div key={member.id}><span className="avatar small">{member.name[0]}</span><span><b>{member.name}</b><small>{member.username ? '@' + member.username : 'Username not assigned'}</small><small>{member.role === 'admin' ? 'Admin · you' : member.role === 'viewer' ? 'Viewer' : 'Player'}</small></span><span className="pot-tag">{member.user_id ? 'Active' : 'Pending'}</span>{member.role !== 'admin' && member.user_id !== state.user.userId && <Confirmed label="Remove" confirmLabel="Remove from tournament" prompt={`Reason for removing ${member.name} from this tournament`} busy={busy} onConfirm={reason => removeMember(member.id, member.name, reason)}/>}</div>)}</div></>}
      {admin && state?.tournament && <ViewerAccess key={state.tournament.id} tournamentId={state.tournament.id} onRefresh={onRefresh}/>}
      <p className="fine-print">No public sign-up. Invited members complete their profile before accessing tournaments. Your owner account retains administration access.</p>
    </> : <p className="notice">Only the site owner can manage account access.</p>}
  </section>;
}
