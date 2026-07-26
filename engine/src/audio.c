/*
 * audio.c — musique par scène via snesmod (PVSnesLib).
 *
 * Le soundbank est généré par smconv depuis les .it copiés par datagen
 * (src/data/music/, ordre = music_id) et épinglé en bank $87 (kit §3).
 * AUDIO_ENABLED vient de datagen : un projet sans musique compile sans
 * soundbank ni référence au symbole SOUNDBANK__.
 */
#include <snes.h>
#include "formats.h"
#include "audio.h"
#include "data/audio_cfg.h"

#if AUDIO_ENABLED
extern char SOUNDBANK__;
#endif

static u8 current_music;

void audio_init(void)
{
  current_music = MUSIC_NONE;
#if AUDIO_ENABLED
  spcBoot();
  spcSetBank(&SOUNDBANK__);
#endif
}

void audio_play_music(u8 music_id)
{
  if (music_id == current_music)
    return;
#if AUDIO_ENABLED
  if (current_music != MUSIC_NONE)
    spcStop();
  if (music_id != MUSIC_NONE)
  {
    spcLoad(music_id);
    spcPlay(0);
  }
#endif
  current_music = music_id;
}

void audio_process(void)
{
#if AUDIO_ENABLED
  spcProcess();
#endif
}
