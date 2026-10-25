import { describe, it, expect } from 'vitest';
import { validateTubeConfig, ValidationError } from './validators';

describe('validateTubeConfig', () => {
  it('should not throw error for valid config', () => {
    const validConfig = {
      width: 40,
      height: 30,
      thickness: 1.2,
      totalLength: 150,
      partLength: 80
    };
    expect(() => validateTubeConfig(validConfig)).not.toThrow();
  });

  it('should throw error for invalid width', () => {
    const invalidConfig = {
      width: 0,
      height: 30,
      thickness: 1.2,
      totalLength: 150,
      partLength: 80
    };
    try {
        validateTubeConfig(invalidConfig);
    } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).errors[0].field).toBe('width');
    }
  });

  it('should not throw error if partLength differs from totalLength', () => {
    const validConfig = {
      width: 40,
      height: 30,
      thickness: 1.2,
      totalLength: 100,
      partLength: 150
    };
    expect(() => validateTubeConfig(validConfig)).not.toThrow();
  });
});
