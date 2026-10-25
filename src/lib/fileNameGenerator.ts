import { ZeroGapState } from '../types';

export const generateProfessionalFileName = (config: ZeroGapState, extension: string): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const diam = (config.tube.width || 0).toFixed(1);
  const thick = config.tube.thickness.toFixed(1);
  const length = config.tube.partLength.toFixed(1);
  const angle = config.assembly.tiltAngle.toFixed(1);

  // e.g. MecaFlow_D40.0_T2.0_L300.0_A45.0_20260523.stl
  return `MecaFlow_D${diam}_T${thick}_L${length}_A${angle}_${dateStr}.${extension}`;
};
