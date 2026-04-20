import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MapAdvancedMarker, MapMarkerClusterer, GoogleMap } from '@angular/google-maps';
import { BikeService } from './scooter.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [GoogleMap, MapMarkerClusterer, MapAdvancedMarker],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly service = inject(BikeService);
  private readonly fallbackCenter: google.maps.LatLngLiteral = {
    lat: 53.59840544367906,
    lng: 10.063711568459246,
  };
  private readonly reloadTick = signal(0);

  readonly center = signal<google.maps.LatLngLiteral>(this.fallbackCenter);

  readonly bikes = toSignal(
    toObservable(this.reloadTick).pipe(switchMap(() => this.service.getAllBikes('hamburg'))),
    { initialValue: [] },
  );

  ngOnInit(): void {
    this.setCenterFromBrowserLocation();
  }

  reloadBikes(): void {
    this.reloadTick.update((value) => value + 1);
    this.setCenterFromBrowserLocation();
  }

  private setCenterFromBrowserLocation(): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.center.set({
          lat: coords.latitude,
          lng: coords.longitude,
        });
      },
      () => {
        this.center.set(this.fallbackCenter);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }
}
