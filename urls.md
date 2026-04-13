urls

Dott
https://gbfs.api.ridedott.com/public/v2/hamburg/free_bike_status.json

```json
{
  "data": {
    "bikes": [
      {
        "bike_id": "511da45f-ffef-4c1e-abe3-33b92dc17efc",
        "current_range_meters": 16200,
        "current_fuel_percent": 0.41,
        "is_disabled": false,
        "is_reserved": false,
        "last_reported": 1776104080,
        "lat": 53.501514,
        "lon": 10.022829,
        "pricing_plan_id": "11a49272-3cdb-48ac-ac40-a3f26292829c",
        "rental_uris": {
          "android": "https://go.ridedott.com/vehicles/511da45f-ffef-4c1e-abe3-33b92dc17efc?platform=android",
          "ios": "https://go.ridedott.com/vehicles/511da45f-ffef-4c1e-abe3-33b92dc17efc?platform=ios"
        },
        "vehicle_type_id": "dott_scooter"
      },
      {
        "bike_id": "3c97761b-147e-4c01-90f6-d6b0211132bb",
        "current_range_meters": 11700,
        "current_fuel_percent": 0.44,
        "is_disabled": false,
        "is_reserved": false,
        "last_reported": 1776103937,
        "lat": 53.546008,
        "lon": 10.112077,
        "pricing_plan_id": "097a1a31-b2da-5026-adcb-39702d5d6b32",
        "rental_uris": {
          "android": "https://go.ridedott.com/vehicles/3c97761b-147e-4c01-90f6-d6b0211132bb?platform=android",
          "ios": "https://go.ridedott.com/vehicles/3c97761b-147e-4c01-90f6-d6b0211132bb?platform=ios"
        },
        "vehicle_type_id": "dott_bicycle"
      }
    ]
  }
}
```

Lime
https://data.lime.bike/api/partners/v1/gbfs/hamburg/free_bike_status

```json
{
  "last_updated": 1776104526,
  "ttl": 0,
  "version": "1.0",
  "data": {
    "bikes": [
      {
        "bike_id": "e53d48a2-c125-4608-b466-7f9068e1b227",
        "lat": 53.6132,
        "lon": 10.0089,
        "is_reserved": 0,
        "is_disabled": 0,
        "vehicle_type": "scooter"
      },
        "bike_id": "c7a85476-b714-4e88-912d-9d85b88b5360",
        "lat": 53.5513,
        "lon": 9.9486,
        "is_reserved": 0,
        "is_disabled": 0,
        "vehicle_type": "bike"
      }
    ]
  }
}
```
