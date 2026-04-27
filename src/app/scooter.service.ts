import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  combineLatest,
  defer,
  map,
  Observable,
  of,
  Subject,
  switchMap,
} from 'rxjs';
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
  tenant: 'DOTT' | 'Lime' | 'VOI';
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

interface VoiVerifyPhoneResponse {
  token: string;
}

interface VoiVerifyCodeResponse {
  verificationStep?: 'emailValidationRequired' | 'authorized' | 'deviceActivationRequired';
  authToken?: string;
}

interface VoiAuthTokenResponse {
  authToken: string;
}

interface VoiSessionResponse {
  accessToken: string;
  authenticationToken: string;
}

interface VoiZone {
  id?: string | number;
  zone_id?: string | number;
  name?: string;
  city?: string;
}

interface VoiZonesResponse {
  zones?: VoiZone[];
  data?: {
    zones?: VoiZone[];
  };
}

interface VoiVehicle {
  id: string;
  battery?: number;
  location: {
    lng: number;
    lat: number;
  };
}

interface VoiVehiclesResponse {
  data?: {
    vehicle_groups?: {
      vehicles?: VoiVehicle[];
    }[];
  };
}

@Injectable({ providedIn: 'root' })
export class BikeService {
  private http = inject(HttpClient);
  private readonly voiAuthStorageKey = 'voi_auth_token';
  private readonly voiAccessStorageKey = 'voi_access_token';
  private readonly fallbackCenter: google.maps.LatLngLiteral = {
    lat: 53.59840544367906,
    lng: 10.063711568459246,
  };

  private voiAuthenticationToken: string | null = this.getStorageItem(this.voiAuthStorageKey);
  private voiAccessToken: string | null = this.getStorageItem(this.voiAccessStorageKey);
  city = signal('');
  center = signal<google.maps.LatLngLiteral>(this.fallbackCenter);
  reloadTick$$ = new Subject();

  getCity(lat: number, lng: number) {
    return this.http.get<any>(
      `https://geocode.googleapis.com/v4/geocode/location/${lat},${lng}?key=${environment.gKey}`,
    );
  }

  getAllBikes(): Observable<Bike[]> {
    return combineLatest([this.getAllDott(this.city()), this.getAllLime(this.city()), this.getAllVoi()]).pipe(
      map(([dott, lime, voi]) => [...dott, ...lime, ...voi]),
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
    const request = environment.limeUsePhpProxy
      ? this.http.post<{ data: { bikes: LimeAPIDataBike[] } }>(environment.limeUrl, { city })
      : this.http.get<{ data: { bikes: LimeAPIDataBike[] } }>(
          `${environment.limeUrl}${city}/free_bike_status`,
        );
    return request.pipe(
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

  private getAllVoi(): Observable<Bike[]> {
    return this.getVoiAccessToken().pipe(
      switchMap((accessToken) => {
        if (!accessToken) {
          return of([]);
        }
        return this.getVoiZoneIds(accessToken).pipe(
          switchMap((zoneIds) => {
            if (zoneIds.length === 0) {
              return of([]);
            }
            return combineLatest(zoneIds.map((zoneId) => this.getVoiVehicles(accessToken, zoneId))).pipe(
              map((zoneVehicles) => zoneVehicles.flat()),
            );
          }),
        );
      }),
      catchError(() => of([])),
    );
  }

  private getVoiAccessToken(): Observable<string | null> {
    if (this.voiAccessToken) {
      return of(this.voiAccessToken);
    }

    if (this.voiAuthenticationToken) {
      return this.openVoiSession(this.voiAuthenticationToken).pipe(
        map((session) => {
          this.storeVoiTokens(session.authenticationToken, session.accessToken);
          return session.accessToken;
        }),
        catchError(() => {
          this.clearVoiTokens();
          return this.startVoiAuthenticationFlow();
        }),
      );
    }

    return this.startVoiAuthenticationFlow();
  }

  private startVoiAuthenticationFlow(): Observable<string | null> {
    return defer(() => {
      const identifier = this.promptValue('Voi Anmeldung: Bitte E-Mail oder Handynummer eingeben');
      if (!identifier) {
        return of(null);
      }

      const email = identifier.includes('@') ? identifier : null;
      const phoneNumberInput = email
        ? this.promptValue('Voi Anmeldung: Handynummer ohne führende 0 eingeben')
        : identifier;
      if (!phoneNumberInput) {
        return of(null);
      }

      const normalizedPhone = phoneNumberInput.replace(/\D/g, '');
      if (!normalizedPhone) {
        return of(null);
      }

      return this.requestVoiOtp(normalizedPhone).pipe(
        switchMap((tokenResponse) => {
          const otp = this.promptValue('Bitte den Voi OTP Code eingeben');
          if (!otp) {
            return of(null);
          }
          return this.verifyVoiOtp(tokenResponse.token, otp).pipe(
            switchMap((verifyResponse) => this.resolveVoiAuthToken(tokenResponse.token, verifyResponse, email)),
          );
        }),
        switchMap((authenticationToken) => {
          if (!authenticationToken) {
            return of(null);
          }
          return this.openVoiSession(authenticationToken).pipe(
            map((session) => {
              this.storeVoiTokens(session.authenticationToken, session.accessToken);
              return session.accessToken;
            }),
          );
        }),
        catchError(() => of(null)),
      );
    });
  }

  private voiPost<T>(path: string, body: object): Observable<T> {
    if (environment.voiUsePhpProxy) {
      return this.http.post<T>(environment.voiUrl, { cmd: path, data: body });
    }
    return this.http.post<T>(`voiapi/${path}`, body);
  }

  private voiGet<T>(path: string, queryParams: Record<string, string>, accessToken: string): Observable<T> {
    if (environment.voiUsePhpProxy) {
      return this.http.post<T>(environment.voiUrl, {
        cmd: path,
        data: { ...queryParams, access_token: accessToken },
      });
    }
    const headers = { 'x-access-token': accessToken };
    const query = new URLSearchParams(queryParams).toString();
    return this.http.get<T>(`voiapi/${path}?${query}`, { headers });
  }

  private requestVoiOtp(phoneNumber: string): Observable<VoiVerifyPhoneResponse> {
    return this.voiPost<VoiVerifyPhoneResponse>('v1/auth/verify/phone', {
      country_code: 'DE',
      phone_number: phoneNumber,
    });
  }

  private verifyVoiOtp(token: string, code: string): Observable<VoiVerifyCodeResponse> {
    return this.voiPost<VoiVerifyCodeResponse>('v2/auth/verify/code', { code, token });
  }

  private resolveVoiAuthToken(
    token: string,
    verifyResponse: VoiVerifyCodeResponse,
    initialEmail: string | null,
  ): Observable<string | null> {
    if (verifyResponse.authToken && verifyResponse.verificationStep === 'authorized') {
      return of(verifyResponse.authToken);
    }

    if (verifyResponse.verificationStep === 'emailValidationRequired') {
      const email = initialEmail ?? this.promptValue('Bitte E-Mail für die Voi Bestätigung eingeben');
      if (!email) {
        return of(null);
      }
      return this.voiPost<VoiAuthTokenResponse>('v1/auth/verify/presence', { email, token }).pipe(
        map((response) => response.authToken),
      );
    }

    if (verifyResponse.verificationStep === 'deviceActivationRequired') {
      return this.voiPost<VoiAuthTokenResponse>('v3/auth/verify/device/activate', {
        token,
        provider: 'sms',
      }).pipe(map((response) => response.authToken));
    }

    return of(verifyResponse.authToken ?? null);
  }

  private openVoiSession(authenticationToken: string): Observable<VoiSessionResponse> {
    return this.voiPost<VoiSessionResponse>('v1/auth/session', { authenticationToken });
  }

  private getVoiZoneIds(accessToken: string): Observable<string[]> {
    const location = this.center();
    return this.voiGet<VoiZonesResponse>(
      'v1/zones',
      { lat: String(location.lat), lng: String(location.lng) },
      accessToken,
    ).pipe(
      map((response) => response.zones ?? response.data?.zones ?? []),
      map((zones) => {
        if (zones.length === 0) {
          return [];
        }
        const normalizedCity = this.city().trim().toLowerCase();
        const cityZones =
          normalizedCity.length > 0
            ? zones.filter((zone) =>
                `${zone.name ?? ''} ${zone.city ?? ''}`.toLowerCase().includes(normalizedCity),
              )
            : zones;
        const zonesToUse = cityZones.length > 0 ? cityZones : zones;
        return [...new Set(zonesToUse.map((zone) => String(zone.id ?? zone.zone_id ?? '')).filter(Boolean))];
      }),
    );
  }

  private getVoiVehicles(accessToken: string, zoneId: string): Observable<Bike[]> {
    return this.voiGet<VoiVehiclesResponse>('v2/rides/vehicles', { zone_id: zoneId }, accessToken).pipe(
        map((response) => response.data?.vehicle_groups ?? []),
        map((groups) => groups.flatMap((group) => group.vehicles ?? [])),
        map((vehicles) =>
          vehicles.map((vehicle) => ({
            tenant: 'VOI' as const,
            bike_id: vehicle.id,
            latLng: {
              lat: vehicle.location.lat,
              lng: vehicle.location.lng,
            },
            current_range_meters: -1,
            current_fuel_percent:
              typeof vehicle.battery === 'number' ? Math.min(Math.max(vehicle.battery, 0), 100) / 100 : -1,
            is_reserved: false,
            is_disabled: false,
            vehicle_type: 'scooter' as const,
          })),
        ),
        catchError(() => of([])),
      );
  }

  private promptValue(message: string): string | null {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
      return null;
    }
    const value = window.prompt(message)?.trim() ?? '';
    return value.length > 0 ? value : null;
  }

  private storeVoiTokens(authenticationToken: string, accessToken: string): void {
    this.voiAuthenticationToken = authenticationToken;
    this.voiAccessToken = accessToken;
    this.setStorageItem(this.voiAuthStorageKey, authenticationToken);
    this.setStorageItem(this.voiAccessStorageKey, accessToken);
  }

  private clearVoiTokens(): void {
    this.voiAuthenticationToken = null;
    this.voiAccessToken = null;
    this.removeStorageItem(this.voiAuthStorageKey);
    this.removeStorageItem(this.voiAccessStorageKey);
  }

  private getStorageItem(key: string): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(key);
  }

  private setStorageItem(key: string, value: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(key, value);
  }

  private removeStorageItem(key: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(key);
  }
}
