import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PET_WEIGHT_KG,
  getLatestAllowedPetBirthDate,
  getPetBirthDateValidationError,
  getPetWeightValidationError,
  isPetTextOnly,
  isValidPetImageFile,
  isValidPetMicrochipNumber,
  mapPetSubmitErrorToField,
  normalizePetMicrochipNumber,
} from '../src/app/utils/pet-form';

describe('pet-form', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-04T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normaliza el microchip dejando solo 15 dígitos', () => {
    expect(normalizePetMicrochipNumber('900-444 555 666 777 abc')).toBe('900444555666777');
  });

  it('acepta nombres de mascota con letras y separadores válidos', () => {
    expect(isPetTextOnly("Luna d'oro")).toBe(true);
    expect(isPetTextOnly('Canela-Rose')).toBe(true);
  });

  it('rechaza nombres de mascota con números', () => {
    expect(isPetTextOnly('Bruno2')).toBe(false);
  });

  it('acepta imágenes PNG/JPG y rechaza otros formatos', () => {
    expect(isValidPetImageFile(new File(['png'], 'luna.png', { type: 'image/png' }))).toBe(true);
    expect(isValidPetImageFile(new File(['jpg'], 'luna.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(isValidPetImageFile(new File(['webp'], 'luna.webp', { type: 'image/webp' }))).toBe(
      false
    );
  });

  it('acepta extensiones válidas aunque el navegador no informe el mime type', () => {
    expect(isValidPetImageFile(new File(['png'], 'luna.png'))).toBe(true);
    expect(isValidPetImageFile(new File(['txt'], 'nota.txt'))).toBe(false);
  });

  it('valida un microchip de 15 dígitos', () => {
    expect(isValidPetMicrochipNumber('981020000123456')).toBe(true);
  });

  it('rechaza un microchip incompleto', () => {
    expect(isValidPetMicrochipNumber('98102000012345')).toBe(false);
  });

  it('calcula la última fecha permitida de nacimiento con mínimo de 3 meses', () => {
    expect(getLatestAllowedPetBirthDate()).toBe('2026-02-04');
  });

  it('permite una fecha de nacimiento válida', () => {
    expect(getPetBirthDateValidationError('2025-11-01')).toBeNull();
  });

  it('rechaza una fecha de nacimiento futura', () => {
    expect(getPetBirthDateValidationError('2026-05-05')).toBe(
      'La fecha de nacimiento no puede ser futura'
    );
  });

  it('rechaza una fecha de nacimiento con menos de 3 meses', () => {
    expect(getPetBirthDateValidationError('2026-03-20')).toBe(
      'La mascota debe tener al menos 3 meses'
    );
  });

  it('rechaza una fecha de nacimiento inválida', () => {
    expect(getPetBirthDateValidationError('2026-99-99')).toBe(
      'La fecha de nacimiento no es válida'
    );
  });

  it('no marca error si el peso está vacío', () => {
    expect(getPetWeightValidationError('')).toBeNull();
  });

  it('rechaza pesos no válidos o no positivos', () => {
    expect(getPetWeightValidationError('abc')).toBe('Introduce un peso válido');
    expect(getPetWeightValidationError('0')).toBe('Introduce un peso válido');
  });

  it('rechaza pesos por encima del máximo permitido', () => {
    expect(getPetWeightValidationError(String(MAX_PET_WEIGHT_KG + 1))).toBe(
      `El peso no puede superar ${MAX_PET_WEIGHT_KG} kg`
    );
  });

  it('acepta pesos válidos', () => {
    expect(getPetWeightValidationError('12.5')).toBeNull();
  });

  it('mapea errores de microchip duplicado al campo correcto', () => {
    expect(mapPetSubmitErrorToField('El microchip ya existe')).toEqual({
      field: 'microchipNumber',
      message: 'El número de microchip ya está en uso',
    });
  });

  it('mapea errores de raza, peso y cliente', () => {
    expect(mapPetSubmitErrorToField('La raza no es válida')).toEqual({
      field: 'breed',
      message: 'La raza no es válida',
    });
    expect(mapPetSubmitErrorToField('El peso es incorrecto')).toEqual({
      field: 'weight',
      message: 'El peso es incorrecto',
    });
    expect(mapPetSubmitErrorToField('cliente no encontrado')).toEqual({
      field: 'clientId',
      message: 'cliente no encontrado',
    });
  });

  it('devuelve null cuando no puede asociar el error a un campo', () => {
    expect(mapPetSubmitErrorToField('')).toBeNull();
    expect(mapPetSubmitErrorToField('Error inesperado del servidor')).toBeNull();
  });
});
