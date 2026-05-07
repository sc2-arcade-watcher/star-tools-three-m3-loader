import fs from 'fs'
import path from 'path'

async function build() {
    
  // Read the XML file
  let xmlContent = fs.readFileSync('./src/structures.xml', 'utf8');
  // Escape the XML content for embedding in JavaScript
  const escapedXml = xmlContent
    .replace(/\\/g, '\\\\')     // Escape backslashes
    .replace(/`/g, '\\`')       // Escape backticks
    .replace(/\$/g, '\\$');     // Escape template literal placeholders

  // Read the original m3-loader.js
  let m3Loader = fs.readFileSync('./src/m3-loader.js', 'utf8');

  m3Loader = m3Loader.replace(
    `<xml>...</xml>`,
    escapedXml
  );
    fs.writeFileSync('./docs/dist/m3-loader.js', m3Loader);

  console.log('Build complete!');
}

build();