// The starter game-menu library (M2 — PLANNING_MENU_EN_EVENTS.md).
//
// Copied into every NEW project by scaffoldProject, right after the
// combat library — same prefab rule: the author's from day one. The
// SRAM commands are the only primitive; everything visible here is an
// ordinary script. The poll rides switch 22 ("Menu autorise", armed by
// the sample scene's init page); Start raises switch 20 and the AUTO
// menu_jeu takes the main context — the RM2003 pattern the showcase
// established.

import type { CommonEvent } from "./types";

// Indexes follow the combat library (0-7): poll 8, menu 9, save 10,
// load 11 — the `call` commands below use these numbers.
export const MENU_COMMON_EVENTS: CommonEvent[] = [
 {
  "name": "menu_poll",
  "trigger": "parallel",
  "switch": 22,
  "commands": [
   {
    "c": "rem",
    "text": "Start ouvre le menu : ce parallel POSE le switch 20, et le common"
   },
   {
    "c": "rem",
    "text": "event AUTO menu_jeu (switch 20) prend le contexte principal —"
   },
   {
    "c": "rem",
    "text": "le motif RM2003. En combat, le parallel de fuite (switch 41,"
   },
   {
    "c": "rem",
    "text": "place AVANT dans la liste) prend la main : le menu dort."
   },
   {
    "c": "key_input",
    "var": 70,
    "wait": false,
    "keys": [
     12
    ]
   },
   {
    "c": "if_var",
    "n": 70,
    "op": "==",
    "value": 12,
    "left": {
     "from": "var",
     "value": 70
    },
    "right": {
     "value": 12
    },
    "then": [
     {
      "c": "switch",
      "n": 20,
      "on": true
     }
    ],
    "else": []
   }
  ]
 },
 {
  "name": "menu_jeu",
  "trigger": "auto",
  "switch": 20,
  "commands": [
   {
    "c": "rem",
    "text": "=== BIBLIOTHEQUE MENU (M2) : le menu de jeu, en events — a toi ==="
   },
   {
    "c": "switch",
    "n": 20,
    "on": false
   },
   {
    "c": "loop",
    "do": [
     {
      "c": "list_select",
      "widget": "menu_principal",
      "var": 71,
      "cancel": true,
      "keep": true
     },
     {
      "c": "if_var",
      "n": 71,
      "op": "==",
      "value": 255,
      "left": {
       "from": "var",
       "value": 71
      },
      "right": {
       "value": 255
      },
      "then": [
       {
        "c": "break"
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 71,
      "op": "==",
      "value": 0,
      "left": {
       "from": "var",
       "value": 71
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "rem",
        "text": "SOUS-MENU : la liste des objets (table items). B revient"
       },
       {
        "c": "rem",
        "text": "au menu principal — la boucle recommence, rien de plus."
       },
       {
        "c": "list_select",
        "widget": "menu_objets",
        "var": 74,
        "cancel": true
       },
       {
        "c": "if_var",
        "n": 74,
        "op": "!=",
        "value": 255,
        "left": {
         "from": "var",
         "value": 74
        },
        "right": {
         "value": 255
        },
        "then": [
         {
          "c": "db_read",
          "table": "items",
          "from": "var",
          "entry": 74,
          "field": "heal",
          "dst": 75
         },
         {
          "c": "msg",
          "text": "Cet objet rend \\\\v[75] PV. (Utilise-le en combat.)"
         }
        ],
        "else": []
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 71,
      "op": "==",
      "value": 1,
      "left": {
       "from": "var",
       "value": 71
      },
      "right": {
       "value": 1
      },
      "then": [
       {
        "c": "call",
        "n": 10
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 71,
      "op": "==",
      "value": 2,
      "left": {
       "from": "var",
       "value": 71
      },
      "right": {
       "value": 2
      },
      "then": [
       {
        "c": "call",
        "n": 11
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 71,
      "op": "==",
      "value": 3,
      "left": {
       "from": "var",
       "value": 71
      },
      "right": {
       "value": 3
      },
      "then": [
       {
        "c": "break"
       }
      ],
      "else": []
     }
    ]
   },
   {
    "c": "ui_show",
    "widget": "menu_principal",
    "on": false
   }
  ]
 },
 {
  "name": "menu_sauvegarder",
  "trigger": "none",
  "commands": [
   {
    "c": "rem",
    "text": "Choisir un slot, ecrire la partie. La SRAM est la primitive ;"
   },
   {
    "c": "rem",
    "text": "l'ecran autour est ce script."
   },
   {
    "c": "list_select",
    "widget": "menu_slots",
    "var": 72,
    "cancel": true
   },
   {
    "c": "if_var",
    "n": 72,
    "op": "!=",
    "value": 255,
    "left": {
     "from": "var",
     "value": 72
    },
    "right": {
     "value": 255
    },
    "then": [
     {
      "c": "if_var",
      "n": 72,
      "op": "==",
      "value": 0,
      "left": {
       "from": "var",
       "value": 72
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "save_slot",
        "slot": 1
       },
       {
        "c": "msg",
        "text": "Partie sauvegardee."
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 72,
      "op": "==",
      "value": 1,
      "left": {
       "from": "var",
       "value": 72
      },
      "right": {
       "value": 1
      },
      "then": [
       {
        "c": "save_slot",
        "slot": 2
       },
       {
        "c": "msg",
        "text": "Partie sauvegardee."
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 72,
      "op": "==",
      "value": 2,
      "left": {
       "from": "var",
       "value": 72
      },
      "right": {
       "value": 2
      },
      "then": [
       {
        "c": "save_slot",
        "slot": 3
       },
       {
        "c": "msg",
        "text": "Partie sauvegardee."
       }
      ],
      "else": []
     }
    ],
    "else": []
   }
  ]
 },
 {
  "name": "menu_charger",
  "trigger": "none",
  "commands": [
   {
    "c": "rem",
    "text": "Choisir un slot ; vide = on le dit, occupe = le chargement WARP"
   },
   {
    "c": "rem",
    "text": "vers la scene sauvegardee et ce script s'arrete la."
   },
   {
    "c": "list_select",
    "widget": "menu_slots",
    "var": 72,
    "cancel": true
   },
   {
    "c": "if_var",
    "n": 72,
    "op": "!=",
    "value": 255,
    "left": {
     "from": "var",
     "value": 72
    },
    "right": {
     "value": 255
    },
    "then": [
     {
      "c": "if_var",
      "n": 72,
      "op": "==",
      "value": 0,
      "left": {
       "from": "var",
       "value": 72
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "slot_info",
        "slot": 1,
        "var": 73
       },
       {
        "c": "if_var",
        "n": 73,
        "op": "==",
        "value": 0,
        "left": {
         "from": "var",
         "value": 73
        },
        "right": {
         "value": 0
        },
        "then": [
         {
          "c": "msg",
          "text": "(vide)"
         }
        ],
        "else": [
         {
          "c": "load_slot",
          "slot": 1
         }
        ]
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 72,
      "op": "==",
      "value": 1,
      "left": {
       "from": "var",
       "value": 72
      },
      "right": {
       "value": 1
      },
      "then": [
       {
        "c": "slot_info",
        "slot": 2,
        "var": 73
       },
       {
        "c": "if_var",
        "n": 73,
        "op": "==",
        "value": 0,
        "left": {
         "from": "var",
         "value": 73
        },
        "right": {
         "value": 0
        },
        "then": [
         {
          "c": "msg",
          "text": "(vide)"
         }
        ],
        "else": [
         {
          "c": "load_slot",
          "slot": 2
         }
        ]
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 72,
      "op": "==",
      "value": 2,
      "left": {
       "from": "var",
       "value": 72
      },
      "right": {
       "value": 2
      },
      "then": [
       {
        "c": "slot_info",
        "slot": 3,
        "var": 73
       },
       {
        "c": "if_var",
        "n": 73,
        "op": "==",
        "value": 0,
        "left": {
         "from": "var",
         "value": 73
        },
        "right": {
         "value": 0
        },
        "then": [
         {
          "c": "msg",
          "text": "(vide)"
         }
        ],
        "else": [
         {
          "c": "load_slot",
          "slot": 3
         }
        ]
       }
      ],
      "else": []
     }
    ],
    "else": []
   }
  ]
 }
];
