from pymongo import MongoClient

from app.config import get_settings

settings = get_settings()
client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=1500)
database = client[settings.mongodb_database]
