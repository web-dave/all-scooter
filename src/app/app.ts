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
})
export class App {
  private service = inject(BikeService);
  center: google.maps.LatLngLiteral | google.maps.LatLng = {
    lat: 53.59840544367906,
    lng: 10.063711568459246,
  };
  bikes$ = this.service.getAllBikes('hamburg');
  bikes = toSignal(this.bikes$);
  infoWindow = viewChild.required(MapInfoWindow);
  selectedBike = signal<Bike | null>(null);

  openInfo(marker: MapMarker, bike: Bike) {
    this.selectedBike.set(bike);
    this.infoWindow().open(marker);
  }
}
