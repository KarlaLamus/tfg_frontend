import { describe, expect, it } from 'vitest';
import { getInitials, normalizeText, searchById, smartSearch } from '../src/app/utils/search';

describe('search', () => {
  it('normaliza acentos y mayúsculas', () => {
    expect(normalizeText('Árbol Ñandú')).toBe('arbol nandu');
  });

  it('extrae iniciales de un nombre completo', () => {
    expect(getInitials('Carlos García López')).toBe('cgl');
  });

  it('smartSearch devuelve true con búsqueda vacía', () => {
    expect(smartSearch('', 'Carlos García')).toBe(true);
  });

  it('encuentra coincidencias por inicio de texto', () => {
    expect(smartSearch('car', 'Carlos García')).toBe(true);
  });

  it('encuentra coincidencias por iniciales', () => {
    expect(smartSearch('cg', 'Carlos García')).toBe(true);
  });

  it('encuentra coincidencias por palabras individuales', () => {
    expect(smartSearch('gar lo', 'Ana García López')).toBe(true);
  });

  it('hace búsqueda sin depender de acentos', () => {
    expect(smartSearch('maria jose', 'María José')).toBe(true);
  });

  it('devuelve false cuando no hay coincidencias', () => {
    expect(smartSearch('thor', 'Luna Canela')).toBe(false);
  });

  it('searchById encuentra por contains o startsWith', () => {
    expect(searchById('076', 'RES-076')).toBe(true);
    expect(searchById('res', 'RES-076')).toBe(true);
  });

  it('searchById devuelve false si el código no coincide', () => {
    expect(searchById('999', 'RES-076')).toBe(false);
  });
});
