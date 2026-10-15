// UGS squad share code. App-only: it carries the tactic name and player names, which are NOT part of an EA code.
// The EA-facing fields (formation, build-up, line height, role/focus IDs) come from lib/eafc-tactics.ts.
import {BUILD_UP_NAMES} from './eafc-tactics';
export type Slot = {ea: number; player: string}; // ea = EA role/focus ID for that position (slots are in eaIndex order)
export type SquadInput = {name: string; formationKey: string; buildUp: string; lineHeight: number; slots: Slot[]};
export const BUILD_UPS = BUILD_UP_NAMES;

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
export function toShareCode(s: SquadInput): string {
  return 'UGS2.' + b64(JSON.stringify([s.name, s.formationKey, s.buildUp, s.lineHeight, s.slots.map(x => [x.ea, x.player])]));
}
// Parsing only; the caller validates the contents against the configuration.
export function fromShareCode(code: string): SquadInput {
  const c = code.trim();
  if (c.startsWith('UGS1.')) throw new Error('That code comes from an older version of the builder and cannot be imported.');
  if (!c.startsWith('UGS2.') || c.length > 4000) throw new Error('That is not a UGS squad code.');
  try {
    const [name, formationKey, buildUp, lineHeight, slots] = JSON.parse(unb64(c.slice(5)));
    if (!Array.isArray(slots)) throw new Error('x');
    return {name: String(name), formationKey: String(formationKey), buildUp: String(buildUp), lineHeight: Number(lineHeight), slots: (slots as unknown[][]).map(([ea, player]) => ({ea: Number(ea), player: String(player ?? '')}))};
  } catch { throw new Error('That squad code is damaged.'); }
}
