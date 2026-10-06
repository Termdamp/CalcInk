# CalcInk Architecture & Decision Log

> Living document. Every non-trivial decision gets an entry. Newest entries go at the bottom.

## 1. System overview

(Paste the pipeline diagram from the planning notes here and keep it updated.)

## 2. Module boundaries

| Module        | Responsibility                            | May import                |
| ------------- | ----------------------------------------- | ------------------------- |
| `types.ts`    | Shared types, no runtime code             | nothing                   |
| `math`        | Tokenize / parse / evaluate               | `types`                   |
| `strokes`     | Stroke store, undo/redo, geometry         | `types`                   |
| `recognition` | Segmentation, preprocessing, worker client| `types`, `strokes`        |
| `workers`     | Worker entry points                       | `types`, `recognition`    |
| `canvas`      | Rendering + pointer input                 | `types`, `strokes`        |
| `ui`          | Toolbar, overlay, wiring                  | everything                |

## 3. Decision log

### Template

#### ADR-NNN: Title
- **Decision:** What we chose.
- **Alternatives:** What else we considered.
- **Why:** The reasoning, with trade-offs.
- **Revisit if:** What evidence would change our mind.

---

#### ADR-001: Vite + TypeScript (strict)
- **Decision:** Vite for dev/build, TypeScript with `strict` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- **Alternatives:** Webpack, Next.js, plain JS.
- **Why:** Fast HMR, first-class Web Worker and WASM asset handling, simple PWA plugin. Strict typing catches empty-array and missing-field bugs that are common in stroke and parser code.
- **Revisit if:** A required library is incompatible with the strict flags.

#### ADR-002: Strokes as data, not pixels
- **Decision:** `Stroke[]` in a store is the source of truth; the canvas is a derived view.
- **Alternatives:** Bitmap snapshots for undo; reading pixels back from the canvas.
- **Why:** Enables undo/redo, stroke eraser, HiDPI re-rendering, stroke-aware segmentation, and DOM-free tests.
- **Revisit if:** Re-rendering cost shows up in profiling (mitigate with a cached layer).

#### ADR-003: Pointer Events for input
- **Decision:** Pointer Events (with `getCoalescedEvents`, `touch-action: none`) for mouse, pen and touch.
- **Alternatives:** Separate mouse + touch handlers.
- **Why:** One code path for all devices, with pressure and pointer type included.

#### ADR-004: Recognition runs in a Web Worker via onnxruntime-web
- **Decision:** Segmentation, preprocessing and inference run in a dedicated worker; main thread only sends stroke data and receives symbols. Stale responses are dropped via request IDs.
- **Alternatives:** Main-thread inference; TensorFlow.js.
- **Why:** Hard 60 FPS requirement; ONNX gives us a wide choice of pre-trained models.
- **Revisit if:** Worker startup or message overhead dominates latency.

#### ADR-005: Vitest, separate config
- **Decision:** `vitest.config.ts` separate from `vite.config.ts`, `node` environment by default.
- **Why:** Tests don't load the PWA plugin; the logic modules are DOM-free so Node is faster.

#### ADR-006: Vanilla TypeScript canvas core
- **Decision:** No UI framework or drawing library in the canvas core.
- **Alternatives:** React + Konva, Fabric.js, tldraw.
- **Why:** Full control over the render loop and input latency; the concepts are the learning goal.

## 4. Open questions

- **OQ-1 Model choice:** MNIST covers digits only; we need operators and "=". Candidates: models trained on HASYv2 or CROHME-style symbols. Evaluate against a small labeled benchmark before committing (Phase 2).
- **OQ-2 Segmentation:** How do we group strokes into symbols (spatial overlap, time gap, both)?
- **OQ-3 Pixel eraser semantics:** Split strokes geometrically, or composite an erase mask?
- **OQ-4 Hosting:** Does the host allow COOP/COEP headers? (Needed for multithreaded WASM via SharedArrayBuffer; otherwise single-thread.)
- **OQ-5 PWA precache size:** Workbox's default per-file limit is 2 MiB, which is smaller than the ORT WASM binary. The limit needs raising and the model and WASM files need explicit caching.
#### ADR-007: Strokes in CSS pixels; DPR applied via setTransform
- **Decision:** Store all coordinates in CSS px. Size the bitmap as `round(css × dpr)` and apply `ctx.setTransform(dpr,0,0,dpr,0,0)` after every resize. Watch DPR with a re-arming `matchMedia(resolution)` listener.
- **Alternatives:** Store device pixels; `ctx.scale` (cumulative, error-prone).
- **Why:** Strokes stay valid across zoom/monitor changes; recognition geometry is device-independent.
- **Revisit if:** We need exact fractional-DPR fidelity (`devicePixelContentBoxSize`).

#### ADR-008: Full redraw per animation frame, coalesced
- **Decision:** Renderer redraws all strokes at most once per rAF; resize redraws synchronously.
- **Alternatives:** Layered canvases, dirty rectangles, incremental drawing.
- **Why:** Expression-sized scenes are tiny; simplicity wins until measured otherwise.
- **Revisit if:** Frame time with N strokes exceeds ~4 ms in DevTools.

#### ADR-009: Smoothing is display-only
- **Decision:** Quadratic Bézier through midpoints at render time; the store keeps raw (jitter-filtered) samples.
- **Why:** Recognition and hit-testing need true geometry; smoothing is a view concern.

#### ADR-010: Input heuristics (palm rejection, cancel semantics)
- **Decision:** Ignore touch for 1 s after pen activity and for contacts >40 px; a pen preempts an in-progress touch stroke; `pointercancel` discards the stroke. Record pressure for pens only.
- **Alternatives:** Accept all pointers; rely on OS palm rejection.
- **Why:** Hardware reporting varies widely; these rules are cheap and fail safe.
- **Revisit if:** Real-device testing shows false rejections.
#### ADR-011: Draft separate from the document store
- **Decision:** The in-progress stroke lives in a mutable `Draft`; `StrokeStore` holds only committed, frozen strokes and replaces its array on every change.
- **Alternatives:** One store with an "active stroke" field (Phase 1); fully persistent data structures.
- **Why:** Undo history, serialization and caching need immutable data; the hot path (a push per sample) needs mutability. Separating them gives both.

#### ADR-012: Two stacked canvases, on-demand rAF with dirty flags
- **Decision:** `#committed` repaints incrementally for pure appends and fully otherwise; `#live` repaints one stroke per frame. Frames are scheduled only when something is dirty.
- **Alternatives:** One canvas, full repaint per frame; permanent rAF loop; dirty rectangles.
- **Why:** Per-frame cost while drawing is independent of page content; an idle page does no work.
- **Revisit if:** Full committed repaints (undo, erase drags) exceed ~4 ms with realistic content.

#### ADR-013: Command pattern with grouping; bounded history
- **Decision:** `AddStroke`, `EraseStrokes` (remove ids + add fragments), `Clear`, `Composite`; history of 100 steps; a gesture is one step via begin/commit/rollback group; commands record original indices.
- **Alternatives:** State snapshots (array or bitmap).
- **Why:** O(touched) memory per step, semantic labels, deltas for the renderer, exact inverse restores draw order.

#### ADR-014: Erasers operate on vector data; pixel eraser splits strokes
- **Decision:** Stroke eraser = point-to-segment distance against `radius + halfWidth` with cached-bounds prefilter and stamped sweeps. Pixel eraser = exact segment/disc intersection producing fragment strokes.
- **Alternatives:** `destination-out` on the bitmap; erase operations stored as data.
- **Why:** The recognizer reads strokes, so the document must equal what is visible; keeps the `Stroke` contract unchanged.
- **Revisit if:** Fragment counts grow noticeably after heavy erasing (consider merging adjacent fragments).

#### ADR-015: Versioned, validated JSON document format
- **Decision:** `{format, version, strokes}`; deserialization validates every field and returns a result instead of throwing; loading resets history.
- **Why:** Files are untrusted input; a version tag enables migration.
