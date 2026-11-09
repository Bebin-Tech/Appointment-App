"""SQLite development persistence. Each write takes a reserved transaction lock."""
import os
import sqlite3
from contextlib import contextmanager
from contextlib import closing
from pathlib import Path

DB_PATH = os.environ.get('BOOKFLOW_DB', str(Path(__file__).parent / 'bookflow.sqlite3'))

def connect():
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    return db

def initialize():
    with closing(connect()) as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
          password_hash TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires INTEGER NOT NULL
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
          bucket TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS deleted_bookings (
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          booking_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          data TEXT NOT NULL, expires REAL NOT NULL,
          PRIMARY KEY(workspace_id,booking_id)
        );
        ''')
        db.commit()

@contextmanager
def read():
    with closing(connect()) as db:
        yield db

@contextmanager
def transaction():
    db = connect()
    try:
        db.execute('BEGIN IMMEDIATE')
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
