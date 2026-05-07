import path from 'path';
import { fileURLToPath } from 'url';
import { loadM3FromFile, buildThreeMeshesFromModel, exportToGLB, structures } from './src/m3-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function convertM3ToGLB(inputPath, outputPath) {
  console.log(`Loading M3 file: ${inputPath}`);
  const sections = await loadM3FromFile(inputPath);
  console.log('Structures loaded:', Object.keys(structures).length);
  if (!sections.model) {
    throw new Error('Model section not found in M3 file');
  }

  console.log('Building Three.js meshes...');
  const textureBasePath = path.join(__dirname, 'demo', 'assets', 'Textures');
  const group = buildThreeMeshesFromModel(sections.model, sections, { textureBasePath });

  console.log(`Exporting to GLB: ${outputPath}`);
  await exportToGLB(group, outputPath);
  console.log('Conversion complete!');
}

// Main
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log('Usage: node convert-m3.js <input.m3> <output.glb>');
  process.exit(1);
}

const [inputPath, outputPath] = args;

convertM3ToGLB(inputPath, outputPath).catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});