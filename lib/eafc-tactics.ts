// Configuration-aware EA FC tactic logic: builds on the raw codec (eafc-tactic-code.ts) and the generated configuration
// (eafc-tactic-config.ts). Everything that is part of an EA code lives here; app-only fields (player names, tactic name)
// are deliberately NOT represented in it. Safe for browser and server.
import {decode,encode,TacticCodeError} from './eafc-tactic-code';
import {BUILD_UP_NAMES,FORMATIONS,OPTIONS,ROLE_NAMES,type FormationDef,type Option} from './eafc-tactic-config';

export {BUILD_UP_NAMES,FORMATIONS,TacticCodeError};
export type BuildUp = typeof BUILD_UP_NAMES[number];
export type EaTactic = {formationKey: string; buildUp: BuildUp; lineHeight: number; roleIds: number[]}; // roleIds are in eaIndex order
const bad = (m: string): never => { throw new TacticCodeError(m); };

export const formationByKey = (key: string): FormationDef | undefined => FORMATIONS.find(f => f.key === key);
export const formationByEaId = (id: number): FormationDef | undefined => FORMATIONS.find(f => f.eaId === id);
export const optionsFor = (pos: string): readonly Option[] => OPTIONS[pos] ?? [];
export const optionLabel = (o: Option) => `${ROLE_NAMES[o.role] ?? o.role} (${o.focus})`;
export const roleName = (o: Option) => ROLE_NAMES[o.role] ?? o.role;
// "433-2" -> "4-3-3 (2)": display only, derived from the key by us.
export function formationLabel(key: string): string {
  const [shape, variant] = key.split('-');
  const label = shape.length === 3 || shape.length >= 4 ? shape.split('').join('-') : shape;
  return variant ? `${label} (${variant})` : label;
}

// A starting point, not an optimized tactic: one valid configured option per position type (EA role/focus ID).
const START: Record<string, number> = {GK: 1, LB: 1, RB: 1, CB: 1, CDM: 1, CM: 0, LM: 0, RM: 0, CAM: 1, LW: 3, RW: 3, ST: 1};
export function defaultRoles(key: string): number[] {
  const f = formationByKey(key) ?? bad(`Unknown formation "${key}".`);
  return f.positions.map(p => { const id = START[p.pos]; const o = optionsFor(p.pos).find(x => x.id === id); return o ? o.id : bad(`No configured options for ${p.pos}.`); });
}
export const defaultTactic = (key = '352'): EaTactic => ({formationKey: key, buildUp: 'Balanced', lineHeight: 50, roleIds: defaultRoles(key)});

// Switching formation: a position keeps its choice only when an unused slot of the same position type in the old formation had
// a role + focus the new slot also offers (matched in eaIndex order, e.g. first CB to first CB). Everything else resets to the
// starting point and is reported so the user can see what changed.
export function remapRoles(oldKey: string, oldIds: readonly number[], newKey: string): {roleIds: number[]; reset: string[]} {
  const from = formationByKey(oldKey), to = formationByKey(newKey) ?? bad(`Unknown formation "${newKey}".`);
  const defaults = defaultRoles(newKey), reset: string[] = [];
  const pool = new Map<string, Option[]>();
  from?.positions.forEach((p, i) => { const o = optionsFor(p.pos).find(x => x.id === oldIds[i]); if (o) pool.set(p.pos, [...(pool.get(p.pos) ?? []), o]); });
  const roleIds = to.positions.map((p, i) => {
    const prev = pool.get(p.pos)?.shift();
    const same = prev && optionsFor(p.pos).find(o => o.role === prev.role && o.focus === prev.focus);
    if (same) return same.id;
    reset.push(p.pos);
    return defaults[i];
  });
  return {roleIds, reset};
}

export function validateTactic(t: EaTactic): FormationDef {
  const f = formationByKey(t.formationKey) ?? bad(`Unsupported formation "${t.formationKey}".`);
  if (!(BUILD_UP_NAMES as readonly string[]).includes(t.buildUp)) bad('Build-up must be Balanced, Counter or Short Passing.');
  if (!Number.isInteger(t.lineHeight) || t.lineHeight < 1 || t.lineHeight > 100) bad('Line height must be a whole number from 1 to 100.');
  if (t.roleIds.length !== 11) bad('A tactic needs exactly eleven role/focus choices.');
  f.positions.forEach((p, i) => { if (!optionsFor(p.pos).some(o => o.id === t.roleIds[i])) bad(`Role/focus ID ${t.roleIds[i]} is not valid for ${p.pos} in ${formationLabel(f.key)}.`); });
  return f;
}
export function encodeTactic(t: EaTactic): string {
  const f = validateTactic(t);
  return encode({formationId: f.eaId, buildUpId: BUILD_UP_NAMES.indexOf(t.buildUp), lineHeight: t.lineHeight, roles: t.roleIds});
}
export function decodeTactic(code: string): EaTactic {
  const raw = decode(code.trim());
  const f = formationByEaId(raw.formationId) ?? bad(`Formation ID ${raw.formationId} is not in the supported list.`);
  const buildUp = BUILD_UP_NAMES[raw.buildUpId] ?? bad(`Build-up ID ${raw.buildUpId} is not supported.`);
  const t: EaTactic = {formationKey: f.key, buildUp, lineHeight: raw.lineHeight, roleIds: [...raw.roles]};
  validateTactic(t);
  return t;
}

// Pitch layout for the builder only (not part of any code). Rows come from the position type; left-to-right order within a row
// follows the configuration's card number, which reads left to right.
const BAND: Record<string, number> = {ST: 11, LW: 21, RW: 21, CAM: 33, LM: 48, RM: 48, CM: 48, CDM: 62, LB: 76, RB: 76, CB: 76, GK: 91};
export function layoutFor(key: string): {pos: string; x: number; y: number}[] {
  const f = formationByKey(key) ?? bad(`Unknown formation "${key}".`);
  const group = new Map<number, number[]>();
  f.positions.forEach((p, i) => group.set(BAND[p.pos], [...(group.get(BAND[p.pos]) ?? []), i]));
  const out = new Array<{pos: string; x: number; y: number}>(11);
  for (const [y, idx] of group) {
    const sorted = [...idx].sort((a, b) => f.positions[a].card - f.positions[b].card), n = sorted.length;
    const wide = sorted.every(i => /^[LR]/.test(f.positions[i].pos) && f.positions[i].pos !== 'CB');
    sorted.forEach((i, k) => { out[i] = {pos: f.positions[i].pos, y, x: n === 1 ? 50 : n === 2 ? (wide ? [14, 86][k] : [36, 64][k]) : 12 + (76 * k) / (n - 1)}; });
  }
  return out;
}
