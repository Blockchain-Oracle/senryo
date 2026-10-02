# Senryo sounds

Original cues generated on 2026-10-02 with ElevenLabs text-to-sound-effects (`eleven_text_to_sound_v2`,
`prompt_influence` 0.6) from Senryo's own prompts (`variants/PROMPTS.tsv`) — no Apple/system recordings, no third-party
samples. Each was trimmed of leading/trailing silence, given a 40 ms fade-out and loudness-normalised (ffmpeg `loudnorm`
I=-20 LUFS, TP=-2 dB, LRA=7), mono 44.1 kHz 16-bit WAV.

| Cue | Used for | Default |
|---|---|---|
| `scene` | each settled welcome scene (soft swipe) | variant 2 |
| `onboarding` | welcome / setup complete | variant 3 |
| `fill` | a trade filled (finalized) | variant 1 |
| `deposit` | money arrived (finalized) | variant 1 |
| `send` | money sent (finalized) | variant 1 |
| `unlock` | signed in / unlocked | variant 3 |
| `liquidation` | liquidation warning / event | variant 2 |
| `error` | a failed action | variant 2 |

Defaults were picked from spectrograms (tonal clarity, attack, length) because the author couldn't listen; the user
chooses by ear in Preferences → Sounds (`app/account/sounds.tsx`), stored per device (`STORAGE_KEYS.soundChoice`).
All three variants per cue live in `variants/`; unused ones are removed before the code freeze.

Playback (feedback/sound.ts): follows the ringer switch (`playsInSilentMode: false`), mixes with other audio, never
plays in the background, once per finalized outcome (D-235). On-device loudness acceptance is pending.
