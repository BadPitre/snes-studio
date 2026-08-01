/*
 * audio.h — per-scene music (snesmod, bank $87).
 */
#ifndef AUDIO_H
#define AUDIO_H

#include <snes.h>

#define MUSIC_NONE 0xFF

/* Boots the SPC700 and the soundbank. Call it early — spcBoot takes a
   while — before video init. Does nothing without music in the project. */
void audio_init(void);

/* Plays music_id (a soundbank index); MUSIC_NONE is silence. No effect
   if it is already the current track. */
void audio_play_music(u8 music_id);

/* Plays sfx_id: a BRR sample from data_sfx.c, loaded into the SPC
   effect region and played over the music. An out-of-range id is
   ignored. */
void audio_play_sfx(u8 sfx_id);

/* Feeds the SPC stream — call every frame before WaitForVBlank(). */
void audio_process(void);

#endif /* AUDIO_H */
