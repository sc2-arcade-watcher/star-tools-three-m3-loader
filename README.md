# m3-viewer-threejs

A browser-based viewer and Node.js toolchain for **StarCraft II / C&C3 M3** model files, powered by [Three.js](https://threejs.org).

- Parses the binary M3 format entirely in JavaScript — no native dependencies for viewing/converting
- Renders models with DDS textures, skeletal animation, and attachment point visualisation in the browser via WebGL
- Exports to GLB for use in Blender, game engines, or any GLTF-compatible tool
- Renders transparent PNG screenshots from the command line
- URL state: share a direct link to any model (`?race=GDI&unit=GDI_Harvester`)

---

## Browser demo

Serve the repo from a local HTTP server (required for ES module imports and `fetch`):

```bash
npm run serve          # npx serve . -l 8000
# or
python -m http.server 8000
```

Then open **http://localhost:8000/demo/**

### Controls

| Control | Action |
|---------|--------|
| Left drag | Orbit |
| Right drag / scroll | Zoom |
| Middle drag | Pan |

### UI panels

**Top bar** — select source (Local files or GitHub), choose faction and unit.

**Animations panel** (top-right) — lists all animation sequences. Each shows a tag:
- `C` — *concurrent*: can play alongside other animations; click to toggle on/off
- `P0`, `P1`, … — *priority n*: exclusive; clicking one stops other non-concurrent animations of lower-or-equal priority

Multiple animations can be active at once when they are concurrent.

**Attachment Points panel** (right, below animations) — lists all ATT_ attachment points from the model. Click a name to show/hide a yellow circle marker at that bone, which follows the animation. Markers are always 10 px in diameter regardless of zoom and render on top of geometry.

**Bottom bar** — three action buttons:

| Button | Action |
|--------|--------|
| ⬇ Export GLB | Download the current model as a binary GLTF file |
| ⬇ Download ZIP | Bundle the M3 file + all its textures into a ZIP |
| 📷 PNG | Render the current view to a square, transparent-background PNG cropped to the model bounds (attachment markers excluded) |

---

## CLI tools (Node.js)

Install dependencies first:

```bash
npm install
```

Requires **Node.js 18+**.

### Convert M3 → GLB

```bash
node convert-m3.js path/to/model.m3 output.glb
# or
npm run convert -- path/to/model.m3 output.glb
```

### Render M3 → PNG (transparent background)

Requires the optional native packages `gl` and `canvas` (already listed in `dependencies`):

```bash
node screenshot-m3.js path/to/model.m3 output.png [options]
# or
npm run screenshot -- path/to/model.m3 output.png [options]
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--width=N` | `800` | Output image width in pixels |
| `--height=N` | `600` | Output image height in pixels |
| `--rotX=N` | `20` | Camera elevation angle in degrees |
| `--rotY=N` | `30` | Camera azimuth angle in degrees |
| `--zoom=N` | `1.0` | Zoom multiplier (< 1 = closer, > 1 = farther) |
| `--bg=RRGGBB` | *(none)* | Solid hex background colour; omit for transparent |

**Examples:**

```bash
# Default view, transparent background
node screenshot-m3.js demo/assets/Units/Neutral/Crate.m3 crate.png

# Front-facing, larger image
node screenshot-m3.js demo/assets/Units/GDI/GDI_Commando.m3 commando.png \
  --width=1024 --height=1024 --rotX=15 --rotY=0

# Dark background
node screenshot-m3.js demo/assets/Units/GDI/GDI_Harvester.m3 harvester.png \
  --width=800 --height=600 --bg=111111
```

> **Note:** Screenshot rendering uses headless WebGL 1 via the `gl` package. Models with skeletal animation will render in their bind pose (skinning shaders require WebGL 2). Static geometry and textures render correctly.

---

## Running tests

```bash
npm test

# Run only the PNG pipeline test
node --test --test-name-pattern="PNG render" test/convert.test.js
```

Tests cover: geometry parsing, UV ranges, multi-region models, GLB export, and the PNG render pipeline (headless-gl → canvas → PNG).

---

## Project structure

```
m3-viewer-threejs/
├── src/
│   └── m3-loader.js          # M3 parser + Three.js mesh/animation/attachment builder
├── demo/
│   ├── index.html            # Viewer UI
│   ├── style.css             # Viewer styles
│   ├── main.js               # Demo app logic
│   ├── github.js             # GitHub API integration (model index, OAuth Device Flow)
│   └── assets/               # Model and texture data (gitignored)
│       ├── Units/
│       └── Textures/
├── vendor/                   # Vendored Three.js builds for Node.js (GLTFExporter)
├── test/
│   └── convert.test.js       # Automated tests (node:test)
├── m3studio-main/            # m3studio Blender addon — structures.xml used at runtime
├── convert-m3.js             # CLI: M3 → GLB
├── screenshot-m3.js          # CLI: M3 → PNG (requires gl + canvas)
└── package.json
```

---

## M3 format notes

M3 is a proprietary binary model format used by StarCraft II and C&C3. Structure definitions are parsed at runtime from `m3studio-main/structures.xml` (part of the [m3studio](https://github.com/Solstice245/m3studio) Blender addon by Solstice245).

Key details:
- **Vertex format** — determined by `vertex_flags` bitmask on the MODL section
- **UV encoding** — `int16` values: `u = x × uv_multiply / 32768` (DirectX origin, matches `flipY=false` on DDSLoader)
- **Textures** — DDS with S3TC compression (`WEBGL_compressed_texture_s3tc`)
- **Coordinate system** — Z-up; converted to Three.js Y-up by rotating the root group −90° on X
- **Skeleton** — IREF sections store inverse bind matrices; bone world transforms are derived from `IREF^-1`, decomposed into parent-local space so `calculateInverses()` gives correct boneInverses
- **Animations** — STC_/STG_/SEQS hierarchy; `concurrent` and `priority` fields on STC_ control blending
- **Attachment points** — ATT_ sections; each references a bone index

---

## Credits

M3 structure definitions and import reference from [m3studio](https://github.com/Solstice245/m3studio) by Solstice245 and contributors, licensed under GPL-2.0.
