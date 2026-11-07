export type Vec3 = [number, number, number];
export type Mesh = { vertices: Vec3[]; faces: number[][] };
export type Primitive = 'cube' | 'pyramid' | 'cylinder' | 'cone' | 'sphere' | 'torus';

export const PRIMITIVES: { id: Primitive; label: string }[] = [
  { id: 'cube', label: 'Khối lập phương' }, { id: 'pyramid', label: 'Khối chóp' }, { id: 'cylinder', label: 'Khối trụ' },
  { id: 'cone', label: 'Khối nón' }, { id: 'sphere', label: 'Khối cầu' }, { id: 'torus', label: 'Khối xuyến' },
];

const SEGMENTS = 32;

const cube = (): Mesh => ({
  vertices: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]],
});

const pyramid = (): Mesh => ({
  vertices: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [0, 1, 0]],
  faces: [[0, 1, 2, 3], [0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]],
});

const lathe = (profile: [number, number][], closedTop: boolean, closedBottom: boolean): Mesh => {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  for (const [radius, y] of profile) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      vertices.push([radius * Math.cos(a), y, radius * Math.sin(a)]);
    }
  }
  for (let r = 0; r < profile.length - 1; r++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const next = (i + 1) % SEGMENTS;
      faces.push([r * SEGMENTS + i, r * SEGMENTS + next, (r + 1) * SEGMENTS + next, (r + 1) * SEGMENTS + i]);
    }
  }
  if (closedBottom) faces.push(Array.from({ length: SEGMENTS }, (_, i) => SEGMENTS - 1 - i));
  if (closedTop) faces.push(Array.from({ length: SEGMENTS }, (_, i) => (profile.length - 1) * SEGMENTS + i));
  return { vertices, faces };
};

const torus = (): Mesh => {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  const minor = 16;
  for (let i = 0; i < SEGMENTS; i++) {
    const u = (i / SEGMENTS) * Math.PI * 2;
    for (let j = 0; j < minor; j++) {
      const v = (j / minor) * Math.PI * 2;
      vertices.push([(1 + 0.4 * Math.cos(v)) * Math.cos(u), 0.4 * Math.sin(v), (1 + 0.4 * Math.cos(v)) * Math.sin(u)]);
    }
  }
  for (let i = 0; i < SEGMENTS; i++) {
    for (let j = 0; j < minor; j++) {
      const a = i * minor + j;
      const b = ((i + 1) % SEGMENTS) * minor + j;
      const c = ((i + 1) % SEGMENTS) * minor + ((j + 1) % minor);
      const d = i * minor + ((j + 1) % minor);
      faces.push([a, d, c, b]);
    }
  }
  return { vertices, faces };
};

export function primitiveMesh(kind: Primitive): Mesh {
  switch (kind) {
    case 'pyramid': return pyramid();
    case 'cylinder': return lathe([[1, -1], [1, 1]], true, true);
    case 'cone': return lathe([[1, -1], [0.001, 1]], false, true);
    case 'sphere': return lathe(Array.from({ length: 17 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 16) * Math.PI;
      return [Math.max(0.001, Math.cos(a)), Math.sin(a)] as [number, number];
    }), false, false);
    case 'torus': return torus();
    default: return cube();
  }
}

export function parseObj(text: string): Mesh {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v' && parts.length >= 4) vertices.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
    else if (parts[0] === 'f' && parts.length >= 4) {
      const face = parts.slice(1).map((token) => {
        const index = parseInt(token.split('/')[0], 10);
        return index < 0 ? vertices.length + index : index - 1;
      });
      if (face.every((index) => Number.isInteger(index) && index >= 0)) faces.push(face);
    }
  }
  return { vertices, faces };
}

const triangle = (mesh: Mesh, a: Vec3, b: Vec3, c: Vec3) => {
  const start = mesh.vertices.length;
  mesh.vertices.push(a, b, c);
  mesh.faces.push([start, start + 1, start + 2]);
};

export function parseStl(buffer: ArrayBuffer): Mesh {
  const mesh: Mesh = { vertices: [], faces: [] };
  const view = new DataView(buffer);
  const count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  if (buffer.byteLength === 84 + count * 50 && count > 0) {
    for (let i = 0; i < count; i++) {
      const base = 84 + i * 50 + 12;
      const read = (offset: number): Vec3 => [view.getFloat32(base + offset, true), view.getFloat32(base + offset + 4, true), view.getFloat32(base + offset + 8, true)];
      triangle(mesh, read(0), read(12), read(24));
    }
    return mesh;
  }
  const matches = new TextDecoder().decode(buffer).match(/vertex\s+[-+\d.eE]+\s+[-+\d.eE]+\s+[-+\d.eE]+/g) ?? [];
  const points = matches.map((match) => match.trim().split(/\s+/).slice(1).map(Number) as Vec3);
  for (let i = 0; i + 2 < points.length; i += 3) triangle(mesh, points[i], points[i + 1], points[i + 2]);
  return mesh;
}

export function normalizeMesh(mesh: Mesh): Mesh {
  if (!mesh.vertices.length) return mesh;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const vertex of mesh.vertices) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], vertex[axis]);
      max[axis] = Math.max(max[axis], vertex[axis]);
    }
  }
  const center = min.map((value, axis) => (value + max[axis]) / 2);
  const scale = 2 / (Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1);
  return { faces: mesh.faces, vertices: mesh.vertices.map((vertex) => vertex.map((value, axis) => (value - center[axis]) * scale) as Vec3) };
}

const rotate = (point: Vec3, rx: number, ry: number, rz: number): Vec3 => {
  let [x, y, z] = point;
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  return [x, y, z];
};

const shade = (hex: string, light: number) => {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * light);
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
};

const LIGHT: Vec3 = [-0.4, 0.6, 0.7];
const CAMERA = 5;

export function renderMesh(canvas: HTMLCanvasElement, mesh: Mesh, view: { rx: number; ry: number; rz: number; color: string; zoom: number }) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  const radius = mesh.vertices.reduce((max, [x, y, z]) => Math.max(max, Math.hypot(x, y, z)), 0.001);
  const fit = (radius * CAMERA) / (CAMERA - Math.min(radius, CAMERA - 0.5));
  const unit = ((Math.min(width, height) / 2) * 0.86 * view.zoom) / fit;
  const toRad = Math.PI / 180;
  const rotated = mesh.vertices.map((vertex) => rotate(vertex, view.rx * toRad, view.ry * toRad, view.rz * toRad));
  const project = ([x, y, z]: Vec3) => {
    const perspective = CAMERA / (CAMERA - z);
    return [width / 2 + x * unit * perspective, height / 2 - y * unit * perspective];
  };
  const polygons = mesh.faces.map((face) => {
    const a = rotated[face[0]];
    const b = rotated[face[1]];
    const c = rotated[face[2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    const dot = Math.abs(normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]) / length;
    const depth = face.reduce((sum, index) => sum + rotated[index][2], 0) / face.length;
    return { face, depth, light: Math.min(1, 0.35 + dot * 0.75) };
  }).sort((p, q) => p.depth - q.depth);
  context.lineJoin = 'round';
  for (const polygon of polygons) {
    context.beginPath();
    polygon.face.forEach((index, i) => {
      const [x, y] = project(rotated[index]);
      if (i) context.lineTo(x, y);
      else context.moveTo(x, y);
    });
    context.closePath();
    const color = shade(view.color, polygon.light);
    context.fillStyle = color;
    context.strokeStyle = color;
    context.lineWidth = 0.6;
    context.fill();
    context.stroke();
  }
}
