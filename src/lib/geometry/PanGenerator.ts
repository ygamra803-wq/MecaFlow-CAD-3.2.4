import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';
import { PanConfig } from '../../types';

export const createPanGeometries = (config: PanConfig): { 
  panGeom: THREE.BufferGeometry; 
  panInnerGeom: THREE.BufferGeometry | null; 
} => {
  if (config.wallProfile === 'مخصص' && config.customStlBuffer) {
    const loader = new STLLoader();
    const geom = loader.parse(config.customStlBuffer);
    geom.center();
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    return {
      panGeom: geom,
      panInnerGeom: null
    };
  }

  const wt = config.wallThickness || 2.0;
  const rBottom = config.innerMoldMode
    ? config.bottomDiameter / 2 + wt
    : config.bottomDiameter / 2;
  const rTop = config.innerMoldMode
    ? config.topDiameter / 2 + wt
    : config.topDiameter / 2;
  const panH = config.height;
  const rimThick = config.rimThickness || 2.0;
  const curveRad = config.curveRadius ?? 100.0;
  const filletR = config.bottomFilletRadius || 8.0;
  const addRim = config.addRim;
  const rimH = config.rimHeight || 3.0;

  const buildPanProfile = (rOff: number): THREE.Vector2[] => {
    const rb = Math.max(1, rBottom - rOff);
    const rt = Math.max(1, rTop - rOff);
    const fR = Math.max(0, filletR - rOff);
    const p: THREE.Vector2[] = [];

    if (config.removeBottom) {
      p.push(new THREE.Vector2(0, rOff > 0 ? wt : 0));
      p.push(new THREE.Vector2(rb, rOff > 0 ? wt : 0));
    } else {
      p.push(new THREE.Vector2(0, rOff > 0 ? wt : 0));
      if (fR > 0) {
        const segs = 16;
        for (let i = 0; i <= segs; i++) {
          const theta = (Math.PI / 2) * (1 - i / segs);
          p.push(new THREE.Vector2(rb - fR + fR * Math.cos(theta), (rOff > 0 ? wt : 0) + fR - fR * Math.sin(theta)));
        }
      } else {
        p.push(new THREE.Vector2(rb, rOff > 0 ? wt : 0));
      }
    }

    if (config.wallProfile === 'straight') {
      // Just a straight line to the top
      p.push(new THREE.Vector2(rt, panH));
    } else {
      // Curved wall
      const startZ = (rOff > 0 ? wt : 0) + (config.removeBottom ? 0 : fR);
      const bulgeReduction = rOff >= wt ? rOff * 0.3 : 0;
      const bulge = Math.max(1.0, Math.min(20.0, (200.0 / curveRad) * 4.0) - bulgeReduction);
      const rM = (rb + rt) / 2.0 + bulge;
      const zM = (startZ + panH) / 2.0;
      const cpx = 2 * rM - 0.5 * rb - 0.5 * rt;
      const cpy = 2 * zM - 0.5 * startZ - 0.5 * panH;
      const c = new THREE.QuadraticBezierCurve(
        new THREE.Vector2(rb, startZ), new THREE.Vector2(cpx, cpy), new THREE.Vector2(rt, panH)
      );
      p.push(...c.getPoints(32).slice(1));
    }
    
    if (addRim && rOff === 0) {
      p.push(new THREE.Vector2(rt + rimThick, panH));
      p.push(new THREE.Vector2(rt + rimThick, panH + rimH));
      p.push(new THREE.Vector2(0, panH + rimH));
    } else {
      p.push(new THREE.Vector2(rt + (rOff === 0 ? rimThick : 0), panH));
      p.push(new THREE.Vector2(0, panH));
    }
    return p.filter((pt, i) => i === 0 || !pt.equals(p[i - 1]));
  };

  const outerPts = buildPanProfile(0);
  const panGeom = new THREE.LatheGeometry(outerPts, 64);

  let panInnerGeom = null;
  if (config.useShellPreview) {
    const innerPts = buildPanProfile(wt);
    panInnerGeom = new THREE.LatheGeometry(innerPts, 64);
  }

  return { panGeom, panInnerGeom };
};
