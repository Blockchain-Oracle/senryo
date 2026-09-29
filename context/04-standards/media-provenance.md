# Media Provenance That Survives Re-encoding

> Last researched: 2026-09-28. Track example: "Provenance for generated media that survives re-encoding".

## Overview

The core problem: **cryptographic provenance (C2PA manifests, file hashes, signatures) is destroyed by re-encoding, screenshots, resizing, or social-media metadata stripping.** Durable provenance needs three layers ("durable Content Credentials"):

1. **Hard binding** — C2PA manifest cryptographically bound to exact bytes (SHA-256). Strongest, most brittle.
2. **Soft binding: invisible watermark** — a short ID embedded in pixels/audio that survives JPEG, resize, crop (to a degree). Used to *find* the manifest again.
3. **Soft binding: perceptual fingerprint** — pHash/PDQ/video TMK computed from content; near-duplicate lookup even with no watermark.

The chain (Monad) is the **public, tamper-evident lookup table**: watermark ID / fingerprint → manifest hash, creator identity (passkey / ERC-8004 agent), model, timestamp.

## How it works

### C2PA / Content Credentials
- Spec by C2PA (c2pa-org/specifications, v2.x). A **manifest** (JUMBF box embedded in JPEG/PNG/MP4/WAV/PDF etc., or sidecar/remote) contains **assertions** (actions like `c2pa.created` with `digitalSourceType = trainedAlgorithmicMedia` for AI, ingredients, `c2pa.hash.data` hard binding, `c2pa.soft-binding`), a **claim**, and a **COSE signature** with an X.509 cert.
- Validation checks signature + trust list + hash of asset bytes. Re-encode ⇒ hash mismatch ⇒ manifest invalid or stripped entirely.
- **Soft-binding assertion** records the watermark/fingerprint algorithm + value; the **Soft Binding Resolution API** lets a verifier query a manifest repository by watermark/fingerprint to recover the original manifest. An onchain registry on Monad can play the role of that repository.

### Watermarks (soft binding)

| Tool | Media | Payload | Robustness | License / pkg |
|---|---|---|---|---|
| **TrustMark** (Adobe; ICCV 2025) | Images, arbitrary resolution | 100 bits (with BCH ECC schemas: BCH_SUPER, BCH_5, BCH_4, BCH_3) | JPEG, resize, moderate crop; also supports watermark **removal** (for re-watermarking) | MIT; `pip install trustmark`; variants Q (quality), P (perceptual/robust), B, C |
| **Meta Video Seal / Audio Seal** | Video / audio | 96-bit (VideoSeal), 16-bit msg (AudioSeal) | Designed for compression/re-encode (unverified specifics) | `facebookresearch/videoseal`, `facebookresearch/audioseal` |
| **Google SynthID** | Text open-sourced (HF Transformers); image/audio via Google APIs | — | — | SynthID Text only open |
| `invisible-watermark` (DWT-DCT) | Images | small | **Weak** against re-encoding — avoid as sole mechanism | pip `invisible-watermark` |
| Digimarc, Steg.AI | Commercial | — | Strong | Paid |

### Perceptual hashes (fingerprints)

| Hash | Size | Match | Notes |
|---|---|---|---|
| **PDQ** (Meta) | 256-bit | Hamming distance; Meta suggests ≤ ~31 as match | Robust to resize/JPEG; open (`facebook/ThreatExchange/pdq`); Python `pdqhash` |
| **TMK+PDQF** (Meta) | video | frame-level PDQ + temporal | In ThreatExchange repo |
| **pHash / dHash / aHash** | 64-bit | Hamming ≤ ~8–10 | Python `imagehash`; simple; weaker vs crops |
| Chromaprint | audio | — | AcoustID |
| **ISCC** (ISO 24138:2024) | composite content code | similarity-preserving | Standard content identifier; nice onchain key (unverified library status) |

Fingerprints are **not secret** and collide adversarially (NeuralHash lesson) — use them for lookup, confirm with watermark and/or signature.

## Code

### Python: watermark + fingerprint a generated image

```python
# pip install trustmark pillow pdqhash imagehash numpy
from trustmark import TrustMark
from PIL import Image
import numpy as np, pdqhash, imagehash, hashlib, secrets

tm = TrustMark(verbose=False, model_type='P')         # 'Q' higher quality, 'P' more robust

img = Image.open("gen.png").convert("RGB")
wm_id = secrets.token_hex(8)                          # ≤ payload capacity; or use a bitstring schema
stego = tm.encode(img, wm_id)                         # embed ID
stego.save("gen_wm.jpg", quality=90)

pdq_bits, quality = pdqhash.compute(np.array(stego))  # 256 bools
pdq_hex = np.packbits(pdq_bits.astype(np.uint8)).tobytes().hex()
phash = str(imagehash.phash(stego))
sha = hashlib.sha256(open("gen_wm.jpg","rb").read()).hexdigest()

# After re-encoding / screenshot:
rec = Image.open("screenshot.jpg").convert("RGB")
secret, present, schema = tm.decode(rec)              # -> wm_id if survived
```
(TrustMark API from the official README: `TrustMark(model_type=...)`, `encode(cover, secret)`, `decode(img) -> (secret, present, schema)`, `remove_watermark(img)`. Payload capacity for string mode depends on schema — check `python/CONFIG.md`.)

### TypeScript: read C2PA in the browser (`@contentauth/c2pa-web` v0.15.x)

```ts
import { createC2pa, Reader } from "@contentauth/c2pa-web";
import wasmSrc from "@contentauth/c2pa-web/resources/c2pa.wasm?url";

const c2pa = await createC2pa({ wasmSrc });
const reader = await Reader.fromBlob(c2pa, file.type, file);   // throws/empty if no manifest
const store = await reader.manifestStore();                    // active manifest, assertions, validation status
await reader.free();
```
Signing: `c2pa-python` (`pip install c2pa-python`, `Builder` + signer; see `examples/sign.py`), `c2pa-rs` (Rust; CLI `c2patool`), `c2pa-node` in `contentauth/c2pa-js/packages/c2pa-node` (the older `c2pa-node-v2` repo is archived). Dev certs are fine for a hackathon but won't be on the C2PA trust list.

### Solidity: provenance registry on Monad

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ProvenanceRegistry {
    struct Record {
        address creator;        // passkey smart account, Mera EOA, or ERC-8004 agentWallet
        uint256 agentId;        // optional ERC-8004 agent that generated it (0 = human)
        bytes32 contentSha256;  // hard binding of the original file
        bytes32 manifestHash;   // hash of C2PA manifest (stored on IPFS)
        bytes32 pdq;            // 256-bit PDQ fingerprint
        uint64  timestamp;
        string  manifestURI;    // ipfs://...
    }
    mapping(bytes16 => Record) public byWatermark;   // TrustMark ID (≤100 bits fits in bytes16)
    event Registered(bytes16 indexed wmId, address indexed creator, uint256 indexed agentId, bytes32 pdq, bytes32 contentSha256);

    function register(bytes16 wmId, Record calldata r) external {
        require(byWatermark[wmId].creator == address(0), "taken");
        require(r.creator == msg.sender, "creator");
        byWatermark[wmId] = r;
        byWatermark[wmId].timestamp = uint64(block.timestamp);
        emit Registered(wmId, msg.sender, r.agentId, r.pdq, r.contentSha256);
    }

    /// Verify a single candidate fingerprint on-chain (nearest-neighbour search stays off-chain in an indexer).
    function pdqDistance(bytes32 a, bytes32 b) public pure returns (uint256 d) {
        uint256 x = uint256(a ^ b);
        while (x != 0) { x &= x - 1; unchecked { ++d; } }
    }
    function matches(bytes16 wmId, bytes32 pdq, uint256 threshold) external view returns (bool) {
        return pdqDistance(byWatermark[wmId].pdq, pdq) <= threshold;
    }
}
```

Flow: generate → C2PA sign (assertion `digitalSourceType: trainedAlgorithmicMedia`, soft-binding assertion with TrustMark ID + PDQ) → watermark → pin manifest to IPFS → `register` on Monad (signed by passkey or agent) → verifier: try C2PA; if stripped, decode watermark → registry lookup; if no watermark, PDQ → indexer nearest-neighbour → `matches()` onchain.

## Monad specifics

- Cheap writes + 300 ms blocks → register **every** generation in real time (e.g., per image from an AI app), not batches.
- 256-bit PDQ fits one `bytes32` slot; Hamming distance via popcount loop is cheap for single comparisons.
- Creator identity: **Mera passkey EOAs** or **P256 smart accounts** (precompile `0x0100`) for human creators; **ERC-8004 agentId** for AI generators — reputation of the generator agent becomes provenance signal.
- No C2PA/watermark infra is Monad-native; you'd be first-mover (unverified that nothing exists).
- Consider x402 to monetize verification API or licensed downloads.

## Hackathon project ideas

1. **"Survives the screenshot" verifier** — browser extension/web app: drop any image → C2PA check → TrustMark decode → Monad registry → PDQ fallback. Demo: generate with Qwen/Hunyuan image model, re-encode through WhatsApp/Twitter, still verified.
2. **AI agent provenance stamping** — ERC-8004-registered image-gen agents auto-register outputs; reputation of generator + validation (TEE attestation of the model run).
3. **Soft Binding Resolution API backed by Monad** — implement C2PA's resolution API with Monad as the manifest index.
4. **Creator royalties across reposts** — watermark ID → payout address; x402 license purchase.
5. **Deepfake dispute registry** — attestations "this is NOT from X" with passkey-signed claims.

## Gotchas

- Watermarks can be **removed** (TrustMark itself ships removal) or **forged** by anyone with the model — treat watermark as pointer, not proof; proof = signature by known key over content hash/fingerprint.
- Heavy crops, rotations, and generative "re-imagining" defeat both watermarks and PDQ.
- Perceptual hashes are adversarially collidable; require multiple signals.
- C2PA trust: self-signed/dev certs show as "untrusted" in verify tools.
- Onchain nearest-neighbour search over many fingerprints is infeasible — index offchain (BK-tree / FAISS / Postgres + bit ops) and only verify onchain.
- Store manifests on IPFS/Arweave; onchain only hashes + URIs.
- Video: re-encoding changes frame timing; use frame-sampled PDQ (TMK) + VideoSeal (verify robustness claims yourself).

## Sources

- https://c2pa.org , https://github.com/c2pa-org/specifications , https://spec.c2pa.org
- https://contentauthenticity.org , https://opensource.contentauthenticity.org
- https://github.com/contentauth/c2pa-rs , https://github.com/contentauth/c2pa-js (packages: c2pa-web, c2pa-node, c2pa-wasm, c2pa-types) , https://github.com/contentauth/c2pa-python
- https://github.com/adobe/trustmark (ICCV 2025 paper: https://collomosse.com/pubs/Bui-ICCV-2025.pdf)
- https://github.com/facebook/ThreatExchange (PDQ, TMK+PDQF)
- https://github.com/facebookresearch/videoseal , https://github.com/facebookresearch/audioseal (unverified details)
- https://pypi.org/project/ImageHash/ , https://pypi.org/project/pdqhash/
- https://iscc.codes (ISO 24138)
