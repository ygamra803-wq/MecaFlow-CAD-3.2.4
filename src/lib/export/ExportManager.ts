// ExportManager.ts
import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { exportToSTEP } from '../../lib/stepExporter';

export class ExportManager {
  static exportSTL(mesh: THREE.Object3D | null): string | null {
    if (!mesh) return null;
    const exporter = new STLExporter();
    return exporter.parse(mesh);
  }

  static async exportSTEP(mesh: THREE.Object3D | null): Promise<string | null> {
    if (!mesh) return null;
    return exportToSTEP(mesh);
  }
}
