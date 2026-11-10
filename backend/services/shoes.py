"""Shoe mileage from the user's synced activities and distance overrides."""
import math

METERS_PER_MILE = 1609.344


def shoe_activity_type(sport):
    name = ' '.join((sport or '').strip().lower().replace('-', ' ').replace('_', ' ').replace('/', ' ').split())
    if name in ('running', 'trail running', '0'):
        return 'running'
    if name in ('walking', 'dog walking', 'stroller walking', '63'):
        return 'walking'
    if name in ('hiking', 'rucking', 'hiking rucking', '52'):
        return 'hiking'
    return None


def summarize_shoes(workouts):
    shoes = {}
    unassigned = 0
    for workout in workouts:
        kind = shoe_activity_type(workout.get('sport_name'))
        if kind is None:
            continue
        name = ' '.join((workout.get('running_shoes') or '').split())
        if not name:
            unassigned += 1
            continue
        key = name.casefold()
        if key not in shoes:
            shoes[key] = {'name': name, 'total_miles': 0, 'running_miles': 0,
                          'walking_miles': 0, 'hiking_miles': 0, 'activities': 0,
                          'missing_distance': 0, 'last_used': None}
        shoe = shoes[key]
        shoe['activities'] += 1
        date = workout.get('start_time')
        if date and (shoe['last_used'] is None or date > shoe['last_used']):
            shoe['last_used'] = date
        override = workout.get('running_miles')
        distance = workout.get('distance_m')
        miles = float(override) if override is not None else float(distance) / METERS_PER_MILE if distance is not None else None
        if miles is None or not math.isfinite(miles) or miles < 0:
            shoe['missing_distance'] += 1
            continue
        shoe['total_miles'] += miles
        shoe[f'{kind}_miles'] += miles
    return {'shoes': sorted(shoes.values(), key=lambda shoe: (-shoe['total_miles'], shoe['name'].casefold())),
            'unassigned_activities': unassigned}
