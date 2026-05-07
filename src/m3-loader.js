import * as THREE from 'three';
const STRUCTURES_XML_EMBEDDED = `<xml>...</xml>`;
const isNode = typeof process !== 'undefined' && process.versions?.node != null;

let fs, path, __dirnameNode, GLTFExporter, DOMParser;

if (isNode) {
  fs = (await import('fs')).default;
  path = (await import('path')).default;
  const { fileURLToPath } = await import('url');
  __dirnameNode = path.dirname(fileURLToPath(import.meta.url));
  ({ GLTFExporter } = await import('../vendor/GLTFExporter.js'));
  ({ DOMParser } = await import('xmldom'));

  if (typeof FileReader === 'undefined') {
    global.FileReader = class {
      readAsArrayBuffer(blob) {
        blob.arrayBuffer().then((ab) => { this.result = ab; this.onloadend?.(); });
      }
      readAsDataURL(blob) {
        blob.arrayBuffer().then((ab) => {
          const b64 = Buffer.from(ab).toString('base64');
          this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
          this.onloadend?.();
        });
      }
    };
  }
} else {
  DOMParser = globalThis.DOMParser;
}

const primitiveFieldInfo = {
  uint8: { size: 1, getter: 'getUint8', setter: 'setUint8' },
  int16: { size: 2, getter: 'getInt16', setter: 'setInt16' },
  uint16: { size: 2, getter: 'getUint16', setter: 'setUint16' },
  int32: { size: 4, getter: 'getInt32', setter: 'setInt32' },
  uint32: { size: 4, getter: 'getUint32', setter: 'setUint32' },
  uint64: { size: 8, getter: 'getBigUint64', setter: 'setBigUint64' },
  float: { size: 4, getter: 'getFloat32', setter: 'setFloat32' },
};

export let structures = {};

export class M3Field {
  constructor(name) {
    this.name = name;
    this.size = 0;
  }

  fromBuffer(data, buffer, offset) {
    throw new Error('fromBuffer not implemented');
  }

  toBuffer(data, buffer, offset) {
    throw new Error('toBuffer not implemented');
  }
}

export class M3FieldPrimitive extends M3Field {
  constructor(name, type, defaultValue = 0, expectedValue = null) {
    super(name);
    this.type = type;
    this.defaultValue = defaultValue;
    this.expectedValue = expectedValue;
    this.structInfo = primitiveFieldInfo[type];
    this.size = this.structInfo.size;
  }

  fromBuffer(data, buffer, offset) {
    const view = new DataView(buffer, offset, this.size);
    const value = view[this.structInfo.getter](0, true);
    if (this.expectedValue !== null && value !== this.expectedValue) {
      console.warn(`${data.desc.history.name}V${data.desc.version}.${this.name} expected ${this.expectedValue} but got ${value}`);
    }
    data[this.name] = value;
  }

  toBuffer(data, buffer, offset) {
    const view = new DataView(buffer, offset, this.size);
    view[this.structInfo.setter](0, data[this.name], true);
  }
}

export class M3FieldBytes extends M3FieldPrimitive {
  constructor(name, size, defaultValue, expectedValue = null) {
    super(name, 'uint8', defaultValue, expectedValue);
    this.size = size;
  }

  fromBuffer(data, buffer, offset) {
    const bytes = new Uint8Array(buffer, offset, this.size);
    data[this.name] = new Uint8Array(bytes);
  }

  toBuffer(data, buffer, offset) {
    const bytes = data[this.name];
    new Uint8Array(buffer, offset, this.size).set(bytes);
  }
}

export class M3FieldStructure extends M3Field {
  constructor(name, desc, refTo = '') {
    super(name);
    this.desc = desc;
    this.size = desc.size;
    this.refTo = refTo;
  }

  fromBuffer(data, buffer, offset) {
    const nested = this.desc.instance(buffer, offset);
    if (this.refTo) {
      nested.__refTo = this.refTo;
    }
    data[this.name] = nested;
  }

  toBuffer(data, buffer, offset) {
    const instance = data[this.name];
    instance.toBuffer(buffer, offset);
  }
}

export class M3StructureHistory {
  constructor(name, versionToSize, fieldRecords) {
    this.name = name;
    this.primitive = ['U8__', 'I16_', 'U16_', 'I32_', 'U32_', 'I64_', 'U64_', 'FLAG', 'REAL', 'CHAR'].includes(name);
    this.versionToSize = versionToSize;
    this.fieldRecords = fieldRecords;
    this.versionToDescription = new Map();
    for (const version of versionToSize.keys()) {
      this.getVersion(version);
    }
  }

  getVersion(version, mdVersion = 34) {
    const descId = `MD${mdVersion}_${version}`;
    if (this.versionToDescription.has(descId)) {
      return this.versionToDescription.get(descId);
    }

    const fields = {};
    for (const { field, sinceVersion, tillVersion } of this.fieldRecords) {
      if (version < sinceVersion || version > tillVersion) continue;
      if (field instanceof M3FieldStructure && mdVersion === 33 && field.desc.history.name === 'Reference') {
        const smallRefDesc = structures['SmallReference'].getVersion(field.desc.version, mdVersion);
        fields[field.name] = new M3FieldStructure(field.name, smallRefDesc, field.refTo);
      } else {
        fields[field.name] = field;
      }
    }

    const size = Object.values(fields).reduce((sum, f) => sum + f.size, 0);
    const requestedSize = this.versionToSize.get(version);
    if (requestedSize !== undefined && requestedSize !== size && mdVersion === 34) {
      console.warn(`Size mismatch for ${this.name}V${version}: expected ${requestedSize}, actual ${size}`);
    }

    const desc = new M3StructureDescription(this, version, fields, size);
    this.versionToDescription.set(descId, desc);
    return desc;
  }
}

export class M3StructureDescription {
  constructor(history, version, fields, size) {
    this.history = history;
    this.version = version;
    this.fields = fields;
    this.size = size;
  }

  instance(buffer, offset = 0) {
    return new M3StructureData(this, buffer, offset);
  }

  instances(buffer, count) {
    if (this.history.primitive) {
      const values = [];
      const field = this.fields['value'];
      const view = new DataView(buffer);
      for (let ii = 0; ii < count; ii += 1) {
        values.push(view[field.structInfo.getter](ii * field.size, true));
      }
      return values;
    }

    const values = [];
    for (let ii = 0; ii < count; ii += 1) {
      values.push(this.instance(buffer, ii * this.size));
    }
    return values;
  }

  static getVertexDescription(vertexFlags) {
    const fields = {};
    let size = 0;
    const addField = (field) => { fields[field.name] = field; size += field.size; };

    addField(new M3FieldStructure('pos', structures['VEC3'].getVersion(0)));
    const lookupPairs = (vertexFlags & 0x20 ? 2 : 0) + (vertexFlags & 0x40 ? 2 : 0);
    for (let ii = 0; ii < lookupPairs; ii += 1) addField(new M3FieldPrimitive(`weight${ii}`, 'uint8'));
    for (let ii = 0; ii < lookupPairs; ii += 1) addField(new M3FieldPrimitive(`lookup${ii}`, 'uint8'));
    if (vertexFlags & 0x80) addField(new M3FieldStructure('normalf', structures['VEC3'].getVersion(0)));
    if (vertexFlags & 0x0800000) {
      addField(new M3FieldStructure('normal', structures['Vector3As3uint8'].getVersion(0)));
      addField(new M3FieldPrimitive('sign', 'uint8'));
    }
    if (vertexFlags & 0x100) addField(new M3FieldPrimitive('test100', 'uint32', 0));
    if (vertexFlags & 0x200) addField(new M3FieldStructure('col', structures['COL'].getVersion(0)));
    if (vertexFlags & 0x400) addField(new M3FieldPrimitive('test400', 'uint32', 0));
    if (vertexFlags & 0x800) addField(new M3FieldPrimitive('test800', 'uint32', 0xffffffff));
    if (vertexFlags & 0x1000) addField(new M3FieldPrimitive('test1000', 'uint32', 0xffffffff));
    let uvCoords = 0;
    if (vertexFlags & 0x00020000) uvCoords += 1;
    if (vertexFlags & 0x00040000) uvCoords += 1;
    if (vertexFlags & 0x00080000) uvCoords += 1;
    if (vertexFlags & 0x00100000) uvCoords += 1;
    if (vertexFlags & 0x40000000) uvCoords += 1;
    if (vertexFlags & 0x2000) addField(new M3FieldStructure('fuv0', structures['VEC2'].getVersion(0)));
    if (vertexFlags & 0x4000) addField(new M3FieldStructure('fuv1', structures['VEC2'].getVersion(0)));
    if (vertexFlags & 0x8000) addField(new M3FieldStructure('fuv2', structures['VEC2'].getVersion(0)));
    if (vertexFlags & 0x10000) addField(new M3FieldStructure('fuv3', structures['VEC2'].getVersion(0)));
    for (let ii = 0; ii < uvCoords; ii += 1) addField(new M3FieldStructure(`uv${ii}`, structures['Vector2As2int16'].getVersion(0)));
    if (vertexFlags & 0x200000) addField(new M3FieldStructure('normalf', structures['VEC3'].getVersion(0)));
    if (vertexFlags & 0x400000) addField(new M3FieldStructure('tanf', structures['VEC3'].getVersion(0)));
    if (vertexFlags & 0x1000000) {
      addField(new M3FieldStructure('tan', structures['Vector3As3uint8'].getVersion(0)));
      addField(new M3FieldPrimitive('unused', 'uint8'));
    }
    if (vertexFlags & 0x2000000) addField(new M3FieldPrimitive('test2000000', 'uint32', 10000));
    if (vertexFlags & 0x4000000) {
      addField(new M3FieldPrimitive('test4000000', 'uint32', 10000));
      addField(new M3FieldPrimitive('test4000001', 'uint32', 10000));
      addField(new M3FieldPrimitive('test4000002', 'uint32', 10000));
    }
    if (vertexFlags & 0x8000000) {
      addField(new M3FieldPrimitive('test8000000', 'uint32', 10000));
      addField(new M3FieldPrimitive('test8000001', 'uint32', 10000));
      addField(new M3FieldPrimitive('test8000002', 'uint32', 10000));
    }
    if (vertexFlags & 0x10000000) addField(new M3FieldPrimitive('test10000000', 'uint32', 10000));
    if (vertexFlags & 0x20000000) addField(new M3FieldPrimitive('test20000000', 'uint32', 10000));

    return new M3StructureDescription(new M3StructureHistory(`VertexFormat${vertexFlags.toString(16).padStart(8, '0')}`, new Map(), []), 0, fields, size);
  }
}

export class M3StructureData {
  constructor(desc, buffer, offset = 0) {
    this.desc = desc;
    if (buffer) {
      this.fromBuffer(buffer, offset);
    } else {
      for (const field of Object.values(desc.fields)) {
        if (field instanceof M3FieldStructure) {
          this[field.name] = field.desc.instance();
        } else {
          this[field.name] = field.defaultValue;
        }
      }
    }
  }

  fromBuffer(buffer, offset = 0) {
    let fieldOffset = offset;
    for (const field of Object.values(this.desc.fields)) {
      field.fromBuffer(this, buffer, fieldOffset);
      fieldOffset += field.size;
    }
  }

  toBuffer(buffer, offset = 0) {
    let fieldOffset = offset;
    for (const field of Object.values(this.desc.fields)) {
      field.toBuffer(this, buffer, fieldOffset);
      fieldOffset += field.size;
    }
  }

  bitGet(fieldName, bitName) {
    const field = this.desc.fields[fieldName];
    if (!field || !field.bitMaskMap) return false;
    return (this[fieldName] & field.bitMaskMap[bitName]) !== 0;
  }
}

export class M3Section {
  constructor(desc, indexEntry, references, content, rawBytes = null) {
    this.desc = desc;
    this.indexEntry = indexEntry;
    this.references = references;
    this.content = content;
    this.rawBytes = rawBytes;
  }
}

export class M3SectionList extends Array {
  constructor() {
    super();
    this.fileBuffer = null;
    this.mdVersion = 34;
    this.model = null;
  }

  static async load(arrayBuffer) {
    let xmlText;
    if (isNode) {
      xmlText = fs.readFileSync(path.join(__dirnameNode, './structures.xml'), 'utf8');
    } else {
      xmlText = STRUCTURES_XML_EMBEDDED;
    }
    await loadM3StructuresXml(xmlText);

    const list = new M3SectionList();
    list.fileBuffer = arrayBuffer;
    const headerView = new DataView(arrayBuffer, 0, 4);
    const tagValue = headerView.getUint32(0, true);
    const mdTag = bytesToTag(tagValue);
    list.mdVersion = parseInt(mdTag.slice(2), 10);

    const headerDesc = structures[mdTag].getVersion(11, list.mdVersion);
    const header = headerDesc.instance(arrayBuffer, 0);
    const indexOffset = header.index_offset;
    const indexSize = header.index_size;
    const indexDesc = structures['MDIndexEntry'].getVersion(list.mdVersion, list.mdVersion);

    for (let ii = 0; ii < indexSize; ii += 1) {
      const entryOffset = indexOffset + ii * indexDesc.size;
      const entry = indexDesc.instance(arrayBuffer, entryOffset);
      const tagStr = bytesToTag(entry.tag);
      const sectionDesc = structures[tagStr].getVersion(entry.version, list.mdVersion);
      const sectionOffset = entry.offset;
      const sectionSize = sectionDesc.size * entry.repetitions;
      const sectionBuffer = arrayBuffer.slice(sectionOffset, sectionOffset + sectionSize);
      const sectionContent = sectionDesc.instances(sectionBuffer, entry.repetitions);
      list.push(new M3Section(sectionDesc, entry, [], sectionContent, sectionBuffer));
    }

    const headerSection = list[0];
    const modelRef = headerSection.content[0].model;
    list.model = list.getSectionByReference(modelRef)?.content[0] ?? null;
    return list;
  }

  getSectionByReference(reference) {
    if (!reference) return null;
    const index = reference.index;
    const entries = reference.entries;
    if (typeof index !== 'number' || !entries) return null;
    return this[index] || null;
  }

  getSectionsByTag(tag) {
    return this.filter((section) => section.desc.history.name === tag);
  }
}

function childElements(parent, tagName) {
  return Array.from(parent.childNodes || []).filter((n) => n.nodeType === 1 && n.tagName === tagName);
}

export async function loadM3StructuresXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const structureElements = Array.from(doc.getElementsByTagName('structure'));
  const histories = {};

  const parseHexString = (hexString) => {
    if (!hexString) return null;
    const normalized = hexString.trim();
    if (!normalized.startsWith('0x')) return null;
    const length = (normalized.length - 2) / 2;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = parseInt(normalized.substr(2 + i * 2, 2), 16);
    }
    return bytes;
  };

  for (const structureElement of structureElements) {
    const name = structureElement.getAttribute('name') || '';
    const versionToSize = new Map();
    const versionsEl = childElements(structureElement, 'versions')[0];
    if (versionsEl) {
      for (const vEl of childElements(versionsEl, 'version')) {
        versionToSize.set(parseInt(vEl.getAttribute('number') || '0', 10), parseInt(vEl.getAttribute('size') || '0', 10));
      }
    }

    const maxDefinedVersion = versionToSize.size > 0 ? Math.max(...versionToSize.keys()) : 36;
    const fieldRecords = [];
    const fieldsEl = childElements(structureElement, 'fields')[0];
    if (fieldsEl) {
      for (const fieldElement of childElements(fieldsEl, 'field')) {
        const fieldName = fieldElement.getAttribute('name') || '';
        const typeAttr = fieldElement.getAttribute('type');
        const sizeAttr = fieldElement.getAttribute('size');
        const refTo = fieldElement.getAttribute('ref_to') || '';
        const sinceVersion = fieldElement.hasAttribute('since_version') ? parseInt(fieldElement.getAttribute('since_version'), 10) : 0;
        const tillVersion = fieldElement.hasAttribute('till_version') ? parseInt(fieldElement.getAttribute('till_version'), 10) : maxDefinedVersion;
        const defaultValueRaw = fieldElement.getAttribute('default_value');
        const expectedValueRaw = fieldElement.getAttribute('expected_value');
        const defaultValue = defaultValueRaw ? (defaultValueRaw.startsWith('0x') ? parseInt(defaultValueRaw, 0) : parseFloat(defaultValueRaw)) : 0;
        const expectedValue = expectedValueRaw ? (expectedValueRaw.startsWith('0x') ? parseInt(expectedValueRaw, 0) : parseFloat(expectedValueRaw)) : null;
        const bits = {};
        const bitsEl = childElements(fieldElement, 'bits')[0];
        if (bitsEl) {
          for (const bitEl of childElements(bitsEl, 'bit')) {
            const mask = parseInt(bitEl.getAttribute('mask') || '0', 0);
            const bitName = bitEl.getAttribute('name') || '';
            if (bitName) bits[bitName] = mask;
          }
        }

        let field;
        if (!typeAttr) {
          const size = parseInt(sizeAttr || '0', 10);
          field = new M3FieldBytes(fieldName, size, parseHexString(defaultValueRaw) || new Uint8Array(size), parseHexString(expectedValueRaw));
        } else if ((primitiveFieldInfo[typeAttr] && typeAttr.includes('int')) || typeAttr === 'float') {
          field = new M3FieldPrimitive(fieldName, typeAttr, defaultValue, expectedValue);
          if (Object.keys(bits).length) field.bitMaskMap = bits;
        } else {
          let actualType = typeAttr;
          let version = 0;
          const vPos = typeAttr.lastIndexOf('V');
          if (vPos !== -1 && vPos < typeAttr.length - 1 && !Number.isNaN(Number(typeAttr.substring(vPos + 1)))) {
            actualType = typeAttr.substring(0, vPos);
            version = parseInt(typeAttr.substring(vPos + 1), 10);
          }
          const referencedHistory = histories[actualType];
          if (!referencedHistory) throw new Error(`Structure ${actualType} referenced by ${name}.${fieldName} is not defined yet`);
          const fieldDesc = referencedHistory.getVersion(version);
          field = new M3FieldStructure(fieldName, fieldDesc, refTo);
        }

        fieldRecords.push({ field, sinceVersion, tillVersion });
      }
    }

    histories[name] = new M3StructureHistory(name, versionToSize, fieldRecords);
  }

  structures = histories;
  return histories;
}

function bytesToTag(tagValue) {
  const bytes = [tagValue & 0xff, (tagValue >> 8) & 0xff, (tagValue >> 16) & 0xff, (tagValue >> 24) & 0xff];
  return String.fromCharCode(...bytes).replace(/\0/g, '').split('').reverse().join('');
}

function vector3AsUint8ToFloat(vec) {
  return [
    (vec.x / 255) * 2 - 1,
    (vec.y / 255) * 2 - 1,
    (vec.z / 255) * 2 - 1,
  ];
}

function toThreeUv(uv, multiply = 16, offset = 0) {
  return [uv.x * multiply / 32768 + offset, uv.y * multiply / 32768 + offset];
}

function buildVertexObject(vertex, uvMultiply, uvOffset) {
  const result = { position: [vertex.pos.x, vertex.pos.y, vertex.pos.z] };
  if (vertex.normalf) result.normal = [vertex.normalf.x, vertex.normalf.y, vertex.normalf.z];
  else if (vertex.normal) result.normal = vector3AsUint8ToFloat(vertex.normal);
  for (let uvIndex = 0; uvIndex < 5; uvIndex += 1) {
    const uvName = `uv${uvIndex}`;
    if (vertex[uvName]) result[uvName] = toThreeUv(vertex[uvName], uvMultiply, uvOffset);
  }
  for (let uvIndex = 0; uvIndex < 4; uvIndex += 1) {
    const fuvName = `fuv${uvIndex}`;
    if (vertex[fuvName]) result[fuvName] = [vertex[fuvName].x, vertex[fuvName].y];
  }
  if (vertex.col) result.color = [vertex.col.r / 255, vertex.col.g / 255, vertex.col.b / 255, vertex.col.a / 255];
  const weights = [];
  const lookups = [];
  for (let ii = 0; ii < 4; ii += 1) {
    if (vertex[`weight${ii}`] !== undefined) weights.push(vertex[`weight${ii}`] / 255);
    if (vertex[`lookup${ii}`] !== undefined) lookups.push(vertex[`lookup${ii}`]);
  }
  if (weights.length) result.weights = weights;
  if (lookups.length) result.boneIndices = lookups;
  return result;
}

function getSectionString(sections, reference) {
  const sec = sections.getSectionByReference(reference);
  if (!sec) return '';
  return String.fromCharCode(...sec.content).replace(/\0/g, '');
}

function resolveTexturePath(m3Path, textureBasePath) {
  if (!m3Path) return null;
  const filename = m3Path.replace(/\\/g, '/').split('/').pop();
  return isNode ? path.join(textureBasePath, filename) : `${textureBasePath}/${filename}`;
}

function getRegionMaterial(model, sections, division, regionIndex) {
  const batchSection = sections.getSectionByReference(division.batches);
  if (!batchSection) return null;
  const batch = batchSection.content.find((b) => b.region_index === regionIndex);
  if (!batch) return null;

  const matRefSection = sections.getSectionByReference(model.material_references);
  if (!matRefSection) return null;
  const matRef = matRefSection.content[batch.material_reference_index];
  if (!matRef || matRef.type !== 1) return null;

  const matSection = sections.getSectionByReference(model.materials_standard);
  if (!matSection) return null;
  return matSection.content[matRef.material_index] ?? null;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

// Convert a parsed M3 Matrix44 (column-major: x,y,z,w are column VEC4s) to THREE.Matrix4.
function m3MatrixToThree(m) {
  // THREE.Matrix4.fromArray expects column-major flat array
  return new THREE.Matrix4().fromArray([
    m.x.x, m.x.y, m.x.z, m.x.w,
    m.y.x, m.y.y, m.y.z, m.y.w,
    m.z.x, m.z.y, m.z.z, m.z.w,
    m.w.x, m.w.y, m.w.z, m.w.w,
  ]);
}

function buildBoneSkeleton(model, sections) {
  const boneSection = sections.getSectionByReference(model.bones);
  if (!boneSection || !boneSection.content.length) return null;

  const boneLookupSection = sections.getSectionByReference(model.bone_lookup);
  const boneLookup = boneLookupSection?.content ?? [];

  const boneData = boneSection.content;

  // Use IREF (bone_rests) matrices for the bind pose — each IREF is the
  // inverse-bind matrix for that bone in M3 world space.  Inverting it gives
  // the bone's world transform at bind time, which we decompose into
  // parent-local space so Three.js can form the same world transform.
  const boneRestSection = sections.getSectionByReference(model.bone_rests);
  const boneRests = boneRestSection?.content ?? [];

  // World transforms in M3 space (from IREF^-1)
  const worldMats = boneData.map((_, i) => {
    const iref = boneRests[i];
    if (!iref) return null;
    return m3MatrixToThree(iref.matrix).invert();
  });

  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scl = new THREE.Vector3();
  const _parentInv = new THREE.Matrix4();

  const threeBones = boneData.map((bone, i) => {
    const b = new THREE.Bone();
    b.name = getSectionString(sections, bone.name) || `Bone_${i}`;

    const wm = worldMats[i];
    if (wm) {
      const parentIdx = bone.parent;
      if (parentIdx >= 0 && worldMats[parentIdx]) {
        // local = parentWorld^-1 * myWorld
        _parentInv.copy(worldMats[parentIdx]).invert();
        _parentInv.multiply(wm).decompose(_pos, _quat, _scl);
      } else {
        // root bone — local transform == world transform
        wm.decompose(_pos, _quat, _scl);
      }
      b.position.copy(_pos);
      b.quaternion.copy(_quat);
      b.scale.copy(_scl);
    } else {
      // Fallback: use animation-reference default values
      const loc = bone.location['default'];
      const rot = bone.rotation['default'];
      const scl = bone.scale['default'];
      b.position.set(loc.x, loc.y, loc.z);
      b.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      b.scale.set(scl.x, scl.y, scl.z);
    }

    return b;
  });

  boneData.forEach((bone, i) => {
    const p = bone.parent;
    if (p >= 0 && p < threeBones.length) {
      threeBones[p].add(threeBones[i]);
    }
  });

  const rootBones = threeBones.filter((_, i) => boneData[i].parent < 0);
  const skeleton = new THREE.Skeleton(threeBones);

  return { threeBones, rootBones, skeleton, boneLookup, boneWorldMats: worldMats };
}

// ── Mesh builder ──────────────────────────────────────────────────────────────

export function buildThreeMeshesFromModel(model, sections, { textureBasePath = null, textureLoader = null, textureResolver = null, onTextureMissing = null } = {}) {
  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  const vertexFlags = model.vertex_flags;
  const vertexSection = sections.getSectionByReference(model.vertices);
  const divisionSection = sections.getSectionByReference(model.divisions);
  if (!vertexSection || !divisionSection) {
    console.warn('Missing vertices or divisions section in M3 model');
    return group;
  }

  const vertexDesc = M3StructureDescription.getVertexDescription(vertexFlags);
  const vertexBuffer = vertexSection.rawBytes;
  const vertexCount = Math.floor(vertexBuffer.byteLength / vertexDesc.size);
  const vertexObjects = vertexDesc.instances(vertexBuffer, vertexCount);

  // Build skeleton when model has skinning data
  const hasSkinning = !!(vertexFlags & 0x60);
  const skeletonInfo = hasSkinning ? buildBoneSkeleton(model, sections) : null;
  if (skeletonInfo) {
    for (const rb of skeletonInfo.rootBones) group.add(rb);
  }

  const skinnedMeshes = [];
  // matName → Set<THREE.Material> for live texture replacement
  const matNameToMaterials = new Map();

  for (const division of divisionSection.content) {
    const faceSection = sections.getSectionByReference(division.faces);
    const regionSection = sections.getSectionByReference(division.regions);
    if (!faceSection || !regionSection) continue;

    const faceIndices = faceSection.content;

    regionSection.content.forEach((region, regionIndex) => {
      const firstVertexIndex = region.first_vertex_index;
      const vertexCountForRegion = region.vertex_count;
      const firstFaceIndex = region.first_face_index;
      const faceCount = region.face_count;
      const uvMultiply = region.uv_multiply ?? 16;
      const uvOffset = region.uv_offset ?? 0;
      const regionVersion = region.desc.version ?? 0;
      const firstBoneLookupIndex = region.first_bone_lookup_index ?? 0;
      const regionVertices = vertexObjects.slice(firstVertexIndex, firstVertexIndex + vertexCountForRegion);
      const vertices = regionVertices.map((v) => buildVertexObject(v, uvMultiply, uvOffset));

      const indices = [];
      for (let ii = firstFaceIndex; ii < firstFaceIndex + faceCount; ii += 3) {
        if (ii + 2 >= faceIndices.length) break;
        let a = faceIndices[ii];
        let b = faceIndices[ii + 1];
        let c = faceIndices[ii + 2];
        if (regionVersion <= 2) {
          a -= firstVertexIndex;
          b -= firstVertexIndex;
          c -= firstVertexIndex;
        }
        indices.push(a, b, c);
      }

      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const normals = [];
      const uvs = [];
      const colors = [];
      const skinIndices = [];
      const skinWeights = [];
      let hasM3Normals = false;

      for (const vertex of vertices) {
        positions.push(...vertex.position);
        if (vertex.normal) { normals.push(...vertex.normal); hasM3Normals = true; }
        else normals.push(0, 0, 1);
        const uv = vertex.uv0 ?? vertex.fuv0 ?? [0, 0];
        uvs.push(uv[0], uv[1]);
        if (vertex.color) colors.push(vertex.color[0], vertex.color[1], vertex.color[2]);

        if (skeletonInfo) {
          const lu = skeletonInfo.boneLookup;
          const bi = vertex.boneIndices;
          skinIndices.push(
            bi?.[0] !== undefined ? (lu[firstBoneLookupIndex + bi[0]] ?? 0) : 0,
            bi?.[1] !== undefined ? (lu[firstBoneLookupIndex + bi[1]] ?? 0) : 0,
            bi?.[2] !== undefined ? (lu[firstBoneLookupIndex + bi[2]] ?? 0) : 0,
            bi?.[3] !== undefined ? (lu[firstBoneLookupIndex + bi[3]] ?? 0) : 0,
          );
          skinWeights.push(
            vertex.weights?.[0] ?? 1,
            vertex.weights?.[1] ?? 0,
            vertex.weights?.[2] ?? 0,
            vertex.weights?.[3] ?? 0,
          );
        }
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      if (colors.length === vertices.length * 3) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      if (skeletonInfo) {
        geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
        geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
      }
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();
      if (!hasM3Normals) geometry.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({ color: 0xdddddd, vertexColors: colors.length > 0 });

      const mat = getRegionMaterial(model, sections, division, regionIndex);
      if (mat) {
        const diffLayerSec = sections.getSectionByReference(mat.layer_diff);
        const diffLayer = diffLayerSec?.content[0];
        if (diffLayer) {
          const m3Path = getSectionString(sections, diffLayer.color_bitmap);
          const filename = m3Path ? m3Path.replace(/\\/g, '/').split('/').pop() : null;

          if (isNode && textureBasePath) {
            const texPath = resolveTexturePath(m3Path, textureBasePath);
            if (texPath && fs.existsSync(texPath)) {
              material.userData.diffuseTexturePath = texPath;
            }
          } else if (!isNode && textureLoader && (textureBasePath || textureResolver)) {
            const texPath = textureResolver ? textureResolver(filename) : resolveTexturePath(m3Path, textureBasePath);
            if (texPath) {
              const tex = textureLoader.load(texPath, undefined, undefined,
                onTextureMissing ? () => onTextureMissing(filename, material) : undefined
              );
              tex.flipY = false;
              material.map = tex;
              material.color.set(0xffffff);
            }
          }
        }
      }

      if (mat) {
        const matName = getSectionString(sections, mat.name) || null;
        if (matName) {
          if (!matNameToMaterials.has(matName)) matNameToMaterials.set(matName, new Set());
          matNameToMaterials.get(matName).add(material);
        }
      }

      const mesh = skeletonInfo
        ? new THREE.SkinnedMesh(geometry, material)
        : new THREE.Mesh(geometry, material);
      mesh.name = `M3_Mesh_${group.children.length}`;
      group.add(mesh);
      if (skeletonInfo) skinnedMeshes.push(mesh);
    });
  }

  group.userData.matNameToMaterials = matNameToMaterials;

  // Bind skeleton after all bones and meshes are parented to the group
  if (skeletonInfo) {
    group.userData.bones = skeletonInfo.threeBones;
    group.userData.boneWorldMats = skeletonInfo.boneWorldMats;
    group.updateMatrixWorld(true);
    for (const mesh of skinnedMeshes) {
      mesh.bind(skeletonInfo.skeleton);
    }
  }

  return group;
}

// ── Attachment points ─────────────────────────────────────────────────────────

export function buildAttachmentPoints(model, sections) {
  const attSection = sections.getSectionByReference(model.attachment_points);
  if (!attSection) return [];
  return attSection.content.map((att, i) => ({
    name: getSectionString(sections, att.name) ?? `Attachment_${i}`,
    boneIndex: att.bone,
  }));
}

// ── Animation clips ───────────────────────────────────────────────────────────

// SD** type index → STC field name (matches field declaration order in STC_)
const SD_FIELDS = ['sdev', 'sd2v', 'sd3v', 'sd4q', 'sdcc', 'sdr3', 'sdu8', 'sds6', 'sdu6', 'sds3', 'sdu3', 'sdfg', 'sdmb'];

export function buildAnimationClips(model, sections) {
  const seqSection = sections.getSectionByReference(model.sequences);
  const stgSection = sections.getSectionByReference(model.sequence_transformation_groups);
  const stcSection = sections.getSectionByReference(model.sequence_transformation_collections);
  const boneSection = sections.getSectionByReference(model.bones);

  if (!seqSection || !stgSection || !boneSection) return [];

  const boneData = boneSection.content;
  const seqs = seqSection.content;
  const stgs = stgSection.content;
  const stcs = stcSection?.content ?? [];

  return seqs.map((seq, seqIndex) => {
    const name = getSectionString(sections, seq.name) || `Seq_${seqIndex}`;
    const msStart = seq.anim_ms_start;
    const msEnd = seq.anim_ms_end;
    const duration = (msEnd - msStart) / 1000;

    const stg = stgs[seqIndex];
    if (!stg) return new THREE.AnimationClip(name, duration, []);

    const stcIndicesSection = sections.getSectionByReference(stg.stc_indices);
    if (!stcIndicesSection) return new THREE.AnimationClip(name, duration, []);

    // Build animId → {sdSection, sdIdx} map from all STCs in this group
    const animIdMap = new Map();

    for (const stcIdx of stcIndicesSection.content) {
      if (stcIdx >= stcs.length) continue;
      const stc = stcs[stcIdx];

      const idsSection = sections.getSectionByReference(stc.anim_ids);
      const refsSection = sections.getSectionByReference(stc.anim_refs);
      if (!idsSection || !refsSection) continue;

      idsSection.content.forEach((animId, i) => {
        const animRef = refsSection.content[i];
        const sdIdx = animRef & 0xFFFF;
        const fieldIdx = (animRef >>> 16) & 0xFFFF;
        const fieldName = SD_FIELDS[fieldIdx];
        if (!fieldName || !stc[fieldName]) return;

        const sdSection = sections.getSectionByReference(stc[fieldName]);
        const sdEntry = sdSection?.content?.[sdIdx];
        if (sdEntry) animIdMap.set(animId, { sdSection, sdIdx });
      });
    }

    // Collect concurrent / priority from all STCs in this sequence
    let isConcurrent = false;
    let priority = 0;
    for (const stcIdx of stcIndicesSection.content) {
      if (stcIdx >= stcs.length) continue;
      const stc = stcs[stcIdx];
      if (stc.concurrent) isConcurrent = true;
      if ((stc.priority ?? 0) > priority) priority = stc.priority;
    }

    const tracks = [];

    boneData.forEach((bone, bi) => {
      const boneName = getSectionString(sections, bone.name) || `Bone_${bi}`;

      const addTrack = (animRef, TrackClass, prop, extract) => {
        if (!animRef?.header?.flags) return; // not animated
        const entry = animIdMap.get(animRef.header.id);
        if (!entry) return;

        const sd = entry.sdSection.content[entry.sdIdx];
        const framesSection = sections.getSectionByReference(sd.frames);
        const keysSection = sections.getSectionByReference(sd.keys);
        if (!framesSection?.content?.length || !keysSection?.content?.length) return;

        const framesArr = framesSection.content;
        const keysArr = keysSection.content;
        const times = [];
        const values = [];
        for (let fi = 0; fi < framesArr.length; fi++) {
          const f = framesArr[fi];
          if (f >= msStart && f <= msEnd) {
            times.push((f - msStart) / 1000);
            values.push(...extract(keysArr[fi]));
          }
        }
        if (times.length) tracks.push(new TrackClass(`${boneName}.${prop}`, times, values));
      };

      addTrack(bone.location, THREE.VectorKeyframeTrack, 'position', (k) => [k.x, k.y, k.z]);
      addTrack(bone.rotation, THREE.QuaternionKeyframeTrack, 'quaternion', (k) => [k.x, k.y, k.z, k.w]);
      addTrack(bone.scale, THREE.VectorKeyframeTrack, 'scale', (k) => [k.x, k.y, k.z]);
    });

    const clip = new THREE.AnimationClip(name, duration, tracks);
    clip.userData = { concurrent: isConcurrent, priority };
    return clip;
  });
}

export function getModelTextureFilenames(model, sections) {
  const filenames = new Set();
  const divSection = sections.getSectionByReference(model.divisions);
  if (!divSection) return filenames;

  for (const division of divSection.content) {
    const regionSection = sections.getSectionByReference(division.regions);
    if (!regionSection) continue;
    regionSection.content.forEach((_, regionIndex) => {
      const mat = getRegionMaterial(model, sections, division, regionIndex);
      if (!mat) return;
      const diffLayerSec = sections.getSectionByReference(mat.layer_diff);
      const diffLayer = diffLayerSec?.content[0];
      if (!diffLayer) return;
      const m3Path = getSectionString(sections, diffLayer.color_bitmap);
      if (m3Path) {
        const filename = m3Path.replace(/\\/g, '/').split('/').pop();
        if (filename) filenames.add(filename);
      }
    });
  }
  return filenames;
}

// ── Material list ─────────────────────────────────────────────────────────────

export function buildMaterialList(model, sections) {
  const matSection = sections.getSectionByReference(model.materials_standard);
  if (!matSection) return [];

  const LAYER_FIELDS = [
    { key: 'layer_diff', label: 'Diffuse' },
    { key: 'layer_spec', label: 'Specular' },
    { key: 'layer_norm', label: 'Normal' },
  ];

  return matSection.content.map((mat, i) => {
    const name = getSectionString(sections, mat.name) || `Material_${i}`;
    const textures = [];
    for (const { key, label } of LAYER_FIELDS) {
      if (!mat[key]) continue;
      const layerSec = sections.getSectionByReference(mat[key]);
      const layer = layerSec?.content[0];
      if (!layer?.color_bitmap) continue;
      const m3Path = getSectionString(sections, layer.color_bitmap);
      if (!m3Path) continue;
      const filename = m3Path.replace(/\\/g, '/').split('/').pop();
      if (filename) textures.push({ label, filename });
    }
    return { name, textures };
  });
}

// ── Bone hierarchy ────────────────────────────────────────────────────────────

export function buildBoneHierarchy(model, sections) {
  const boneSection = sections.getSectionByReference(model.bones);
  if (!boneSection) return [];
  return boneSection.content.map((bone, i) => ({
    index: i,
    name: getSectionString(sections, bone.name) || `Bone_${i}`,
    parentIndex: (bone.parent != null && bone.parent >= 0) ? bone.parent : -1,
  }));
}

// ── Hit volumes ───────────────────────────────────────────────────────────────

export function buildHitVolumes(model, sections) {
  function ssgsToObj(s, i) {
    if (!s || s.shape === undefined) return null;
    try {
      return {
        index: i,
        shape: s.shape,       // 0=cuboid, 1=sphere, 2=capsule
        boneIndex: s.bone,    // int16, −1 = model space
        matrix4: m3MatrixToThree(s.matrix),
        size0: s.size0, size1: s.size1, size2: s.size2,
      };
    } catch { return null; }
  }

  function atvlToObj(a, i) {
    try {
      return {
        index: i,
        bone0: a.bone0,
        shape: a.shape,       // 0=cuboid, 1=sphere, 2=capsule
        matrix4: m3MatrixToThree(a.matrix),
        size0: a.size0, size1: a.size1, size2: a.size2,
      };
    } catch { return null; }
  }

  const hitSection = sections.getSectionByReference(model.hittests);
  const hittests = hitSection
    ? hitSection.content.map(ssgsToObj).filter(Boolean)
    : [];

  const atvlSection = sections.getSectionByReference(model.attachment_volumes);
  const attachmentVolumes = atvlSection
    ? atvlSection.content.map(atvlToObj).filter(Boolean)
    : [];

  let tight = null;
  try {
    if (model.hittest_tight) tight = ssgsToObj(model.hittest_tight, -1);
  } catch {}

  return { tight, hittests, attachmentVolumes };
}

// ── Bounds ────────────────────────────────────────────────────────────────────

export function buildBounds(model) {
  const b = model.boundings;
  if (!b) return null;
  const min = b.min, max = b.max;
  if (!min || !max) return null;
  // M3 axes: X=left/right, Y=back/front, Z=bottom/top
  return {
    left: min.x, right: max.x,
    back: min.y, front: max.y,
    bottom: min.z, top: max.z,
    radius: b.radius ?? 0,
  };
}

// ── Lights ────────────────────────────────────────────────────────────────────

export function buildLights(model, sections) {
  const lightSection = sections.getSectionByReference(model.lights);
  if (!lightSection || !lightSection.content.length) return [];
  const boneSection = sections.getSectionByReference(model.bones);
  const boneData = boneSection?.content ?? [];
  return lightSection.content.map((l, i) => {
    const boneIndex = l.bone ?? -1;
    const boneName = (boneIndex >= 0 && boneData[boneIndex])
      ? (getSectionString(sections, boneData[boneIndex].name) || `Bone_${boneIndex}`)
      : null;
    const shapeNames = ['Unknown', 'Point', 'Spot'];
    return {
      index: i,
      name: boneName ?? `Light_${i}`,
      shape: shapeNames[l.shape] ?? 'Unknown',
      boneIndex,
    };
  });
}

// ── Turrets ───────────────────────────────────────────────────────────────────

export function buildTurrets(model, sections) {
  const turretSection = sections.getSectionByReference(model.turrets);
  if (!turretSection || !turretSection.content.length) return [];
  const partData = sections.getSectionByReference(model.turret_parts)?.content ?? [];
  const boneSection = sections.getSectionByReference(model.bones);
  const boneData = boneSection?.content ?? [];
  return turretSection.content.map((t, i) => {
    const name = getSectionString(sections, t.name) || `Turret_${i}`;
    const partIndices = sections.getSectionByReference(t.parts)?.content ?? [];
    const parts = partIndices.map(ii => {
      const p = partData[ii];
      if (!p) return null;
      const boneIndex = p.bone ?? -1;
      const boneName = (boneIndex >= 0 && boneData[boneIndex])
        ? (getSectionString(sections, boneData[boneIndex].name) || `Bone_${boneIndex}`)
        : null;
      return { boneIndex, boneName: boneName ?? `Bone_${boneIndex}` };
    }).filter(Boolean);
    return { index: i, name, parts };
  });
}

// ── Node.js only ──────────────────────────────────────────────────────────────

export async function loadM3FromFile(filePath) {
  if (!isNode) throw new Error('loadM3FromFile is only available in Node.js');
  const buffer = fs.readFileSync(filePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return await M3SectionList.load(arrayBuffer);
}

export async function exportToGLB(group, outputPath) {
  if (!isNode) throw new Error('exportToGLB is only available in Node.js');
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      group,
      (gltf) => {
        if (gltf instanceof ArrayBuffer) {
          fs.writeFileSync(outputPath, Buffer.from(gltf));
          resolve(outputPath);
        } else {
          reject(new Error('GLTF export failed: unexpected output'));
        }
      },
      reject,
      { binary: true }
    );
  });
}
