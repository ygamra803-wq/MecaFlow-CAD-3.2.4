import * as THREE from 'three';

export interface Circumcircle {
  center: THREE.Vector3;
  radius: number;
}

/**
 * Calculates the distance between two 3D points.
 */
export const calculateDistance = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return p1.distanceTo(p2);
};

/**
 * Calculates the angle (in degrees) formed by 3 points: A -> Vertex(B) -> C
 */
export const calculateAngle = (A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3): number => {
  const v1 = new THREE.Vector3().subVectors(A, B).normalize();
  const v2 = new THREE.Vector3().subVectors(C, B).normalize();
  const angleRad = v1.angleTo(v2);
  return THREE.MathUtils.radToDeg(angleRad);
};

/**
 * Calculates the circumscribed circle passing through 3 3D points.
 * Useful for measuring arcs and radius.
 */
export const calculateCircumcircle = (A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3): Circumcircle | null => {
  const a = A.distanceTo(B);
  const b = B.distanceTo(C);
  const c = C.distanceTo(A);

  // Check if they are collinear
  const cross = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
  if (cross.lengthSq() < 1e-10) {
    return null; // Collinear points cannot define a circle
  }

  // Use barycentric coordinates to find the circumcenter.
  // alpha = a^2 (b^2 + c^2 - a^2)
  // beta = b^2 (c^2 + a^2 - b^2)
  // gamma = c^2 (a^2 + b^2 - c^2)
  
  // Here, the sides are standard convention:
  // a = side opposite to A = length(B-C)
  // b = side opposite to B = length(A-C)
  // c = side opposite to C = length(A-B)
  const lenA = B.distanceTo(C);
  const lenB = A.distanceTo(C);
  const lenC = A.distanceTo(B);

  const alpha = (lenA * lenA) * (lenB * lenB + lenC * lenC - lenA * lenA);
  const beta = (lenB * lenB) * (lenA * lenA + lenC * lenC - lenB * lenB);
  const gamma = (lenC * lenC) * (lenA * lenA + lenB * lenB - lenC * lenC);

  const sum = alpha + beta + gamma;

  const centerX = (alpha * A.x + beta * B.x + gamma * C.x) / sum;
  const centerY = (alpha * A.y + beta * B.y + gamma * C.y) / sum;
  const centerZ = (alpha * A.z + beta * B.z + gamma * C.z) / sum;

  const center = new THREE.Vector3(centerX, centerY, centerZ);
  const radius = center.distanceTo(A);

  return { center, radius };
};

/**
 * Evaluates points to find differences.
 */
export const calculateDeltas = (A: THREE.Vector3, B: THREE.Vector3) => {
  return {
    dx: Math.abs(B.x - A.x),
    dy: Math.abs(B.y - A.y),
    dz: Math.abs(B.z - A.z)
  };
};
