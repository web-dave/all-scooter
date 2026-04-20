import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { BikeService } from './scooter.service';
import { environment } from '../environments/environment';
import { MapComponent } from './map';

@Component({
  selector: 'app-root',
  imports: [MapComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly service = inject(BikeService);
  maps = true;
  gKey = environment.gKey;
  private readonly fallbackCenter: google.maps.LatLngLiteral = {
    lat: 53.59840544367906,
    lng: 10.063711568459246,
  };

  readonly center = signal<google.maps.LatLngLiteral>(this.fallbackCenter);

  ngOnInit(): void {
    this.setCenterFromBrowserLocation();
  }

  reloadBikes(): void {
    this.setCenterFromBrowserLocation();
    this.service.reloadTick$$.next(1);
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
        this.service.getCity(coords.latitude, coords.longitude).subscribe((data) => {
          this.service.city = data.results[0].postalAddress.locality.toLowerCase();
          this.service.reloadTick$$.next(1);
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
