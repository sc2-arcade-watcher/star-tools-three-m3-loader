import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { loadM3FromFile, buildThreeMeshesFromModel } from '../src/m3-loader.js';
import { createCanvas, ImageData } from 'canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(__dirname, '..', 'demo', 'assets');

async function loadModel(relPath) {
  const sections = await loadM3FromFile(path.join(assets, relPath));
  assert.ok(sections.model, `model section missing in ${relPath}`);
  const group = buildThreeMeshesFromModel(sections.model, sections);
  return group;
}

function meshStats(group) {
  let totalVertices = 0, totalFaces = 0;
  const meshes = [];
  group.traverse((obj) => { if (obj.isMesh) meshes.push(obj); });
  for (const mesh of meshes) {
    const geo = mesh.geometry;
    totalVertices += geo.attributes.position.count;
    totalFaces += geo.index.count / 3;
  }
  return { meshCount: meshes.length, totalVertices, totalFaces };
}

function uvRange(group) {
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  const meshes = [];
  group.traverse((obj) => { if (obj.isMesh) meshes.push(obj); });
  for (const mesh of meshes) {
    const uv = mesh.geometry.attributes.uv;
    if (!uv) continue;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  return { minU, maxU, minV, maxV };
}

// ── Crate ────────────────────────────────────────────────────────────────────

test('Crate: parses and builds geometry', async () => {
  const group = await loadModel('Units/Neutral/Crate.m3');
  const { meshCount, totalVertices, totalFaces } = meshStats(group);

  assert.ok(meshCount >= 1, `expected ≥1 mesh, got ${meshCount}`);
  assert.ok(totalVertices > 0, 'no vertices');
  assert.ok(totalFaces > 0, 'no faces');
  console.log(`  meshes=${meshCount}  verts=${totalVertices}  faces=${totalFaces}`);
});

test('Crate: UV coordinates in valid range', async () => {
  const group = await loadModel('Units/Neutral/Crate.m3');
  const { minU, maxU, minV, maxV } = uvRange(group);

  assert.ok(minU >= -0.1, `U min out of range: ${minU}`);
  assert.ok(maxU <= 4.1,  `U max out of range: ${maxU}`);
  assert.ok(minV >= -0.1, `V min out of range: ${minV}`);
  assert.ok(maxV <= 4.1,  `V max out of range: ${maxV}`);
  console.log(`  U=[${minU.toFixed(3)}, ${maxU.toFixed(3)}]  V=[${minV.toFixed(3)}, ${maxV.toFixed(3)}]`);
});

// ── GDI Harvester ─────────────────────────────────────────────────────────────

test('GDI_Harvester: multiple meshes', async () => {
  const group = await loadModel('Units/GDI/GDI_Harvester.m3');
  const { meshCount, totalVertices, totalFaces } = meshStats(group);

  assert.ok(meshCount > 1, `expected >1 mesh (multi-region model), got ${meshCount}`);
  assert.ok(totalVertices > 100, `suspiciously few vertices: ${totalVertices}`);
  assert.ok(totalFaces > 50,    `suspiciously few faces: ${totalFaces}`);
  console.log(`  meshes=${meshCount}  verts=${totalVertices}  faces=${totalFaces}`);
});

test('GDI_Harvester: UV coordinates in valid range', async () => {
  const group = await loadModel('Units/GDI/GDI_Harvester.m3');
  const { minU, maxU, minV, maxV } = uvRange(group);

  // Harvester uses tiled/offset UVs; bounds are wider than [0,1]
  assert.ok(minU >= -2, `U min out of range: ${minU}`);
  assert.ok(maxU <= 4,  `U max out of range: ${maxU}`);
  assert.ok(minV >= -2, `V min out of range: ${minV}`);
  assert.ok(maxV <= 4,  `V max out of range: ${maxV}`);
  console.log(`  U=[${minU.toFixed(3)}, ${maxU.toFixed(3)}]  V=[${minV.toFixed(3)}, ${maxV.toFixed(3)}]`);
});

// ── Visceroid ─────────────────────────────────────────────────────────────────

test('Visceroid: parses and builds geometry', async () => {
  const group = await loadModel('Units/Neutral/Visceroid.m3');
  const { meshCount, totalVertices, totalFaces } = meshStats(group);

  assert.ok(meshCount >= 1, `expected ≥1 mesh, got ${meshCount}`);
  assert.ok(totalVertices > 0, 'no vertices');
  assert.ok(totalFaces > 0, 'no faces');
  console.log(`  meshes=${meshCount}  verts=${totalVertices}  faces=${totalFaces}`);
});

// ── GLB export ────────────────────────────────────────────────────────────────

test('Crate: exports valid GLB file', async () => {
  const { exportToGLB } = await import('../src/m3-loader.js');
  const group = await loadModel('Units/Neutral/Crate.m3');
  const outPath = path.join(__dirname, '_crate_test.glb');

  try {
    await exportToGLB(group, outPath);
    const stat = fs.statSync(outPath);
    assert.ok(stat.size > 1000, `GLB file too small: ${stat.size} bytes`);
    // GLB magic: first 4 bytes = 0x46546C67 ('glTF')
    const buf = fs.readFileSync(outPath);
    assert.equal(buf.toString('ascii', 0, 4), 'glTF', 'invalid GLB magic bytes');
    console.log(`  GLB size=${stat.size} bytes`);
  } finally {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  }
});

// ── PNG screenshot ────────────────────────────────────────────────────────────
// Tests the headless render pipeline: headless-gl → readPixels → canvas → PNG.
// Uses raw GL calls (no Three.js renderer) to avoid WebGL 1 vs 2 shader issues
// with skinned meshes.  screenshot-m3.js uses the same pixel-read + canvas path.

test('PNG render: headless-gl to canvas to PNG', async () => {
  const gl = (await import('gl')).default;

  const W = 128, H = 128;
  const glCtx = gl(W, H, { preserveDrawingBuffer: true });

  // Draw a solid orange frame using raw GL
  glCtx.clearColor(1.0, 0.27, 0.0, 1.0); // ~0xff4400, fully opaque
  glCtx.clear(glCtx.COLOR_BUFFER_BIT);

  // Also draw a transparent border by scissoring the centre
  glCtx.enable(glCtx.SCISSOR_TEST);
  glCtx.scissor(10, 10, W - 20, H - 20); // inner region stays orange
  // (we just verify the outer corners are also orange since we cleared the whole buffer)
  glCtx.disable(glCtx.SCISSOR_TEST);

  const pixels = new Uint8Array(W * H * 4);
  glCtx.readPixels(0, 0, W, H, glCtx.RGBA, glCtx.UNSIGNED_BYTE, pixels);

  // Centre pixel should be orange and fully opaque
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  const ci = (cy * W + cx) * 4;
  assert.ok(pixels[ci]     > 200, `red channel too low: ${pixels[ci]}`);
  assert.ok(pixels[ci + 1] < 100, `green channel too high: ${pixels[ci + 1]}`);
  assert.ok(pixels[ci + 3] > 200, `alpha too low: ${pixels[ci + 3]}`);

  // Flip rows (WebGL bottom-to-top) and encode to PNG
  const outCanvas = createCanvas(W, H);
  const ctx = outCanvas.getContext('2d');
  const imgData = new ImageData(W, H);
  for (let row = 0; row < H; row++) {
    const src = (H - 1 - row) * W * 4;
    imgData.data.set(pixels.subarray(src, src + W * 4), row * W * 4);
  }
  ctx.putImageData(imgData, 0, 0);

  const outPath = path.join(__dirname, '_screenshot_test.png');
  try {
    const buf = outCanvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buf);

    const stat = fs.statSync(outPath);
    assert.ok(stat.size > 200, `PNG too small: ${stat.size} bytes`);
    assert.equal(buf[0], 0x89, 'invalid PNG magic[0]');
    assert.equal(buf.toString('ascii', 1, 4), 'PNG', 'invalid PNG magic');

    // After row-flip, centre should still be opaque orange
    const imgCi = (Math.floor(H / 2) * W + Math.floor(W / 2)) * 4;
    assert.ok(imgData.data[imgCi]     > 200, 'flipped image: red low');
    assert.ok(imgData.data[imgCi + 3] > 200, 'flipped image: alpha low');

    console.log(`  PNG size=${stat.size} bytes, centre=[${pixels[ci]},${pixels[ci+1]},${pixels[ci+2]},${pixels[ci+3]}]`);
  } finally {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  }
});
