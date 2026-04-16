import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GoogleMap, MapAdvancedMarker, MapMarkerClusterer } from '@angular/google-maps';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
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
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the menu bar with a reload button', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.menu-bar__title')?.textContent).toContain('All Scooter');
    expect(compiled.querySelector('.menu-bar__reload')?.textContent).toContain('Reload');
  });
});
