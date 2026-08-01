// Migration F1-c — les fonctions ont d'abord été des common events à
// paramètres, avant d'avoir leur propre liste. Un projet enregistré
// entre-temps porte ses fonctions au mauvais endroit ; les déplacer
// sans rien perdre, y compris les APPELS qui les visent.
//
// Le piège est là : les commandes stockent un INDEX, pas un nom. Sortir
// des entrées de common_events décale toutes celles qui restent, donc
// il ne suffit pas de déplacer les définitions — il faut réécrire les
// « call » ET les « call_fn » de tout le projet. Une migration qui
// oublierait ça appellerait silencieusement le mauvais script, ce qui
// est bien pire qu'une erreur franche.

import type { Command, CommonEvent, FunctionDef, ProjectData } from "./types";

function walk(cmds: Command[] | undefined, fn: (c: Command) => void): void {
  for (const c of cmds ?? []) {
    fn(c);
    const any = c as unknown as Record<string, Command[] | undefined>;
    walk(any.do, fn);
    walk(any.then, fn);
    walk(any.else, fn);
    const opts = (c as unknown as { options?: { do?: Command[] }[] }).options;
    for (const o of opts ?? []) walk(o.do, fn);
  }
}

export function migrateFunctions(d: ProjectData): ProjectData {
  const commons = (d.project.common_events ?? []) as (CommonEvent & {
    params?: string[];
    returns?: boolean;
  })[];
  const isFn = (ce: (typeof commons)[number]) =>
    (ce.params?.length ?? 0) > 0 || !!ce.returns;
  if (!commons.some(isFn)) return d;

  const keptCommons: CommonEvent[] = [];
  const moved: FunctionDef[] = [];
  const ceMap = new Map<number, number>(); // ancien index -> nouvel index
  const fnMap = new Map<number, number>();
  commons.forEach((ce, i) => {
    if (isFn(ce)) {
      fnMap.set(i, moved.length);
      moved.push({
        name: ce.name,
        params: ce.params ?? [],
        returns: !!ce.returns,
        commands: ce.commands,
      });
    } else {
      ceMap.set(i, keptCommons.length);
      keptCommons.push({
        name: ce.name,
        trigger: ce.trigger,
        switch: ce.switch,
        commands: ce.commands,
      });
    }
  });
  // les fonctions déjà présentes gardent leurs index, les déplacées
  // s'ajoutent derrière
  const existing = d.project.functions ?? [];
  const shift = existing.length;
  const functions = [...existing, ...moved];

  const fix = (c: Command) => {
    const any = c as unknown as { c: string; n?: number };
    if (any.c === "call" && any.n !== undefined) {
      const to = ceMap.get(any.n);
      // un « call » qui visait une fonction devient un « call_fn » sans
      // arguments : datagen le refusera avec un message clair, ce qui
      // vaut mieux qu'un appel muet vers le mauvais script
      if (to !== undefined) any.n = to;
      else {
        const f = fnMap.get(any.n);
        if (f !== undefined) {
          (any as unknown as { c: string; args: unknown[] }).c = "call_fn";
          (any as unknown as { args: unknown[] }).args = [];
          any.n = shift + f;
        }
      }
    } else if (any.c === "call_fn" && any.n !== undefined) {
      const f = fnMap.get(any.n);
      if (f !== undefined) any.n = shift + f;
    }
  };

  for (const sc of Object.values(d.scenes)) {
    for (const ev of sc.events ?? []) {
      const pages = (ev as unknown as { pages?: { commands?: Command[] }[] }).pages;
      if (pages) for (const p of pages) walk(p.commands, fix);
      walk((ev as unknown as { commands?: Command[] }).commands, fix);
    }
  }
  for (const ce of keptCommons) walk(ce.commands, fix);
  for (const f of functions) walk(f.commands, fix);

  return {
    ...d,
    project: {
      ...d.project,
      common_events: keptCommons.length ? keptCommons : undefined,
      functions: functions.length ? functions : undefined,
    },
  };
}
