// EA FC tactic code codec (12-character share codes), implemented from the format notes for the "Fut26" encoder.
// Pure functions, no I/O. The 72-bit payload uses BigInt on purpose.
// Validation here covers structure only (ranges, checksum). Formation and role/focus ID tables are NOT included yet:
// they come from the supplied page configuration and are per-formation, per-position.

export const BUILD_UP = {balanced: 0, counter: 1, shortPassing: 2} as const;
export type Tactic = {formationId: number; buildUpId: number; lineHeight: number; roles: readonly number[]};

const ALPHABET = '&123456789?@' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.replace('I', '#').replace('O', '%') + 'abcdefghijklmnopqrstuvwxyz'.replace('l', '$');
const ROTATION = [7, 2, 31, 5, 29, 11, 23, 13, 17, 3, 19, 1] as const;
const CHECKSUM_BASE = 91;
const mod = (n: number, m: number) => ((n % m) + m) % m;

export class TacticCodeError extends Error {}
const bad = (m: string): never => { throw new TacticCodeError(m); };

export function checksum(t: Tactic): number {
  return mod(CHECKSUM_BASE + t.formationId + t.buildUpId + t.lineHeight + t.roles.reduce((a, b) => a + b, 0), 512);
}

function validate(t: Tactic) {
  if (!Number.isInteger(t.formationId) || t.formationId < 0 || t.formationId > 1023) bad('Formation ID must be 0-1023.');
  if (![0, 1, 2].includes(t.buildUpId)) bad('Build-up must be Balanced (0), Counter (1) or Short Passing (2).');
  if (!Number.isInteger(t.lineHeight) || t.lineHeight < 1 || t.lineHeight > 100) bad('Line height must be 1-100.');
  if (t.roles.length !== 11) bad('Exactly eleven role/focus IDs are needed.');
  if (t.roles.some(r => !Number.isInteger(r) || r < 0 || r > 15)) bad('Each role/focus ID must be 0-15.');
}

export function pack(t: Tactic): bigint {
  validate(t);
  let v = BigInt(checksum(t)) | (BigInt(t.formationId) << BigInt(9));
  t.roles.forEach((r, i) => { v |= BigInt(r) << BigInt(19 + (4 * (10 - i))); }); // shift 59 - 4*i overall
  v |= BigInt(t.lineHeight) << BigInt(63);
  v |= BigInt(t.buildUpId) << BigInt(70);
  return v;
}

export function encode(t: Tactic): string {
  const packed = pack(t);
  const c = Array.from({length: 12}, (_, i) => Number((packed >> BigInt(6 * i)) & BigInt(63)));
  const first = c[0];
  return c.map((x, i) => ALPHABET[mod((i >= 2 ? x + first : x) + ROTATION[i], 64)]).join('');
}

export function decode(code: string): Tactic {
  if (code.length !== 12) bad('A tactic code has exactly 12 characters.');
  const c = [...code].map((ch, i) => {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) bad(`Unknown character "${ch}" at position ${i + 1}.`);
    return mod(idx - ROTATION[i], 64);
  });
  const first = c[0];
  const raw = c.map((x, i) => (i >= 2 ? mod(x - first, 64) : x));
  const packed = raw.reduce((v, x, i) => v | (BigInt(x) << BigInt(6 * i)), BigInt(0));
  const field = (shift: number, bits: number) => Number((packed >> BigInt(shift)) & ((BigInt(1) << BigInt(bits)) - BigInt(1)));
  const t: Tactic = {
    formationId: field(9, 10),
    roles: Array.from({length: 11}, (_, i) => field(59 - 4 * i, 4)),
    lineHeight: field(63, 7),
    buildUpId: field(70, 2),
  };
  validate(t);
  if (field(0, 9) !== checksum(t)) bad('Checksum does not match. The code is damaged or not a valid tactic code.');
  return t;
}
