export type Vec3 = [number, number, number];
export type Mesh = { vertices: Vec3[]; faces: number[][] };
export type Primitive = 'cube' | 'cuboid' | 'pyramid' | 'pyramid3' | 'pyramid6' | 'cylinder' | 'cone' | 'frustum' | 'sphere' | 'hemisphere' | 'capsule' | 'egg' | 'torus' | 'tube'
  | 'prism3' | 'prism5' | 'prism6' | 'prism8' | 'tetrahedron' | 'octahedron' | 'icosahedron' | 'dodecahedron' | 'gem' | 'cup' | 'bowl'
  | 'star' | 'heart' | 'arrow' | 'cross' | 'house' | 'stairs' | 'gear' | 'lshape' | 'tshape';

export const PRIMITIVE_GROUPS: { label: string; items: { id: Primitive; label: string }[] }[] = [
  { label: 'Khối cơ bản', items: [{ id: 'cube', label: 'Lập phương' }, { id: 'cuboid', label: 'Hộp chữ nhật' }, { id: 'sphere', label: 'Khối cầu' }, { id: 'hemisphere', label: 'Bán cầu' }, { id: 'cylinder', label: 'Khối trụ' }, { id: 'cone', label: 'Khối nón' }, { id: 'frustum', label: 'Nón cụt' }, { id: 'torus', label: 'Khối xuyến' }, { id: 'tube', label: 'Ống tròn' }, { id: 'capsule', label: 'Viên nang' }, { id: 'egg', label: 'Quả trứng' }] },
  { label: 'Lăng trụ và chóp', items: [{ id: 'prism3', label: 'Lăng trụ tam giác' }, { id: 'prism5', label: 'Lăng trụ ngũ giác' }, { id: 'prism6', label: 'Lăng trụ lục giác' }, { id: 'prism8', label: 'Lăng trụ bát giác' }, { id: 'pyramid', label: 'Chóp tứ giác' }, { id: 'pyramid3', label: 'Chóp tam giác' }, { id: 'pyramid6', label: 'Chóp lục giác' }] },
  { label: 'Đa diện đều', items: [{ id: 'tetrahedron', label: 'Tứ diện' }, { id: 'octahedron', label: 'Bát diện' }, { id: 'dodecahedron', label: 'Thập nhị diện' }, { id: 'icosahedron', label: 'Nhị thập diện' }, { id: 'gem', label: 'Viên kim cương' }] },
  { label: 'Hình nổi', items: [{ id: 'star', label: 'Ngôi sao' }, { id: 'heart', label: 'Trái tim' }, { id: 'arrow', label: 'Mũi tên' }, { id: 'cross', label: 'Chữ thập' }, { id: 'lshape', label: 'Thanh chữ L' }, { id: 'tshape', label: 'Thanh chữ T' }, { id: 'gear', label: 'Bánh răng' }] },
  { label: 'Đồ vật', items: [{ id: 'house', label: 'Ngôi nhà' }, { id: 'stairs', label: 'Cầu thang' }, { id: 'cup', label: 'Cái cốc' }, { id: 'bowl', label: 'Cái bát' }] },
];

export const PRIMITIVES = PRIMITIVE_GROUPS.flatMap((group) => group.items);

const SEGMENTS = 32;

const cube = (): Mesh => ({
  vertices: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 4, 7, 3]],
});

const pyramid = (): Mesh => ({
  vertices: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [0, 1, 0]],
  faces: [[0, 1, 2, 3], [0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]],
});

const lathe = (profile: [number, number][], closedTop: boolean, closedBottom: boolean, segments = SEGMENTS): Mesh => {
  const vertices: Vec3[] = [];
  const faces: number[][] = [];
  for (const [radius, y] of profile) {
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      vertices.push([radius * Math.cos(a), y, radius * Math.sin(a)]);
    }
  }
  for (let r = 0; r < profile.length - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      faces.push([r * segments + i, r * segments + next, (r + 1) * segments + next, (r + 1) * segments + i]);
    }
  }
  if (closedBottom) faces.push(Array.from({ length: segments }, (_, i) => segments - 1 - i));
  if (closedTop) faces.push(Array.from({ length: segments }, (_, i) => (profile.length - 1) * segments + i));
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

const arcProfile = (from: number, to: number, steps: number, rx = 1, ry = 1, dy = 0): [number, number][] => Array.from({ length: steps + 1 }, (_, i) => {
  const a = from + ((to - from) * i) / steps;
  return [Math.max(0.001, Math.cos(a) * rx), Math.sin(a) * ry + dy];
});

const extrude = (outline: [number, number][], depth = 0.5): Mesh => {
  const n = outline.length;
  const vertices: Vec3[] = [...outline.map(([x, y]) => [x, y, depth] as Vec3), ...outline.map(([x, y]) => [x, y, -depth] as Vec3)];
  const faces: number[][] = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => 2 * n - 1 - i)];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
  return { vertices, faces };
};

const starOutline = (points: number, outer: number, inner: number, rotation = Math.PI / 2): [number, number][] =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = rotation + (i * Math.PI) / points;
    return [r * Math.cos(a), r * Math.sin(a)];
  });

const heartOutline = (): [number, number][] => Array.from({ length: 48 }, (_, i) => {
  const t = (i / 48) * Math.PI * 2;
  return [(16 * Math.sin(t) ** 3) / 16, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16];
});

const GEAR_TOOTH: [number, number][] = [[0, 0.78], [0.18, 1], [0.5, 1], [0.68, 0.78]];

const gearOutline = (teeth = 12): [number, number][] => Array.from({ length: teeth }, (_, i) => GEAR_TOOTH.map(([offset, r]) => {
  const a = ((i + offset) / teeth) * Math.PI * 2;
  return [r * Math.cos(a), r * Math.sin(a)] as [number, number];
})).flat();

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const icosahedron = (): Mesh => {
  const t = (1 + Math.sqrt(5)) / 2;
  return {
    vertices: [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]],
    faces: [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]],
  };
};

const dodecahedron = (): Mesh => {
  const ico = icosahedron();
  const centers = ico.faces.map((face) => face.reduce<Vec3>((sum, index) => [sum[0] + ico.vertices[index][0] / 3, sum[1] + ico.vertices[index][1] / 3, sum[2] + ico.vertices[index][2] / 3], [0, 0, 0]));
  const faces = ico.vertices.map((axis, vi) => {
    const u = cross(axis, Math.abs(axis[0]) < 0.9 * Math.hypot(...axis) ? [1, 0, 0] : [0, 1, 0]);
    const v = cross(axis, u);
    const angle = (fi: number) => Math.atan2(dot(centers[fi], v), dot(centers[fi], u));
    return ico.faces.map((face, fi) => (face.includes(vi) ? fi : -1)).filter((fi) => fi >= 0).sort((p, q) => angle(p) - angle(q));
  });
  return { vertices: centers, faces };
};

const BUILDERS: Record<Primitive, () => Mesh> = {
  cube,
  cuboid: () => ({ ...cube(), vertices: cube().vertices.map(([x, y, z]) => [x * 1.5, y * 0.8, z] as Vec3) }),
  pyramid,
  pyramid3: () => lathe([[1, -1], [0.001, 1]], false, true, 3),
  pyramid6: () => lathe([[1, -1], [0.001, 1]], false, true, 6),
  cylinder: () => lathe([[1, -1], [1, 1]], true, true),
  cone: () => lathe([[1, -1], [0.001, 1]], false, true),
  frustum: () => lathe([[1, -1], [0.55, 1]], true, true),
  sphere: () => lathe(arcProfile(-Math.PI / 2, Math.PI / 2, 16), false, false),
  hemisphere: () => lathe(arcProfile(0, Math.PI / 2, 8, 1, 1, -0.5), false, true),
  capsule: () => lathe([...arcProfile(-Math.PI / 2, 0, 8, 0.6, 0.6, -0.8), ...arcProfile(0, Math.PI / 2, 8, 0.6, 0.6, 0.8)], false, false),
  egg: () => lathe(arcProfile(-Math.PI / 2, Math.PI / 2, 16).map(([r, y]) => [r * (0.78 - y * 0.12), y] as [number, number]), false, false),
  torus,
  tube: () => lathe([[1, -1], [1, 1], [0.65, 1], [0.65, -1], [1, -1]], false, false),
  prism3: () => lathe([[1, -1], [1, 1]], true, true, 3),
  prism5: () => lathe([[1, -1], [1, 1]], true, true, 5),
  prism6: () => lathe([[1, -1], [1, 1]], true, true, 6),
  prism8: () => lathe([[1, -1], [1, 1]], true, true, 8),
  tetrahedron: () => ({ vertices: [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]], faces: [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]] }),
  octahedron: () => ({ vertices: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], faces: [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]] }),
  icosahedron,
  dodecahedron,
  gem: () => lathe([[0.001, -1.1], [1, 0.25], [0.62, 0.7]], true, false, 8),
  cup: () => lathe([[0.001, -1], [0.62, -1], [0.78, 1], [0.7, 1], [0.56, -0.86], [0.001, -0.86]], false, false),
  bowl: () => lathe([...arcProfile(-Math.PI / 2, 0, 10, 1, 0.8, 0.2), ...arcProfile(0, -Math.PI / 2, 10, 0.9, 0.7, 0.2)], false, false),
  star: () => extrude(starOutline(5, 1, 0.42), 0.3),
  heart: () => extrude(heartOutline(), 0.3),
  arrow: () => extrude([[-1, -0.25], [0.2, -0.25], [0.2, -0.6], [1, 0], [0.2, 0.6], [0.2, 0.25], [-1, 0.25]], 0.25),
  cross: () => extrude([[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1], [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]], 0.3),
  lshape: () => extrude([[-0.8, -1], [0.8, -1], [0.8, -0.5], [-0.3, -0.5], [-0.3, 1], [-0.8, 1]], 0.35),
  tshape: () => extrude([[-1, 1], [1, 1], [1, 0.5], [0.25, 0.5], [0.25, -1], [-0.25, -1], [-0.25, 0.5], [-1, 0.5]], 0.35),
  gear: () => extrude(gearOutline(), 0.25),
  house: () => extrude([[-1, -1], [1, -1], [1, 0.2], [0, 1], [-1, 0.2]], 0.9),
  stairs: () => extrude([[-1, -1], [1, -1], [1, 1], [0.5, 1], [0.5, 0.5], [0, 0.5], [0, 0], [-0.5, 0], [-0.5, -0.5], [-1, -0.5]], 0.7),
};

export function primitiveMesh(kind: Primitive): Mesh {
  return (BUILDERS[kind] ?? cube)();
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
