import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BikeService } from './scooter.service';

describe('BikeService (Lime)', () => {
  const limeTokenStorageKey = 'all-scooter:lime-token';
  let service: BikeService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [BikeService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BikeService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
    localStorage.clear();
  });

  it('uses stored token and maps bike pins', () => {
    localStorage.setItem(limeTokenStorageKey, 'stored-token');
    service.center.set({ lat: 53.55, lng: 10 });

    let bikesCount = 0;
    service.getAllLime('hamburg').subscribe((bikes) => {
      bikesCount = bikes.length;
      expect(bikes[0]).toEqual({
        tenant: 'Lime',
        bike_id: 'bike-1',
        latLng: { lat: 53.55, lng: 10.01 },
        current_range_meters: -1,
        current_fuel_percent: -1,
        is_reserved: false,
        is_disabled: true,
        vehicle_type: 'bike',
      });
    });

    const bikePinsRequest = httpTestingController.expectOne(
      (request) => request.method === 'GET' && request.url.endsWith('/v2/map/bike_pins'),
    );
    expect(bikePinsRequest.request.headers.get('Authorization')).toBe('Bearer stored-token');
    bikePinsRequest.flush({
      data: {
        bike_pins: [
          {
            id: 'bike-1',
            attributes: {
              bike_id: 'bike-1',
              lat: 53.55,
              lng: 10.01,
              is_reserved: 0,
              is_disabled: 1,
              vehicle_type: 'bike',
            },
          },
        ],
      },
    });

    expect(bikesCount).toBe(1);
  });

  it('authenticates with prompts and stores token when none exists', () => {
    service.center.set({ lat: 53.55, lng: 10 });
    const promptSpy = vi
      .spyOn(window, 'prompt')
      .mockReturnValueOnce('+491701234567')
      .mockReturnValueOnce('123456');

    service.getAllLime('hamburg').subscribe((bikes) => {
      expect(bikes).toEqual([]);
    });

    const loginRequest = httpTestingController.expectOne(
      (request) =>
        request.method === 'GET' &&
        request.url.endsWith('/v1/login') &&
        request.params.get('phone') === '+491701234567',
    );
    loginRequest.flush({});

    const otpRequest = httpTestingController.expectOne(
      (request) => request.method === 'POST' && request.url.endsWith('/v1/login'),
    );
    expect(otpRequest.request.body).toEqual({
      login_code: '123456',
      phone: '+491701234567',
    });
    otpRequest.flush({ token: 'new-token' });

    const bikePinsRequest = httpTestingController.expectOne(
      (request) => request.method === 'GET' && request.url.endsWith('/v2/map/bike_pins'),
    );
    expect(bikePinsRequest.request.headers.get('Authorization')).toBe('Bearer new-token');
    bikePinsRequest.flush({ data: { bike_pins: [] } });

    expect(localStorage.getItem(limeTokenStorageKey)).toBe('new-token');
    expect(promptSpy).toHaveBeenCalledTimes(2);
  });

  it('clears stored token after unauthorized bike pin request', () => {
    localStorage.setItem(limeTokenStorageKey, 'expired-token');

    service.getAllLime('hamburg').subscribe((bikes) => {
      expect(bikes).toEqual([]);
    });

    const bikePinsRequest = httpTestingController.expectOne(
      (request) => request.method === 'GET' && request.url.endsWith('/v2/map/bike_pins'),
    );
    bikePinsRequest.flush(
      { message: 'unauthorized' },
      {
        status: 401,
        statusText: 'Unauthorized',
      },
    );

    expect(localStorage.getItem(limeTokenStorageKey)).toBeNull();
  });
});
