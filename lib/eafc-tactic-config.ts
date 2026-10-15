// EA FC tactic configuration for the "Fut26" encoder: formation IDs, formation-specific position order (eaIndex),
// and position-specific role/focus IDs. GENERATED from the configuration embedded in FUTBIN's tactics page
// (TacticEaCodeEncoderFut26). Do not edit by hand and do not infer IDs from names: re-extract from the source if it changes.
// Role display names come from the same page. Formation display labels (e.g. "4-3-3 (2)") are derived from the key by us
// and are app-only; the game-facing value is always the EA ID.
// Status: codec checked against recorded codes. Not yet confirmed to import in the game itself.
export type Option = {id: number; role: string; focus: string};
export type FormationDef = {key: string; eaId: number; positions: readonly {pos: string; card: number}[]}; // positions are in eaIndex order

export const ROLE_NAMES: Record<string, string> = {
 "AF": "Advanced Forward",
 "W": "Winger",
 "BTB": "Box-to-Box",
 "H": "Holding",
 "D": "Defender",
 "GK": "Goalkeeper",
 "SK": "Sweeper Keeper",
 "BPK": "Ball-Playing Keeper",
 "FB": "Fullback",
 "WB": "Wingback",
 "FAB": "Falseback",
 "AWB": "Attacking Wingback",
 "IWB": "Inverted Wingback",
 "S": "Stopper",
 "BPD": "Ball-Playing Defender",
 "WDB": "Wide Back",
 "DLP": "Deep-Lying Playmaker",
 "PL": "Playmaker",
 "HW": "Half Winger",
 "CH": "Centre Half",
 "WH": "Wide Half",
 "BC": "Box Crasher",
 "SS": "Shadow Striker",
 "C10": "Classic 10",
 "WP": "Wide Playmaker",
 "WM": "Wide Midfielder",
 "IF": "Inside Forward",
 "TF": "Target Forward",
 "F9": "False 9",
 "PO": "Poacher"
};

export const OPTIONS: Record<string, readonly Option[]> = {
 "GK": [{"id":0,"role":"GK","focus":"Defend"},{"id":1,"role":"GK","focus":"Balanced"},{"id":2,"role":"SK","focus":"Balanced"},{"id":3,"role":"SK","focus":"Build-Up"},{"id":4,"role":"BPK","focus":"Build-Up"}],
 "LB": [{"id":0,"role":"FB","focus":"Defend"},{"id":1,"role":"FB","focus":"Balanced"},{"id":2,"role":"WB","focus":"Balanced"},{"id":3,"role":"WB","focus":"Support"},{"id":4,"role":"FAB","focus":"Defend"},{"id":5,"role":"FAB","focus":"Balanced"},{"id":6,"role":"AWB","focus":"Support"},{"id":7,"role":"AWB","focus":"Attack"},{"id":8,"role":"FB","focus":"Versatile"},{"id":9,"role":"IWB","focus":"Build-Up"},{"id":10,"role":"IWB","focus":"Attack"}],
 "RB": [{"id":0,"role":"FB","focus":"Defend"},{"id":1,"role":"FB","focus":"Balanced"},{"id":2,"role":"WB","focus":"Balanced"},{"id":3,"role":"WB","focus":"Support"},{"id":4,"role":"FAB","focus":"Defend"},{"id":5,"role":"FAB","focus":"Balanced"},{"id":6,"role":"AWB","focus":"Support"},{"id":7,"role":"AWB","focus":"Attack"},{"id":8,"role":"FB","focus":"Versatile"},{"id":9,"role":"IWB","focus":"Build-Up"},{"id":10,"role":"IWB","focus":"Attack"}],
 "CB": [{"id":0,"role":"D","focus":"Defend"},{"id":1,"role":"D","focus":"Balanced"},{"id":2,"role":"S","focus":"Balanced"},{"id":3,"role":"S","focus":"Aggressive"},{"id":4,"role":"BPD","focus":"Defend"},{"id":5,"role":"BPD","focus":"Build-Up"},{"id":6,"role":"BPD","focus":"Aggressive"},{"id":7,"role":"WDB","focus":"Defend"},{"id":8,"role":"WDB","focus":"Aggressive"},{"id":9,"role":"WDB","focus":"Support"}],
 "CDM": [{"id":0,"role":"CH","focus":"Defend"},{"id":1,"role":"H","focus":"Defend"},{"id":2,"role":"H","focus":"Ball-Winning"},{"id":3,"role":"H","focus":"Roaming"},{"id":4,"role":"DLP","focus":"Build-Up"},{"id":5,"role":"DLP","focus":"Defend"},{"id":6,"role":"DLP","focus":"Roaming"},{"id":7,"role":"WH","focus":"Defend"},{"id":8,"role":"WH","focus":"Build-Up"},{"id":9,"role":"BC","focus":"Balanced"}],
 "CM": [{"id":0,"role":"BTB","focus":"Balanced"},{"id":1,"role":"H","focus":"Defend"},{"id":2,"role":"H","focus":"Ball-Winning"},{"id":3,"role":"DLP","focus":"Build-Up"},{"id":4,"role":"DLP","focus":"Defend"},{"id":5,"role":"PL","focus":"Attack"},{"id":6,"role":"PL","focus":"Roaming"},{"id":7,"role":"HW","focus":"Attack"},{"id":8,"role":"HW","focus":"Balanced"},{"id":9,"role":"BTB","focus":"Ball-Winning"},{"id":10,"role":"HW","focus":"Support"}],
 "LM": [{"id":0,"role":"W","focus":"Balanced"},{"id":1,"role":"W","focus":"Attack"},{"id":2,"role":"WP","focus":"Build-Up"},{"id":3,"role":"WP","focus":"Attack"},{"id":4,"role":"WM","focus":"Support"},{"id":5,"role":"WM","focus":"Defend"},{"id":6,"role":"IF","focus":"Balanced"},{"id":7,"role":"IF","focus":"Attack"},{"id":8,"role":"WM","focus":"Build-Up"}],
 "RM": [{"id":0,"role":"W","focus":"Balanced"},{"id":1,"role":"W","focus":"Attack"},{"id":2,"role":"WP","focus":"Build-Up"},{"id":3,"role":"WP","focus":"Attack"},{"id":4,"role":"WM","focus":"Support"},{"id":5,"role":"WM","focus":"Defend"},{"id":6,"role":"IF","focus":"Balanced"},{"id":7,"role":"IF","focus":"Attack"},{"id":8,"role":"WM","focus":"Build-Up"}],
 "CAM": [{"id":0,"role":"PL","focus":"Build-Up"},{"id":1,"role":"PL","focus":"Balanced"},{"id":2,"role":"PL","focus":"Roaming"},{"id":3,"role":"SS","focus":"Attack"},{"id":4,"role":"HW","focus":"Attack"},{"id":5,"role":"HW","focus":"Balanced"},{"id":6,"role":"C10","focus":"Attack"},{"id":7,"role":"C10","focus":"Wide"},{"id":8,"role":"HW","focus":"Roaming"},{"id":9,"role":"C10","focus":"Versatile"}],
 "LW": [{"id":0,"role":"IF","focus":"Attack"},{"id":1,"role":"IF","focus":"Balanced"},{"id":2,"role":"IF","focus":"Roaming"},{"id":3,"role":"W","focus":"Balanced"},{"id":4,"role":"W","focus":"Attack"},{"id":5,"role":"WP","focus":"Build-Up"},{"id":6,"role":"WP","focus":"Attack"},{"id":7,"role":"W","focus":"Versatile"}],
 "RW": [{"id":0,"role":"IF","focus":"Attack"},{"id":1,"role":"IF","focus":"Balanced"},{"id":2,"role":"IF","focus":"Roaming"},{"id":3,"role":"W","focus":"Balanced"},{"id":4,"role":"W","focus":"Attack"},{"id":5,"role":"WP","focus":"Build-Up"},{"id":6,"role":"WP","focus":"Attack"},{"id":7,"role":"W","focus":"Versatile"}],
 "ST": [{"id":0,"role":"TF","focus":"Attack"},{"id":1,"role":"TF","focus":"Balanced"},{"id":2,"role":"TF","focus":"Wide"},{"id":3,"role":"F9","focus":"Build-Up"},{"id":4,"role":"PO","focus":"Attack"},{"id":5,"role":"PO","focus":"Support"},{"id":6,"role":"AF","focus":"Attack"},{"id":7,"role":"AF","focus":"Support"},{"id":8,"role":"AF","focus":"Versatile"},{"id":9,"role":"F9","focus":"Attack"},{"id":10,"role":"PO","focus":"Versatile"}]
};

export const FORMATIONS: readonly FormationDef[] = [
 {key:"3142",eaId:22,positions:[{"pos":"GK","card":11},{"pos":"CB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"CDM","card":5},{"pos":"RM","card":7},{"pos":"CM","card":6},{"pos":"CM","card":4},{"pos":"LM","card":3},{"pos":"ST","card":2},{"pos":"ST","card":1}]},
 {key:"3412",eaId:23,positions:[{"pos":"GK","card":11},{"pos":"CB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"RM","card":7},{"pos":"CM","card":6},{"pos":"CM","card":5},{"pos":"LM","card":4},{"pos":"CAM","card":2},{"pos":"ST","card":3},{"pos":"ST","card":1}]},
 {key:"3421",eaId:24,positions:[{"pos":"GK","card":11},{"pos":"CB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"RM","card":7},{"pos":"CM","card":6},{"pos":"CM","card":5},{"pos":"LM","card":4},{"pos":"CAM","card":3},{"pos":"CAM","card":1},{"pos":"ST","card":2}]},
 {key:"343",eaId:25,positions:[{"pos":"GK","card":11},{"pos":"CB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"RM","card":7},{"pos":"CM","card":6},{"pos":"CM","card":5},{"pos":"LM","card":4},{"pos":"RW","card":3},{"pos":"ST","card":2},{"pos":"LW","card":1}]},
 {key:"352",eaId:27,positions:[{"pos":"GK","card":11},{"pos":"CB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"CDM","card":6},{"pos":"CDM","card":5},{"pos":"RM","card":7},{"pos":"LM","card":4},{"pos":"CAM","card":2},{"pos":"ST","card":3},{"pos":"ST","card":1}]},
 {key:"41212",eaId:14,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":5},{"pos":"RM","card":6},{"pos":"LM","card":4},{"pos":"CAM","card":2},{"pos":"ST","card":3},{"pos":"ST","card":1}]},
 {key:"41212-2",eaId:15,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":5},{"pos":"CM","card":6},{"pos":"CM","card":4},{"pos":"CAM","card":2},{"pos":"ST","card":3},{"pos":"ST","card":1}]},
 {key:"4132",eaId:1,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":5},{"pos":"RM","card":6},{"pos":"CM","card":3},{"pos":"LM","card":4},{"pos":"ST","card":2},{"pos":"ST","card":1}]},
 {key:"4141",eaId:2,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":6},{"pos":"RM","card":5},{"pos":"CM","card":4},{"pos":"CM","card":3},{"pos":"LM","card":2},{"pos":"ST","card":1}]},
 {key:"4213",eaId:36,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":6},{"pos":"CDM","card":5},{"pos":"CAM","card":4},{"pos":"RW","card":3},{"pos":"ST","card":2},{"pos":"LW","card":1}]},
 {key:"4222",eaId:13,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":6},{"pos":"CDM","card":5},{"pos":"CAM","card":4},{"pos":"CAM","card":3},{"pos":"ST","card":2},{"pos":"ST","card":1}]},
 {key:"4231",eaId:3,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":6},{"pos":"CDM","card":5},{"pos":"CAM","card":4},{"pos":"CAM","card":3},{"pos":"CAM","card":2},{"pos":"ST","card":1}]},
 {key:"4231-2",eaId:4,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":6},{"pos":"CDM","card":5},{"pos":"RM","card":4},{"pos":"LM","card":2},{"pos":"CAM","card":3},{"pos":"ST","card":1}]},
 {key:"424",eaId:5,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CM","card":6},{"pos":"CM","card":5},{"pos":"RW","card":4},{"pos":"ST","card":2},{"pos":"ST","card":1},{"pos":"LW","card":3}]},
 {key:"4312",eaId:6,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CM","card":6},{"pos":"CM","card":5},{"pos":"CM","card":4},{"pos":"CAM","card":3},{"pos":"ST","card":2},{"pos":"ST","card":1}]},
 {key:"4321",eaId:7,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CM","card":6},{"pos":"CM","card":5},{"pos":"CM","card":4},{"pos":"CAM","card":3},{"pos":"CAM","card":1},{"pos":"ST","card":2}]},
 {key:"433",eaId:8,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CM","card":6},{"pos":"CM","card":5},{"pos":"CM","card":4},{"pos":"RW","card":3},{"pos":"ST","card":2},{"pos":"LW","card":1}]},
 {key:"433-2",eaId:9,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":5},{"pos":"CM","card":6},{"pos":"CM","card":4},{"pos":"RW","card":3},{"pos":"ST","card":2},{"pos":"LW","card":1}]},
 {key:"433-3",eaId:10,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":6},{"pos":"CDM","card":4},{"pos":"CM","card":5},{"pos":"RW","card":3},{"pos":"ST","card":2},{"pos":"LW","card":1}]},
 {key:"433-4",eaId:11,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CM","card":6},{"pos":"CM","card":4},{"pos":"CAM","card":5},{"pos":"RW","card":3},{"pos":"ST","card":2},{"pos":"LW","card":1}]},
 {key:"4411-2",eaId:18,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"RM","card":6},{"pos":"CM","card":5},{"pos":"CM","card":4},{"pos":"LM","card":3},{"pos":"CAM","card":2},{"pos":"ST","card":1}]},
 {key:"442",eaId:16,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"RM","card":6},{"pos":"CM","card":5},{"pos":"CM","card":4},{"pos":"LM","card":3},{"pos":"ST","card":2},{"pos":"ST","card":1}]},
 {key:"442-2",eaId:17,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"CDM","card":5},{"pos":"CDM","card":4},{"pos":"RM","card":6},{"pos":"LM","card":3},{"pos":"ST","card":2},{"pos":"ST","card":1}]},
 {key:"451",eaId:21,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"RM","card":6},{"pos":"CM","card":4},{"pos":"LM","card":2},{"pos":"CAM","card":5},{"pos":"CAM","card":3},{"pos":"ST","card":1}]},
 {key:"451-2",eaId:20,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"LB","card":7},{"pos":"RM","card":6},{"pos":"CM","card":5},{"pos":"CM","card":4},{"pos":"CM","card":3},{"pos":"LM","card":2},{"pos":"ST","card":1}]},
 {key:"5212",eaId:29,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"CB","card":7},{"pos":"LB","card":6},{"pos":"CM","card":5},{"pos":"CM","card":4},{"pos":"CAM","card":2},{"pos":"ST","card":3},{"pos":"ST","card":1}]},
 {key:"523",eaId:30,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"CB","card":7},{"pos":"LB","card":6},{"pos":"CM","card":5},{"pos":"CM","card":4},{"pos":"RW","card":3},{"pos":"ST","card":2},{"pos":"LW","card":1}]},
 {key:"532",eaId:31,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"CB","card":7},{"pos":"LB","card":6},{"pos":"CDM","card":4},{"pos":"CM","card":5},{"pos":"CM","card":3},{"pos":"ST","card":2},{"pos":"ST","card":1}]},
 {key:"541",eaId:33,positions:[{"pos":"GK","card":11},{"pos":"RB","card":10},{"pos":"CB","card":9},{"pos":"CB","card":8},{"pos":"CB","card":7},{"pos":"LB","card":6},{"pos":"RM","card":5},{"pos":"CM","card":4},{"pos":"CM","card":3},{"pos":"LM","card":2},{"pos":"ST","card":1}]}
];

export const BUILD_UP_NAMES = ["Balanced", "Counter", "Short Passing"] as const; // index = EA build-up ID (0, 1, 2)
