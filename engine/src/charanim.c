/*
 * charanim.c — the custom charset animation player (CH3).
 * Contract and table layout in charanim.h.
 */
#include <snes.h>
#include "charanim.h"
#include "scene.h"
#include "actors.h"
#include "player.h"

#define CA_TARGETS 25 /* actor slots 0-23 + the hero (CA_HERO) */

#define CA_END_NORMAL 0
#define CA_END_LOOP 1
#define CA_END_HOLD 2

/* All explicitly initialised — .bss is garbage (ENGINE_CONSTRAINTS
   1.2); chanim_init rewrites everything at scene load anyway. */
static u16 ca_ofs[CA_TARGETS]; /* table offset, 0xFFFF = inactive */
static u8 ca_pos[CA_TARGETS];  /* current step */
static u8 ca_t[CA_TARGETS];    /* frames left in the current step */
static u8 ca_run[CA_TARGETS];  /* 0 once a `hold` reached its last step */
static u8 ca_n = 0;            /* active count: the idle fast path */

/* The target's table, resolved through the scene's script block. */
static const u8 *ca_table(u8 i)
{
  return scene_ctx.scripts + ca_ofs[i];
}

/* Shows step `pos` on the target: the override pair, plus the frame
   cache invalidation the draw paths key on. */
static void ca_apply(u8 i)
{
  const u8 *t = ca_table(i);
  const u8 *s = t + 2 + (ca_pos[i] << 1) + ca_pos[i]; /* pos*3, no mul */

  if (i == CA_HERO)
  {
    player_frame_ovr(s[0], s[1]);
  }
  else
  {
    actor_fovr[i] = s[0];
    actor_povr[i] = s[1];
    actor_lastf[i] = 0xFF; /* same frame, other palette: recompute */
  }
  ca_t[i] = s[2];
  if (ca_t[i] == 0)
    ca_t[i] = 1; /* a zero duration would tick 0 -> 255 */
}

static void ca_clear(u8 i)
{
  if (ca_ofs[i] == 0xFFFF)
    return;
  ca_ofs[i] = 0xFFFF;
  if (ca_n)
    ca_n--;
  if (i == CA_HERO)
  {
    player_frame_ovr_clear();
  }
  else
  {
    actor_fovr[i] = 0xFF;
    actor_lastf[i] = 0xFF;
  }
}

void chanim_play(u8 target, u16 ofs)
{
  if (target >= CA_TARGETS)
    return;
  if (ca_ofs[target] == 0xFFFF)
    ca_n++;
  ca_ofs[target] = ofs;
  ca_pos[target] = 0;
  ca_run[target] = 1;
  ca_apply(target);
}

void chanim_stop(u8 target)
{
  if (target >= CA_TARGETS)
    return;
  ca_clear(target);
}

void chanim_init(void)
{
  u8 i;

  for (i = 0; i < CA_TARGETS; i++)
  {
    ca_ofs[i] = 0xFFFF;
    ca_pos[i] = 0;
    ca_t[i] = 0;
    ca_run[i] = 0;
  }
  ca_n = 0;
  player_frame_ovr_clear();
  /* the actor overrides are reset by actors_init's own loop */
}

u8 chanim_busy(void)
{
  u8 i;

  if (!ca_n)
    return 0;
  for (i = 0; i < CA_TARGETS; i++)
  {
    if (ca_ofs[i] == 0xFFFF || !ca_run[i])
      continue; /* inactive, or a hold frozen on its last step */
    if (ca_table(i)[1] != CA_END_LOOP)
      return 1;
  }
  return 0;
}

void chanim_update(void)
{
  u8 i, count, end;

  if (!ca_n)
    return;
  for (i = 0; i < CA_TARGETS; i++)
  {
    if (ca_ofs[i] == 0xFFFF || !ca_run[i])
      continue;
    ca_t[i]--;
    if (ca_t[i])
      continue;
    count = ca_table(i)[0];
    end = ca_table(i)[1];
    ca_pos[i]++;
    if (ca_pos[i] >= count)
    {
      if (end == CA_END_LOOP)
      {
        ca_pos[i] = 0;
        ca_apply(i);
      }
      else if (end == CA_END_HOLD)
      {
        ca_run[i] = 0; /* freeze on the last step, keep the override */
      }
      else
      {
        ca_clear(i); /* back to the walk */
      }
    }
    else
    {
      ca_apply(i);
    }
  }
}
