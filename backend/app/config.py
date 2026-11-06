from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "F1 Strategy Intelligence API"
    environment: str = "development"
    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3307
    mysql_database: str = "f1_strategy"
    mysql_user: str = "f1_app"
    mysql_password: str = ""
    mongodb_uri: str = "mongodb://127.0.0.1:27018/f1_strategy"
    mongodb_database: str = "f1_strategy"
    web_origin: str = "http://localhost:3000"
    api_secret_key: str = ""

    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore", case_sensitive=False)

    @property
    def mysql_url(self) -> str:
        from urllib.parse import quote_plus

        return (
            f"mysql+pymysql://{quote_plus(self.mysql_user)}:{quote_plus(self.mysql_password)}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}?charset=utf8mb4"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
