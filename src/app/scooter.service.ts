import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, combineLatest, map, Observable, of, Subject } from 'rxjs';
import { environment } from '../environments/environment';

interface DottAPIDataBike {
  bike_id: string;
  current_range_meters: number;
  current_fuel_percent: number;
  is_disabled: boolean;
  is_reserved: boolean;
  last_reported: number;
  lat: number;
  lon: number;
  pricing_plan_id: string;
  rental_uris: {
    android: string;
    ios: string;
  };
  vehicle_type_id: 'dott_bicycle' | 'dott_scooter';
}
interface LimeAPIDataBike {
  bike_id: string;
  lat: number;
  lon: number;
  is_reserved: number;
  is_disabled: number;
  vehicle_type: 'bike' | 'scooter';
}

export interface Bike {
  tenant: 'DOTT' | 'Lime';
  bike_id: string;
  latLng: {
    lat: number;
    lng: number;
  };
  current_range_meters: number;
  current_fuel_percent: number;
  is_reserved: boolean;
  is_disabled: boolean;
  vehicle_type: 'bike' | 'scooter';
}

@Injectable({ providedIn: 'root' })
export class BikeService {
  private http = inject(HttpClient);
  city = '';
  reloadTick$$ = new Subject();

  getCity(lat: number, lng: number) {
    return this.http.get<any>(
      `https://geocode.googleapis.com/v4/geocode/location/${lat},${lng}?key=---`,
    );
  }

  getAllBikes(): Observable<Bike[]> {
    // return this.getAllDott(city);
    return combineLatest([this.getAllDott(this.city), this.getAllLime(this.city)]).pipe(
      map(([dott, lime]) => [...dott, ...lime]),
    );
  }

  getAllDott(city: string): Observable<Bike[]> {
    const url = `${environment.dottUrl}${city}/free_bike_status.json`;
    return this.http.get<{ data: { bikes: DottAPIDataBike[] } }>(url).pipe(
      map((res) => res.data.bikes),
      map((bikes) =>
        bikes.map((bike) => ({
          ...bike,
          vehicle_type: bike.vehicle_type_id == 'dott_bicycle' ? 'bike' : 'scooter',
        })),
      ),
      catchError(() => of([])),
      map((bikes) =>
        bikes.map(
          (bike) =>
            ({
              tenant: 'DOTT',
              bike_id: bike.bike_id,
              latLng: {
                lat: bike.lat,
                lng: bike.lon,
              },
              current_range_meters: bike.current_range_meters,
              current_fuel_percent: bike.current_fuel_percent,
              is_reserved: bike.is_reserved,
              is_disabled: bike.is_disabled,
              vehicle_type: bike.vehicle_type,
            }) as Bike,
        ),
      ),
    );
  }

  getAllLime(city: string): Observable<Bike[]> {
    const url = `${environment.limeUrl}${city}/free_bike_status`;
    return this.http.get<{ data: { bikes: LimeAPIDataBike[] } }>(url).pipe(
      map((res) => res.data.bikes),
      catchError(() => of([])),
      map((bikes) =>
        bikes.map(
          (bike) =>
            ({
              tenant: 'Lime',
              bike_id: bike.bike_id,
              latLng: {
                lat: bike.lat,
                lng: bike.lon,
              },
              current_range_meters: -1,
              current_fuel_percent: -1,
              is_reserved: !!bike.is_reserved,
              is_disabled: !!bike.is_disabled,
              vehicle_type: bike.vehicle_type,
            }) as Bike,
        ),
      ),
    );
  }
}
