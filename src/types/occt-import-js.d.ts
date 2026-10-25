declare module 'occt-import-js' {
  export interface OCCTResultMesh {
    color?: [number, number, number];
    attributes: {
      position: {
        itemSize: number;
        type: string;
        array: Float32Array | number[];
      };
      normal?: {
        itemSize: number;
        type: string;
        array: Float32Array | number[];
      };
    };
  }

  export interface OCCTResult {
    success: boolean;
    meshes: OCCTResultMesh[];
  }

  export interface OCCTInstance {
    ReadStepFile(fileBuffer: Uint8Array, params: any): OCCTResult;
  }

  export default function occtimportjs(options?: {
    locateFile?: (path: string, scriptDirectory?: string) => string;
  }): Promise<OCCTInstance>;
}
