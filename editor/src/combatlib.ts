// The starter combat library (V4 — PLANNING_COMBAT_EN_EVENTS.md).
//
// Copied into every NEW project by scaffoldProject, exactly like a
// prefab: from then on it belongs to the author — engine updates never
// touch it. This is the SIMPLE version (attack, potion, flee); the
// showcase project carries the full reference (skills, weighted AI,
// poison, hooks). Generated once, then maintained by hand like any
// source file.

import type { CommonEvent, FunctionDef } from "./types";

export const COMBAT_COMMON_EVENTS: CommonEvent[] = [
 {
  "name": "combat_tour",
  "trigger": "none",
  "commands": [
   {
    "c": "rem",
    "text": "=== BIBLIOTHEQUE COMBAT (kit de depart) : la boucle ATB, en events ==="
   },
   {
    "c": "rem",
    "text": "Ce combat est A TOI : chaque commande se lit et se modifie ici."
   },
   {
    "c": "rem",
    "text": "L'ECRAN COMPOSE (Tools > Ecrans) a pose les monstres et nomme leurs"
   },
   {
    "c": "rem",
    "text": "fiches database dans les variables 252+. Le reste est a toi."
   },
   {
    "c": "call",
    "n": 8
   },
   {
    "c": "var",
    "n": 89,
    "op": "=",
    "value": 0
   },
   {
    "c": "var",
    "n": 95,
    "op": "=",
    "value": 0
   },
   {
    "c": "var",
    "n": 99,
    "op": "=",
    "value": 0
   },
   {
    "c": "rem",
    "text": "PV des monstres depuis la database (slot vide = 0, deja 'mort')"
   },
   {
    "c": "db_read",
    "table": "monsters",
    "from": "var",
    "entry": 252,
    "field": "max_hp",
    "dst": 80
   },
   {
    "c": "db_read",
    "table": "monsters",
    "from": "var",
    "entry": 253,
    "field": "max_hp",
    "dst": 81
   },
   {
    "c": "rem",
    "text": "Jauges ATB : paires (jauge, vitesse) — 100+ heros, 104+ monstres"
   },
   {
    "c": "var",
    "n": 100,
    "op": "=",
    "value": 0
   },
   {
    "c": "var",
    "n": 102,
    "op": "=",
    "value": 0
   },
   {
    "c": "var",
    "n": 104,
    "op": "=",
    "value": 0
   },
   {
    "c": "var",
    "n": 106,
    "op": "=",
    "value": 0
   },
   {
    "c": "var",
    "n": 101,
    "op": "=",
    "value": 224,
    "from": "var"
   },
   {
    "c": "var",
    "n": 103,
    "op": "=",
    "value": 225,
    "from": "var"
   },
   {
    "c": "db_read",
    "table": "monsters",
    "from": "var",
    "entry": 252,
    "field": "speed",
    "dst": 105
   },
   {
    "c": "db_read",
    "table": "monsters",
    "from": "var",
    "entry": 253,
    "field": "speed",
    "dst": 107
   },
   {
    "c": "ui_show",
    "widget": "combat_pv1",
    "on": true
   },
   {
    "c": "rem",
    "text": "L'equipe est posee par l'ECRAN lui-meme (Tools > Ecrans >"
   },
   {
    "c": "rem",
    "text": "combat_slimes, section Sprites animes) : le heros y respire en boucle."
   },
   {
    "c": "rem",
    "text": "2e equipier : ajouter son sprite animé (emplacement 6) dans l'ecran."
   },
   {
    "c": "switch",
    "n": 41,
    "on": true
   },
   {
    "c": "clock",
    "base": 100,
    "lanes": 4
   },
   {
    "c": "loop",
    "do": [
     {
      "c": "if_var",
      "n": 100,
      "op": ">=",
      "value": 255,
      "left": {
       "from": "var",
       "value": 100
      },
      "right": {
       "value": 255
      },
      "then": [
       {
        "c": "if_var",
        "n": 240,
        "op": "!=",
        "value": 0,
        "left": {
         "from": "var",
         "value": 240
        },
        "right": {
         "value": 0
        },
        "then": [
         {
          "c": "var",
          "n": 90,
          "op": "=",
          "value": 0
         },
         {
          "c": "call",
          "n": 1
         }
        ],
        "else": [
         {
          "c": "var",
          "n": 100,
          "op": "=",
          "value": 0
         }
        ]
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 102,
      "op": ">=",
      "value": 255,
      "left": {
       "from": "var",
       "value": 102
      },
      "right": {
       "value": 255
      },
      "then": [
       {
        "c": "if_var",
        "n": 242,
        "op": "!=",
        "value": 0,
        "left": {
         "from": "var",
         "value": 242
        },
        "right": {
         "value": 0
        },
        "then": [
         {
          "c": "var",
          "n": 90,
          "op": "=",
          "value": 1
         },
         {
          "c": "call",
          "n": 1
         }
        ],
        "else": [
         {
          "c": "var",
          "n": 102,
          "op": "=",
          "value": 0
         }
        ]
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 104,
      "op": ">=",
      "value": 255,
      "left": {
       "from": "var",
       "value": 104
      },
      "right": {
       "value": 255
      },
      "then": [
       {
        "c": "if_var",
        "n": 80,
        "op": "!=",
        "value": 0,
        "left": {
         "from": "var",
         "value": 80
        },
        "right": {
         "value": 0
        },
        "then": [
         {
          "c": "var",
          "n": 90,
          "op": "=",
          "value": 0
         },
         {
          "c": "call",
          "n": 2
         }
        ],
        "else": [
         {
          "c": "var",
          "n": 104,
          "op": "=",
          "value": 0
         }
        ]
       }
      ],
      "else": []
     },
     {
      "c": "if_var",
      "n": 106,
      "op": ">=",
      "value": 255,
      "left": {
       "from": "var",
       "value": 106
      },
      "right": {
       "value": 255
      },
      "then": [
       {
        "c": "if_var",
        "n": 81,
        "op": "!=",
        "value": 0,
        "left": {
         "from": "var",
         "value": 81
        },
        "right": {
         "value": 0
        },
        "then": [
         {
          "c": "var",
          "n": 90,
          "op": "=",
          "value": 1
         },
         {
          "c": "call",
          "n": 2
         }
        ],
        "else": [
         {
          "c": "var",
          "n": 106,
          "op": "=",
          "value": 0
         }
        ]
       }
      ],
      "else": []
     },
     {
      "c": "if_sw",
      "n": 500,
      "on": true,
      "then": [
       {
        "c": "break"
       }
      ],
      "else": []
     },
     {
      "c": "wait",
      "frames": 1
     }
    ]
   },
   {
    "c": "rem",
    "text": "Rideau — la page AUTO conditionnee sur le switch 500 prend la suite"
   },
   {
    "c": "clock",
    "base": 100,
    "lanes": 0
   },
   {
    "c": "switch",
    "n": 41,
    "on": false
   },
   {
    "c": "ui_show",
    "widget": "combat_pv1",
    "on": false
   },
   {
    "c": "vig_hide",
    "slot": 5
   },
   {
    "c": "vig_hide",
    "slot": 6
   },
   {
    "c": "stage_close",
    "dur": 30,
    "trans": "mosaic"
   }
  ]
 },
 {
  "name": "combat_tour_heros",
  "trigger": "none",
  "commands": [
   {
    "c": "rem",
    "text": "Le tour d'un heros (v90). En mode Attente le temps s'arrete au menu."
   },
   {
    "c": "if_var",
    "n": 89,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 89
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "clock",
      "base": 100,
      "lanes": 0
     }
    ],
    "else": []
   },
   {
    "c": "loop",
    "do": [
     {
      "c": "list_select",
      "widget": "menu_combat",
      "var": 92,
      "cancel": false,
      "keep": true
     },
     {
      "c": "if_sw",
      "n": 500,
      "on": true,
      "then": [
       {
        "c": "rem",
        "text": "la fuite L+R a gagne pendant le menu : on sort"
       },
       {
        "c": "break"
       }
      ],
      "else": []
     },
     {
      "c": "rem",
      "text": "0 Attaque — degats = attaque x2 - defense (fonction 1, modifiable)"
     },
     {
      "c": "if_var",
      "n": 92,
      "op": "==",
      "value": 0,
      "left": {
       "from": "var",
       "value": 92
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "target_sel",
        "var": 91,
        "ally": false,
        "cancel": true
       },
       {
        "c": "if_var",
        "n": 91,
        "op": "!=",
        "value": 255,
        "left": {
         "from": "var",
         "value": 91
        },
        "right": {
         "value": 255
        },
        "then": [
         {
          "c": "if_var",
          "n": 91,
          "op": "==",
          "value": 0,
          "left": {
           "from": "var",
           "value": 91
          },
          "right": {
           "value": 0
          },
          "then": [
           {
            "c": "db_read",
            "table": "monsters",
            "from": "var",
            "entry": 252,
            "field": "defense",
            "dst": 84
           }
          ],
          "else": []
         },
         {
          "c": "if_var",
          "n": 91,
          "op": "==",
          "value": 1,
          "left": {
           "from": "var",
           "value": 91
          },
          "right": {
           "value": 1
          },
          "then": [
           {
            "c": "db_read",
            "table": "monsters",
            "from": "var",
            "entry": 253,
            "field": "defense",
            "dst": 84
           }
          ],
          "else": []
         },
         {
          "c": "if_var",
          "n": 90,
          "op": "==",
          "value": 0,
          "left": {
           "from": "var",
           "value": 90
          },
          "right": {
           "value": 0
          },
          "then": [
           {
            "c": "call_fn",
            "n": 0,
            "args": [
             {
              "from": "var",
              "value": 208
             },
             {
              "from": "var",
              "value": 84
             }
            ],
            "dst": 93
           }
          ],
          "else": [
           {
            "c": "call_fn",
            "n": 0,
            "args": [
             {
              "from": "var",
              "value": 209
             },
             {
              "from": "var",
              "value": 84
             }
            ],
            "dst": 93
           }
          ]
         },
         {
          "c": "rem",
          "text": "La fioriture : l'attaquant s'anime vite le temps du coup"
         },
         {
          "c": "if_var",
          "n": 90,
          "op": "==",
          "value": 0,
          "left": {
           "from": "var",
           "value": 90
          },
          "right": {
           "value": 0
          },
          "then": [
           {
            "c": "vig_play",
            "slot": 5,
            "mode": "loop",
            "speed": 3
           }
          ],
          "else": [
           {
            "c": "vig_play",
            "slot": 6,
            "mode": "loop",
            "speed": 3
           }
          ]
         },
         {
          "c": "call",
          "n": 3
         },
         {
          "c": "if_var",
          "n": 90,
          "op": "==",
          "value": 0,
          "left": {
           "from": "var",
           "value": 90
          },
          "right": {
           "value": 0
          },
          "then": [
           {
            "c": "vig_play",
            "slot": 5,
            "mode": "loop",
            "speed": 24
           }
          ],
          "else": [
           {
            "c": "vig_play",
            "slot": 6,
            "mode": "loop",
            "speed": 24
           }
          ]
         },
         {
          "c": "break"
         }
        ],
        "else": []
       }
      ],
      "else": []
     },
     {
      "c": "rem",
      "text": "1 Potion — comptee par la variable 17, soin lu dans la database"
     },
     {
      "c": "if_var",
      "n": 92,
      "op": "==",
      "value": 1,
      "left": {
       "from": "var",
       "value": 92
      },
      "right": {
       "value": 1
      },
      "then": [
       {
        "c": "rem",
        "text": "1 Objets — un SOUS-MENU : la liste des objets (table items),"
       },
       {
        "c": "rem",
        "text": "filtree par ce qu'on possede. B revient au menu de combat."
       },
       {
        "c": "list_select",
        "widget": "menu_objets",
        "var": 74,
        "cancel": true
       },
       {
        "c": "if_sw",
        "n": 500,
        "on": true,
        "then": [
         {
          "c": "break"
         }
        ],
        "else": []
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
          "c": "rem",
          "text": "Le soin vient de la FICHE choisie, pas d'un objet code ici."
         },
         {
          "c": "db_read",
          "table": "items",
          "from": "var",
          "entry": 74,
          "field": "heal",
          "dst": 93
         },
         {
          "c": "db_entry",
          "table": "items",
          "entry": "potion",
          "dst": 75
         },
         {
          "c": "if_var",
          "n": 74,
          "op": "==",
          "value": 0,
          "left": {
           "from": "var",
           "value": 74
          },
          "right": {
           "from": "var",
           "value": 75
          },
          "then": [
           {
            "c": "var",
            "n": 17,
            "op": "-",
            "value": 1
           }
          ],
          "else": []
         },
         {
          "c": "var",
          "n": 240,
          "op": "+",
          "from": "var",
          "value": 93
         },
         {
          "c": "rem",
          "text": "cap aux PV max (v241)"
         },
         {
          "c": "if_var",
          "n": 240,
          "op": ">=",
          "value": 0,
          "left": {
           "from": "var",
           "value": 240
          },
          "right": {
           "from": "var",
           "value": 241
          },
          "then": [
           {
            "c": "var",
            "n": 240,
            "op": "=",
            "from": "var",
            "value": 241
           }
          ],
          "else": []
         },
         {
          "c": "popup",
          "value": 0,
          "value_var": 93,
          "x": 200,
          "y": 40
         },
         {
          "c": "break"
         }
        ],
        "else": []
       }
      ],
      "else": []
     },
     {
      "c": "rem",
      "text": "2 Fuir — pile ou face. Ajoute ici tes competences (voir showcase)."
     },
     {
      "c": "if_var",
      "n": 92,
      "op": "==",
      "value": 2,
      "left": {
       "from": "var",
       "value": 92
      },
      "right": {
       "value": 2
      },
      "then": [
       {
        "c": "var",
        "n": 94,
        "op": "rand",
        "value": 1
       },
       {
        "c": "if_var",
        "n": 94,
        "op": "==",
        "value": 1,
        "left": {
         "from": "var",
         "value": 94
        },
        "right": {
         "value": 1
        },
        "then": [
         {
          "c": "var",
          "n": 248,
          "op": "=",
          "value": 3
         },
         {
          "c": "switch",
          "n": 500,
          "on": true
         }
        ],
        "else": []
       },
       {
        "c": "break"
       }
      ],
      "else": []
     }
    ]
   },
   {
    "c": "rem",
    "text": "L'action est prise : on ferme le menu reste affiche."
   },
   {
    "c": "ui_show",
    "widget": "menu_combat",
    "on": false
   },
   {
    "c": "if_var",
    "n": 90,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 90
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "var",
      "n": 100,
      "op": "=",
      "value": 0
     }
    ],
    "else": [
     {
      "c": "var",
      "n": 102,
      "op": "=",
      "value": 0
     }
    ]
   },
   {
    "c": "clock",
    "base": 100,
    "lanes": 4
   }
  ]
 },
 {
  "name": "combat_tour_monstre",
  "trigger": "none",
  "commands": [
   {
    "c": "rem",
    "text": "Le tour d'un monstre (v90 = slot) : l'attaque simple, en alternant"
   },
   {
    "c": "rem",
    "text": "les cibles vivantes. IA ponderee, sorts, poison : voir le showcase."
   },
   {
    "c": "clock",
    "base": 100,
    "lanes": 0
   },
   {
    "c": "if_var",
    "n": 90,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 90
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "db_read",
      "table": "monsters",
      "from": "var",
      "entry": 252,
      "field": "attack",
      "dst": 84
     }
    ],
    "else": [
     {
      "c": "db_read",
      "table": "monsters",
      "from": "var",
      "entry": 253,
      "field": "attack",
      "dst": 84
     }
    ]
   },
   {
    "c": "var",
    "n": 95,
    "op": "+",
    "value": 1
   },
   {
    "c": "var",
    "n": 96,
    "op": "=",
    "value": 95,
    "from": "var"
   },
   {
    "c": "var",
    "n": 96,
    "op": "%",
    "value": 2
   },
   {
    "c": "if_var",
    "n": 96,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 96
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "if_var",
      "n": 240,
      "op": "!=",
      "value": 0,
      "left": {
       "from": "var",
       "value": 240
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "var",
        "n": 91,
        "op": "=",
        "value": 0
       }
      ],
      "else": [
       {
        "c": "var",
        "n": 91,
        "op": "=",
        "value": 1
       }
      ]
     }
    ],
    "else": [
     {
      "c": "if_var",
      "n": 242,
      "op": "!=",
      "value": 0,
      "left": {
       "from": "var",
       "value": 242
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "var",
        "n": 91,
        "op": "=",
        "value": 1
       }
      ],
      "else": [
       {
        "c": "var",
        "n": 91,
        "op": "=",
        "value": 0
       }
      ]
     }
    ]
   },
   {
    "c": "if_var",
    "n": 91,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 91
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "call_fn",
      "n": 0,
      "args": [
       {
        "from": "var",
        "value": 84
       },
       {
        "from": "var",
        "value": 212
       }
      ],
      "dst": 93
     }
    ],
    "else": [
     {
      "c": "call_fn",
      "n": 0,
      "args": [
       {
        "from": "var",
        "value": 84
       },
       {
        "from": "var",
        "value": 213
       }
      ],
      "dst": 93
     }
    ]
   },
   {
    "c": "call",
    "n": 6
   },
   {
    "c": "wait",
    "frames": 24
   },
   {
    "c": "rem",
    "text": "Defaite ?"
   },
   {
    "c": "if_var",
    "n": 240,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 240
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "if_var",
      "n": 242,
      "op": "==",
      "value": 0,
      "left": {
       "from": "var",
       "value": 242
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "var",
        "n": 248,
        "op": "=",
        "value": 2
       },
       {
        "c": "switch",
        "n": 500,
        "on": true
       }
      ],
      "else": []
     }
    ],
    "else": []
   },
   {
    "c": "if_var",
    "n": 90,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 90
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "var",
      "n": 104,
      "op": "=",
      "value": 0
     }
    ],
    "else": [
     {
      "c": "var",
      "n": 106,
      "op": "=",
      "value": 0
     }
    ]
   },
   {
    "c": "clock",
    "base": 100,
    "lanes": 4
   }
  ]
 },
 {
  "name": "combat_toucher_monstre",
  "trigger": "none",
  "commands": [
   {
    "c": "rem",
    "text": "Applique v93 degats au monstre v91 : plancher 0, popup, flash —"
   },
   {
    "c": "rem",
    "text": "ou fondu + slot libere s'il meurt (le curseur l'ignorera)."
   },
   {
    "c": "if_var",
    "n": 91,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 91
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "if_var",
      "n": 93,
      "op": ">=",
      "value": 0,
      "left": {
       "from": "var",
       "value": 93
      },
      "right": {
       "from": "var",
       "value": 80
      },
      "then": [
       {
        "c": "var",
        "n": 80,
        "op": "=",
        "value": 0
       }
      ],
      "else": [
       {
        "c": "var",
        "n": 80,
        "op": "-",
        "value": 93,
        "from": "var"
       }
      ]
     },
     {
      "c": "call",
      "n": 5
     },
     {
      "c": "if_var",
      "n": 80,
      "op": "==",
      "value": 0,
      "left": {
       "from": "var",
       "value": 80
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "slot_fx",
        "slot": 1,
        "fx": "fadeout",
        "frames": 24
       },
       {
        "c": "wait",
        "frames": 28
       },
       {
        "c": "stage_clear",
        "slot": 1
       }
      ],
      "else": [
       {
        "c": "slot_fx",
        "slot": 1,
        "fx": "flash",
        "frames": 12
       },
       {
        "c": "wait",
        "frames": 24
       }
      ]
     }
    ],
    "else": [
     {
      "c": "if_var",
      "n": 93,
      "op": ">=",
      "value": 0,
      "left": {
       "from": "var",
       "value": 93
      },
      "right": {
       "from": "var",
       "value": 81
      },
      "then": [
       {
        "c": "var",
        "n": 81,
        "op": "=",
        "value": 0
       }
      ],
      "else": [
       {
        "c": "var",
        "n": 81,
        "op": "-",
        "value": 93,
        "from": "var"
       }
      ]
     },
     {
      "c": "call",
      "n": 5
     },
     {
      "c": "if_var",
      "n": 81,
      "op": "==",
      "value": 0,
      "left": {
       "from": "var",
       "value": 81
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "slot_fx",
        "slot": 2,
        "fx": "fadeout",
        "frames": 24
       },
       {
        "c": "wait",
        "frames": 28
       },
       {
        "c": "stage_clear",
        "slot": 2
       }
      ],
      "else": [
       {
        "c": "slot_fx",
        "slot": 2,
        "fx": "flash",
        "frames": 12
       },
       {
        "c": "wait",
        "frames": 24
       }
      ]
     }
    ]
   },
   {
    "c": "rem",
    "text": "Victoire ? Les recompenses se lisent dans la database (slot vide = +0)"
   },
   {
    "c": "if_var",
    "n": 80,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 80
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "if_var",
      "n": 81,
      "op": "==",
      "value": 0,
      "left": {
       "from": "var",
       "value": 81
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "db_read",
        "table": "monsters",
        "from": "var",
        "entry": 252,
        "field": "xp",
        "dst": 84
       },
       {
        "c": "var",
        "n": 249,
        "op": "+",
        "value": 84,
        "from": "var"
       },
       {
        "c": "db_read",
        "table": "monsters",
        "from": "var",
        "entry": 253,
        "field": "xp",
        "dst": 84
       },
       {
        "c": "var",
        "n": 249,
        "op": "+",
        "value": 84,
        "from": "var"
       },
       {
        "c": "db_read",
        "table": "monsters",
        "from": "var",
        "entry": 252,
        "field": "gold",
        "dst": 84
       },
       {
        "c": "var",
        "n": 250,
        "op": "+",
        "value": 84,
        "from": "var"
       },
       {
        "c": "db_read",
        "table": "monsters",
        "from": "var",
        "entry": 253,
        "field": "gold",
        "dst": 84
       },
       {
        "c": "var",
        "n": 250,
        "op": "+",
        "value": 84,
        "from": "var"
       },
       {
        "c": "var",
        "n": 248,
        "op": "=",
        "value": 1
       },
       {
        "c": "switch",
        "n": 500,
        "on": true
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
  "name": "combat_soigner_heros",
  "trigger": "none",
  "commands": [
   {
    "c": "rem",
    "text": "Soigne le heros v91 de v93 PV, plafonne a son maximum, popup."
   },
   {
    "c": "if_var",
    "n": 91,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 91
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "var",
      "n": 240,
      "op": "+",
      "value": 93,
      "from": "var"
     },
     {
      "c": "if_var",
      "n": 240,
      "op": ">=",
      "value": 0,
      "left": {
       "from": "var",
       "value": 240
      },
      "right": {
       "from": "var",
       "value": 241
      },
      "then": [
       {
        "c": "var",
        "n": 240,
        "op": "=",
        "value": 241,
        "from": "var"
       }
      ],
      "else": []
     },
     {
      "c": "popup",
      "value": 100,
      "value_var": 93,
      "x": 196,
      "y": 48
     },
     {
      "c": "wait",
      "frames": 24
     }
    ],
    "else": [
     {
      "c": "var",
      "n": 242,
      "op": "+",
      "value": 93,
      "from": "var"
     },
     {
      "c": "if_var",
      "n": 242,
      "op": ">=",
      "value": 0,
      "left": {
       "from": "var",
       "value": 242
      },
      "right": {
       "from": "var",
       "value": 243
      },
      "then": [
       {
        "c": "var",
        "n": 242,
        "op": "=",
        "value": 243,
        "from": "var"
       }
      ],
      "else": []
     },
     {
      "c": "popup",
      "value": 100,
      "value_var": 93,
      "x": 196,
      "y": 80
     },
     {
      "c": "wait",
      "frames": 24
     }
    ]
   }
  ]
 },
 {
  "name": "combat_popup_monstre",
  "trigger": "none",
  "commands": [
   {
    "c": "rem",
    "text": "Le popup de degats sur le monstre v91 — les coordonnees suivent"
   },
   {
    "c": "rem",
    "text": "les positions du groupe (data/troops.toml : x*8+16, y*8+8)."
   },
   {
    "c": "if_var",
    "n": 91,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 91
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "popup",
      "value": 100,
      "value_var": 93,
      "x": 56,
      "y": 88
     }
    ],
    "else": [
     {
      "c": "popup",
      "value": 100,
      "value_var": 93,
      "x": 96,
      "y": 104
     }
    ]
   }
  ]
 },
 {
  "name": "combat_toucher_heros",
  "trigger": "none",
  "commands": [
   {
    "c": "rem",
    "text": "Applique v93 degats au heros v91 : plancher 0, popup, KO = disparait."
   },
   {
    "c": "if_var",
    "n": 91,
    "op": "==",
    "value": 0,
    "left": {
     "from": "var",
     "value": 91
    },
    "right": {
     "value": 0
    },
    "then": [
     {
      "c": "if_var",
      "n": 93,
      "op": ">=",
      "value": 0,
      "left": {
       "from": "var",
       "value": 93
      },
      "right": {
       "from": "var",
       "value": 240
      },
      "then": [
       {
        "c": "var",
        "n": 240,
        "op": "=",
        "value": 0
       }
      ],
      "else": [
       {
        "c": "var",
        "n": 240,
        "op": "-",
        "value": 93,
        "from": "var"
       }
      ]
     },
     {
      "c": "rem",
      "text": "Le recul : le sprite animé accelere le temps de l'impact"
     },
     {
      "c": "vig_play",
      "slot": 5,
      "mode": "loop",
      "speed": 2
     },
     {
      "c": "popup",
      "value": 100,
      "value_var": 93,
      "x": 196,
      "y": 48
     },
     {
      "c": "if_var",
      "n": 240,
      "op": "==",
      "value": 0,
      "left": {
       "from": "var",
       "value": 240
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "vig_hide",
        "slot": 5
       }
      ],
      "else": []
     },
     {
      "c": "vig_play",
      "slot": 5,
      "mode": "loop",
      "speed": 24
     }
    ],
    "else": [
     {
      "c": "if_var",
      "n": 93,
      "op": ">=",
      "value": 0,
      "left": {
       "from": "var",
       "value": 93
      },
      "right": {
       "from": "var",
       "value": 242
      },
      "then": [
       {
        "c": "var",
        "n": 242,
        "op": "=",
        "value": 0
       }
      ],
      "else": [
       {
        "c": "var",
        "n": 242,
        "op": "-",
        "value": 93,
        "from": "var"
       }
      ]
     },
     {
      "c": "vig_play",
      "slot": 6,
      "mode": "loop",
      "speed": 2
     },
     {
      "c": "popup",
      "value": 100,
      "value_var": 93,
      "x": 196,
      "y": 80
     },
     {
      "c": "if_var",
      "n": 242,
      "op": "==",
      "value": 0,
      "left": {
       "from": "var",
       "value": 242
      },
      "right": {
       "value": 0
      },
      "then": [
       {
        "c": "vig_hide",
        "slot": 6
       }
      ],
      "else": []
     },
     {
      "c": "vig_play",
      "slot": 6,
      "mode": "loop",
      "speed": 24
     }
    ]
   }
  ]
 },
 {
  "name": "combat_fuite_lr",
  "trigger": "parallel",
  "switch": 41,
  "commands": [
   {
    "c": "rem",
    "text": "L+R tenus ~45 frames : memes chances que le menu Fuir. La fuite"
   },
   {
    "c": "rem",
    "text": "prend effet des que l'interaction en cours se resout."
   },
   {
    "c": "key_input",
    "var": 86,
    "wait": false,
    "keys": [
     9
    ]
   },
   {
    "c": "if_var",
    "n": 86,
    "op": "==",
    "value": 9,
    "left": {
     "from": "var",
     "value": 86
    },
    "right": {
     "value": 9
    },
    "then": [
     {
      "c": "key_input",
      "var": 86,
      "wait": false,
      "keys": [
       10
      ]
     },
     {
      "c": "if_var",
      "n": 86,
      "op": "==",
      "value": 10,
      "left": {
       "from": "var",
       "value": 86
      },
      "right": {
       "value": 10
      },
      "then": [
       {
        "c": "var",
        "n": 99,
        "op": "+",
        "value": 1
       },
       {
        "c": "if_var",
        "n": 99,
        "op": ">=",
        "value": 45,
        "left": {
         "from": "var",
         "value": 99
        },
        "right": {
         "value": 45
        },
        "then": [
         {
          "c": "var",
          "n": 99,
          "op": "=",
          "value": 0
         },
         {
          "c": "var",
          "n": 94,
          "op": "rand",
          "value": 1
         },
         {
          "c": "if_var",
          "n": 94,
          "op": "==",
          "value": 1,
          "left": {
           "from": "var",
           "value": 94
          },
          "right": {
           "value": 1
          },
          "then": [
           {
            "c": "var",
            "n": 248,
            "op": "=",
            "value": 3
           },
           {
            "c": "switch",
            "n": 500,
            "on": true
           },
           {
            "c": "switch",
            "n": 41,
            "on": false
           }
          ],
          "else": []
         }
        ],
        "else": []
       }
      ],
      "else": [
       {
        "c": "var",
        "n": 99,
        "op": "=",
        "value": 0
       }
      ]
     }
    ],
    "else": [
     {
      "c": "var",
      "n": 99,
      "op": "=",
      "value": 0
     }
    ]
   }
  ]
 },
 {
  "name": "combat_preparer",
  "trigger": "none",
  "commands": [
   {
    "c": "rem",
    "text": "=== BIBLIOTHEQUE COMBAT : l'equipe entre en scene (G1) ==="
   },
   {
    "c": "rem",
    "text": "L'equipe est une DONNEE : la variable 60 porte le numero de la"
   },
   {
    "c": "rem",
    "text": "fiche heroes de la 1re place (61 pour la 2e, si tu en ajoutes)."
   },
   {
    "c": "rem",
    "text": "« Numero d'une fiche » la remplit — changer d'equipier = 1 ligne."
   },
   {
    "c": "rem",
    "text": "Ici on recopie ses stats dans les variables de travail :"
   },
   {
    "c": "rem",
    "text": "PV 240+ (courant, max), PM 232+, atq 208+, def 212+, magie 216+,"
   },
   {
    "c": "rem",
    "text": "def. magique 220+, vitesse 224+."
   },
   {
    "c": "db_read",
    "table": "heroes",
    "from": "var",
    "entry": 60,
    "field": "max_hp",
    "dst": 241
   },
   {
    "c": "var",
    "n": 240,
    "op": "=",
    "from": "var",
    "value": 241
   },
   {
    "c": "db_read",
    "table": "heroes",
    "from": "var",
    "entry": 60,
    "field": "max_mp",
    "dst": 232
   },
   {
    "c": "db_read",
    "table": "heroes",
    "from": "var",
    "entry": 60,
    "field": "attack",
    "dst": 208
   },
   {
    "c": "db_read",
    "table": "heroes",
    "from": "var",
    "entry": 60,
    "field": "defense",
    "dst": 212
   },
   {
    "c": "db_read",
    "table": "heroes",
    "from": "var",
    "entry": 60,
    "field": "magic",
    "dst": 216
   },
   {
    "c": "db_read",
    "table": "heroes",
    "from": "var",
    "entry": 60,
    "field": "magic_def",
    "dst": 220
   },
   {
    "c": "db_read",
    "table": "heroes",
    "from": "var",
    "entry": 60,
    "field": "speed",
    "dst": 224
   },
   {
    "c": "var",
    "n": 231,
    "op": "=",
    "value": 1
   }
  ]
 }
];

export const COMBAT_FUNCTIONS: FunctionDef[] = [
 {
  "name": "degats_physiques",
  "params": [
   "attaque",
   "defense"
  ],
  "locals": [
   "d"
  ],
  "returns": true,
  "commands": [
   {
    "c": "rem",
    "text": "attaque x2 - defense, plancher 1 — la formule de base, a toi"
   },
   {
    "c": "var",
    "dst": "local",
    "n": 0,
    "op": "=",
    "from": "param",
    "value": 0
   },
   {
    "c": "var",
    "dst": "local",
    "n": 0,
    "op": "*",
    "value": 2
   },
   {
    "c": "if_var",
    "n": 0,
    "op": ">=",
    "value": 0,
    "left": {
     "from": "param",
     "value": 1
    },
    "right": {
     "from": "local",
     "value": 0
    },
    "then": [
     {
      "c": "ret_fn",
      "value": 1
     }
    ],
    "else": [
     {
      "c": "var",
      "dst": "local",
      "n": 0,
      "op": "-",
      "from": "param",
      "value": 1
     },
     {
      "c": "ret_fn",
      "from": "local",
      "value": 0
     }
    ]
   }
  ]
 },
 {
  "name": "degats_magiques",
  "params": [
   "puissance",
   "magie",
   "def_magique"
  ],
  "locals": [
   "d"
  ],
  "returns": true,
  "commands": [
   {
    "c": "rem",
    "text": "puissance + magie x2 - def. magique, plancher 1 — pour tes sorts"
   },
   {
    "c": "var",
    "dst": "local",
    "n": 0,
    "op": "=",
    "from": "param",
    "value": 1
   },
   {
    "c": "var",
    "dst": "local",
    "n": 0,
    "op": "*",
    "value": 2
   },
   {
    "c": "var",
    "dst": "local",
    "n": 0,
    "op": "+",
    "from": "param",
    "value": 0
   },
   {
    "c": "if_var",
    "n": 0,
    "op": ">=",
    "value": 0,
    "left": {
     "from": "param",
     "value": 2
    },
    "right": {
     "from": "local",
     "value": 0
    },
    "then": [
     {
      "c": "ret_fn",
      "value": 1
     }
    ],
    "else": [
     {
      "c": "var",
      "dst": "local",
      "n": 0,
      "op": "-",
      "from": "param",
      "value": 2
     },
     {
      "c": "ret_fn",
      "from": "local",
      "value": 0
     }
    ]
   }
  ]
 },
 {
  "name": "soin_montant",
  "params": [
   "puissance",
   "magie"
  ],
  "locals": [
   "d"
  ],
  "returns": true,
  "commands": [
   {
    "c": "rem",
    "text": "puissance + magie — pour tes sorts de soin"
   },
   {
    "c": "var",
    "dst": "local",
    "n": 0,
    "op": "=",
    "from": "param",
    "value": 0
   },
   {
    "c": "var",
    "dst": "local",
    "n": 0,
    "op": "+",
    "from": "param",
    "value": 1
   },
   {
    "c": "ret_fn",
    "from": "local",
    "value": 0
   }
  ]
 }
];

// Names for the variables and switches the library and the battle
// opener use — shown by the editor's pickers.
export const COMBAT_VARIABLES: string[] = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Potions", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Equipe: fiche place 1", "Equipe: fiche place 2", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Combat: poison heros 1", "Combat: poison heros 2", "Combat: PV monstre 1", "Combat: PV monstre 2", "", "", "Combat: scratch", "", "Combat: touche L/R", "", "", "Combat: mode Actif (0 = Attente)", "Combat: acteur", "Combat: cible", "Combat: choix menu", "Combat: degats", "Combat: alea", "Combat: alternance", "Combat: scratch 2", "", "", "Combat: fuite L+R (compteur)", "Combat: jauge heros 1", "Combat: vitesse heros 1", "Combat: jauge heros 2", "Combat: vitesse heros 2", "Combat: jauge monstre 1", "Combat: vitesse monstre 1", "Combat: jauge monstre 2", "Combat: vitesse monstre 2", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Combat: attaque heros 1", "Combat: attaque heros 2", "", "", "Combat: defense heros 1", "Combat: defense heros 2", "", "", "Combat: magie heros 1", "Combat: magie heros 2", "", "", "Combat: def. magique heros 1", "Combat: def. magique heros 2", "", "", "Combat: vitesse (stat) heros 1", "Combat: vitesse (stat) heros 2", "", "", "", "", "", "Combat: taille de l'equipe", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Combat: issue (1 victoire, 2 defaite, 3 fuite)", "Combat: XP gagnes", "Combat: or gagne", "Combat: groupe en cours", "Combat: monstre 1 (database)", "Combat: monstre 2 (database)", "Combat: monstre 3 (database)", "Combat: monstre 4 (database)"];

export const COMBAT_SWITCHES: string[] = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Combat: fuite L+R armee", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Combat termine (reserve moteur)"];
