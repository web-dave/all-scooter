import { Component, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { GoogleMap, MapInfoWindow, MapMarker, MapMarkerClusterer } from '@angular/google-maps';
import { Subject, switchMap } from 'rxjs';
import { Bike, BikeService } from './scooter.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-map',
  template: `
    <google-map mapId="scooterMap" height="100%" width="100%" [zoom]="12" [center]="center()">
      <map-marker-clusterer>
        @for (bike of bikes(); track bike.bike_id) {
          <map-marker
            #marker="mapMarker"
            [position]="bike.latLng"
            [icon]="markerIcon(bike)"
            (mapClick)="openInfo(marker, bike)"
          />
        }
      </map-marker-clusterer>
      <map-info-window>
        @let sBike = selectedBike();
        @if (sBike != null) {
          <div style="font-size: x-large">
            <img
              style="height: 70px"
              [src]="'./' + markerIcon(sBike).url"
              [alt]="sBike.tenant + ' ' + sBike.vehicle_type"
            />
            @if (sBike.current_fuel_percent >= 0) {
              <div>
                🔋 <span>{{ sBike.current_fuel_percent * 100 }}%</span>
              </div>
            }
            @if (sBike.current_range_meters >= 0) {
              <div>
                🚶🏼‍♀️‍➡️ <span>{{ (sBike.current_range_meters / 1000).toFixed(1) }}km</span>
              </div>
            }
          </div>
        }
      </map-info-window>
    </google-map>
  `,
  imports: [GoogleMap, MapMarkerClusterer, MapMarker, MapInfoWindow],
})
export class MapComponent implements OnInit {
  center = input.required<google.maps.LatLngLiteral>();
  private readonly service = inject(BikeService);

  infoWindow = viewChild.required(MapInfoWindow);
  selectedBike = signal<Bike | null>(null);

  readonly bikes = toSignal(
    this.service.reloadTick$$.pipe(switchMap(() => this.service.getAllBikes())),
    {
      initialValue: [],
    },
  );

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

  ngOnInit(): void {
    // throw new Error('Method not implemented.');
  }
}
