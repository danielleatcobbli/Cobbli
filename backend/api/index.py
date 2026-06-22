"""Vercel entry point — re-exports the FastAPI app."""

from __future__ import annotations

import os
import sys

# Vercel mounts /var/task/api/index.py; the app package lives one level up.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.main import app  # noqa: E402,F401
