from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from app.config import get_settings


def build_engine() -> Engine:
    settings = get_settings()
    return create_engine(settings.mysql_url, pool_pre_ping=True, pool_recycle=1800)


engine = build_engine()
