import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { App } from './app';
import { MapComponent } from './map';
import { BikeService } from './scooter.service';

describe('App', () => {
  const geolocation = {
    getCurrentPosition: vi.fn(),
  };
  const bikeServiceMock = {
    city: '',
    currentLocation: null as google.maps.LatLngLiteral | null,
    reloadTick$$: new Subject(),
    getCity: vi.fn(() => of({ results: [{ postalAddress: { locality: 'Munich' } }] })),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    geolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 48.137154,
          longitude: 11.576124,
        },
      });
    });

    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: geolocation,
    });

    TestBed.overrideComponent(App, {
      remove: {
        imports: [MapComponent],
      },
      add: {
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: BikeService, useValue: bikeServiceMock }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the menu bar with a reload button', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.menu-bar__title')?.textContent).toContain('All Scooter');
    expect(compiled.querySelector('.menu-bar__reload')?.textContent).toContain('Reload');
  });

  it('should center the map on the browser location when available', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.componentInstance.center()).toEqual({
      lat: 48.137154,
      lng: 11.576124,
    });
    expect(geolocation.getCurrentPosition).toHaveBeenCalled();
  });
});
