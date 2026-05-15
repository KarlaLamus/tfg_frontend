import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApiUrl } from '../src/app/utils/api-client';
import { extractPetPhotoUrl, updatePetRequest } from '../src/app/utils/pets-api';

describe('pets-api image mapping', () => {
  it('usa una foto absoluta si ya viene completa', () => {
    expect(
      extractPetPhotoUrl({
        fotoUrl: 'https://cdn.example.com/mascotas/luna.jpg',
      })
    ).toBe('https://cdn.example.com/mascotas/luna.jpg');
  });

  it('convierte rutas relativas del backend en URLs absolutas', () => {
    expect(
      extractPetPhotoUrl({
        imagenUrl: '/uploads/mascotas/luna.jpg',
      })
    ).toBe(buildApiUrl('/uploads/mascotas/luna.jpg'));
  });

  it('soporta estructuras anidadas de imagen', () => {
    expect(
      extractPetPhotoUrl({
        foto: {
          url: 'uploads/mascotas/milo.png',
        },
      })
    ).toBe(buildApiUrl('uploads/mascotas/milo.png'));
  });

  it('devuelve cadena vacia si la mascota no trae imagen', () => {
    expect(extractPetPhotoUrl({ nombre: 'Nina' })).toBe('');
  });
});

describe('pets-api update fallbacks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reintenta la edición con x-www-form-urlencoded si el PUT JSON devuelve 415', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            idMascota: 88,
            nombre: 'Oliver',
            especie: 'GATO',
            raza: 'Raza sin especificar',
            fechaNacimiento: '2025-06-16',
            peso: 3.4,
            sexo: 'MACHO',
            esterilizado: true,
            numeroMicrochip: '847385789578978',
            observaciones: '',
            color: '',
            dueno: { clienteId: 77 },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 415,
            error: 'Unsupported Media Type',
            path: '/api/mascotas/88',
          }),
          {
            status: 415,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    const result = await updatePetRequest(88, {
      ownerId: 77,
      name: 'Oliver',
      species: 'Gato',
      breed: 'Raza sin especificar',
      microchipNumber: '847385789578978',
      birthDate: '2025-06-16',
      weight: '3.4',
      sex: 'Macho',
      neutered: 'Sí',
      observations: '',
    });

    expect(result).toEqual({
      petId: 88,
      photoSavedToBackend: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const jsonPutInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(jsonPutInit.headers).get('Content-Type')).toBe('application/json');

    const encodedPutInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(new Headers(encodedPutInit.headers).get('Content-Type')).toContain(
      'application/x-www-form-urlencoded'
    );
    expect(String(encodedPutInit.body)).toContain('idMascota=88');
    expect(String(encodedPutInit.body)).toContain('clienteId=77');
  });
});
