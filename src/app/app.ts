import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MapAdvancedMarker, MapMarkerClusterer, GoogleMap } from '@angular/google-maps';
import { BikeService } from './scooter.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, switchMap } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [GoogleMap, MapMarkerClusterer, MapAdvancedMarker],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly service = inject(BikeService);
  private readonly reloadTick$$ = new BehaviorSubject(0);

  readonly center: google.maps.LatLngLiteral | google.maps.LatLng = {
    lat: 53.59840544367906,
    lng: 10.063711568459246,
  };

  readonly bikes = toSignal(
    this.reloadTick$$.pipe(switchMap(() => this.service.getAllBikes('hamburg'))),
    { initialValue: [] },
  );

  reloadBikes(): void {
    const value = this.reloadTick$$.getValue() + 1;
    this.reloadTick$$.next(value);
  }
}
