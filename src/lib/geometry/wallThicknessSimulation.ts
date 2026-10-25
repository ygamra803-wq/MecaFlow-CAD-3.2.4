import * as THREE from 'three';

/**
 * محاكي سمك الجدار للأنابيب والمقالي لدعم التصنيع الفعلي (Shell vs Inner Mold)
 */
export class WallThicknessSimulator {
  /**
   * تطبيق إزاحة السمك على مضلعات المجسم بناءً على النورمال (اتجاه السطح)
   * @param geometry - هندسة المخروط/الأنبوب
   * @param thickness - السمك بالـ ملم
   * @param isInnerMold - ما إذا كان القياس قالبًا داخليًا (إزاحة سالبة) أو خارجيًا
   */
  static applyWallThickness(
    geometry: THREE.BufferGeometry,
    thickness: number,
    isInnerMold: boolean
  ): THREE.BufferGeometry {
    const cloned = geometry.clone();
    
    // تأمين وجود النورمالز
    if (!cloned.attributes.normal) {
      cloned.computeVertexNormals();
    }
    
    const positions = cloned.attributes.position.array as Float32Array;
    const normals = cloned.attributes.normal?.array as Float32Array;
    
    if (!positions || !normals) {
      return cloned;
    }

    const offset = isInnerMold ? -thickness : thickness;

    // إزاحة كل نقطة بمقدار السمك في اتجاه متجه العمود المائل (Normal)
    for (let i = 0; i < positions.length; i += 3) {
      const nx = normals[i];
      const ny = normals[i + 1];
      const nz = normals[i + 2];

      // التأكد من أن متجهات العمود ليست أصفاراً لتفادي تشوه النقاط
      const len = Math.hypot(nx, ny, nz);
      if (len > 0.0001) {
        positions[i] += (nx / len) * offset;
        positions[i + 1] += (ny / len) * offset;
        positions[i + 2] += (nz / len) * offset;
      }
    }
    
    cloned.attributes.position.needsUpdate = true;
    cloned.computeVertexNormals();
    cloned.computeBoundingBox();
    cloned.computeBoundingSphere();
    
    return cloned;
  }
}
