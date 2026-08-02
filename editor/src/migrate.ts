// F1-c migration — functions were first common events with parameters,
// before they had a list of their own. A project saved in between
// carries its functions in the wrong place; moving them without losing
// anything, including the CALLS that target them.
//
// The trap is here: the commands store an INDEX, not a name. Taking
// entries out of common_events shifts every remaining one, so moving
// the definitions is not enough — the "call" AND "call_fn" commands of
// the whole project must be rewritten. A migration that forgot this
// would silently call the wrong script, which is far worse than a
// clean error.

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
  const ceMap = new Map<number, number>(); // old index -> new index
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
  // the functions already present keep their indices, the moved ones are
  // appended behind them
  const existing = d.project.functions ?? [];
  const shift = existing.length;
  const functions = [...existing, ...moved];

  const fix = (c: Command) => {
    const any = c as unknown as { c: string; n?: number };
    if (any.c === "call" && any.n !== undefined) {
      const to = ceMap.get(any.n);
      // a "call" that targeted a function becomes a "call_fn" with no
      // arguments: datagen will refuse it with a clear message, which
      // beats a silent call to the wrong script
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
