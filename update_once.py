"""Одноразове оновлення цін (для планувальника хостингу): python3 update_once.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import server

server.migrate_legacy()
server.update()
