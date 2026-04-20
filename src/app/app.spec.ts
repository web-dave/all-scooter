import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GoogleMap, MapAdvancedMarker, MapMarkerClusterer } from '@angular/google-maps';
import { App } from './app';

describe('App', () => {
  const geolocation = {
    getCurrentPosition: vi.fn(),
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
        imports: [GoogleMap, MapMarkerClusterer, MapAdvancedMarker],
      },
      add: {
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    await TestBed.configureTestingModule({
      imports: [App],
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
