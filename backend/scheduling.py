"""Authoritative scheduling checks; run inside the same transaction as writes."""
from collections import Counter
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import HTTPException

PLANS = {'Free': {'bookings': 50, 'seats': 1}, 'Pro': {'bookings': 1000, 'seats': 5}, 'Business': {'bookings': 100000, 'seats': 25}}
ACTIVE = {'confirmed', 'pending', 'completed'}

def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))

def fail(message, code=409):
    raise HTTPException(code, message)

def validate_booking(w, b, *, require_future=True, ignore_id=None):
    services = {x['id']: x for x in w['services']}
    people = {x['id']: x for x in w['staff']}
    service, person = services.get(b['serviceId']), people.get(b['staffId'])
    if not service or not person or not any(c['id'] == b['clientId'] for c in w['clients']):
        fail('Select a valid service, team member and client.', 422)
    start = timestamp(b['start'])
    end = start + timedelta(minutes=b['duration'])
    if require_future and start < datetime.now(timezone.utc):
        fail('That appointment is in the past. Choose a future time.')
    local, local_end = start.astimezone(ZoneInfo(w['timezone'])), end.astimezone(ZoneInfo(w['timezone']))
    day = (local.weekday() + 1) % 7
    if day not in w['hours']['days'] or day not in person['days']:
        fail('This team member is not working on that day.')
    st, en = local.strftime('%H:%M'), local_end.strftime('%H:%M')
    if local.date() != local_end.date() or st < max(w['hours']['start'], person['start']) or en > min(w['hours']['end'], person['end']):
        fail('This appointment falls outside working hours.')
    for other in w['bookings']:
        if other['id'] == (ignore_id or b['id']) or other['staffId'] != b['staffId'] or other['status'] not in ACTIVE:
            continue
        other_start = timestamp(other['start'])
        other_end = other_start + timedelta(minutes=other['duration'])
        other_buffer = services.get(other['serviceId'], {}).get('buffer', 0)
        if start < other_end + timedelta(minutes=other_buffer) and end + timedelta(minutes=service['buffer']) > other_start:
            fail('This time overlaps an appointment or its buffer. Choose an open time.')

def validate_quotas(w):
    plan = PLANS[w['plan']]
    if len(w['staff']) + len(w['invites']) > plan['seats']:
        fail('The team seat limit for this plan has been reached.')
    zone = ZoneInfo(w['timezone'])
    counts = Counter(timestamp(b['start']).astimezone(zone).strftime('%Y-%m') for b in w['bookings'] if b['status'] != 'cancelled')
    if any(count > plan['bookings'] for count in counts.values()):
        fail('The monthly booking limit for this plan has been reached.')
    if w['plan'] == 'Free' and any(w['integrations'].values()):
        fail('Integrations require Pro or Business.')

def validate_changes(old, new, restored=None):
    previous = {b['id']: b for b in old['bookings']}
    restored = restored or {}
    old_services = {s['id']: s for s in old['services']}
    changed_buffers = {s['id'] for s in new['services'] if s['id'] in old_services and s['buffer'] != old_services[s['id']]['buffer']}
    if changed_buffers:
        # A buffer edit must not silently introduce collisions between bookings
        # that were already valid. Past history remains unchanged.
        for b in new['bookings']:
            if b['status'] in ACTIVE and timestamp(b['start']) > datetime.now(timezone.utc):
                validate_booking(new, b)
    for b in new['bookings']:
        was = previous.get(b['id'])
        if not was and restored.get(b['id']) == b:
            # Undo can restore history; future appointments must still be free.
            if b['status'] in ACTIVE and timestamp(b['start']) > datetime.now(timezone.utc):
                validate_booking(new, b)
            continue
        if was == b:
            continue
        if not was or any(was[k] != b[k] for k in ('start', 'serviceId', 'staffId', 'clientId', 'duration', 'price')):
            s = next((s for s in new['services'] if s['id'] == b['serviceId']), None)
            if not s or b['duration'] != s['duration'] or b['price'] != s['price']:
                fail('Booking duration and price must match the selected service.', 422)
            if b['status'] in ACTIVE:
                validate_booking(new, b)
        elif was['status'] not in ACTIVE and b['status'] in ACTIVE:
            validate_booking(new, b)
        if b['status'] in ('completed', 'no-show') and timestamp(b['start']) > datetime.now(timezone.utc):
            fail('Future appointments cannot be completed or marked no-show.')
        if b['recurring'] and not (was and was['recurring']) and new['plan'] == 'Free':
            fail('Recurring appointments require Pro or Business.')
    validate_quotas(new)
