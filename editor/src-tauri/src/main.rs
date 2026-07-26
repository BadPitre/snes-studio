// Empêche la console Windows en release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    snes_studio_editor_lib::run()
}
