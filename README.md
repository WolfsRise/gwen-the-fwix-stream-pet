# Gwen the Fwix — PS5 Twitch overlay

Voice-reactive stream pet for Gwen's Twitch broadcasts from PlayStation 5 through Lightstream.

## Current baseline

- The **Midnight Grove** gameplay layout combines the warm woodland frame, aqua/purple neon, the custom chat skin, and Gwen's moonlit avatar alcove.
- Crystals pulse independently, plants sway subtly, and the frame ears and tail twitch on occasional unsynchronized beats.
- The gameplay layout deliberately has no camera window; Gwen is the on-stream camera replacement.
- Gwen idles with subtle whole-body and tail motion and reacts to controller voice energy.
- The Chrome controller analyzes microphone volume locally and sends only a normalized energy value.
- The rejected temporary mouth overlay is disabled. Canonical closed, conversational, and emphasized mouth frames will replace it in a reviewed revision.
- The repository is the source of truth for canon corrections, accessories, and version history.

This is a zero-build static overlay with two URLs:

- `?mode=overlay&layout=gameplay&room=YOUR-PRIVATE-CODE` — full 1280×720 Lightstream gameplay skin.
- `?mode=overlay&layout=pet&room=YOUR-PRIVATE-CODE` — pet-only fallback.
- `?mode=controller&room=YOUR-PRIVATE-CODE` — keep this open in Chrome and allow microphone access.

The microphone is analyzed locally in the controller tab. Only normalized volume values are sent to the overlay through an encrypted WebRTC data channel; audio is never recorded or transmitted by this project.

## GitHub Pages deployment

The published site lives at `https://wolfsrise.github.io/gwen-the-fwix-stream-pet/`.

1. Open the controller URL, choose a long private room code, and press **Connect**.
2. Copy the displayed overlay URL.
3. In Lightstream, add **3rd Party Integrations → Browser Source** and paste the displayed gameplay overlay URL.
4. Set the browser-source canvas to `1280 × 720` and fit it to the entire Lightstream scene.
5. Keep the controller tab open while streaming. Enable its microphone and tune sensitivity.

Your PS5 headset can remain the broadcast microphone. Do not add the Chrome microphone as a second Lightstream audio source unless you intentionally want it on-air.

## Reliability note

The quick-start version uses PeerJS's public signaling service. It is suitable for a first-stream setup, but a private signaling relay is recommended for long-term production reliability.
