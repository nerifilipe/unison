# Demo audio provenance

All three tracks are original synthetic test signals created for this repository by `scripts/generate-demo-audio.sh`. Artist “Unison Lab” is a demo label. Titles and artwork are original demo content; no real artist affiliation is implied.

| Track | Oscillator frequencies (Hz) | Duration |
| --- | --- | --- |
| First Light | 261.63, 329.63, 392.00 | 60 seconds |
| Slow Orbit | 220.00, 261.63, 329.63 | 60 seconds |
| Tidal | 174.61, 220.00, 261.63 | 60 seconds |

FFmpeg combines sine waves with slow amplitude modulation and fade-in/fade-out. The output is stereo PCM WAV at 44,100 Hz, 16-bit. There are no downloaded songs, third-party samples, voices, recordings or performances. The generation code and generated demo audio are provided under this repository's MIT license. The cover art is CSS geometry created for this project.

`docker compose build audio-seed` generates the assets. `docker compose run --rm audio-seed` uploads them to the local `demo` bucket. Generation is repeatable for a fixed FFmpeg version; FFmpeg is supplied by Debian Bookworm and package patch updates can change encoded metadata. Byte-identical output across arbitrary image rebuild dates is not guaranteed.

Only this demo bucket is anonymously readable; writing requires local storage credentials. This is a local demo policy, not the planned policy for user uploads. No user uploads are implemented.
