import copy
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from backend import database
from backend.main import app

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, 'DB_PATH', str(tmp_path / 'test.sqlite3'))
    with TestClient(app) as c:
        yield c

def signup(c, email='owner@example.com'):
    r = c.post('/api/auth/signup', json={'name': 'Olivia Bennett', 'email': email, 'password': 'example-password'})
    assert r.status_code == 201, r.text
    return r.json()

def workspace(c):
    signup(c)
    data = {'id': 'draft', 'name': 'Test Studio', 'slug': 'test-studio', 'color': '#235c45', 'plan': 'Free', 'timezone': 'UTC',
            'hours': {'start': '09:00', 'end': '18:00', 'days': [0,1,2,3,4,5,6]},
            'staff': [{'id': 'owner', 'name': 'Olivia', 'email': 'owner@example.com', 'role': 'Owner', 'start': '09:00', 'end': '18:00', 'days': [0,1,2,3,4,5,6]}],
            'services': [{'id': 'service', 'name': 'Discovery', 'duration': 30, 'price': 0, 'buffer': 15, 'description': '', 'color': 'green'}],
            'clients': [{'id': 'client', 'name': 'Alex', 'email': 'alex@example.com', 'tags': [], 'notes': 'Private CRM note'}]}
    r = c.post('/api/workspaces', json={'data': data})
    assert r.status_code == 201, r.text
    return r.json()

def put(c, w):
    return c.put('/api/workspaces/' + w['id'], json={'data': w, 'revision': w['revision']})

def public_data(w, hour=10):
    start = (datetime.now(timezone.utc) + timedelta(days=2)).replace(hour=hour, minute=0, second=0, microsecond=0)
    return {'name': 'Alex', 'email': 'alex@example.com', 'serviceId': 'service', 'staffId': w['staff'][0]['id'], 'start': start.isoformat()}

def test_auth_session_and_logout(client):
    assert client.get('/api/auth/me').status_code == 401
    signup(client)
    assert client.get('/api/auth/me').json()['email'] == 'owner@example.com'
    assert client.post('/api/auth/logout').status_code == 200
    assert client.get('/api/auth/me').status_code == 401
    assert client.post('/api/auth/login', json={'email':'owner@example.com','password':'incorrect-password'}).status_code == 401
    assert client.post('/api/auth/login', json={'email':'owner@example.com','password':'example-password'}).status_code == 200

def test_tenant_isolation(client):
    w = workspace(client)
    with TestClient(app) as stranger:
        signup(stranger, 'stranger@example.com')
        assert stranger.get('/api/workspaces').json() == []
        assert put(stranger, w).status_code == 404
        assert stranger.delete('/api/workspaces/'+w['id'],headers={'Content-Type':'application/json'}).status_code == 404

def test_public_page_redacts_personal_information(client):
    w = workspace(client)
    page = client.get('/api/public/'+w['slug']).json()
    assert page['clients'] == []
    assert all('email' not in s for s in page['staff'])
    assert 'audit' not in page
    assert 'Private CRM note' not in str(page)

def test_conflict_buffer_and_available_boundary(client):
    w = workspace(client)
    payload = public_data(w)
    path = '/api/public/'+w['slug']+'/bookings'
    assert client.post(path, json=payload).status_code == 201
    assert client.post(path, json=payload).status_code == 409
    start = datetime.fromisoformat(payload['start'])
    assert client.post(path, json={**payload, 'start': (start+timedelta(minutes=30)).isoformat()}).status_code == 409
    assert client.post(path, json={**payload, 'start': (start+timedelta(minutes=45)).isoformat()}).status_code == 201
    assert len(client.get('/api/workspaces').json()[0]['bookings']) == 2

def test_concurrent_bookings_reserve_slot_atomically(client):
    w = workspace(client)
    path = '/api/public/'+w['slug']+'/bookings'
    payload = public_data(w)
    def book(_):
        with TestClient(app) as browser:
            return browser.post(path, json=payload).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(book, [1,2]))
    assert sorted(results) == [201,409]
    assert len(client.get('/api/workspaces').json()[0]['bookings']) == 1

def test_past_and_outside_hours(client):
    w = workspace(client)
    path = '/api/public/'+w['slug']+'/bookings'
    assert client.post(path, json={**public_data(w), 'start':'2000-01-01T10:00:00Z'}).status_code == 409
    assert client.post(path, json=public_data(w, 8)).status_code == 409
    assert client.post(path, json={**public_data(w), 'start':'2099-01-01T10:00:00'}).status_code == 422

def test_optimistic_revision_prevents_lost_updates(client):
    w = workspace(client)
    w['name'] = 'Updated name'
    assert put(client, w).status_code == 200
    assert put(client, w).status_code == 409
    assert client.get('/api/workspaces').json()[0]['name'] == 'Updated name'

def test_server_controls_booking_price_and_quota(client):
    w = workspace(client)
    b = {'id':'tampered','clientId':'client','serviceId':'service','staffId':w['staff'][0]['id'], 'start':public_data(w)['start'], 'duration':30,'price':100,'status':'confirmed','notes':'','recurring':False}
    w['bookings']=[b]
    assert put(client,w).status_code == 422
    w['bookings']=[]
    w['invites']=[{'id':'i1','email':'teammate@example.com','role':'Staff'}]
    assert put(client,w).status_code == 409

def test_staff_permissions_and_invitation_membership(client):
    w = workspace(client)
    w['plan'] = 'Business'
    w['invites']=[{'id':'i1','email':'staff@example.com','role':'Staff'}]
    r=put(client,w)
    assert r.status_code == 200, r.text
    with TestClient(app) as person:
        signup(person,'staff@example.com')
        own=person.get('/api/workspaces').json()[0]
        assert own['memberRole']=='Staff'
        assert own['audit']==[]
        changed=copy.deepcopy(own);changed['plan']='Free'
        assert put(person,changed).status_code==403
        changed=copy.deepcopy(own);changed['staff'][0]['start']='10:00'
        assert put(person,changed).status_code==403
        changed=copy.deepcopy(own)
        next(s for s in changed['staff'] if s['email']=='staff@example.com')['start']='10:00'
        assert put(person,changed).status_code==200
        assert person.delete('/api/workspaces/'+own['id'],headers={'Content-Type':'application/json'}).status_code==403

def test_client_permissions_and_private_notes(client):
    w=workspace(client);w['plan']='Pro';w['invites']=[{'id':'ic','email':'alex@example.com','role':'Client'}]
    assert put(client,w).status_code==200
    with TestClient(app) as person:
        signup(person,'alex@example.com')
        own=person.get('/api/workspaces').json()[0]
        assert own['memberRole']=='Client'
        assert own['clients'][0]['notes']==''
        own['services'][0]['price']=100
        assert put(person,own).status_code==403

def test_origin_protection_and_mock_reset(client):
    r=client.post('/api/auth/signup',json={'name':'Test','email':'t@example.com','password':'test-password'},headers={'Origin':'https://untrusted.example'})
    assert r.status_code==403
    assert client.post('/api/auth/forgot-password',json={'email':'unknown@example.com'}).status_code==200

def test_waitlist_duplicate_and_invalid_service(client):
    w=workspace(client);path='/api/public/'+w['slug']+'/waitlist'
    data={'name':'Alex','email':'alex@example.com','date':public_data(w)['start'][:10],'serviceId':'service'}
    assert client.post(path,json=data).status_code==201
    assert client.post(path,json=data).status_code==409
    assert client.post(path,json={**data,'serviceId':'missing'}).status_code==404

def test_recurring_batch_is_atomic_and_plan_gated(client):
    w=workspace(client)
    start=datetime.fromisoformat(public_data(w)['start'])
    def appointment(i,offset):
        return {'id':str(i),'clientId':'client','serviceId':'service','staffId':w['staff'][0]['id'],
                'start':(start+timedelta(days=offset)).isoformat(),'duration':30,'price':0,
                'status':'confirmed','notes':'','recurring':True}
    w['bookings']=[appointment(1,0),appointment(2,7)]
    assert put(client,w).status_code==409
    assert client.get('/api/workspaces').json()[0]['bookings']==[]
    w['plan']='Pro'
    w['bookings']=[appointment(1,0),appointment(2,0)]
    assert put(client,w).status_code==409
    assert client.get('/api/workspaces').json()[0]['bookings']==[]
    w['bookings']=[appointment(1,0),appointment(2,7)]
    assert put(client,w).status_code==200

def test_server_audit_actor_and_member_notification_preferences(client):
    w=workspace(client);w['plan']='Business';w['invites']=[{'id':'is','email':'staff@example.com','role':'Staff'}]
    assert put(client,w).status_code==200
    with TestClient(app) as person:
        signup(person,'staff@example.com')
        own=person.get('/api/workspaces').json()[0]
        own['notifications']['email']=False
        own['audit']=[{'id':'fake','text':'fake','actor':'Forged actor','role':'Owner','time':1}]
        assert put(person,own).status_code==200
        assert person.get('/api/workspaces').json()[0]['notifications']['email'] is False
    current=client.get('/api/workspaces').json()[0]
    assert current['notifications']['email'] is True
    assert all(x['actor']!='Forged actor' for x in current['audit'])

def test_undo_can_restore_deleted_history_without_allowing_new_past_bookings(client):
    w=workspace(client)
    assert client.post('/api/public/'+w['slug']+'/bookings',json=public_data(w)).status_code==201
    with database.transaction() as db:
        import json
        data=json.loads(db.execute('SELECT data FROM workspaces WHERE id=?',(w['id'],)).fetchone()['data'])
        data['bookings'][0].update(start='2000-01-03T10:00:00Z',status='completed')
        db.execute('UPDATE workspaces SET data=? WHERE id=?',(json.dumps(data),w['id']))
    current=client.get('/api/workspaces').json()[0]
    record=copy.deepcopy(current['bookings'][0])
    current['bookings']=[]
    result=put(client,current)
    assert result.status_code==200
    restored=result.json();restored['bookings']=[record]
    assert put(client,restored).status_code==200
    current=client.get('/api/workspaces').json()[0]
    current['bookings'].append({**record,'id':'brand-new-past-booking'})
    assert put(client,current).status_code==409
