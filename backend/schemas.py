"""Validated API contracts. Camel-case fields match the React domain objects."""
from datetime import date, datetime
from typing import Literal, Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Role = Literal['Owner', 'Admin', 'Staff', 'Client']
Status = Literal['confirmed', 'pending', 'completed', 'no-show', 'cancelled']

class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class Credentials(Model):
    email: str = Field(min_length=3, max_length=160, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: Annotated[str, StringConstraints(strip_whitespace=False)] = Field(min_length=8, max_length=128)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value):
        return value.lower()

class Signup(Credentials):
    name: str = Field(min_length=1, max_length=80)

class Profile(Model):
    name: str = Field(min_length=1, max_length=80)

class Forgot(Model):
    email: str = Field(min_length=3, max_length=160)

class Hours(Model):
    start: str = Field(pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')
    end: str = Field(pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')
    days: list[int] = Field(min_length=1, max_length=7)

    @model_validator(mode='after')
    def valid_hours(self):
        if self.start >= self.end or any(d < 0 or d > 6 for d in self.days):
            raise ValueError('Choose valid working hours and weekdays.')
        if len(set(self.days)) != len(self.days):
            raise ValueError('Working days must be unique.')
        return self

class TeamMember(Hours):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=160)
    role: Role

class Service(Model):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default='', max_length=500)
    duration: int = Field(ge=15, le=240, multiple_of=15)
    price: float = Field(ge=0, le=100000, allow_inf_nan=False)
    buffer: int = Field(ge=0, le=120, multiple_of=5)
    color: Literal['purple', 'green', 'blue'] = 'green'

class Client(Model):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=160, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    tags: list[str] = Field(default_factory=list, max_length=8)
    notes: str = Field(default='', max_length=2000)

class Booking(Model):
    id: str = Field(min_length=1, max_length=80)
    clientId: str = Field(min_length=1, max_length=80)
    serviceId: str = Field(min_length=1, max_length=80)
    staffId: str = Field(min_length=1, max_length=80)
    start: datetime
    duration: int = Field(ge=15, le=240)
    price: float = Field(ge=0, le=100000, allow_inf_nan=False)
    status: Status = 'confirmed'
    recurring: bool = False
    notes: str = Field(default='', max_length=1000)

    @field_validator('start')
    @classmethod
    def aware_datetime(cls, value):
        if value.tzinfo is None:
            raise ValueError('Appointment timestamps must include a UTC offset.')
        return value

class Invite(Model):
    id: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=160, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    role: Literal['Admin', 'Staff', 'Client']

class WaitEntry(Model):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=160)
    date: date
    serviceId: str = Field(min_length=1, max_length=80)

class Key(Model):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    last: str = Field(min_length=4, max_length=4)
    date: date

class Connections(Model):
    google: bool = False
    zoom: bool = False
    stripe: bool = False

class Preferences(Model):
    email: bool = True
    reminders: bool = True
    digest: bool = False

class Activity(Model):
    id: str = Field(min_length=1, max_length=80)
    text: str = Field(max_length=500)
    time: int

class Audit(Activity):
    actor: str = Field(max_length=100)
    role: Role

class Workspace(Model):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(pattern=r'^#[0-9a-fA-F]{6}$')
    slug: str = Field(min_length=1, max_length=100, pattern=r'^[a-z0-9-]+$')
    plan: Literal['Free', 'Pro', 'Business'] = 'Free'
    timezone: str
    hours: Hours
    staff: list[TeamMember] = Field(default_factory=list, max_length=25)
    services: list[Service] = Field(default_factory=list, max_length=100)
    clients: list[Client] = Field(default_factory=list, max_length=10000)
    bookings: list[Booking] = Field(default_factory=list, max_length=50000)
    waitlist: list[WaitEntry] = Field(default_factory=list, max_length=5000)
    invites: list[Invite] = Field(default_factory=list, max_length=25)
    keys: list[Key] = Field(default_factory=list, max_length=100)
    integrations: Connections = Field(default_factory=Connections)
    notifications: Preferences = Field(default_factory=Preferences)
    activity: list[Activity] = Field(default_factory=list, max_length=25)
    audit: list[Audit] = Field(default_factory=list, max_length=100)
    revision: int = 0
    memberRole: Role = 'Owner'

    @field_validator('timezone')
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError('Choose a valid IANA timezone.')
        return value

    @model_validator(mode='after')
    def unique_ids(self):
        for name in ('staff', 'services', 'clients', 'bookings', 'waitlist', 'invites', 'keys'):
            records = getattr(self, name)
            if len({x.id for x in records}) != len(records):
                raise ValueError(f'Duplicate {name} IDs.')
        return self

class WorkspaceInput(Model):
    data: Workspace
    revision: int = Field(default=0, ge=0)

class PublicBooking(Model):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=160, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    serviceId: str = Field(min_length=1, max_length=80)
    staffId: str = Field(min_length=1, max_length=80)
    start: datetime

    @field_validator('start')
    @classmethod
    def aware(cls, value):
        if value.tzinfo is None:
            raise ValueError('Include the appointment timezone offset.')
        return value

class PublicWaitlist(Model):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=160, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    date: date
    serviceId: str = Field(min_length=1, max_length=80)
