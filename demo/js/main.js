import { M3SectionList, buildThreeMeshesFromModel, buildAnimationClips, buildAttachmentPoints, buildMaterialList, buildBoneHierarchy, buildHitVolumes, buildLights, buildTurrets, buildBounds, getModelTextureFilenames } from '../../src/m3-loader.js';
import JSZip from 'jszip';
import * as THREE from 'three';
import { OrbitControls } from '../lib/three/OrbitControls.js';
import { GLTFExporter } from '../lib/three/GLTFExporter.js';
import { DDSLoader } from '../lib/three/DDSLoader.js';
import { TGALoader } from '../lib/three/TGALoader.js';
import '../lib/img-src-texture-support/img-src-texture-support.js';
import { fetchModelList, buildTextureIndex, makeTextureResolver, rawUrl, clearCache, getToken, setToken, startDeviceFlow, GITHUB_CLIENT_ID } from './github.js';


const modelsByFolder = {
  Cabal: ["CAbalLeviathanDrone_Death","CabalAftershock","CabalAscended","CabalAscended_Upgrade","CabalAscender","CabalAvengerTank","CabalAvengerTank_Death","CabalAvengerTank_Upgrade_Death","CabalBasilisk","CabalBasilisk_Death","CabalBike","CabalBike_Death","CabalBlackHand","CabalBlackHand_Upgrade","CabalCenturion","CabalCenturion_Upgrade","CabalCobra","CabalCobra_Death","CabalDefenseCrawler","CabalDefenseCrawler_Death","CabalDevout","CabalDevout_Upgrade","CabalDominator","CabalDominator_Upgrade","CabalDropShip","CabalEngineer","CabalEnlightened","CabalEnlightened_Upgrade","CabalFlameMine","CabalFlameTank","CabalFlameTank_Death","CabalHijacker","CabalHolySpirit","CabalHolySpirit_Death","CabalHolySpirit_Upgrade","CabalLeviathan","CabalLeviathanDrone","CabalLeviathan_Death","CabalMantis","CabalMantis_Upgrade","CabalMarauder","CabalMedusa","CabalMedusa_Death","CabalOffenseCrawler","CabalRaider","CabalRaider_Death","CabalReaper","CabalReaper_Upgrade","CabalReckoner","CabalReckonerDeployed_Death","CabalReckoner_Death","CabalSalamander","CabalSalamander_Death","CabalSalvator","CabalScalpel","CabalScalpel_Death","CabalScorpion","CabalSlave","CabalSpecter","CabalSpecter_Death","CabalSpider","CabalStealthTank","CabalStealthTank_Death","CabalSupportCrawler","CabalTyrant","CabalTyrant_Death","CabalUnderminer","CabalVenom","CabalVenom_Death","CabalVertigo","CabalWidow","CabalWidowWreckage","CabalWidow_SpiderAttachment"],
  GDI: ["GDI_APC","GDI_APC_Death","GDI_Behemoth","GDI_Commando","GDI_Droppod","GDI_Dropship","GDI_Dropship_Death","GDI_Engineer","GDI_FireHawk","GDI_FireHawk_Death","GDI_GST","GDI_Grenadier","GDI_HammerHead","GDI_Harvester","GDI_Harvester_Death","GDI_Hover","GDI_Juggernaut","GDI_MARV","GDI_MCV","GDI_MCV_Death","GDI_MCV_Morph","GDI_MammothTank","GDI_MammothTank_Death","GDI_MissileTrooper","GDI_Orca","GDI_OrcaStrikeCraft","GDI_Orca_Death","GDI_Ox","GDI_PitBull","GDI_Pitbull_Death","GDI_Predator","GDI_Predator_Death","GDI_RepairDrone","GDI_RifleMan","GDI_Rig","GDI_Rig_Death","GDI_Rig_Morph","GDI_SensorPod","GDI_Shatterer","GDI_Slingshot","GDI_Sniper","GDI_SuperSonicFighter","GDI_Surveyor","GDI_Surveyor_Death","GDI_Titan","GDI_Wolverine","GDI_ZoneRaider","GDI_ZoneTrooper"],
  Neutral: ["Crate","Visceroid"],
  Nod: ["NodArmageddon","NodArtilleryBeacon","NodAvatar","NodAwakened","NodBanshee","NodBeamCannon","NodBike","NodBlackHand","NodBlade","NodBoobyTrap","NodCarryall","NodCommando","NodConfessor","NodDevil","NodDisruptionPod","NodEmissary","NodEnlightened","NodFanatic","NodFlameTank","NodHalGrenade","NodHarvester","NodMCV","NodMCV_Death","NodMCV_Morph","NodMagneticMine","NodMantis","NodMilitant","NodMilitantRocket","NodMine","NodNuclearMissile","NodPurifier","NodRaider","NodReckoner","NodRedeemer","NodRedeemer_Death","NodRepairDrone","NodSaboteur","NodScorcher","NodScorpionTank","NodShadow","NodShadowFlying","NodSpecter","NodStealthTank","NodTiberiumTrooper","NodVenom","NodVertigo"],
  Scrin: ["Scrin_Annihilator","Scrin_Assimilator","Scrin_Assimilator_Death","Scrin_Buzzers","Scrin_Carrier","Scrin_Corrupter","Scrin_Cultist","Scrin_Cultist_Death","Scrin_Devastator","Scrin_Devourer","Scrin_Disintegrator","Scrin_Disintegrator_Death","Scrin_EradicatorHexapod","Scrin_Harvester","Scrin_Invader","Scrin_MasterMind","Scrin_MillipedeBody","Scrin_MillipedeHead","Scrin_Mothership","Scrin_Oblivion","Scrin_Ravager","Scrin_RepairDrone","Scrin_Seeker","Scrin_ShardWalker","Scrin_ShockTrooper","Scrin_Stormrider","Scrin_Stormrider_Death"],
  ZOCOM: ["Archangel","Argus","Armadillo","Bulldog","Conductor","DefenseCrawler","DefenseCrawler_Morph","Dozer","Droppod","Engineer","Firehawk","Hammerhead","Hunter","Hurricane","James","Juggernaut","Kodiak","Kodiak_AAGun","Kodiak_AGGun","Mammoth","Mammoth_Death","Mastodon","Mastodon_Death","OffenseCrawler","OffenseCrawler_Deployed","OffenseCrawler_MultiCannon","Orca","Paladin","Refractor","Rhino","Sandstorm","ScoutDrone","Sheppard","Sheppard_Death","Shockwave","Shuttle","Spanner","Spartan","StickyBomb","Striker","SupportCrawler","SupportCrawler_Deployed","SupportCrawler_RocketLauncher","Talon","Thunderhead","Titan","Wing","Wolf","ZoneCaptain","ZoneCommando","ZoneDefender","ZoneEnforcer","ZoneLancer","ZoneRaider","ZoneTrooper","ZoneTrooper_Death"],
};

const structuresXmlPath = '../m3studio-main/structures.xml';
const ddsLoader = new DDSLoader();
const tgaLoader = new TGALoader();
const clock = new THREE.Clock();
let scene, camera, renderer, controls, currentGroup;
let gridHelper, axesHelper, boundsWireframe, groundMesh;
let mixer = null;
let currentClips = [];
let activeActions = new Map(); // clip.name → AnimationAction
let ghModels = [];   // [{ name, repo }]
let ghTexIndex = {}; // filename.toLowerCase() → repo
let useGithub = false;
let currentModelUrl = null;
let currentSections = null;
let currentTextureResolver = null;
let currentTextureBasePath = null;
const attMarkers = new Map();   // boneIndex → THREE.Object3D (triangle marker)
const atvlMarkers = new Map();  // vol.index → THREE.LineSegments (attachment volume wireframe)
const boneMarkers = new Map();  // boneIndex → THREE.Object3D
const hitMarkers  = new Map();  // vol.index → THREE.LineSegments
const matOutlines = new Map();  // matName → THREE.Mesh[] (outline meshes)
let currentHitVolumes = { tight: null, hittests: [], attachmentVolumes: [] };

const status    = document.getElementById('status');
const localSearch = document.getElementById('localSearch');
const localDropdown = document.getElementById('local-dropdown');
const ghAuthBtn  = document.getElementById('ghAuthBtn');
const ghSearch   = document.getElementById('ghSearch');
const authModal  = document.getElementById('auth-modal');
const authCode   = document.getElementById('auth-code');
const authOpen   = document.getElementById('auth-open');
const authCancel = document.getElementById('auth-cancel');
const ghSel     = document.getElementById('gh-dropdown');
const exportBtn     = document.getElementById('exportBtn');
const downloadBtn   = document.getElementById('downloadBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const boundsPanel  = document.getElementById('bounds-panel');
const boundsList   = document.getElementById('bounds-list');
const boundsToggle = document.getElementById('bounds-toggle');
const animPanel   = document.getElementById('anim-panel');
const animList    = document.getElementById('anim-list');
const animToggle  = document.getElementById('anim-toggle');
const attPanel    = document.getElementById('att-panel');
const attList     = document.getElementById('att-list');
const attToggle   = document.getElementById('att-toggle');
const matPanel    = document.getElementById('mat-panel');
const matList     = document.getElementById('mat-list');
const matToggle   = document.getElementById('mat-toggle');
const bonePanel   = document.getElementById('bone-panel');
const boneList    = document.getElementById('bone-list');
const boneToggle  = document.getElementById('bone-toggle');
const hitPanel    = document.getElementById('hit-panel');
const hitList     = document.getElementById('hit-list');
const hitToggle   = document.getElementById('hit-toggle');
const lightPanel  = document.getElementById('light-panel');
const lightList   = document.getElementById('light-list');
const lightToggle = document.getElementById('light-toggle');
const turretPanel = document.getElementById('turret-panel');
const turretList  = document.getElementById('turret-list');
const turretToggle = document.getElementById('turret-toggle');
// Texture modal
const texModal      = document.getElementById('tex-modal');
const texTitle      = document.getElementById('tex-title');
const texPreview    = document.getElementById('tex-preview');
const texClose      = document.getElementById('tex-close');
const texDownload   = document.getElementById('tex-download');
const texLocalInput = document.getElementById('tex-local-input');
const texGhBtn      = document.getElementById('tex-gh-btn');
const texGhSearch   = document.getElementById('tex-gh-search');
const texGhInput    = document.getElementById('tex-gh-input');
const texGhResults  = document.getElementById('tex-gh-results');

const srcLocal  = document.getElementById('srcLocal');
const srcGithub = document.getElementById('srcGithub');
const localUi   = document.getElementById('local-ui');
const githubUi  = document.getElementById('github-ui');

function setStatus(text) { status.textContent = text; }

// ── Texture viewer modal ──────────────────────────────────────────────────────

let texModalCtx = null; // { matName, label, filename, imgEl, rowEl }
let _texActiveRow = null;

async function openTexModal(matName, label, filename, currentUrl, imgEl, rowEl) {
  // Highlight selected row
  if (_texActiveRow) _texActiveRow.classList.remove('active');
  _texActiveRow = rowEl ?? null;
  if (_texActiveRow) _texActiveRow.classList.add('active');

  texModalCtx = { matName, label, filename, imgEl };
  texTitle.textContent = `${label} — ${filename}`;
  texPreview.src = '';
  texGhSearch.style.display = 'none';
  texGhInput.value = '';
  texGhResults.innerHTML = '';

  // Position near the right-panels if first open, else keep current position
  if (!texModal.style.left) {
    const rp = document.getElementById('right-panels');
    const rpRect = rp.getBoundingClientRect();
    texModal.style.top  = `${rpRect.top}px`;
    texModal.style.left = `${Math.max(8, rpRect.left - 420)}px`;
  }
  texModal.classList.add('open');

  const dataUrl = (imgEl?.src && !imgEl.src.endsWith('gif')) ? imgEl.src
    : await renderTextureThumbnail(getTextureUrl(filename) || currentUrl);
  texPreview.src = dataUrl || currentUrl || '';
}

texClose.addEventListener('click', () => {
  texModal.classList.remove('open');
  if (_texActiveRow) { _texActiveRow.classList.remove('active'); _texActiveRow = null; }
});

// Drag-to-move on header
(function () {
  const texHeader = document.getElementById('tex-header');
  let dragging = false, ox = 0, oy = 0;
  texHeader.addEventListener('mousedown', e => {
    dragging = true;
    ox = e.clientX - texModal.getBoundingClientRect().left;
    oy = e.clientY - texModal.getBoundingClientRect().top;
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    texModal.style.left = `${Math.max(0, e.clientX - ox)}px`;
    texModal.style.top  = `${Math.max(0, e.clientY - oy)}px`;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
})();

texDownload.addEventListener('click', async () => {
  if (!texModalCtx?.filename) return;
  const url = getTextureUrl(texModalCtx.filename);
  if (!url) return setStatus('No URL for this texture');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = texModalCtx.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) { setStatus(`Download failed: ${e.message}`); }
});

texLocalInput.addEventListener('change', async () => {
  const file = texLocalInput.files[0];
  if (!file || !texModalCtx) return;
  const ext = file.name.split('.').pop().toLowerCase();
  try {
    const buf = await file.arrayBuffer();
    let tex;
    if (ext === 'dds') {
      tex = ddsLoader.parse(buf);
      // ddsLoader.parse returns a CompressedTexture-like object; use load() from URL instead
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const objUrl = URL.createObjectURL(blob);
      tex = ddsLoader.load(objUrl);
      tex.flipY = false;
      await applyReplacementTexture(tex, objUrl, file.name);
    } else if (ext === 'tga') {
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const objUrl = URL.createObjectURL(blob);
      tex = tgaLoader.load(objUrl);
      tex.flipY = false;
      await applyReplacementTexture(tex, objUrl, file.name);
    } else {
      const objUrl = URL.createObjectURL(new Blob([buf]));
      tex = new THREE.TextureLoader().load(objUrl);
      tex.flipY = false;
      await applyReplacementTexture(tex, objUrl, file.name);
    }
  } catch (e) { setStatus(`Load failed: ${e.message}`); }
  texLocalInput.value = '';
});

texGhBtn.addEventListener('click', async () => {
  const open = texGhSearch.style.display === 'none';
  texGhSearch.style.display = open ? '' : 'none';
  if (open) {
    if (!Object.keys(ghTexIndex).length) {
      texGhResults.innerHTML = '<div style="padding:6px 8px;color:#888;font-size:.8rem">Loading index…</div>';
      try { ghTexIndex = await buildTextureIndex(); } catch { texGhResults.innerHTML = '<div style="padding:6px 8px;color:#888;font-size:.8rem">Failed to load index</div>'; return; }
    }
    renderTexGhResults(texGhInput.value);
    texGhInput.focus();
  }
});

texGhInput.addEventListener('input', () => renderTexGhResults(texGhInput.value));

function renderTexGhResults(query) {
  const q = query.toLowerCase().trim();
  const keys = Object.keys(ghTexIndex);
  const matches = q ? keys.filter(k => k.includes(q)) : keys;
  texGhResults.innerHTML = '';
  matches.slice(0, 60).forEach(k => {
    const btn = document.createElement('button');
    btn.textContent = k;
    btn.addEventListener('click', async () => {
      const entry = ghTexIndex[k];
      if (!entry) return;
      const url = rawUrl(entry.repo, entry.name);
      let tex;
      if (k.endsWith('.dds')) {
        tex = ddsLoader.load(url);
        tex.flipY = false;
      } else if (k.endsWith('.tga')) {
        tex = tgaLoader.load(url);
        tex.flipY = false;
      } else {
        tex = new THREE.TextureLoader().load(url);
        tex.flipY = false;
      }
      await applyReplacementTexture(tex, url, k);
      texGhSearch.style.display = 'none';
    });
    texGhResults.appendChild(btn);
  });
  if (!matches.length) texGhResults.innerHTML = '<div style="padding:6px 8px;color:#888;font-size:.8rem">No results</div>';
}

async function applyReplacementTexture(tex, url, filename) {
  if (!texModalCtx) return;
  const { matName, label, imgEl } = texModalCtx;
  // Update Three.js materials
  const mats = currentGroup?.userData?.matNameToMaterials?.get(matName);
  if (mats) {
    for (const mat of mats) {
      if (label === 'Diffuse') { mat.map = tex; mat.color.set(0xffffff); }
      else if (label === 'Specular') mat.specularMap = tex;
      else if (label === 'Normal') mat.normalMap = tex;
      mat.needsUpdate = true;
    }
  }
  // Update preview and thumbnail
  const dataUrl = await renderTextureThumbnail(url);
  if (dataUrl) {
    texPreview.src = dataUrl;
    if (imgEl) imgEl.src = dataUrl;
  }
  texModalCtx.filename = filename;
  texTitle.textContent = `${label} — ${filename}`;
  setStatus(`Texture replaced: ${filename}`);
}

// ── Ground texture ────────────────────────────────────────────────────────────

function buildGroundTexture() {
  const sz = 512;
  const canvas = document.createElement('canvas');
  canvas.width = sz; canvas.height = sz;
  const ctx = canvas.getContext('2d');

  // Base dirt
  ctx.fillStyle = '#3d2e1e';
  ctx.fillRect(0, 0, sz, sz);

  // Dirt variation patches
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * sz, y = Math.random() * sz;
    const r = Math.random() * 12 + 2;
    const l = 38 + Math.random() * 30 | 0;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${l + 20},${l},${l - 10},${0.25 + Math.random() * 0.35})`;
    ctx.fill();
  }

  // Grass clumps
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * sz, y = Math.random() * sz;
    const r = Math.random() * 9 + 2;
    const g = 55 + Math.random() * 45 | 0;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${20 + Math.random() * 20 | 0},${g},${10 + Math.random() * 15 | 0},${0.3 + Math.random() * 0.45})`;
    ctx.fill();
  }

  // Small pebbles / stones
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * sz, y = Math.random() * sz;
    const r = Math.random() * 3 + 1;
    const v = 70 + Math.random() * 50 | 0;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${v},${v - 5},${v - 10},0.7)`;
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 70, 160);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.update();

  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(100, 150, 120);
  scene.add(dir);
  scene.add(new THREE.AmbientLight(0x888888));

  gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
  axesHelper = new THREE.AxesHelper(1);
  axesHelper.material.depthTest = false;
  axesHelper.renderOrder = 1;
  scene.add(gridHelper);
  scene.add(axesHelper);

  // Ground plane with procedural dirt/grass texture
  const groundMat = new THREE.MeshLambertMaterial({ map: buildGroundTexture() });
  groundMat.polygonOffset = true;
  groundMat.polygonOffsetFactor = 1;
  groundMat.polygonOffsetUnits = 1;
  groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.renderOrder = -1; // ground below grid; grid default 0; axes = 1
  groundMesh.visible = false;
  scene.add(groundMesh);

  const groundBtn = document.getElementById('groundBtn');
  const groundOn = localStorage.getItem('groundVisible') === 'true';
  groundMesh.visible = groundOn;
  groundBtn.classList.toggle('active', groundOn);
  groundBtn.addEventListener('click', () => {
    const visible = !groundMesh.visible;
    groundMesh.visible = visible;
    groundBtn.classList.toggle('active', visible);
    localStorage.setItem('groundVisible', visible);
  });

  const gridBtn = document.getElementById('gridBtn');
  const gridOn = localStorage.getItem('gridVisible') === 'true';
  gridHelper.visible = gridOn;
  axesHelper.visible = gridOn;
  gridBtn.classList.toggle('active', gridOn);
  gridBtn.addEventListener('click', () => {
    const visible = !gridHelper.visible;
    gridHelper.visible = visible;
    axesHelper.visible = visible;
    gridBtn.classList.toggle('active', visible);
    localStorage.setItem('gridVisible', visible);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  controls.update();
  renderer.render(scene, camera);
}

// ── URL params ────────────────────────────────────────────────────────────────

function getUrlParams() {
  const p = new URLSearchParams(location.search);
  return { src: p.get('src'), race: p.get('race'), unit: p.get('unit'), gh: p.get('gh') };
}

function setUrlParams(params, modelName) {
  const url = '?' + new URLSearchParams(params).toString();
  history.pushState(params, '', url);
  if (modelName) document.title = `${modelName} — M3 Viewer`;
}

window.addEventListener('popstate', async (e) => {
  const p = e.state ?? Object.fromEntries(new URLSearchParams(location.search));
  if (!p.src) return;
  try {
    if (p.src === 'gh') {
      ghSearch.value = p.gh.replace(/\.m3$/i, '');
      filterGhList(ghSearch.value);
      const model = getCurrentGhModel();
      if (model) {
        await loadModel(rawUrl(model.repo, model.name), { textureResolver: makeTextureResolver(ghTexIndex) });
        document.title = `${ghSearch.value} — M3 Viewer`;
      }
    } else {
      localSearch.value = `${p.race}/${p.unit}`;
      await loadModel(`./assets/Units/${p.race}/${p.unit}.m3`, {
        textureBasePath: './assets/Textures',
        onTextureMissing: async (filename, mat) => {
          if (!filename) return;
          if (!Object.keys(ghTexIndex).length) {
            try { ghTexIndex = await buildTextureIndex(); } catch { return; }
          }
          const entry = ghTexIndex[filename.toLowerCase()];
          if (!entry) return;
          const tex = ddsLoader.load(rawUrl(entry.repo, entry.name));
          tex.flipY = false;
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        },
      });
      document.title = `${p.unit} — M3 Viewer`;
    }
  } catch (err) {
    console.error(err);
  }
});

// ── Local source ──────────────────────────────────────────────────────────────

function populateLocalDropdown(query) {
  const q = query.toLowerCase();
  localDropdown.innerHTML = '';
  const allModels = [];
  
  for (const [folder, models] of Object.entries(modelsByFolder)) {
    for (const model of models) {
      allModels.push({ folder, model, displayName: `${folder}/${model}` });
    }
  }
  
  const matches = q ? allModels.filter(m => m.displayName.toLowerCase().includes(q)) : allModels;
  for (const item of matches.slice(0, 200)) {
    const btn = document.createElement('button');
    btn.className = 'dropdown-item';
    btn.textContent = item.displayName;
    btn.dataset.folder = item.folder;
    btn.dataset.model = item.model;
    btn.addEventListener('click', () => {
      localSearch.value = item.displayName;
      localDropdown.style.display = 'none';
      currentModelUrl = `./assets/Units/${item.folder}/${item.model}.m3`;
      triggerLoad();
    });
    localDropdown.appendChild(btn);
  }
  if (matches.length > 0) {
    localDropdown.style.display = 'block';
  } else {
    localDropdown.style.display = 'none';
  }
}

function populateLocalList() {
  // No longer needed for selects, but keep for backward compatibility
}

// ── GitHub source ─────────────────────────────────────────────────────────────

function getCurrentGhModel() {
  const name = ghSearch.value;
  return ghModels.find(m => m.name.replace(/\.m3$/i, '') === name);
}

function getCurrentLocalModel() {
  const displayName = localSearch.value;
  const [folder, model] = displayName.split('/');
  if (folder && model && modelsByFolder[folder]?.includes(model)) {
    return { folder, model, displayName };
  }
  return null;
}

function triggerGhLoad() {
  const model = getCurrentGhModel();
  if (model) {
    currentModelUrl = rawUrl(model.repo, model.name);
    triggerLoad();
  }
}

function filterGhList(query) {
  const q = query.toLowerCase();
  ghSel.innerHTML = '';
  const matches = q ? ghModels.filter(m => m.name.toLowerCase().includes(q)) : ghModels;
  if (matches.length > 0) {
    for (const m of matches.slice(0, 200)) {
      const btn = document.createElement('button');
      btn.className = 'dropdown-item';
      btn.textContent = m.name.replace(/\.m3$/i, '');
      btn.dataset.repo = m.repo;
      btn.dataset.name = m.name;
      btn.addEventListener('click', () => {
        ghSearch.value = m.name.replace(/\.m3$/i, '');
        ghSel.style.display = 'none';
        currentModelUrl = rawUrl(m.repo, m.name);
        triggerLoad();
      });
      ghSel.appendChild(btn);
    }
    ghSel.style.display = q ? 'block' : 'none';
  } else {
    ghSel.style.display = 'none';
  }
}

async function initGithub() {
  if (ghModels.length) return;
  const total = 4 + 8;
  let done = 0;
  const onProgress = () => setStatus(`Loading index… ${++done}/${total}`);

  setStatus('Fetching model list from GitHub…');
  try {
    [ghModels, ghTexIndex] = await Promise.all([
      fetchModelList(onProgress),
      buildTextureIndex(onProgress),
    ]);
  } catch (err) {
    if (err.message === 'rate_limit') {
      setStatus('GitHub rate limit hit — enter a token and retry');
      ghModels = [];
      return;
    }
    throw err;
  }
  setStatus(`GitHub: ${ghModels.length} models ready`);
  filterGhList(ghSearch.value);
}

// ── Source toggle ─────────────────────────────────────────────────────────────

function setSource(gh) {
  useGithub = gh;
  srcLocal.classList.toggle('active', !gh);
  srcGithub.classList.toggle('active', gh);
  localUi.style.display = gh ? 'none' : 'flex';
  githubUi.style.display = gh ? 'flex' : 'none';
  if (gh) initGithub();
}

// ── Model loading ─────────────────────────────────────────────────────────────

async function loadModel(url, opts = {}) {
  setStatus('Fetching M3…');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  const buffer = await response.arrayBuffer();
  setStatus('Parsing…');
  const sections = await M3SectionList.load(buffer, structuresXmlPath);
  if (!sections.model) throw new Error('Model section not found');
  setStatus('Building mesh…');

  currentModelUrl = url;
  currentSections = sections;
  currentTextureResolver = opts.textureResolver ?? null;
  currentTextureBasePath = opts.textureBasePath ?? null;

  const group = buildThreeMeshesFromModel(sections.model, sections, {
    textureLoader: ddsLoader,
    ...opts,
  });

  if (mixer) { mixer.stopAllAction(); mixer = null; activeActions.clear(); }
  hitMarkers.clear();
  boneMarkers.clear();
  matOutlines.clear();
  texModal.classList.remove('open');
  if (_texActiveRow) { _texActiveRow.classList.remove('active'); _texActiveRow = null; }
  if (currentGroup) scene.remove(currentGroup);
  currentGroup = group;
  scene.add(group);

  // Bounds panel
  if (boundsWireframe) { scene.remove(boundsWireframe); boundsWireframe = null; }
  boundsList.innerHTML = '';
  const bounds = buildBounds(sections.model);
  if (bounds) {
    boundsPanel.style.display = 'block';
    const fmt = v => v.toFixed(3);
    boundsList.style.cursor = 'pointer';
    for (const [label, value] of [
      ['Left',   fmt(bounds.left)],
      ['Right',  fmt(bounds.right)],
      ['Front',  fmt(bounds.front)],
      ['Back',   fmt(bounds.back)],
      ['Top',    fmt(bounds.top)],
      ['Bottom', fmt(bounds.bottom)],
      ['Radius', fmt(bounds.radius)],
    ]) {
      const row = document.createElement('div');
      row.className = 'bounds-row';
      row.innerHTML = `<span class="bounds-label">${label}</span><span class="bounds-value">${value}</span>`;
      boundsList.appendChild(row);
    }
    boundsList.addEventListener('click', () => {
      if (boundsWireframe) {
        currentGroup.remove(boundsWireframe);
        boundsWireframe = null;
        boundsList.classList.remove('active');
      } else {
        // Build in M3 local space, parent to group so the -PI/2 rotation is inherited
        const w = bounds.right - bounds.left;
        const d = bounds.front - bounds.back;
        const h = bounds.top - bounds.bottom;
        const cx = (bounds.left + bounds.right) / 2;
        const cy = (bounds.back + bounds.front) / 2;
        const cz = (bounds.bottom + bounds.top) / 2;
        const geo = new THREE.BoxGeometry(w, d, h);
        boundsWireframe = new THREE.LineSegments(
          new THREE.WireframeGeometry(geo),
          new THREE.LineBasicMaterial({ color: 0xffff44, depthTest: false })
        );
        boundsWireframe.renderOrder = 997;
        boundsWireframe.position.set(cx, cy, cz);
        currentGroup.add(boundsWireframe);
        boundsList.classList.add('active');
      }
    });
  } else {
    boundsPanel.style.display = 'none';
  }

  // Animations
  activeActions.clear();
  currentClips = buildAnimationClips(sections.model, sections);
  animList.innerHTML = '';
  if (currentClips.length) {
    mixer = new THREE.AnimationMixer(group);
    for (const clip of currentClips) {
      const btn = document.createElement('button');
      const conc = clip.userData.concurrent;
      const prio = clip.userData.priority ?? 0;
      const tag = document.createElement('span');
      tag.className = 'anim-tag';
      tag.textContent = conc ? 'C' : `P${prio}`;
      tag.title = conc ? 'Concurrent' : `Priority ${prio}`;
      btn.appendChild(document.createTextNode(clip.name));
      btn.appendChild(tag);
      btn.dataset.clipName = clip.name;
      btn.addEventListener('click', () => toggleAnim(clip, btn));
      animList.appendChild(btn);
    }
    animPanel.style.display = 'block';
    // Auto-play Stand
    const standClip =
      currentClips.find((c) => /^stand$/i.test(c.name)) ??
      currentClips.find((c) => /\bstand\b/i.test(c.name)) ??
      currentClips.find((c) => /stand/i.test(c.name)) ??
      currentClips[0];
    const standBtn = animList.querySelector(`[data-clip-name="${CSS.escape(standClip.name)}"]`);
    toggleAnim(standClip, standBtn);
  } else {
    animPanel.style.display = 'none';
  }

  // Hit volumes — built early so attachment panel can reference them
  hitMarkers.clear();
  hitList.innerHTML = '';
  currentHitVolumes = buildHitVolumes(sections.model, sections);

  // Attachment points (expandable tree; ATVL volumes are child nodes)
  attMarkers.clear();
  atvlMarkers.clear();
  attList.innerHTML = '';
  const attPoints = buildAttachmentPoints(sections.model, sections);
  attPanel.style.display = 'block';
  if (attPoints.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No attachment points';
    attList.appendChild(empty);
  }
  for (const att of attPoints) {
    const vols = currentHitVolumes.attachmentVolumes.filter(v => v.bone0 === att.boneIndex);
    const row = document.createElement('div');
    row.className = 'tree-row';
    const nameBtn = document.createElement('button');
    nameBtn.className = 'tree-name-btn';
    nameBtn.textContent = att.name;
    nameBtn.addEventListener('click', () => toggleAttMarker(att, nameBtn));
    if (vols.length) {
      const toggle = makeTreeToggle();
      const children = document.createElement('div');
      children.className = 'tree-children';
      children.style.display = 'none';
      toggle.addEventListener('click', () => toggleTreeNode(toggle, children));
      for (const vol of vols) {
        const volRow = document.createElement('div');
        volRow.className = 'tree-row';
        volRow.appendChild(makeTreePlaceholder());
        const volBtn = document.createElement('button');
        volBtn.className = 'tree-name-btn';
        const tag = document.createElement('span');
        tag.className = 'vol-tag';
        tag.textContent = ['Cuboid', 'Sphere', 'Capsule'][vol.shape] ?? '?';
        volBtn.appendChild(document.createTextNode(`Volume ${vol.index}`));
        volBtn.appendChild(tag);
        volBtn.addEventListener('click', () => toggleAtvlVolume(vol, volBtn));
        volRow.appendChild(volBtn);
        children.appendChild(volRow);
      }
      row.appendChild(toggle);
      row.appendChild(nameBtn);
      attList.appendChild(row);
      attList.appendChild(children);
    } else {
      row.appendChild(makeTreePlaceholder());
      row.appendChild(nameBtn);
      attList.appendChild(row);
    }
  }

  // Materials (expandable tree with texture thumbnails)
  matList.innerHTML = '';
  const matItems = buildMaterialList(sections.model, sections);
  if (matItems.length) {
    matPanel.style.display = 'block';
    for (const mat of matItems) {
      const row = document.createElement('div');
      row.className = 'tree-row';
      if (mat.textures.length) {
        const toggle = makeTreeToggle();
        const children = document.createElement('div');
        children.className = 'tree-children';
        children.style.display = 'none';
        let loaded = false;
        toggle.addEventListener('click', () => {
          const open = toggleTreeNode(toggle, children);
          if (open && !loaded) {
            loaded = true;
            children.querySelectorAll('img.tex-thumb[data-url]').forEach(async img => {
              const url = img.dataset.url;
              if (!url) return;
              const dataUrl = await renderTextureThumbnail(url);
              if (dataUrl) img.src = dataUrl;
            });
          }
        });
        row.appendChild(toggle);
        const nameBtn = document.createElement('button');
        nameBtn.className = 'tree-name-btn';
        nameBtn.textContent = mat.name;
        nameBtn.title = mat.name;
        nameBtn.addEventListener('click', () => toggleMatOutline(mat.name, nameBtn));
        row.appendChild(nameBtn);
        for (const { label, filename } of mat.textures) {
          const url = getTextureUrl(filename) ?? '';
          const tRow = document.createElement('div');
          tRow.className = 'tree-tex-row';
          const img = document.createElement('img');
          img.className = 'tex-thumb';
          img.dataset.url = url;
          img.src = TEX_PLACEHOLDER;
          img.title = filename;
          img.addEventListener('click', () => openTexModal(mat.name, label, filename, img.src !== TEX_PLACEHOLDER ? img.src : url, img, tRow));
          const info = document.createElement('span');
          info.className = 'tree-tex-info';
          info.style.cursor = 'pointer';
          info.innerHTML = `<span class="tex-label">${label}</span><span class="tex-name" title="${filename}">${filename}</span>`;
          info.addEventListener('click', () => openTexModal(mat.name, label, filename, img.src !== TEX_PLACEHOLDER ? img.src : url, img, tRow));
          tRow.append(img, info);
          children.appendChild(tRow);
        }
        matList.appendChild(row);
        matList.appendChild(children);
      } else {
        row.appendChild(makeTreePlaceholder());
        const nameBtn2 = document.createElement('button');
        nameBtn2.className = 'tree-name-btn';
        nameBtn2.textContent = mat.name;
        nameBtn2.title = mat.name;
        nameBtn2.addEventListener('click', () => toggleMatOutline(mat.name, nameBtn2));
        row.appendChild(nameBtn2);
        matList.appendChild(row);
      }
    }
  } else {
    matPanel.style.display = 'none';
  }

  // Bones (expandable recursive tree with triangle markers)
  boneMarkers.clear();
  boneList.innerHTML = '';
  const boneHier = buildBoneHierarchy(sections.model, sections);
  if (boneHier.length) {
    bonePanel.style.display = 'block';
    const childrenOf = new Map();
    for (const bone of boneHier) {
      if (bone.parentIndex >= 0) {
        if (!childrenOf.has(bone.parentIndex)) childrenOf.set(bone.parentIndex, []);
        childrenOf.get(bone.parentIndex).push(bone);
      }
    }
    function renderBoneTree(bones, container) {
      for (const bone of bones) {
        const ch = childrenOf.get(bone.index) ?? [];
        const row = document.createElement('div');
        row.className = 'tree-row';
        let childDiv = null;
        if (ch.length) {
          const toggle = makeTreeToggle();
          childDiv = document.createElement('div');
          childDiv.className = 'tree-children';
          childDiv.style.display = 'none';
          toggle.addEventListener('click', () => toggleTreeNode(toggle, childDiv));
          row.appendChild(toggle);
        } else {
          row.appendChild(makeTreePlaceholder());
        }
        const nameBtn = document.createElement('button');
        nameBtn.className = 'tree-name-btn';
        nameBtn.textContent = bone.name;
        nameBtn.addEventListener('click', () => toggleBoneMarker(bone, nameBtn));
        row.appendChild(nameBtn);
        container.appendChild(row);
        if (childDiv) {
          renderBoneTree(ch, childDiv);
          container.appendChild(childDiv);
        }
      }
    }
    renderBoneTree(boneHier.filter(b => b.parentIndex < 0), boneList);
  } else {
    bonePanel.style.display = 'none';
  }

  // Hit volumes panel (currentHitVolumes already built above)
  const hasHitVols = currentHitVolumes.tight || currentHitVolumes.hittests.length;
  if (hasHitVols) {
    hitPanel.style.display = 'block';
    const addVolBtn = (label, vol, color) => {
      const btn = document.createElement('button');
      const tag = document.createElement('span');
      tag.className = 'vol-tag';
      tag.textContent = ['Cuboid', 'Sphere', 'Capsule'][vol.shape] ?? '?';
      btn.appendChild(document.createTextNode(label));
      btn.appendChild(tag);
      btn.addEventListener('click', () => toggleHitVolume(vol, btn, color));
      hitList.appendChild(btn);
    };
    if (currentHitVolumes.tight) addVolBtn('Tight Hit Test', currentHitVolumes.tight, 0x44ffff);
    currentHitVolumes.hittests.forEach((v, i) => addVolBtn(`Hit Test ${i}`, v, 0xff44ff));
  } else {
    hitPanel.style.display = 'none';
  }

  // Lights panel
  lightList.innerHTML = '';
  const lights = buildLights(sections.model, sections);
  if (lights.length) {
    lightPanel.style.display = 'block';
    for (const lt of lights) {
      const btn = document.createElement('button');
      const tag = document.createElement('span');
      tag.className = 'vol-tag';
      tag.textContent = lt.shape;
      btn.appendChild(document.createTextNode(lt.name));
      btn.appendChild(tag);
      lightList.appendChild(btn);
    }
  } else {
    lightPanel.style.display = 'none';
  }

  // Turrets panel
  turretList.innerHTML = '';
  const turrets = buildTurrets(sections.model, sections);
  if (turrets.length) {
    turretPanel.style.display = 'block';
    for (const turret of turrets) {
      const row = document.createElement('div');
      row.className = 'tree-row';
      if (turret.parts.length) {
        const toggle = makeTreeToggle();
        const children = document.createElement('div');
        children.className = 'tree-children';
        children.style.display = 'none';
        toggle.addEventListener('click', () => toggleTreeNode(toggle, children));
        for (const part of turret.parts) {
          const pRow = document.createElement('div');
          pRow.className = 'tree-row';
          pRow.appendChild(makeTreePlaceholder());
          const lbl = document.createElement('span');
          lbl.className = 'tree-label';
          lbl.textContent = part.boneName;
          pRow.appendChild(lbl);
          children.appendChild(pRow);
        }
        row.appendChild(toggle);
        row.appendChild(makeTreeLabel(turret.name));
        turretList.appendChild(row);
        turretList.appendChild(children);
      } else {
        row.appendChild(makeTreePlaceholder());
        row.appendChild(makeTreeLabel(turret.name));
        turretList.appendChild(row);
      }
    }
  } else {
    turretPanel.style.display = 'none';
  }

  const bbox = new THREE.Box3().setFromObject(group);
  const center = bbox.getCenter(new THREE.Vector3());
  const radius = bbox.getSize(new THREE.Vector3()).length() * 0.5;
  group.userData.modelRadius = radius;
  // Fit grid to model: 0.5-unit cells, span ~10x model radius
  const gridSpan = Math.ceil(radius * 10);
  const gridDivs = Math.max(10, Math.round(gridSpan / 0.5));
  scene.remove(gridHelper);
  gridHelper = new THREE.GridHelper(gridSpan, gridDivs, 0x444444, 0x333333);
  gridHelper.visible = axesHelper.visible; // inherit current toggle state
  gridHelper.position.set(0, 0, 0);
  scene.add(gridHelper);
  axesHelper.scale.setScalar(radius * 0.5);
  groundMesh.scale.setScalar(gridSpan);
  groundMesh.material.map.repeat.set(gridSpan / 2, gridSpan / 2);
  groundMesh.material.map.needsUpdate = true;
  const fovY = camera.fov * Math.PI / 180;
  const dist = (radius / Math.sin(fovY / 2)) * 1.3;
  camera.near = Math.max(0.1, dist * 0.005);
  camera.far = dist * 50;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(new THREE.Vector3(0.3, 0.5, 1).normalize(), dist);
  controls.update();
  downloadBtn.disabled = false;
  screenshotBtn.disabled = false;
  setStatus(`Loaded`);
}

async function triggerLoad() {
  try {
    exportBtn.disabled = true;
    if (useGithub) {
      const model = getCurrentGhModel();
      if (!model) return;
      setUrlParams({ src: 'gh', gh: model.name }, model.name.replace(/\.m3$/i, ''));
      await loadModel(rawUrl(model.repo, model.name), {
        textureResolver: makeTextureResolver(ghTexIndex),
      });
    } else {
      const localModel = getCurrentLocalModel();
      if (!localModel) return;
      setUrlParams({ src: 'local', race: localModel.folder, unit: localModel.model }, localModel.model);
      await loadModel(`./assets/Units/${localModel.folder}/${localModel.model}.m3`, {
        textureBasePath: './assets/Textures',
        onTextureMissing: async (filename, mat) => {
          if (!filename) return;
          if (!Object.keys(ghTexIndex).length) {
            try { ghTexIndex = await buildTextureIndex(); } catch { return; }
          }
          const entry = ghTexIndex[filename.toLowerCase()];
          if (!entry) return;
          const tex = ddsLoader.load(rawUrl(entry.repo, entry.name));
          tex.flipY = false;
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        },
      });
    }
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  } finally {
    exportBtn.disabled = false;
  }
}

// ── GLB export ────────────────────────────────────────────────────────────────

function saveArrayBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function decompressTexture(compressedTex) {
  const w = compressedTex.mipmaps[0]?.width ?? compressedTex.image?.width ?? 1;
  const h = compressedTex.mipmaps[0]?.height ?? compressedTex.image?.height ?? 1;
  const rt = new THREE.WebGLRenderTarget(w, h);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tmpScene = new THREE.Scene();
  tmpScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: compressedTex, depthTest: false })));
  const tmpRenderer = new THREE.WebGLRenderer();
  tmpRenderer.setSize(w, h);
  tmpRenderer.setRenderTarget(rt);
  tmpRenderer.render(tmpScene, ortho);
  tmpRenderer.setRenderTarget(null);
  tmpRenderer.dispose();

  const pixels = new Uint8Array(w * h * 4);
  const gl = tmpRenderer.getContext();
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  for (let row = 0; row < h; row++) {
    const src = (h - 1 - row) * w * 4;
    imgData.data.set(pixels.subarray(src, src + w * 4), row * w * 4);
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  return tex;
}

function exportGLB() {
  if (!currentGroup) return setStatus('Load a model first');
  setStatus('Preparing textures…');
  const replacements = [];
  currentGroup.traverse((obj) => {
    if (!obj.isMesh) return;
    const mat = obj.material;
    if (mat?.map?.isCompressedTexture) {
      const canvas = decompressTexture(mat.map);
      replacements.push({ mat, original: mat.map, canvas });
      mat.map = canvas;
      mat.needsUpdate = true;
    }
  });

  const restore = () => {
    for (const { mat, original, canvas } of replacements) {
      mat.map = original; mat.needsUpdate = true; canvas.dispose();
    }
  };

  new GLTFExporter().parse(
    currentGroup,
    (gltf) => {
      restore();
      if (gltf instanceof ArrayBuffer) {
        const name = ghSearch.value || localSearch.value || 'model';
        saveArrayBuffer(gltf, `${name}.glb`);
        setStatus('Exported');
      } else {
        setStatus('Export failed: unexpected output');
      }
    },
    (err) => { restore(); setStatus(`Export error: ${err.message}`); },
    { binary: true }
  );
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function downloadZip() {
  if (!currentModelUrl || !currentSections) return setStatus('Load a model first');

  const modelName = currentModelUrl.split('/').pop();
  const zipName = modelName.replace(/\.m3$/i, '');

  const filenames = getModelTextureFilenames(currentSections.model, currentSections);
  const total = 1 + filenames.size;
  let done = 0;
  setStatus(`Downloading 0/${total}…`);

  const zip = new JSZip();

  // Add the M3 file
  const m3Res = await fetch(currentModelUrl);
  if (m3Res.ok) zip.file(modelName, await m3Res.arrayBuffer());
  setStatus(`Downloading ${++done}/${total}…`);

  // Add textures
  const texFolder = zip.folder('textures');
  await Promise.all([...filenames].map(async (filename) => {
    const url = currentTextureResolver
      ? currentTextureResolver(filename)
      : currentTextureBasePath ? `${currentTextureBasePath}/${filename}` : null;
    if (!url) { done++; return; }
    try {
      const res = await fetch(url);
      if (res.ok) texFolder.file(filename, await res.arrayBuffer());
    } catch {}
    setStatus(`Downloading ${++done}/${total}…`);
  }));

  setStatus('Creating ZIP…');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${zipName}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus(`Downloaded ${zipName}.zip`);
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

const TEX_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function makeTreeToggle() {
  const btn = document.createElement('button');
  btn.className = 'tree-toggle';
  btn.textContent = '+';
  return btn;
}

function makeTreePlaceholder() {
  const span = document.createElement('span');
  span.className = 'tree-toggle-ph';
  return span;
}

function makeTreeLabel(text) {
  const span = document.createElement('span');
  span.className = 'tree-label';
  span.textContent = text;
  return span;
}

function toggleTreeNode(toggleBtn, childrenDiv) {
  const open = childrenDiv.style.display === 'none';
  childrenDiv.style.display = open ? '' : 'none';
  toggleBtn.textContent = open ? '−' : '+';
  return open;
}

// ── Texture thumbnails ────────────────────────────────────────────────────────

function getTextureUrl(filename) {
  if (!filename) return null;
  if (currentTextureResolver) return currentTextureResolver(filename);
  if (currentTextureBasePath) return `${currentTextureBasePath}/${filename}`;
  return null;
}

async function renderTextureThumbnail(url) {
  try {
    const blob = await window.textureRenderer.loadAndRender(url);
    return URL.createObjectURL(blob);
  } catch { return null; }
}

// ── Screenshot ────────────────────────────────────────────────────────────────

function takeScreenshot() {
  if (!currentGroup) return setStatus('Load a model first');
  const name = ghSearch.value || localSearch.value || 'model';

  // Hide all markers for the shot
  for (const m of attMarkers.values()) m.visible = false;
  for (const m of atvlMarkers.values()) m.visible = false;
  for (const m of boneMarkers.values()) m.visible = false;
  for (const m of hitMarkers.values()) m.visible = false;

  const bg = scene.background;
  scene.background = null;
  renderer.render(scene, camera);
  scene.background = bg;

  // ── Compute model screen-space bounding box ───────────────────────────────
  const PW = renderer.domElement.width;   // physical pixels
  const PH = renderer.domElement.height;

  const bbox = new THREE.Box3().setFromObject(currentGroup);
  const corners = [
    new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
    new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
    new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
    new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
    new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
    new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
    new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
    new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z),
  ];

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const _ndc = new THREE.Vector3();
  for (const c of corners) {
    _ndc.copy(c).project(camera);
    if (Math.abs(_ndc.z) > 1.0) continue; // behind camera or beyond far plane
    const px = (_ndc.x + 1) / 2 * PW;
    const py = (1 - (_ndc.y + 1) / 2) * PH;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px);
    y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  // Fallback: use full canvas if projection failed
  if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = PW; y1 = PH; }

  // 5% padding, then make square from centre
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.05 + 4);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(PW, x1 + pad); y1 = Math.min(PH, y1 + pad);

  const size = Math.ceil(Math.max(x1 - x0, y1 - y0));
  const cx   = Math.round((x0 + x1) / 2);
  const cy   = Math.round((y0 + y1) / 2);
  let sx = Math.max(0, cx - Math.floor(size / 2));
  let sy = Math.max(0, cy - Math.floor(size / 2));
  if (sx + size > PW) sx = PW - size;
  if (sy + size > PH) sy = PH - size;
  sx = Math.max(0, sx); sy = Math.max(0, sy);
  const finalSize = Math.min(size, PW - sx, PH - sy);

  // Crop to square canvas and download
  const out = document.createElement('canvas');
  out.width = out.height = finalSize;
  out.getContext('2d').drawImage(renderer.domElement, sx, sy, finalSize, finalSize, 0, 0, finalSize, finalSize);

  // Restore markers
  for (const m of attMarkers.values()) m.visible = true;
  for (const m of atvlMarkers.values()) m.visible = true;
  for (const m of boneMarkers.values()) m.visible = true;
  for (const m of hitMarkers.values()) m.visible = true;

  const link = document.createElement('a');
  link.href = out.toDataURL('image/png');
  link.download = `${name}.png`;
  link.click();
  setStatus(`Screenshot saved (${finalSize}×${finalSize}px)`);
}

// ── Animations ────────────────────────────────────────────────────────────────

function toggleAnim(clip, btn) {
  if (!mixer) return;
  if (activeActions.has(clip.name)) {
    activeActions.get(clip.name).stop();
    activeActions.delete(clip.name);
    btn?.classList.remove('active');
    return;
  }

  // If non-concurrent, stop other non-concurrent actions of lower-or-equal priority
  if (!clip.userData.concurrent) {
    for (const [name, action] of activeActions) {
      const other = currentClips.find((c) => c.name === name);
      if (other && !other.userData.concurrent && (other.userData.priority ?? 0) <= (clip.userData.priority ?? 0)) {
        action.stop();
        activeActions.delete(name);
        animList.querySelector(`[data-clip-name="${CSS.escape(name)}"]`)?.classList.remove('active');
      }
    }
  }

  const action = mixer.clipAction(clip);
  action.reset().play();
  activeActions.set(clip.name, action);
  btn?.classList.add('active');
}

// ── Attachment point markers ──────────────────────────────────────────────────

const _boneWorldPos = new THREE.Vector3();
const _childWorldPos = new THREE.Vector3();

function estimateBoneLength(threeBone) {
  const childBones = threeBone.children.filter(c => c.isBone);
  if (childBones.length > 0) {
    threeBone.getWorldPosition(_boneWorldPos);
    let best = 0;
    for (const child of childBones) {
      child.getWorldPosition(_childWorldPos);
      const d = _boneWorldPos.distanceTo(_childWorldPos);
      if (d > best) best = d;
    }
    if (best > 0.001) return best;
  }
  // Leaf bone fallback: fraction of model bounding radius
  const modelRadius = currentGroup?.userData?.modelRadius ?? 50;
  return modelRadius * 0.08;
}

function makeMarker(name, color, threeBone) {
  const size = estimateBoneLength(threeBone);
  const w = size * 0.25; // half-width of triangle base
  const tri = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, size, 0),  // tip — points along bone +Y (head → tail)
      new THREE.Vector3(-w, 0, 0),
      new THREE.Vector3(w, 0, 0),
      new THREE.Vector3(0, size, 0),
    ]),
    new THREE.LineBasicMaterial({ color, depthTest: false })
  );
  tri.name = `Marker_${name}`;
  tri.renderOrder = 999;
  return tri;
}

function makeAttMarker(name, bone) { return makeMarker(name, 0xffcc00, bone); }
function makeBoneMarker(name, bone) { return makeMarker(name, 0x44ffff, bone); }

function makeVolumeWireframe(vol, color) {
  let innerGeo;
  if (vol.shape === 1) {
    innerGeo = new THREE.SphereGeometry(vol.size0, 12, 8);
  } else if (vol.shape === 2) {
    // Capsule: size0=radius, size1=cylindrical length; vol.matrix4 encodes orientation
    innerGeo = new THREE.CapsuleGeometry(Math.max(vol.size0, 0.01), Math.max(vol.size1, 0), 4, 8);
  } else {
    innerGeo = new THREE.BoxGeometry(
      Math.max(vol.size0 * 2, 0.01),
      Math.max(vol.size2 * 2, 0.01),
      Math.max(vol.size1 * 2, 0.01)
    );
  }
  const lines = new THREE.LineSegments(
    new THREE.WireframeGeometry(innerGeo),
    new THREE.LineBasicMaterial({ color, depthTest: false })
  );
  lines.renderOrder = 998;
  lines.matrix.copy(vol.matrix4);
  lines.matrixAutoUpdate = false;
  return lines;
}

function toggleAttMarker(att, btn) {
  if (attMarkers.has(att.boneIndex)) {
    attMarkers.get(att.boneIndex).parent?.remove(attMarkers.get(att.boneIndex));
    attMarkers.delete(att.boneIndex);
    btn.classList.remove('active');
    return;
  }
  const bones = currentGroup?.userData?.bones;
  const bone = bones?.[att.boneIndex];
  if (!bone) return;
  const marker = makeAttMarker(att.name, bone);
  bone.add(marker);
  attMarkers.set(att.boneIndex, marker);
  btn.classList.add('active');
}

function toggleAtvlVolume(vol, btn) {
  const key = vol.index;
  if (atvlMarkers.has(key)) {
    atvlMarkers.get(key).parent?.remove(atvlMarkers.get(key));
    atvlMarkers.delete(key);
    btn.classList.remove('active');
    return;
  }
  const bones = currentGroup?.userData?.bones;
  const bone = bones?.[vol.bone0];
  if (!bone) return;
  const mesh = makeVolumeWireframe(vol, 0x44ff44);
  bone.add(mesh);
  atvlMarkers.set(key, mesh);
  btn.classList.add('active');
}

function toggleMatOutline(matName, btn) {
  if (matOutlines.has(matName)) {
    for (const m of matOutlines.get(matName)) m.parent?.remove(m);
    matOutlines.delete(matName);
    btn.classList.remove('active');
    return;
  }
  if (!currentGroup) return;
  const matSet = currentGroup.userData.matNameToMaterials?.get(matName);
  if (!matSet) return;
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, side: THREE.BackSide, depthTest: false, depthWrite: false });
  outlineMat.renderOrder = 999;
  const meshes = [];
  currentGroup.traverse(obj => {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    if ((obj.isMesh || obj.isSkinnedMesh) && mats.some(m => matSet.has(m))) {
      let outline;
      if (obj.isSkinnedMesh) {
        outline = new THREE.SkinnedMesh(obj.geometry, outlineMat);
        outline.bind(obj.skeleton, obj.bindMatrix);
      } else {
        outline = new THREE.Mesh(obj.geometry, outlineMat);
        outline.matrix.copy(obj.matrix);
        outline.matrixAutoUpdate = false;
      }
      outline.scale.setScalar(1.02);
      outline.renderOrder = 999;
      obj.parent.add(outline);
      meshes.push(outline);
    }
  });
  if (meshes.length) { matOutlines.set(matName, meshes); btn.classList.add('active'); }
}

function toggleBoneMarker(bone, btn) {
  if (boneMarkers.has(bone.index)) {
    boneMarkers.get(bone.index).parent?.remove(boneMarkers.get(bone.index));
    boneMarkers.delete(bone.index);
    btn.classList.remove('active');
    return;
  }
  const bones = currentGroup?.userData?.bones;
  const threeBone = bones?.[bone.index];
  if (!threeBone) return;
  const marker = makeBoneMarker(bone.name, threeBone);
  threeBone.add(marker);
  boneMarkers.set(bone.index, marker);
  btn.classList.add('active');
}

function toggleHitVolume(vol, btn, color) {
  const key = `${color}_${vol.index}`;
  if (hitMarkers.has(key)) {
    hitMarkers.get(key).parent?.remove(hitMarkers.get(key));
    hitMarkers.delete(key);
    btn.classList.remove('active');
    return;
  }
  if (!currentGroup) return;
  const mesh = makeVolumeWireframe(vol, color);
  // SSGS matrices need a 90° X-axis rotation to align with Three.js Y-up convention
  mesh.matrix.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

  const bones = currentGroup.userData?.bones;
  const bone = (vol.boneIndex != null && vol.boneIndex >= 0) ? bones?.[vol.boneIndex] : null;

  if (bone) {
    bone.add(mesh);
  } else {
    currentGroup.add(mesh);
  }

  hitMarkers.set(key, mesh);
  btn.classList.add('active');
}

// ── Panel collapse ────────────────────────────────────────────────────────────

function makePanelToggle(listEl, toggleEl) {
  let open = true;
  return () => {
    open = !open;
    listEl.style.display = open ? '' : 'none';
    toggleEl.textContent = open ? '▲' : '▼';
  };
}

document.querySelector('#bounds-panel .panel-header').addEventListener('click',
  makePanelToggle(boundsList, boundsToggle));
document.querySelector('#anim-panel .panel-header').addEventListener('click',
  makePanelToggle(animList, animToggle));
document.querySelector('#att-panel .panel-header').addEventListener('click',
  makePanelToggle(attList, attToggle));
document.querySelector('#mat-panel .panel-header').addEventListener('click',
  makePanelToggle(matList, matToggle));
document.querySelector('#bone-panel .panel-header').addEventListener('click',
  makePanelToggle(boneList, boneToggle));
document.querySelector('#hit-panel .panel-header').addEventListener('click',
  makePanelToggle(hitList, hitToggle));
document.querySelector('#light-panel .panel-header').addEventListener('click',
  makePanelToggle(lightList, lightToggle));
document.querySelector('#turret-panel .panel-header').addEventListener('click',
  makePanelToggle(turretList, turretToggle));

exportBtn.addEventListener('click', exportGLB);
downloadBtn.addEventListener('click', downloadZip);
screenshotBtn.addEventListener('click', takeScreenshot);
localSearch.addEventListener('input', () => {
  populateLocalDropdown(localSearch.value);
});

localSearch.addEventListener('focus', () => {
  populateLocalDropdown(localSearch.value);
});

localSearch.addEventListener('blur', () => {
  // Delay hiding to allow clicks on dropdown items
  setTimeout(() => {
    localDropdown.style.display = 'none';
  }, 150);
});

ghSearch.addEventListener('input', () => {
  filterGhList(ghSearch.value);
});

ghSearch.addEventListener('focus', () => {
  if (ghModels.length > 0) {
    filterGhList(ghSearch.value);
  }
});

ghSearch.addEventListener('blur', () => {
  // Delay hiding to allow clicks on dropdown items
  setTimeout(() => {
    ghSel.style.display = 'none';
  }, 150);
});

// ── GitHub auth ───────────────────────────────────────────────────────────────

function updateAuthBtn() {
  if (!GITHUB_CLIENT_ID) {
    ghAuthBtn.textContent = 'Set client_id in github.js';
    ghAuthBtn.disabled = true;
    return;
  }
  ghAuthBtn.textContent = getToken() ? '✓ Connected' : 'Connect GitHub';
  ghAuthBtn.disabled = false;
}

let deviceFlowAbort = null;

ghAuthBtn.addEventListener('click', async () => {
  if (getToken()) {
    setToken('');
    clearCache();
    ghModels = [];
    ghTexIndex = {};
    updateAuthBtn();
    setStatus('Disconnected');
    return;
  }
  deviceFlowAbort = new AbortController();
  authModal.classList.add('open');

  for await (const evt of startDeviceFlow(deviceFlowAbort.signal)) {
    if (evt.step === 'code') {
      authCode.textContent = evt.userCode;
      authOpen.href = evt.verificationUri;
    } else if (evt.step === 'done') {
      authModal.classList.remove('open');
      updateAuthBtn();
      clearCache();
      ghModels = [];
      ghTexIndex = {};
      initGithub();
    } else {
      authModal.classList.remove('open');
      setStatus(`Auth error: ${evt.message}`);
    }
  }
});

authCancel.addEventListener('click', () => {
  deviceFlowAbort?.abort();
  authModal.classList.remove('open');
});
srcLocal.addEventListener('click', () => setSource(false));
srcGithub.addEventListener('click', () => setSource(true));

updateAuthBtn();
populateLocalList();
initScene();

const { src, race, unit, gh } = getUrlParams();
if (src === 'gh') {
  setSource(true);
  initGithub().then(() => {
    if (gh) {
      ghSearch.value = gh.replace(/\.m3$/i, '');
      filterGhList(ghSearch.value);
      if (getCurrentGhModel()) triggerGhLoad();
    }
  });
} else if (race && unit) {
  localSearch.value = `${race}/${unit}`;
  triggerLoad();
} else {
  setStatus('Ready');
}