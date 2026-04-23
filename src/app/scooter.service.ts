import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, combineLatest, map, Observable, of, Subject, switchMap, tap } from 'rxjs';
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
  id?: string;
  bike_id?: string;
  lat?: number;
  lon?: number;
  lng?: number;
  is_reserved?: boolean | number;
  is_disabled?: boolean | number;
  vehicle_type?: 'bike' | 'scooter';
  attributes?: {
    bike_id?: string;
    lat?: number;
    lon?: number;
    lng?: number;
    is_reserved?: boolean | number;
    is_disabled?: boolean | number;
    vehicle_type?: 'bike' | 'scooter';
  };
}

interface LimeBikePinsResponse {
  data?: LimeAPIDataBike[] | { bikes?: LimeAPIDataBike[]; bike_pins?: LimeAPIDataBike[] };
}

interface LimeEmailLoginResponse {
  token?: string;
  data?: {
    token?: string;
  };
  user?: {
    token?: string;
    attributes?: {
      token?: string;
    };
  };
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
  private readonly limeTokenStorageKey = 'all-scooter:lime-token';
  private readonly limeDeviceTokenStorageKey = 'all-scooter:lime-device-token';
  private readonly limeMapBoundsOffset = 0.02;
  private readonly limeMapZoom = 16;
  private readonly limeAppVersion = '3.248.1';
  private readonly limePromptEmailMessage = 'Bitte gib deine Lime E-Mail Adresse ein.';
  private readonly limePromptMagicLinkTokenMessage =
    'Bitte gib den magic_link_token aus dem Link in deiner E-Mail ein.';
  private readonly limeDeviceTokenPrefix = 'all-scooter';
  city = signal('');
  private readonly fallbackCenter: google.maps.LatLngLiteral = {
    lat: 53.59840544367906,
    lng: 10.063711568459246,
  };
  center = signal<google.maps.LatLngLiteral>(this.fallbackCenter);
  reloadTick$$ = new Subject();

  getCity(lat: number, lng: number) {
    return this.http.get<any>(
      `https://geocode.googleapis.com/v4/geocode/location/${lat},${lng}?key=${environment.gKey}`,
    );
  }

  getAllBikes(): Observable<Bike[]> {
    console.log('get all');
    return combineLatest([this.getAllDott(this.city()), this.getAllLime(this.city())]).pipe(
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
    return this.ensureLimeToken().pipe(
      switchMap((token) => (token == null ? of([]) : this.getLimeBikePins(token))),
      map((bikes) =>
        bikes.map(
          (bike) => this.mapLimeBike(bike),
        ),
      ),
      map((bikes) => bikes.filter((bike): bike is Bike => bike != null)),
    );
  }

  private ensureLimeToken(): Observable<string | null> {
    const token = this.getStoredLimeToken();
    if (token != null) {
      return of(token);
    }

    const email = this.askUser(this.limePromptEmailMessage);
    if (email == null) {
      return of(null);
    }

    const deviceToken = this.getLimeDeviceToken();

    return this.http
      .post(`${environment.limeUrl}v2/onboarding/magic-link`, {
        email,
        user_agreement_country_code: 'DE',
        user_agreement_version: 4,
      })
      .pipe(
        switchMap(() => {
          const magicLinkToken = this.askUser(this.limePromptMagicLinkTokenMessage);
          if (magicLinkToken == null) {
            return of(null);
          }

          const headers = new HttpHeaders({
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Device-Token': deviceToken,
          });

          return this.http
            .post<LimeEmailLoginResponse>(
              `${environment.limeUrl}v2/onboarding/login`,
              `magic_link_token=${encodeURIComponent(magicLinkToken)}`,
              { headers },
            )
            .pipe(map((response) => this.getLimeAuthToken(response)));
        }),
        tap((token) => {
          if (token != null) {
            this.storeLimeToken(token);
          }
        }),
        catchError(() => of(null)),
      );
  }

  private getLimeAuthToken(response: LimeEmailLoginResponse): string | null {
    return (
      response.token ?? response.data?.token ?? response.user?.token ?? response.user?.attributes?.token ?? null
    );
  }

  private getLimeBikePins(token: string): Observable<LimeAPIDataBike[]> {
    const center = this.center();
    const bounds = this.limeMapBoundsOffset;
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Platform: 'Web',
      'App-Version': this.limeAppVersion,
      'X-Device-Token': this.getLimeDeviceToken(),
    });
    return this.http
      .get<LimeBikePinsResponse>(`${environment.limeUrl}v2/map/bike_pins`, {
        headers,
        params: {
          ne_lat: String(center.lat + bounds),
          ne_lng: String(center.lng + bounds),
          sw_lat: String(center.lat - bounds),
          sw_lng: String(center.lng - bounds),
          user_latitude: String(center.lat),
          user_longitude: String(center.lng),
          zoom: String(this.limeMapZoom),
        },
      })
      .pipe(
        map((response) => this.readLimeBikesFromResponse(response)),
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            this.clearStoredLimeToken();
          }
          return of([]);
        }),
      );
  }

  private readLimeBikesFromResponse(response: LimeBikePinsResponse): LimeAPIDataBike[] {
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data == null) {
      return [];
    }

    return response.data.bike_pins ?? response.data.bikes ?? [];
  }

  private mapLimeBike(bike: LimeAPIDataBike): Bike | null {
    const bikeData = bike.attributes ?? bike;
    const lat = bikeData.lat;
    const lng = bikeData.lng ?? bikeData.lon;

    if (lat == null || lng == null) {
      return null;
    }

    const bikeId = bikeData.bike_id ?? bike.id;
    if (bikeId == null) {
      return null;
    }

    return {
      tenant: 'Lime',
      bike_id: bikeId,
      latLng: {
        lat,
        lng,
      },
      current_range_meters: -1,
      current_fuel_percent: -1,
      is_reserved: bikeData.is_reserved === true || bikeData.is_reserved === 1,
      is_disabled: bikeData.is_disabled === true || bikeData.is_disabled === 1,
      vehicle_type: bikeData.vehicle_type === 'bike' ? 'bike' : 'scooter',
    };
  }

  private askUser(message: string): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const value = window.prompt(message)?.trim();
    return value == null || value.length === 0 ? null : value;
  }

  private getStoredLimeToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(this.limeTokenStorageKey);
  }

  private storeLimeToken(token: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.limeTokenStorageKey, token);
  }

  private clearStoredLimeToken(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(this.limeTokenStorageKey);
  }

  private getLimeDeviceToken(): string {
    if (typeof localStorage === 'undefined') {
      return `${this.limeDeviceTokenPrefix}-device`;
    }

    const existingDeviceToken = localStorage.getItem(this.limeDeviceTokenStorageKey);
    if (existingDeviceToken != null) {
      return existingDeviceToken;
    }

    const generatedDeviceToken =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : this.generateFallbackDeviceToken();
    localStorage.setItem(this.limeDeviceTokenStorageKey, generatedDeviceToken);
    return generatedDeviceToken;
  }

  private generateFallbackDeviceToken(): string {
    if (typeof crypto === 'undefined' || !('getRandomValues' in crypto)) {
      return `${this.limeDeviceTokenPrefix}-device`;
    }

    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${this.limeDeviceTokenPrefix}-${randomHex}`;
  }
}
