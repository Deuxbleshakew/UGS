# Squad builder (milestone 4G, migration 0017)

Locked until the draw: the server refuses writes (and returns no squads) until at least one club in the tournament config has a manager. Only managers and the organizer can build; everyone in the tournament can browse others' tactics.

- Each account keeps up to 5 tactics per tournament (slot 0 = starting tactic, 1-4 = squad tactics). Optimistic `version` on update; owners edit/delete their own, the organizer can delete any.
- Formations (29), position order and role/focus options come from the generated configuration `lib/eafc-tactic-config.ts`; logic in `lib/eafc-tactics.ts`. The server validates every save against it and generates the EA code itself (a client-sent code is ignored).
- UGS share code (`UGS2.` + base64url JSON, includes names) works between UGS users only. Old `UGS1.` codes are refused.
- EA codes are generated from the builder selections and checked against the configuration extracted from FUTBIN's page (lib/eafc-tactic-config.ts, generated; do not edit by hand). Importing an EA code fills formation, build-up, line height and all eleven roles. Player names and the tactic name are app-only and never part of an EA code.

Files: `drizzle/0017_squads.sql`, `lib/squads.ts`, `lib/squad-data.ts`, `lib/eafc-tactic-code.ts` (raw codec), `lib/eafc-tactic-config.ts` (generated), `lib/eafc-tactics.ts`, `tests/eafc-tactics.test.ts`, `app/squad-builder.tsx`, routes `GET/POST /api/tournament/:tid/squads[/delete]`, view `squad`.
Production needs migrations 0010 to 0017; back up first.

## Status
- Codec verified against recorded examples: yes (`bJ1HxNuTxs57`, `$J@R7X4d72TG`, `jQ?h5nzptf@j`; tests in `tests/eafc-tactics.test.ts`).
- Accepted by FUTBIN: the height-60 code only.
- Accepted by the actual game: NOT verified. `jQ?h5nzptf@j` and any generated code still need a live import test.
- Production deployed: no. Needs migrations 0010 to 0017.
- Limits: formation labels such as "4-3-3 (2)" are our own display names derived from FUTBIN's keys, not confirmed game names. Rows saved by the first version of the builder (older slot format) are hidden and replaced when that slot is saved again.
