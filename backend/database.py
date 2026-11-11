"""PostgreSQL persistence in deployment, with SQLite for local development.

Writes take a transaction-scoped lock before reading workspace revisions or
availability, so concurrent workers cannot reserve the same appointment slot.
"""
import os
import sqlite3
from contextlib import contextmanager
from contextlib import closing
from pathlib import Path
from threading import Lock

import psycopg
from psycopg.rows import dict_row

DB_PATH = os.environ.get('BOOKFLOW_DB', str(Path(__file__).parent / 'bookflow.sqlite3'))
DATABASE_URL = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
IntegrityError = (sqlite3.IntegrityError, psycopg.IntegrityError)
_initialized = set()
_initialize_lock = Lock()
_WRITE_LOCK = 754801239


class PostgresConnection:
    def __init__(self):
        self.connection = psycopg.connect(DATABASE_URL, row_factory=dict_row,
                                         connect_timeout=15, prepare_threshold=None)

    def execute(self, sql, params=()):
        return self.connection.execute(sql.replace('?', '%s'), params)

    def executescript(self, sql):
        for statement in sql.split(';'):
            if statement.strip():
                self.connection.execute(statement)

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def close(self):
        self.connection.close()


def storage_kind():
    return 'postgresql' if DATABASE_URL else 'sqlite'

def connect():
    if DATABASE_URL:
        return PostgresConnection()
    if os.environ.get('VERCEL'):
        raise RuntimeError('DATABASE_URL is required on Vercel; local SQLite is not persistent.')
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    return db

def initialize():
    key = DATABASE_URL or DB_PATH
    with _initialize_lock:
        if key in _initialized:
            return
        _initialize(key)


def _initialize(key):
    with closing(connect()) as db:
        if DATABASE_URL:
            db.execute('SELECT pg_advisory_xact_lock(?)', (_WRITE_LOCK,))
        db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
          password_hash TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS memberships (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          role TEXT NOT NULL, staff_id TEXT, client_id TEXT,
          preferences TEXT NOT NULL DEFAULT '{"email":true,"reminders":true,"digest":false}',
          PRIMARY KEY(user_id,workspace_id)
        );
        CREATE TABLE IF NOT EXISTS rate_limits (
          bucket TEXT PRIMARY KEY, window_start BIGINT NOT NULL, count INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS deleted_bookings (
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          booking_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          data TEXT NOT NULL, expires DOUBLE PRECISION NOT NULL,
          PRIMARY KEY(workspace_id,booking_id)
        );
        ''')
        db.commit()
    _initialized.add(key)

@contextmanager
def read():
    initialize()
    with closing(connect()) as db:
        yield db

@contextmanager
def transaction():
    initialize()
    db = connect()
    try:
        if DATABASE_URL:
            db.execute('SELECT pg_advisory_xact_lock(?)', (_WRITE_LOCK,))
        else:
            db.execute('BEGIN IMMEDIATE')
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
