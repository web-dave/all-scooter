import { Component, inject, signal } from '@angular/core';
import {
  MapMarker,
  MapMarkerClusterer,
  GoogleMap,
} from '@angular/google-maps';
import { Bike, BikeService } from './scooter.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [GoogleMap, MapMarkerClusterer, MapMarker],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private service = inject(BikeService);
  center: google.maps.LatLngLiteral | google.maps.LatLng = {
    lat: 53.59840544367906,
    lng: 10.063711568459246,
  };
  bikes$ = this.service.getAllBikes('hamburg');
  bikes = toSignal(this.bikes$);

  markerIcon(bike: Bike) {
    return {
      url: `${bike.tenant.toLowerCase()}-${bike.vehicle_type}.svg`,
      scaledSize: {
        width: 20,
        height: 30
      } as google.maps.Size
    }
  }
}
