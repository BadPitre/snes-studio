/*
 * audio.h — musique par scène (snesmod / bank $87, kit §3).
 */
#ifndef AUDIO_H
#define AUDIO_H

#include <snes.h>

#define MUSIC_NONE 0xFF

/* Boot du SPC700 + soundbank. À appeler tôt (spcBoot prend du temps),
   avant l'init vidéo. Sans musique dans le projet, ne fait rien. */
void audio_init(void);

/* Joue la musique music_id (index soundbank) ; MUSIC_NONE = silence.
   Sans effet si c'est déjà la musique courante. */
void audio_play_music(u8 music_id);

/* Joue le son sfx_id (B1) : échantillon BRR de data_sfx.c, chargé dans
   la région d'effets du SPC puis joué — se superpose à la musique.
   Id hors bornes : ignoré. */
void audio_play_sfx(u8 sfx_id);

/* Alimente le flux SPC — à appeler chaque frame avant WaitForVBlank(). */
void audio_process(void);

#endif /* AUDIO_H */
