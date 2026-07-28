/*
 * FICHIER GENERE par tools/datagen — NE PAS EDITER A LA MAIN.
 * Source : demo/ (projet JSON/PNG). Regenerer : make data (ou cargo run).
 */
#include <snes.h>
#include "db_tables.h"

const u8 *const db_tables[] = {
  db_items,
  db_stats,
};
const u8 db_table_sizes[] = {
  6, 7,
};
const u8 db_table_counts[] = {
  2, 2,
};
