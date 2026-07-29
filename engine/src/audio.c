/*
 * audio.c — musique par scène + sons scriptés via snesmod (PVSnesLib).
 *
 * Le soundbank est généré par smconv depuis les .it copiés par datagen
 * (src/data/music/, ordre = music_id) et épinglé en bank $87 (kit §3).
 * AUDIO_ENABLED vient de datagen : un projet sans musique compile sans
 * soundbank ni référence au symbole SOUNDBANK__.
 *
 * Sons (B1) : échantillons BRR 8 kHz de data_sfx.c (module sfx de
 * datagen, toujours émis). La région d'effets du SPC est dimensionnée
 * sur le PLUS GROS son (SFX_REGION pages de 256 octets) : chaque
 * spcPlaySound y recharge le sien (modèle PVSnesLib, exemple tada).
 * spcAllocateSoundRegion COUPE le module en cours — appelé au BOOT
 * uniquement, avant la première musique.
 */
#include <snes.h>
#include "formats.h"
#include "audio.h"
#include "data/audio_cfg.h"

#if AUDIO_ENABLED
extern char SOUNDBANK__;
#endif

#if SFX_COUNT
extern const u8 *const sfx_ptr[];
extern const u16 sfx_len[];
static brrsamples sfx_tab[SFX_COUNT];
#endif

static u8 current_music;

void audio_init(void)
{
#if SFX_COUNT
  u8 i;
#endif

  current_music = MUSIC_NONE;
#if AUDIO_ENABLED || SFX_COUNT
  spcBoot(); /* les sons BRR ont besoin du SPC même sans musique */
#endif
#if AUDIO_ENABLED
  spcSetBank(&SOUNDBANK__);
#endif
#if SFX_COUNT
  spcAllocateSoundRegion(SFX_REGION);
  /* PIÈGE (lu dans snesmodwla.asm/sounds.asm) : spcSetSoundEntry fait
     pointer la table SPC sur la DERNIÈRE structure passée, et
     spcPlaySound(i) lit l'entrée à « dernière + i x 8 » (en AVANT
     dans la mémoire). Les entrées vivent donc dans un TABLEAU CONTIGU
     (brrsamples = 8 octets pile) chargé À REBOURS : le dernier appel
     pose sfx_tab[0] -> spcPlaySound(sfx_id) indexe le projet tel
     quel. Charger à l'endroit jouait des entrées HORS TABLEAU. */
  for (i = SFX_COUNT; i != 0; i--)
    spcSetSoundEntry(15, 8, 4, sfx_len[i - 1], (u8 *)sfx_ptr[i - 1],
                     &sfx_tab[i - 1]);
#endif
}

void audio_play_sfx(u8 sfx_id)
{
#if SFX_COUNT
  if (sfx_id < SFX_COUNT)
    spcPlaySound(sfx_id); /* index direct — cf le chargement à rebours */
#else
  (void)sfx_id;
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
