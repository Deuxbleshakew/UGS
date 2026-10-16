// Owner-supplied badges for already-qualified clubs only. Missing clubs use the crest fallback.
const badges: Record<string, string> = {
  'real madrid': 'ttpBQ21',
  'manchester city': 'gufJH55',
  'borussia dortmund': 'W4Z3jk1',
  'bayern munich': '8rr5NKO',
  'inter milan': 'YvnAd7A',
  'barcelona': 'nomRizU',
  'villarreal': 'hFYQVbx',
  'arsenal': 'bHlldxU',
  'liverpool': 'AKzX2YQ',
  'paris saint germain': 'UYTttTL',
  'atletico madrid': 'Y57QdV6',
  'roma': 'qjFredP',
  'napoli': 'gzTFvrO',
  'real betis': 'UVnzqnn',
};
const aliases: Record<string, string> = {
  'bayern munchen': 'bayern munich', 'fc bayern munchen': 'bayern munich',
  'fc bayern munich': 'bayern munich', 'paris sg': 'paris saint germain',
  'psg': 'paris saint germain', 'fc barcelona': 'barcelona',
  'internazionale': 'inter milan', 'fc internazionale milano': 'inter milan',
  'inter': 'inter milan', 'as roma': 'roma', 'ssc napoli': 'napoli',
  'atletico de madrid': 'atletico madrid', 'villarreal cf': 'villarreal',
};
export function clubBadge(name: string | undefined): string | null {
  const key = (name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const canonical = Object.hasOwn(aliases, key) ? aliases[key] : key;
  return Object.hasOwn(badges, canonical) ? `https://i.imgur.com/${badges[canonical]}.png` : null;
}
