import { Component, inject, signal, viewChild } from '@angular/core';
import {
  MapMarker,
  MapMarkerClusterer,
  MapInfoWindow,
  GoogleMap,
} from '@angular/google-maps';
import { Bike, BikeService } from './scooter.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [JsonPipe, GoogleMap, MapMarkerClusterer, MapMarker, MapInfoWindow],
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
  infoWindow = viewChild.required(MapInfoWindow);
  selectedBike = signal<Bike | null>(null);

  openInfo(marker: MapMarker, bike: Bike) {
    this.selectedBike.set(bike);
    this.infoWindow().open(marker);
  }

  markerIcon(bike: Bike) {
    return {
      url: `${bike.tenant.toLowerCase()}-${bike.vehicle_type}.svg`,
      scaledSize: {
        width: 20,
        height: 30,
      } as google.maps.Size,
    };
  }
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
