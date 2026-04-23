import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BikeService } from './scooter.service';

describe('BikeService', () => {
  let service: BikeService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [BikeService, provideHttpClient(), provideHttpClientTesting()],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  function createService() {
    service = TestBed.inject(BikeService);
    service.city.set('hamburg');
    service.center.set({ lat: 53.5511, lng: 9.9937 });
    return service;
  }

  afterEach(() => {
    httpTestingController.verify();
    localStorage.clear();
  });

  it('should include voi scooters in the aggregated bike list when a token is available', () => {
    localStorage.setItem('voi_access_token', 'stored-access-token');
    createService();

    const bikes: Array<{ tenant: string }> = [];
    service.getAllBikes().subscribe((result) => bikes.push(...result));

    httpTestingController
      .expectOne((request) => request.url.endsWith('/hamburg/free_bike_status.json'))
      .flush({ data: { bikes: [] } });
    httpTestingController
      .expectOne((request) => request.url.endsWith('/hamburg/free_bike_status'))
      .flush({ data: { bikes: [] } });
    httpTestingController.expectOne('voiapi/v1/zones?lat=53.5511&lng=9.9937').flush({
      zones: [{ id: 'zone-1', city: 'hamburg' }],
    });
    httpTestingController.expectOne('voiapi/v2/rides/vehicles?zone_id=zone-1').flush({
      data: {
        vehicle_groups: [
          {
            vehicles: [
              {
                id: 'voi-scooter-1',
                battery: 45,
                location: {
                  lat: 53.55,
                  lng: 10.0,
                },
              },
            ],
          },
        ],
      },
    });

    expect(bikes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenant: 'VOI',
          bike_id: 'voi-scooter-1',
          current_fuel_percent: 0.45,
        }),
      ]),
    );
  });

  it('should authenticate with otp and persist voi tokens', () => {
    const prompt = vi
      .fn()
      .mockReturnValueOnce('test@example.com')
      .mockReturnValueOnce('17612345678')
      .mockReturnValueOnce('123456');
    Object.defineProperty(window, 'prompt', {
      configurable: true,
      value: prompt,
    });
    createService();

    const bikes: Array<{ tenant: string }> = [];
    service.getAllBikes().subscribe((result) => bikes.push(...result));

    httpTestingController
      .expectOne((request) => request.url.endsWith('/hamburg/free_bike_status.json'))
      .flush({ data: { bikes: [] } });
    httpTestingController
      .expectOne((request) => request.url.endsWith('/hamburg/free_bike_status'))
      .flush({ data: { bikes: [] } });
    httpTestingController.expectOne('voiapi/v1/auth/verify/phone').flush({ token: 'verify-token' });
    httpTestingController.expectOne('voiapi/v2/auth/verify/code').flush({
      verificationStep: 'authorized',
      authToken: 'auth-token',
    });
    httpTestingController.expectOne('voiapi/v1/auth/session').flush({
      accessToken: 'access-token',
      authenticationToken: 'next-auth-token',
    });
    httpTestingController.expectOne('voiapi/v1/zones?lat=53.5511&lng=9.9937').flush({
      zones: [{ id: 'zone-1', city: 'hamburg' }],
    });
    httpTestingController.expectOne('voiapi/v2/rides/vehicles?zone_id=zone-1').flush({
      data: {
        vehicle_groups: [],
      },
    });

    expect(bikes).toEqual([]);
    expect(localStorage.getItem('voi_access_token')).toBe('access-token');
    expect(localStorage.getItem('voi_auth_token')).toBe('next-auth-token');
    expect(prompt).toHaveBeenCalled();
  });
});
