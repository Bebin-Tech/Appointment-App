"""BebinBook development API: real sessions and tenancy; simulated paid services."""
import copy
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from . import database as database
from .schemas import Credentials, Signup, Forgot, Profile, WorkspaceInput, PublicBooking, PublicWaitlist
from .scheduling import fail, validate_booking, validate_changes, validate_quotas, PLANS

ORIGINS = [s.strip() for s in os.environ.get('BOOKFLOW_ORIGINS', 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000,http://localhost:8000').split(',')]
for host_key in ('VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL'):
    if os.environ.get(host_key):
        ORIGINS.append('https://' + os.environ[host_key])
COOKIE_SECURE = os.environ.get('BOOKFLOW_SECURE_COOKIE', 'true' if os.environ.get('VERCEL') else 'false').lower() == 'true'
SESSION_DAYS = 7

@asynccontextmanager
async def lifespan(app):
    database.initialize()
    yield

app = FastAPI(title='BebinBook API', version='1.0.0', lifespan=lifespan, description='Persistent scheduling API. Billing, integration connections, reset delivery and API keys are simulations.')
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_credentials=True, allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allow_headers=['Content-Type'])

@app.middleware('http')
async def protect_requests(request: Request, call_next):
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        origin = request.headers.get('origin')
        if origin and origin not in ORIGINS:
            return Response('Untrusted origin', status_code=403)
        # JSON-only mutations prevent cross-site form submission with session cookies.
        if request.url.path not in ('/api/auth/logout',) and 'application/json' not in request.headers.get('content-type', ''):
            return Response('Use application/json', status_code=415)
        length = request.headers.get('content-length', '0')
        if length.isdigit() and int(length) > 12_000_000:
            return Response('Request too large', status_code=413)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    if request.url.path.startswith('/api'):
        response.headers['Cache-Control'] = 'no-store'
    return response

def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600_000).hex()
    return salt + ':' + derived

def verify_password(password, value):
    return hmac.compare_digest(hash_password(password, value.split(':')[0]), value)

def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()

def session(response, db, user_id):
    token = secrets.token_urlsafe(32)
    db.execute('DELETE FROM sessions WHERE expires < ?', (int(time.time()),))
    db.execute('INSERT INTO sessions VALUES (?,?,?)', (digest(token), user_id, int(time.time()) + SESSION_DAYS * 86400))
    response.set_cookie('bookflow_session', token, httponly=True, secure=COOKIE_SECURE, samesite='lax', max_age=SESSION_DAYS * 86400, path='/')

def current_user(request: Request):
    token = request.cookies.get('bookflow_session', '')
    with database.read() as db:
        row = db.execute('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?', (digest(token), int(time.time()))).fetchone()
    if not row:
        fail('Please log in to continue.', 401)
    return dict(row)

def rate_limit(request, scope, limit=30, seconds=900):
    host = request.client.host if request.client else 'local'
    # Vercel overwrites this header at its trusted ingress. Local servers use
    # the socket peer and never trust arbitrary forwarding headers.
    if os.environ.get('VERCEL'):
        host = request.headers.get('x-vercel-forwarded-for', host).split(',')[0].strip()
    key = scope + ':' + digest(host)
    now = int(time.time())
    with database.transaction() as db:
        db.execute('DELETE FROM rate_limits WHERE window_start < ?', (now - 86400,))
        row = db.execute('SELECT * FROM rate_limits WHERE bucket=?', (key,)).fetchone()
        if not row or now - row['window_start'] >= seconds:
            db.execute('INSERT INTO rate_limits VALUES (?,?,1) ON CONFLICT (bucket) DO UPDATE SET window_start=excluded.window_start, count=1', (key, now))
        elif row['count'] >= limit:
            fail('Too many attempts. Please try again later.', 429)
        else:
            db.execute('UPDATE rate_limits SET count=count+1 WHERE bucket=?', (key,))

def user_profile(user):
    return {k: user[k] for k in ('id', 'name', 'email')}

def audit(w, text, user, role):
    event = {'id': str(uuid4()), 'text': text, 'time': int(time.time() * 1000)}
    w['activity'] = [event, *w.get('activity', [])][:25]
    w['audit'] = [{**event, 'actor': user['name'], 'role': role}, *w.get('audit', [])][:100]

def save_row(db, w, revision):
    db.execute('UPDATE workspaces SET data=?, revision=?, slug=? WHERE id=?', (json.dumps(w), revision, w['slug'], w['id']))

def membership(db, wid, user):
    member = db.execute('SELECT * FROM memberships WHERE workspace_id=? AND user_id=?', (wid, user['id'])).fetchone()
    row = db.execute('SELECT * FROM workspaces WHERE id=?', (wid,)).fetchone()
    if not member or not row:
        fail('Workspace not found.', 404)
    return dict(member), row, json.loads(row['data'])

def view(w, member, revision):
    out = copy.deepcopy(w)
    role = member['role']
    if role == 'Staff':
        out['bookings'] = [b for b in out['bookings'] if b['staffId'] == member['staff_id']]
        # Team CRM is shared. Staff see only their own calendar, but can prepare
        # a new client profile before booking that client's first appointment.
    elif role == 'Client':
        out['bookings'] = [b for b in out['bookings'] if b['clientId'] == member['client_id']]
        out['clients'] = [c for c in out['clients'] if c['id'] == member['client_id']]
        for c in out['clients']:
            c['notes'] = ''
    if role not in ('Owner', 'Admin'):
        out.update(audit=[], activity=[], keys=[], invites=[], waitlist=[])
        out['integrations'] = {'google': False, 'zoom': False, 'stripe': False}
    elif w['plan'] != 'Business':
        out['audit'] = []
        out['keys'] = []
    out['notifications'] = json.loads(member['preferences'])
    out.update(memberRole=role, revision=revision)
    return out

def accept_invites(db, user):
    for row in db.execute('SELECT * FROM workspaces').fetchall():
        w = json.loads(row['data'])
        invite = next((i for i in w['invites'] if i['email'].lower() == user['email']), None)
        if not invite or db.execute('SELECT 1 FROM memberships WHERE user_id=? AND workspace_id=?', (user['id'], row['id'])).fetchone():
            continue
        sid, cid = None, None
        if invite['role'] == 'Client':
            c = next((c for c in w['clients'] if c['email'].lower() == user['email']), None)
            if not c:
                c = {'id': str(uuid4()), 'name': user['name'], 'email': user['email'], 'tags': ['New'], 'notes': ''}
                w['clients'].append(c)
            cid = c['id']
        else:
            sid = str(uuid4())
            w['staff'].append({'id': sid, 'name': user['name'], 'email': user['email'], 'role': invite['role'], **w['hours']})
        w['invites'] = [i for i in w['invites'] if i['id'] != invite['id']]
        validate_quotas(w)
        db.execute('INSERT INTO memberships(user_id,workspace_id,role,staff_id,client_id) VALUES (?,?,?,?,?)', (user['id'], row['id'], invite['role'], sid, cid))
        audit(w, user['name'] + ' joined the workspace', user, invite['role'])
        save_row(db, w, row['revision'] + 1)

@app.get('/api/health')
def health():
    with database.read() as db:
        db.execute('SELECT 1').fetchone()
    return {'status': 'ok', 'storage': database.storage_kind(), 'billing': 'simulated'}

@app.post('/api/auth/signup', status_code=201)
def signup(data: Signup, response: Response, request: Request):
    rate_limit(request, 'signup', 20)
    user = {'id': str(uuid4()), 'email': data.email, 'name': data.name, 'password_hash': hash_password(data.password)}
    try:
        with database.transaction() as db:
            db.execute('INSERT INTO users VALUES (?,?,?,?)', tuple(user[k] for k in ('id', 'email', 'name', 'password_hash')))
            accept_invites(db, user)
            session(response, db, user['id'])
    except database.IntegrityError:
        fail('An account with this email already exists.', 409)
    return user_profile(user)

@app.post('/api/auth/login')
def login(data: Credentials, response: Response, request: Request):
    rate_limit(request, 'login')
    with database.transaction() as db:
        row = db.execute('SELECT * FROM users WHERE email=?', (data.email,)).fetchone()
        stored = row['password_hash'] if row else hash_password('dummy-password', '00' * 16)
        if not verify_password(data.password, stored) or not row:
            fail('Email or password is incorrect.', 401)
        user = dict(row)
        accept_invites(db, user)
        session(response, db, user['id'])
    return user_profile(user)

@app.get('/api/auth/me')
def me(user=Depends(current_user)):
    return user_profile(user)

@app.patch('/api/auth/profile')
def update_profile(data: Profile, user=Depends(current_user)):
    with database.transaction() as db:
        db.execute('UPDATE users SET name=? WHERE id=?', (data.name, user['id']))
    return {**user_profile(user), 'name': data.name}

@app.post('/api/auth/logout')
def logout(request: Request, response: Response):
    with database.transaction() as db:
        db.execute('DELETE FROM sessions WHERE token_hash=?', (digest(request.cookies.get('bookflow_session', '')),))
    response.delete_cookie('bookflow_session', path='/')
    return {'ok': True}

@app.post('/api/auth/forgot-password')
def forgot(data: Forgot, request: Request):
    rate_limit(request, 'forgot', 10)
    return {'message': 'If this account exists, a reset would be sent. Delivery is simulated.'}

@app.get('/api/workspaces')
def list_workspaces(user=Depends(current_user)):
    with database.read() as db:
        rows = db.execute('SELECT w.*, m.role, m.staff_id, m.client_id, m.preferences FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=?', (user['id'],)).fetchall()
    return [view(json.loads(r['data']), dict(r), r['revision']) for r in rows]

@app.post('/api/workspaces', status_code=201)
def create_workspace(body: WorkspaceInput, user=Depends(current_user)):
    w = body.data.model_dump(mode='json', exclude={'revision', 'memberRole'})
    if w['bookings'] or w['invites'] or w['keys'] or len(w['staff']) != 1:
        fail('New workspaces start with one owner and no bookings or invites.', 422)
    w['id'] = str(uuid4())
    # Slug collision and long/non-ASCII company names are resolved server-side.
    base = re.sub(r'[^a-z0-9]+', '-', w['name'].lower()).strip('-')[:65] or 'workspace'
    w['slug'] = base + '-' + secrets.token_hex(4)
    w['plan'] = 'Free'
    w['audit'], w['activity'] = [], []
    w['integrations'] = {'google': False, 'zoom': False, 'stripe': False}
    person = w['staff'][0]
    person.update(id=str(uuid4()), name=user['name'], email=user['email'], role='Owner')
    validate_quotas(w)
    with database.transaction() as db:
        if db.execute('SELECT COUNT(*) AS count FROM memberships WHERE user_id=? AND role=?', (user['id'], 'Owner')).fetchone()['count'] >= 20:
            fail('The development account workspace limit has been reached.')
        audit(w, 'Created workspace', user, 'Owner')
        db.execute('INSERT INTO workspaces VALUES (?,?,?,0)', (w['id'], w['slug'], json.dumps(w)))
        db.execute('INSERT INTO memberships(user_id,workspace_id,role,staff_id) VALUES (?,?,?,?)', (user['id'], w['id'], 'Owner', person['id']))
        member = dict(db.execute('SELECT * FROM memberships WHERE user_id=? AND workspace_id=?', (user['id'], w['id'])).fetchone())
    return view(w, member, 0)

@app.put('/api/workspaces/{wid}')
def update_workspace(wid: str, body: WorkspaceInput, user=Depends(current_user)):
    incoming = body.data.model_dump(mode='json', exclude={'revision', 'memberRole'})
    with database.transaction() as db:
        member, row, old = membership(db, wid, user)
        if body.revision != row['revision']:
            fail('This workspace changed in another session. Refresh before saving again.')
        visible = view(old, member, row['revision'])
        ignored = {'activity', 'audit', 'notifications', 'revision', 'memberRole'}
        changed = {k for k in incoming if k not in ignored and incoming[k] != visible.get(k)}
        role = member['role']
        if incoming['id'] != wid or 'slug' in changed:
            fail('Workspace identity cannot be changed.', 403)
        if role != 'Owner' and 'plan' in changed:
            fail('Only the owner can change billing.', 403)
        if role in ('Staff', 'Client'):
            allowed = {'bookings', 'clients', 'staff'} if role == 'Staff' else {'bookings'}
            if changed - allowed:
                fail('Your role cannot change these workspace fields.', 403)
        if 'staff' in changed:
            old_staff = {x['id']: x for x in old['staff']}
            if set(old_staff) != {x['id'] for x in incoming['staff']}:
                fail('Use team invitations to add members.', 403)
            for person in incoming['staff']:
                before = old_staff[person['id']]
                if any(person[k] != before[k] for k in ('id', 'name', 'email', 'role')):
                    fail('Membership identity and roles cannot be edited here.', 403)
                if role == 'Staff' and person['id'] != member['staff_id'] and person != before:
                    fail('Staff can edit only their own availability.', 403)
        if role == 'Admin' and 'invites' in changed:
            before = {x['id']: x for x in old['invites']}
            if any(i['role'] == 'Admin' and before.get(i['id']) != i for i in incoming['invites']):
                fail('Only the owner can invite admins.', 403)
        if 'keys' in changed and incoming['plan'] != 'Business':
            fail('Mock API keys require Business.', 403)
        new = copy.deepcopy(old)
        for key in changed:
            new[key] = incoming[key]
        if role in ('Staff', 'Client') and 'bookings' in changed:
            own = lambda b: b['staffId'] == member['staff_id'] if role == 'Staff' else b['clientId'] == member['client_id']
            old_own = {b['id']: b for b in old['bookings'] if own(b)}
            hidden_ids = {b['id'] for b in old['bookings'] if not own(b)}
            for b in incoming['bookings']:
                if not own(b) or b['id'] in hidden_ids:
                    fail('You can change only your own appointments.', 403)
                previous = old_own.get(b['id'])
                if role == 'Client':
                    if previous and any(b[k] != previous[k] for k in b if k != 'status') and b['status'] != 'confirmed':
                        fail('Choose an open future time when rescheduling.', 403)
                    if b['status'] not in ('confirmed', 'cancelled') and (not previous or b != previous):
                        fail('Clients can book, reschedule or cancel only.', 403)
                    if previous and b['notes'] != previous['notes']:
                        fail('Client notes cannot be edited here.', 403)
            new['bookings'] = [b for b in old['bookings'] if not own(b)] + incoming['bookings']
        if role == 'Staff' and 'clients' in changed:
            editable = {c['id'] for c in visible['clients']}
            hidden = {c['id'] for c in old['clients']} - editable
            if any(c['id'] in hidden for c in incoming['clients']):
                fail('That client is outside your calendar.', 403)
            new['clients'] = [c for c in old['clients'] if c['id'] not in editable] + incoming['clients']
        # Prevent duplicate email identities and ensure invite quota cannot be bypassed.
        emails = [s['email'].lower() for s in new['staff']] + [i['email'].lower() for i in new['invites']]
        if len(emails) != len(set(emails)):
            fail('A teammate or invitation with this email already exists.')
        now = time.time()
        db.execute('DELETE FROM deleted_bookings WHERE expires < ?', (now,))
        restored = {r['booking_id']: json.loads(r['data']) for r in db.execute(
            'SELECT * FROM deleted_bookings WHERE workspace_id=? AND user_id=? AND expires>=?',
            (wid, user['id'], now)).fetchall()}
        validate_changes(old, new, restored)
        new_ids = {b['id'] for b in new['bookings']}
        for b in old['bookings']:
            if b['id'] not in new_ids:
                db.execute('INSERT INTO deleted_bookings VALUES (?,?,?,?,?) ON CONFLICT (workspace_id, booking_id) DO UPDATE SET user_id=excluded.user_id, data=excluded.data, expires=excluded.expires',
                           (wid, b['id'], user['id'], json.dumps(b), now + 10))
        for booking_id in new_ids & restored.keys():
            db.execute('DELETE FROM deleted_bookings WHERE workspace_id=? AND booking_id=?', (wid, booking_id))
        if changed:
            audit(new, 'Updated ' + ', '.join(sorted(changed)), user, role)
        db.execute('UPDATE memberships SET preferences=? WHERE user_id=? AND workspace_id=?', (json.dumps(incoming['notifications']), user['id'], wid))
        member['preferences'] = json.dumps(incoming['notifications'])
        save_row(db, new, row['revision'] + 1)
    return view(new, member, row['revision'] + 1)

@app.delete('/api/workspaces/{wid}')
def delete_workspace(wid: str, user=Depends(current_user)):
    with database.transaction() as db:
        member, _, _ = membership(db, wid, user)
        if member['role'] != 'Owner':
            fail('Only the owner can delete a workspace.', 403)
        db.execute('DELETE FROM workspaces WHERE id=?', (wid,))
    return {'ok': True}

def public_workspace(db, slug):
    row = db.execute('SELECT * FROM workspaces WHERE slug=?', (slug,)).fetchone()
    if not row:
        fail('Booking page not found.', 404)
    return row, json.loads(row['data'])

@app.get('/api/public/{slug}')
def public_page(slug: str):
    with database.read() as db:
        _, w = public_workspace(db, slug)
    return {**{k: w[k] for k in ('id', 'name', 'color', 'slug', 'timezone', 'hours', 'services')},
            'staff': [{**{k: s[k] for k in ('id', 'name', 'start', 'end', 'days')}, 'role': 'Staff'} for s in w['staff']],
            'bookings': [{k: b[k] for k in ('id', 'start', 'duration', 'serviceId', 'staffId', 'status')} for b in w['bookings'] if b['status'] in ('confirmed', 'pending')],
            'clients': [], 'activity': [], 'waitlist': []}

@app.post('/api/public/{slug}/bookings', status_code=201)
def public_book(slug: str, data: PublicBooking, request: Request):
    rate_limit(request, 'public-book', 30, 3600)
    with database.transaction() as db:
        row, w = public_workspace(db, slug)
        service = next((s for s in w['services'] if s['id'] == data.serviceId), None)
        if not service:
            fail('Service not found.', 404)
        c = next((c for c in w['clients'] if c['email'].lower() == data.email.lower()), None)
        if not c:
            c = {'id': str(uuid4()), 'name': data.name, 'email': data.email.lower(), 'notes': '', 'tags': ['New']}
            w['clients'].append(c)
        b = {'id': str(uuid4()), 'clientId': c['id'], 'serviceId': data.serviceId, 'staffId': data.staffId,
             'start': data.start.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z'), 'duration': service['duration'], 'price': service['price'],
             'status': 'confirmed', 'recurring': False, 'notes': 'Booked through public page'}
        validate_booking(w, b)
        w['bookings'].append(b)
        validate_quotas(w)
        audit(w, data.name + ' booked ' + service['name'], {'name': 'Public booking page'}, 'Client')
        save_row(db, w, row['revision'] + 1)
    return {'id': b['id'], 'start': b['start'], 'status': 'confirmed'}

@app.post('/api/public/{slug}/waitlist', status_code=201)
def public_waitlist(slug: str, data: PublicWaitlist, request: Request):
    rate_limit(request, 'public-wait', 20, 3600)
    with database.transaction() as db:
        row, w = public_workspace(db, slug)
        if data.date < datetime.now(ZoneInfo(w['timezone'])).date():
            fail('Choose a current or future date.', 422)
        if not any(s['id'] == data.serviceId for s in w['services']):
            fail('Service not found.', 404)
        if any(x['email'].lower() == data.email.lower() and x['date'] == str(data.date) and x['serviceId'] == data.serviceId for x in w['waitlist']):
            fail('You are already on this waitlist.')
        if len(w['waitlist']) >= 5000:
            fail('This waitlist is full.')
        w['waitlist'].append({'id': str(uuid4()), **data.model_dump(mode='json')})
        audit(w, data.name + ' joined the waitlist', {'name': 'Public booking page'}, 'Client')
        save_row(db, w, row['revision'] + 1)
    return {'ok': True, 'delivery': 'simulated'}

# A production build can be served by the same origin as the API.
dist = Path(__file__).resolve().parents[1] / 'frontend' / 'dist'
if dist.is_dir():
    app.mount('/', StaticFiles(directory=dist, html=True), name='frontend')
