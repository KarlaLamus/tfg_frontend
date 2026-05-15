import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTrackingRequest,
  fetchTrackingPageData,
  updateTrackingRequest,
} from '../src/app/utils/tracking-api';

describe('tracking-api mutation fallbacks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reintenta crear un seguimiento con x-www-form-urlencoded si el POST JSON devuelve 415', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 415,
            error: 'Unsupported Media Type',
            path: '/api/seguimientos',
          }),
          {
            status: 415,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            idSeguimiento: 321,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    const createdTrackingId = await createTrackingRequest({
      petId: 88,
      reservationId: 205,
      employeeId: 14,
      employeeName: 'Laura Pérez',
      date: '2026-05-10',
      createdAt: '2026-05-10T12:34:56',
      feeding: 'Comió bien',
      medication: 'Sin medicación',
      behavior: 'Tranquilo',
      incidents: '',
      photoUrl: '',
    });

    expect(createdTrackingId).toBe(321);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCallUrl = String(fetchMock.mock.calls[0]?.[0]);
    const firstCallInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(firstCallUrl).toContain('/api/seguimientos');
    expect(new Headers(firstCallInit.headers).get('Content-Type')).toBe('application/json');

    const secondCallUrl = String(fetchMock.mock.calls[1]?.[0]);
    const secondCallInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(secondCallUrl).toContain('/api/seguimientos');
    expect(new Headers(secondCallInit.headers).get('Content-Type')).toContain(
      'application/x-www-form-urlencoded'
    );
    expect(String(secondCallInit.body)).toContain('mascotaId=88');
    expect(String(secondCallInit.body)).toContain('reservaId=205');
  });

  it('envia multipart con la foto cuando se adjunta un archivo en un seguimiento nuevo', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          idSeguimiento: 654,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const photoFile = new File(['tracking-image'], 'seguimiento.jpg', {
      type: 'image/jpeg',
    });

    const createdTrackingId = await createTrackingRequest({
      petId: 88,
      reservationId: 205,
      employeeId: 14,
      employeeName: 'Laura Pérez',
      date: '2026-05-10',
      createdAt: '2026-05-10T12:34:56',
      feeding: 'Comió bien',
      medication: 'Sin medicación',
      behavior: 'Tranquilo',
      incidents: '',
      photoUrl: 'data:image/jpeg;base64,abc',
      photoFile,
    });

    expect(createdTrackingId).toBe(654);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstCallUrl = String(fetchMock.mock.calls[0]?.[0]);
    const firstCallInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(firstCallUrl).toContain('/api/seguimientos');
    expect(new Headers(firstCallInit.headers).get('Accept')).toBe('application/json');
    expect(new Headers(firstCallInit.headers).get('Content-Type')).toBeNull();
    expect(firstCallInit.body).toBeInstanceOf(FormData);

    const multipartBody = firstCallInit.body as FormData;
    const uploadedPhoto = multipartBody.get('foto');

    expect(uploadedPhoto).toBeInstanceOf(File);
    expect((uploadedPhoto as File).name).toBe('seguimiento.jpg');
    expect(multipartBody.get('mascotaId')).toBe('88');
    expect(multipartBody.get('reservaId')).toBe('205');
  });

  it('normaliza createdAt a hora local sin sufijo UTC al crear un seguimiento', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          idSeguimiento: 777,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    await createTrackingRequest({
      petId: 88,
      reservationId: 205,
      employeeId: 14,
      employeeName: 'Laura Pérez',
      date: '2026-05-10',
      createdAt: '2026-05-10T10:34:56.000Z',
      feeding: 'Comió bien',
      medication: 'Sin medicación',
      behavior: 'Tranquilo',
      incidents: '',
      photoUrl: '',
    });

    const firstCallInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const parsedBody = JSON.parse(String(firstCallInit.body)) as Record<string, string>;

    expect(parsedBody.fechaSeguimiento).toBe('2026-05-10T12:34:56');
    expect(parsedBody.fecha).toBe('2026-05-10');
  });

  it('reintenta actualizar un seguimiento con x-www-form-urlencoded si el PUT JSON devuelve 415', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 415,
            error: 'Unsupported Media Type',
            path: '/api/seguimientos/321',
          }),
          {
            status: 415,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    const updatedTrackingId = await updateTrackingRequest({
      trackingId: 321,
      petId: 88,
      reservationId: 205,
      employeeId: 14,
      employeeName: 'Laura Pérez',
      date: '2026-05-10',
      createdAt: '2026-05-10T12:34:56',
      feeding: 'Comió bien',
      medication: 'Sin medicación',
      behavior: 'Activo',
      incidents: 'Sin incidencias',
      photoUrl: '',
    });

    expect(updatedTrackingId).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCallUrl = String(fetchMock.mock.calls[0]?.[0]);
    const firstCallInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(firstCallUrl).toContain('/api/seguimientos/321');
    expect(new Headers(firstCallInit.headers).get('Content-Type')).toBe('application/json');

    const secondCallInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(secondCallInit.headers).get('Content-Type')).toContain(
      'application/x-www-form-urlencoded'
    );
    expect(String(secondCallInit.body)).toContain('seguimientoId=321');
    expect(String(secondCallInit.body)).toContain('mascotaId=88');
  });

  it('deduplica mascotas repetidas del listado y conserva la reserva más reciente', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              nombreDueno: 'Teresa Santos Pina',
              ultimaFechaSeguimiento: '2026-05-07T09:00:00',
              numSeguimientos: 2,
              nombreSala: 'Sala Perros S1',
              idReserva: 190,
              mascota: {
                idMascota: 12,
                nombre: 'Pipa',
                especie: 'PERRO',
                sexo: 'HEMBRA',
                raza: 'Bichón Maltés',
              },
            },
            {
              nombreDueno: 'Teresa Santos Pina',
              ultimaFechaSeguimiento: '2026-05-08T11:30:00',
              numSeguimientos: 3,
              nombreSala: 'Sala Perros S1',
              idReserva: 191,
              mascota: {
                idMascota: 12,
                nombre: 'Pipa',
                especie: 'PERRO',
                sexo: 'HEMBRA',
                raza: 'Bichón Maltés',
              },
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            idMascota: 12,
            nombreMascota: 'Pipa',
            especie: 'PERRO',
            raza: 'Bichón Maltés',
            fechaNacimiento: '2020-04-02',
            edad: 6,
            peso: 5.2,
            sexo: 'HEMBRA',
            esterilizado: true,
            color: 'Blanco',
            observaciones: 'Muy sociable',
            estancia: {
              idReserva: 191,
              fechaEntrada: '2026-05-07',
              fechaSalida: '2026-05-10',
              estado: 'EN_CURSO',
              nombreSala: 'Sala Perros S1',
            },
            dueno: {
              clienteId: 44,
              nombreDueno: 'Teresa Santos Pina',
              telefonoDueno: '+34600100100',
              emailDueno: 'teresa@example.com',
            },
            fichaMedica: null,
            seguimientos: [
              {
                idSeguimiento: 701,
                nombreEmpleado: 'Laura Pérez',
                alimentacion: 'Bien',
                medicacionAdministrada: 'Ninguna',
                comportamiento: 'Activa',
                incidencias: null,
                fechaSeguimiento: '2026-05-08T11:30:00',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    const trackingPageData = await fetchTrackingPageData();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(trackingPageData.pets).toHaveLength(1);
    expect(trackingPageData.pets[0]?.id).toBe(12);
    expect(trackingPageData.pets[0]?.reservation.id).toBe('RES-191');
    expect(trackingPageData.pets[0]?.trackingCount).toBe(1);
  });
});
