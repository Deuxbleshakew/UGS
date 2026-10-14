# UGS identity and competition foundation

Status: identity decisions updated 14 October 2026. Milestone 1 implements the selected identity; Max separately authorized its deployment. Competition-format proposals below remain unapproved and do not change tournament rules.

## Confirmed identity

**UGS — Union Gaming Society** is the organizing body. **Union Gaming** is the short public name. It is not the name of one league or one participating team. Its identity should work across competitions, community events, the app and the Unity ceremony.

The community has Costa Rican roots: most members are from Costa Rica, some live in the United States, and international friends are part of the group. The identity should express those roots while welcoming the whole community. Proposed positioning: **Costa Rican roots. Friends worldwide. United by gaming.**

## Selected primary logo direction

On 13 October 2026, Max selected the **original angular UGS initials**: blue letterforms, red lower strokes and a white outline. Source asset: `concepts/ugs-initials-v1.png`. This is the primary logo direction for Union Gaming Society. Preserve this design when developing the brand, rather than replacing it with the Interlock, Rounded or Badge alternatives.

The selection establishes the visual direction. The saved asset is a transparent PNG concept; production vector artwork, small-size adaptations and monochrome versions remain to be prepared. The refreshed circular crest remains a separate heritage concept. No live application deployment is included in this selection.

## Crest refresh

Max supplied the existing organization crest and approved keeping the Costa Rican flag, purple orchid, sun and **EL QUE MUERE PIERDE** motto. The upper lettering changes to **UNION GAMING SOCIETY**, and a UGS gaming mark replaces the central symbol. The side numerals 20 / 19 are retained from the reference; this guide does not separately establish a founding date.

- Original reference, preserved unchanged: `references/ugs-original.png`.
- First refreshed crest draft: `concepts/ugs-crest-refresh-v1.png`.
- Generation method and exact prompt: `concepts/ugs-crest-refresh-v1-prompt.md`.
- Selected standalone three-initial logo: `concepts/ugs-initials-v1.png`, using blue UGS letters, red lower strokes and a white outline on transparency. Generation prompts: `concepts/ugs-initials-v1-prompt.md`.
- Unselected initials explorations, retained for reference: `concepts/ugs-initials-interlock-v1.png`, `concepts/ugs-initials-rounded-v1.png`, and `concepts/ugs-initials-badge-v1.png`. Exact prompts: `concepts/ugs-initials-options-prompts.md`.

The first draft uses a white UGS/controller monogram inside the sun. It is a raster design proposal on a white background, not an editable vector master or a finished small-size logo set. The crest supplies the identity; the layouts below explore how its colors and typography work across the organization, competition and team presentation.

Brand hierarchy:

1. **UGS:** organizer, regulations, account system, community and umbrella endorsement.
2. **Competition:** **Club Champions**, endorsed “A UGS competition.” The name is confirmed; its visual identity, trophy and season treatment are still being developed.
3. **Club/team:** independent name, crest, colors and personality. Max confirmed RB Tiquicia is their Clubs team. It does not become the UGS crest or the competition's name.
4. **Season/event:** edition, matchday, draw, final and awards; these use the competition's identity.

Max's implementation brief confirms the site hierarchy: **UGS** is the main organization website; **Matchroom** is a section inside it; **Club Champions** is the competition inside Matchroom. Players and History also belong inside Matchroom. RB Tiquicia is a separate top-level Pro Clubs landing page, with no automatic connection to competition Elo or qualification. Existing tournament records retain their names and IDs.

## Milestone 1 application assets

- `public/brand/ugs-initials.png`: unchanged copy of the approved angular initials; no replacement logo generated.
- `public/brand/rb-tiquicia.png`: unchanged copy of Max's supplied RB Tiquicia crest screenshot. Its source white background is retained.
- `app/ugs.css`: blue `#00358C` sampled at pixel (850, 335) and red `#E71025` sampled at (430, 675) of the 1774 × 887 initials PNG. Deep navy, neutral surfaces and lighter supporting shades are application tones; they are not claimed to be separately approved artwork colors.
- The heritage crest and unselected circular/interlock alternatives remain separate and are not used as the primary application logo.
- Application pages reuse the raster artwork. Vector masters and small-size favicon adaptations remain future work.
- See `docs/MILESTONE-1-UGS-SHELL.md` for local implementation scope, changed files and Max's manual acceptance scenarios.

## Competition format proposal

Use the modern league-phase structure as a sporting reference. Do not reproduce UEFA naming, the starball, anthem, star architecture or branded graphics.

| Stage | Proposed rule |
| --- | --- |
| Entrants | 36 clubs, currently managed by 12 people with 3 clubs each |
| Seeding | 4 pots of 9, using a published ranking chosen before the draw |
| Manager assignment | 3 clubs from 3 distinct pots; each pot is skipped by 3 managers |
| League phase | One table; 8 different opponents per club; 4 home and 4 away |
| Pot balance | 2 opponents from every pot, 1 home and 1 away |
| Manager restriction | Clubs belonging to the same manager cannot meet in the league phase |
| League workload | 144 fixtures in total; 24 club appearances per manager |
| Points | Win 3, draw 1, loss 0 |
| Positions 1–8 | Direct entry to the round of 16 |
| Positions 9–24 | Play-offs for the remaining 8 round-of-16 places |
| Positions 25–36 | Eliminated |
| Knockouts | Proposed home/away ties through the semi-finals, then one final; not implemented yet |

UEFA reference: https://www.uefa.com/uefachampionsleague/news/0268-12157d69ce2d-9f011c70f6fa-1000--new-format-for-champions-league-post-2024-everything-you-need-t/

**Current configuration differs:** `data/draw-config.json` has 36 clubs, 12 managers and **3 pots**. With one home and one away opponent per pot, it produces **6 matches per club and 108 fixtures**. It has not been silently changed to the proposed four-pot structure. Reassigning pots requires a deliberate seeding decision and matching Unity configuration.

The existing app imports league-phase draws and handles reports, verification, statistics and awards. It does not yet implement the complete play-off / round-of-16 / quarter-final / semi-final bracket. The proposed knockout rules and any qualification interface must be built before claiming that format is supported end to end.

Decisions before adopting the rules:

- Confirm which UGS competition uses the existing 36-club / 12-manager format, and define the separate participant model for any Clubs competition.
- Choose the pot ranking method for Club Champions.
- Resolve same-manager conflicts in knockouts. A league-phase restriction alone cannot guarantee an entire knockout bracket without such meetings; publish a solution before the tournament.
- Approve qualification tie-breaks, aggregate ties, extra time/penalties, disconnects, no-shows and reporting deadlines. The current alphabetical display fallback must not decide qualification.
- Confirm country restrictions. They are currently off; nationality should not be inferred from a custom team badge.

## Identity directions

### Union — heritage-led direction

- Charcoal and white as the base, with flag red and blue, orchid purple and sun gold from the supplied crest.
- The refreshed organization crest for large displays; a clear UGS wordmark for compact interface labels. The earlier open-U graphic is superseded by the crest refresh.
- Large, direct typography with quiet spaces for team crests.
- Motion: flag-inspired bands align, settle, then reveal the draw or result. Short, restrained broadcast transitions.
- UGS appears as a consistent endorsement; competition titles and team colors remain distinct.

### Circuit — alternative

- Deep blue and white, with orchid purple and gold highlights from the same crest palette.
- Compact technical wordmark, framed letterforms and horizontal information rails.
- Denser broadcast composition suitable for fixtures, draw boards and match coverage.
- Motion: panels move into alignment; a single highlight follows the active team.

Both are exploratory layout directions, not a live rebrand. Palette values are selected digital design tones, not claimed exact measurements of the source artwork. The organization full name and public short name are confirmed; the first refreshed artwork remains a design draft.

## Team identity system

Use a common asset specification, not a mandatory shared crest shape. Each team keeps its own character.

Required team assets:

- Full crest: original vector when available, transparent PNG fallback.
- Simplified crest for small screens and score graphics.
- Micro mark / short initials for 24–32 px contexts.
- Official name and a unique short code selected by the team.
- Primary, secondary and contrast-safe display colors.
- Light-background, dark-background and single-color versions.
- Optional home/away kit patterns and banner artwork.

The RB Tiquicia reference remains unchanged in this exploration. Its lettering and small details should be simplified in a separate approved small-size version; the full badge stays available for team pages and banners. No team assignment, founding year or short code has been inferred from the supplied image.

Keep the UGS mark outside the team crest. Use consistent crest containers, clear space, alignment and name treatment on cards, tables and broadcasts. Team colors must not override red/green status or accessibility indicators.

## Deliverables after a direction is chosen

1. UGS primary wordmark, compact mark, monochrome forms and spacing rules.
2. Club Champions lockup, trophy direction, season treatment and broadcast package.
3. Team asset template and first approved RB Tiquicia adaptations.
4. App tokens, navigation, login, fixtures, standings, reports and award treatments.
5. Unity stage, pot labels, paper slips, team reveals and camera overlays using the same assets.
6. SVG/PNG exports and a concise brand guide; preserve editable masters.
