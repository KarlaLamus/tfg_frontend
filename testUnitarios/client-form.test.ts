import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLIENT_COUNTRY_CODE,
  buildClientPhoneValue,
  isClientTextOnly,
  normalizeClientCountryCode,
  normalizeClientPhoneNumber,
  parseClientPhoneValue,
} from '../src/app/utils/client-form';

describe('client-form', () => {
  it('normaliza el prefijo del país a solo dígitos y máximo 4', () => {
    expect(normalizeClientCountryCode('+34abc12345')).toBe('3412');
  });

  it('normaliza el teléfono a 9 dígitos', () => {
    expect(normalizeClientPhoneNumber('698-934-5567')).toBe('698934556');
  });

  it('construye el teléfono con prefijo por defecto si falta el código', () => {
    expect(buildClientPhoneValue('', '698934556')).toBe(`+${DEFAULT_CLIENT_COUNTRY_CODE} 698934556`);
  });

  it('construye el teléfono sin número cuando solo existe prefijo', () => {
    expect(buildClientPhoneValue('351', '')).toBe('+351');
  });

  it('parsea correctamente un teléfono con prefijo internacional', () => {
    expect(parseClientPhoneValue('+351 698934556')).toEqual({
      countryCode: '351',
      phoneNumber: '698934556',
    });
  });

  it('asume prefijo español si el valor tiene 9 dígitos o menos', () => {
    expect(parseClientPhoneValue('698934556')).toEqual({
      countryCode: DEFAULT_CLIENT_COUNTRY_CODE,
      phoneNumber: '698934556',
    });
  });

  it('acepta textos válidos para nombre y ciudad', () => {
    expect(isClientTextOnly('María José')).toBe(true);
    expect(isClientTextOnly("L'Hospitalet")).toBe(true);
  });

  it('rechaza textos con números en nombre o ciudad', () => {
    expect(isClientTextOnly('Madrid2')).toBe(false);
  });
});
