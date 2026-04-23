import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { BikeService } from './scooter.service';
import { MapComponent } from './map';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [MapComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly service = inject(BikeService);
  maps = signal(false);
  gKey = environment.gKey;

  ngOnInit(): void {
    this.initMaps();
    this.setCenterFromBrowserLocation();
  }

  reloadBikes(): void {
    this.setCenterFromBrowserLocation();
  }

  private setCenterFromBrowserLocation(): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.service.center.set({
          lat: coords.latitude,
          lng: coords.longitude,
        });
        this.service.getCity(coords.latitude, coords.longitude).subscribe((data) => {
          this.service.city.set(data.results[0].postalAddress.locality.toLowerCase());
          this.service.reloadTick$$.next(1);
        });
      },
      () => {
        this.service.center.set({
          lat: 53.59840544367906,
          lng: 10.063711568459246,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }

  initMaps() {
    const g: any = {
      v: 'weekly',
      key: this.gKey,
    };
    let h: any;
    let a: any;
    let k: any;
    let p = 'The Google Maps JavaScript API';
    let c = 'google';
    let l = 'importLibrary';
    let q = '__ib__';
    let m = document;
    let b: any = window;
    b = b[c] || (b[c] = {});
    var d = b.maps || (b.maps = {}),
      r = new Set(),
      e = new URLSearchParams(),
      u = () =>
        h ||
        (h = new Promise(async (f, n) => {
          await (a = m.createElement('script'));
          e.set('libraries', [...r] + '');
          for (k in g) {
            e.set(
              k.replace(/[A-Z]/g, (t: any) => '_' + t[0].toLowerCase()),
              g[k],
            );
          }
          e.set('callback', c + '.maps.' + q);
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          d[q] = f;
          a.onerror = () => (h = n(Error(p + ' could not load.')));
          a.nonce = (m.querySelector('script[nonce]') as any)?.nonce || '';
          m.head.append(a);
        }));
    d[l]
      ? console.warn(p + ' only loads once. Ignoring:', g)
      : (d[l] = (f: any, ...n: any) => r.add(f) && u().then(() => d[l](f, ...n)));

    setTimeout(() => {
      this.maps.set(true);
    }, 1500);
  }
}
