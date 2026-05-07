/**
 * screenshot-m3.js — render an M3 model to a transparent PNG using headless WebGL.
 *
 * Requires (install once):
 *   npm install gl canvas
 *
 * Usage:
 *   node screenshot-m3.js <input.m3> <output.png> [options]
 *
 * Options:
 *   --width=N       image width  (default 800)
 *   --height=N      image height (default 600)
 *   --rotX=N        camera orbit pitch in degrees (default 20)
 *   --rotY=N        camera orbit yaw   in degrees (default 30)
 *   --zoom=N        zoom multiplier   (default 1.0, smaller = closer)
 *   --bg=RRGGBB     solid hex background colour; omit for transparent
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createCanvas, ImageData } from 'canvas';
import gl from 'gl';
import * as THREE from 'three';
import { loadM3FromFile, buildThreeMeshesFromModel } from './src/m3-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────

const positional = [];
const opts = {};
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--')) {
    const [k, v] = arg.slice(2).split('=');
    opts[k] = v;
  } else {
    positional.push(arg);
  }
}

if (positional.length < 2) {
  console.log('Usage: node screenshot-m3.js <input.m3> <output.png> [--width=800] [--height=600] [--rotX=20] [--rotY=30] [--zoom=1.0] [--bg=RRGGBB]');
  process.exit(1);
}

const [inputPath, outputPath] = positional;
const width  = parseInt(opts.width  ?? '800');
const height = parseInt(opts.height ?? '600');
const rotXDeg = parseFloat(opts.rotX  ?? '20');
const rotYDeg = parseFloat(opts.rotY  ?? '30');
const zoom    = parseFloat(opts.zoom  ?? '1.0');
const bgHex   = opts.bg ?? null;

// ── Headless WebGL renderer ───────────────────────────────────────────────────

const glCtx = gl(width, height, { preserveDrawingBuffer: true });

// Patch for Three.js: it expects getExtension to never throw
const origGetExt = glCtx.getExtension.bind(glCtx);
glCtx.getExtension = (name) => { try { return origGetExt(name); } catch { return null; } };

// Pass a node-canvas so Three.js doesn't need document.createElementNS
const nodeCanvas = createCanvas(width, height);
nodeCanvas.addEventListener = () => {};
nodeCanvas.removeEventListener = () => {};
nodeCanvas.style = {};
const renderer = new THREE.WebGLRenderer({
  canvas: nodeCanvas,
  context: glCtx,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(width, height, false);
renderer.setPixelRatio(1);

// ── Load model ────────────────────────────────────────────────────────────────

console.log(`Loading: ${inputPath}`);
const sections = await loadM3FromFile(inputPath);
if (!sections.model) throw new Error('Model section not found');

const textureBasePath = path.join(__dirname, 'demo', 'assets', 'Textures');
const group = buildThreeMeshesFromModel(sections.model, sections, { textureBasePath });

// ── Scene setup ───────────────────────────────────────────────────────────────

const scene = new THREE.Scene();
if (bgHex) scene.background = new THREE.Color(`#${bgHex}`);

const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(100, 150, 120);
scene.add(dir);
scene.add(new THREE.AmbientLight(0x888888));
scene.add(group);

// ── Camera positioning ────────────────────────────────────────────────────────

const bbox   = new THREE.Box3().setFromObject(group);
const center = bbox.getCenter(new THREE.Vector3());
const radius = bbox.getSize(new THREE.Vector3()).length() * 0.5;

const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10000);

// Orbit: start from a position directly in front, then rotate
const dist = (radius / Math.sin((50 / 2) * Math.PI / 180)) * zoom;
const rotX = rotXDeg * Math.PI / 180;
const rotY = rotYDeg * Math.PI / 180;

camera.position.set(
  center.x + dist * Math.sin(rotY) * Math.cos(rotX),
  center.y + dist * Math.sin(rotX),
  center.z + dist * Math.cos(rotY) * Math.cos(rotX),
);
camera.lookAt(center);
camera.updateProjectionMatrix();

// ── Render ────────────────────────────────────────────────────────────────────

renderer.render(scene, camera);

// ── Read pixels and save PNG ──────────────────────────────────────────────────

const pixels = new Uint8Array(width * height * 4);
glCtx.readPixels(0, 0, width, height, glCtx.RGBA, glCtx.UNSIGNED_BYTE, pixels);

// WebGL framebuffer is bottom-to-top; flip rows for image
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');
const imgData = new ImageData(width, height);
for (let row = 0; row < height; row++) {
  const src = (height - 1 - row) * width * 4;
  imgData.data.set(pixels.subarray(src, src + width * 4), row * width * 4);
}
ctx.putImageData(imgData, 0, 0);

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);
console.log(`Saved: ${outputPath} (${width}x${height})`);
