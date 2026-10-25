import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { IntersectionExtractor } from './geometry/intersectionExtractor';
import { ParameterValidator } from './validators/parameterValidator';
import { WallThicknessSimulator } from './geometry/wallThicknessSimulation';
import { CADState } from '../types';

describe('MecaFlow Geometric & Validation Engines', () => {
  
  describe('IntersectionExtractor tests', () => {
    it('should handle meshes gracefully and return empty/error result if geometry is empty', () => {
      const geom = new THREE.BufferGeometry();
      const mesh = new THREE.Mesh(geom);
      const result = IntersectionExtractor.extractIntersectionPath(mesh);
      expect(result.isValid).toBe(false);
      expect(result.pointCount).toBe(0);
    });

    it('should extract edges and compute paths if mock geometry is provided', () => {
      const geom = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
        1, 0, 0,
        1, 1, 0,
        0, 1, 0
      ]);
      geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      const mesh = new THREE.Mesh(geom);
      const result = IntersectionExtractor.extractIntersectionPath(mesh);
      expect(result.gaps).toBeDefined();
    });
  });

  describe('ParameterValidator tests', () => {
    const mockState: CADState = {
      parts: [],
      selectedPartId: null,
      viewMode: '3d',
      gridVisible: true,
      units: 'mm',
      zeroGap: {
        pan: {
          bottomDiameter: 120,
          topDiameter: 160,
          height: 80,
          wallProfile: 'straight',
          curveRadius: 4,
          rimThickness: 2,
          bottomFilletRadius: 10,
          addRim: true,
          rimHeight: 12,
          wallThickness: 2,
          useShellPreview: true,
          innerMoldMode: false,
          applyThicknessToCut: true
        },
        tube: {
          width: 40,
          height: 35,
          thickness: 1.5,
          totalLength: 200,
          fixedHeadLength: 20,
          fixedTailLength: 20,
          partLength: 160,
          cornerRadius: 2,
          shape: 'مستطيل'
        },
        handle: {
          shape: 'rectangular',
          width: 32,
          height: 20,
          depth: 100,
          thickness: 1.5,
          cornerRadius: 2,
          angleX: 12,
          angleY: 0,
          offsetZ: 0,
          insertionDepth: 18
        },
        assembly: {
          tiltAngle: 45,
          handleAngleX: 0,
          handleAngleY: 0,
          handleOffset: 0,
          insertionDistance: 30,
          heightOffset: 0,
          tiltAxis: 'X'
        },
        renderMode: 'preview',
        addFillet: false,
        thermalClearance: true,
        markOrientation: true,
        showGlow: true,
        showBorders: true
      },
      wizardStep: 'tube-design'
    };

    it('should validate full mock CAD state with zero errors', () => {
      const res = ParameterValidator.validateAllParameters(mockState);
      expect(res.isValid).toBe(true);
      expect(res.errors.length).toBe(0);
    });

    it('should flag errors when top diameter is smaller than bottom diameter', () => {
      const badState = JSON.parse(JSON.stringify(mockState)) as CADState;
      badState.zeroGap.pan.topDiameter = 80;
      badState.zeroGap.pan.bottomDiameter = 120;
      const res = ParameterValidator.validateAllParameters(badState);
      expect(res.isValid).toBe(false);
      expect(res.errors.some(e => e.includes('أصغر'))).toBe(true);
    });

    it('should validate single parameters interactively', () => {
      const res1 = ParameterValidator.validateSingleParameter('tubeThickness', 0.2, mockState);
      expect(res1.isValid).toBe(false);

      const res2 = ParameterValidator.validateSingleParameter('tubeWidth', 20, mockState);
      expect(res2.isValid).toBe(true);
    });
  });

  describe('WallThicknessSimulator tests', () => {
    it('should offset positions correctly inside the simulator', () => {
      const geom = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0
      ]);
      const normals = new Float32Array([
        0, 0, 1,
        0, 0, 1,
        0, 0, 1
      ]);
      geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

      const thickened = WallThicknessSimulator.applyWallThickness(geom, 2.0, false);
      const posAttr = thickened.attributes.position as THREE.BufferAttribute;
      expect(posAttr.getZ(0)).toBeCloseTo(2.0);
    });
  });
});
