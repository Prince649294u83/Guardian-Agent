# conftest.py — top-level pytest configuration
# Ensures the project root is on sys.path so that `guardian_openenv` and
# `server` packages are importable without a prior `pip install -e .`.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
