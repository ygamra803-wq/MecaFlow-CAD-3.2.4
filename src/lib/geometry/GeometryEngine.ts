// GeometryEngine.ts
import * as THREE from 'three';
import { TubeConfig, HandleConfig, PanConfig } from '../../types';
import { createTubeGeometry } from './TubeGenerator';
import { createHandleGeometry } from './HandleGenerator';
import { createPanGeometries } from './PanGenerator';

export class GeometryEngine {
  createTube(config: TubeConfig): THREE.BufferGeometry {
    return createTubeGeometry(config);
  }

  createHandle(config: HandleConfig): THREE.BufferGeometry {
    return createHandleGeometry(config);
  }

  createPan(config: PanConfig) {
    return createPanGeometries(config);
  }
}
