'use client';
import {useState, type FormEvent} from 'react';
import {Copy, Plus, ShieldCheck, Users} from 'lucide-react';
import {api, type AppState} from './ui';
import type {AccountAccessRow} from '@/lib/account-access';

type AccessResponse = {token: string | null; existingAccount: boolean; username: string};

function UsernameAssignment({entry, busy, onAssign}: {entry: AccountAccessRow; busy: boolean; onAssign: (entry: AccountAccessRow, username: string) => Promise<void>}) {
  const [username, setUsername] = useState('');
  return <div className="username-account">
    <div><b>{entry.name}{entry.owner ? ' · Owner' : ''}</b><small>{entry.email || 'No email provided'}</small><small>{entry.status === 'active' ? 'Active account' : 'Pending activation'}</small></div>
    {entry.username ? <div className="username-assigned"><b>@{entry.username}</b><small>Username reserved</small></div> : <form onSubmit={event => {event.preventDefault(); void onAssign(entry, username);}}>
      <label className="field">Username for {entry.name}<input value={username} onChange={event => setUsername(event.target.value)} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy}/></label>
      <button className="btn secondary" disabled={busy || username.trim().length < 3}>Assign username</button>
    </form>}
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
      <div className="username-accounts">{(state?.accountAccess ?? []).map(entry => <UsernameAssignment key={entry.key} entry={entry} busy={busy} onAssign={assign}/>)}</div>
      {!!state?.members?.length && <><h3 className="form-section-title">Selected tournament users</h3><div className="member-list">{state.members.map(member => <div key={member.id}><span className="avatar small">{member.name[0]}</span><span><b>{member.name}</b><small>{member.username ? '@' + member.username : 'Username not assigned'}</small><small>{member.role === 'admin' ? 'Admin · you' : 'Player'}</small></span><span className="pot-tag">{member.user_id ? 'Active' : 'Pending'}</span></div>)}</div></>}
      <p className="fine-print">No public sign-up. Viewer permissions and required profile setup are part of a later milestone.</p>
    </> : <p className="notice">Only the site owner can manage account access.</p>}
  </section>;
}
