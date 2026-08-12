// snesphoto — run a ROM headless in a libretro core for N frames, then
// photograph it: the full savestate (retro_serialize) plus the screen
// as PPM. The editor mines the savestate for VRAM, CGRAM, OAM and the
// APU (docs/PLANNING_PHOTO_ROM.md, X6).
//
// Why this exists next to tools/regress/harness.c, which does almost
// the same thing: the harness is the REGRESSION tool — C, compiled by
// regress.sh with cc, deliberately untouched by editor concerns. This
// one is the EDITOR's hands, shipped as a Tauri sidecar like datagen
// and snesbuild, so it has to build wherever cargo builds — including
// Windows, where dlopen does not exist. libloading is that difference.
//
// The core stays STOCK (the regress README promises users a plain
// snes9x_libretro from RetroArch): everything is read through the
// standard libretro API, nothing through private patches.
//
//   snesphoto <core> <rom> <frames> <out_dir> [--start <frame>]
//
// Writes <out_dir>/photo.state and <out_dir>/photo.ppm.

use anyhow::{bail, Context, Result};
use libloading::Library;
use std::ffi::{c_char, c_uint, c_void, CString};
use std::io::Write;

// ---- the slice of libretro.h this needs ------------------------------

const ENV_GET_CAN_DUPE: c_uint = 3;
const ENV_GET_SYSTEM_DIRECTORY: c_uint = 9;
const ENV_SET_PIXEL_FORMAT: c_uint = 10;
const ENV_GET_SAVE_DIRECTORY: c_uint = 31;

const PIXFMT_0RGB1555: c_uint = 0;
const PIXFMT_RGB565: c_uint = 2;

const DEVICE_JOYPAD: c_uint = 1;
const JOYPAD_START: c_uint = 3;

#[repr(C)]
struct GameInfo {
    path: *const c_char,
    data: *const c_void,
    size: usize,
    meta: *const c_char,
}

// ---- state shared with the C callbacks -------------------------------
//
// libretro is a single-threaded callback API: the core calls back into
// us from inside retro_run. Plain statics, no locking — same shape as
// the harness.

static mut FRAME: Vec<u16> = Vec::new();
static mut FRAME_W: usize = 0;
static mut FRAME_H: usize = 0;
static mut PIXFMT: c_uint = PIXFMT_0RGB1555;
static mut PAD: u32 = 0;
static DOT: &[u8] = b".\0";

unsafe extern "C" fn env_cb(cmd: c_uint, data: *mut c_void) -> bool {
    match cmd {
        ENV_SET_PIXEL_FORMAT => {
            PIXFMT = *(data as *const c_uint);
            true
        }
        ENV_GET_SYSTEM_DIRECTORY | ENV_GET_SAVE_DIRECTORY => {
            *(data as *mut *const c_char) = DOT.as_ptr() as *const c_char;
            true
        }
        ENV_GET_CAN_DUPE => {
            *(data as *mut bool) = true;
            true
        }
        _ => false,
    }
}

unsafe extern "C" fn video_cb(data: *const c_void, w: c_uint, h: c_uint, pitch: usize) {
    if data.is_null() {
        return;
    }
    FRAME_W = w as usize;
    FRAME_H = h as usize;
    FRAME.resize(FRAME_W * FRAME_H, 0);
    for y in 0..FRAME_H {
        let row = (data as *const u8).add(y * pitch) as *const u16;
        std::ptr::copy_nonoverlapping(row, FRAME.as_mut_ptr().add(y * FRAME_W), FRAME_W);
    }
}

unsafe extern "C" fn audio_cb(_l: i16, _r: i16) {}
unsafe extern "C" fn audio_batch_cb(_d: *const i16, frames: usize) -> usize {
    frames
}
unsafe extern "C" fn input_poll_cb() {}
unsafe extern "C" fn input_state_cb(port: c_uint, device: c_uint, _index: c_uint, id: c_uint) -> i16 {
    if port == 0 && device == DEVICE_JOYPAD {
        unsafe { ((PAD >> id) & 1) as i16 }
    } else {
        0
    }
}

// One pixel to 8-bit RGB, honouring the format the core declared.
fn rgb(px: u16, fmt: c_uint) -> (u8, u8, u8) {
    let e5 = |v: u16| ((v << 3) | (v >> 2)) as u8;
    if fmt == PIXFMT_RGB565 {
        let g6 = ((px >> 5) & 63) as u8;
        (e5(px >> 11 & 31), (g6 << 2) | (g6 >> 4), e5(px & 31))
    } else {
        (e5(px >> 10 & 31), e5((px >> 5) & 31), e5(px & 31))
    }
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 5 {
        bail!("usage: snesphoto <core> <rom> <frames> <out_dir> [--start <frame>]");
    }
    let frames: u32 = args[3].parse().context("frames: un entier attendu")?;
    let out_dir = std::path::Path::new(&args[4]);
    std::fs::create_dir_all(out_dir)?;
    let start_at: Option<u32> = args
        .iter()
        .position(|a| a == "--start")
        .and_then(|i| args.get(i + 1))
        .and_then(|v| v.parse().ok());

    let rom = std::fs::read(&args[2]).with_context(|| format!("ROM illisible : {}", args[2]))?;

    unsafe {
        let lib = Library::new(&args[1])
            .with_context(|| format!("core libretro illisible : {}", args[1]))?;
        macro_rules! sym {
            ($name:literal, $ty:ty) => {
                *lib.get::<$ty>($name).context(concat!("symbole absent : ", stringify!($name)))?
            };
        }
        let set_environment = sym!(b"retro_set_environment", unsafe extern "C" fn(unsafe extern "C" fn(c_uint, *mut c_void) -> bool));
        let set_video = sym!(b"retro_set_video_refresh", unsafe extern "C" fn(unsafe extern "C" fn(*const c_void, c_uint, c_uint, usize)));
        let set_audio = sym!(b"retro_set_audio_sample", unsafe extern "C" fn(unsafe extern "C" fn(i16, i16)));
        let set_audio_batch = sym!(b"retro_set_audio_sample_batch", unsafe extern "C" fn(unsafe extern "C" fn(*const i16, usize) -> usize));
        let set_input_poll = sym!(b"retro_set_input_poll", unsafe extern "C" fn(unsafe extern "C" fn()));
        let set_input_state = sym!(b"retro_set_input_state", unsafe extern "C" fn(unsafe extern "C" fn(c_uint, c_uint, c_uint, c_uint) -> i16));
        let init = sym!(b"retro_init", unsafe extern "C" fn());
        let load_game = sym!(b"retro_load_game", unsafe extern "C" fn(*const GameInfo) -> bool);
        let run = sym!(b"retro_run", unsafe extern "C" fn());
        let serialize_size = sym!(b"retro_serialize_size", unsafe extern "C" fn() -> usize);
        let serialize = sym!(b"retro_serialize", unsafe extern "C" fn(*mut c_void, usize) -> bool);

        set_environment(env_cb);
        set_video(video_cb);
        set_audio(audio_cb);
        set_audio_batch(audio_batch_cb);
        set_input_poll(input_poll_cb);
        set_input_state(input_state_cb);
        init();

        let path = CString::new(args[2].as_str())?;
        let gi = GameInfo {
            path: path.as_ptr(),
            data: rom.as_ptr() as *const c_void,
            size: rom.len(),
            meta: std::ptr::null(),
        };
        if !load_game(&gi) {
            bail!("le core a refusé la ROM");
        }

        for i in 0..frames {
            // A press is a press, not a tap: held ~a quarter second so
            // even a title that polls lazily sees it.
            PAD = match start_at {
                Some(f) if i >= f && i < f + 15 => 1 << JOYPAD_START,
                _ => 0,
            };
            run();
        }

        let size = serialize_size();
        if size == 0 {
            bail!("le core ne sait pas sérialiser son état");
        }
        let mut state = vec![0u8; size];
        if !serialize(state.as_mut_ptr() as *mut c_void, size) {
            bail!("retro_serialize a échoué");
        }
        std::fs::write(out_dir.join("photo.state"), &state)?;
        println!("state: {} octets", size);

        let mut ppm = Vec::with_capacity(FRAME_W * FRAME_H * 3 + 32);
        write!(ppm, "P6\n{} {}\n255\n", FRAME_W, FRAME_H)?;
        for px in FRAME.iter() {
            let (r, g, b) = rgb(*px, PIXFMT);
            ppm.extend_from_slice(&[r, g, b]);
        }
        std::fs::write(out_dir.join("photo.ppm"), &ppm)?;
        println!("ecran: {}x{}", FRAME_W, FRAME_H);
    }
    println!("ok");
    Ok(())
}
