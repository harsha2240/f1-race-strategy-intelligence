from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator


SessionType = Literal["FP1", "FP2", "FP3", "SPRINT_QUALIFYING", "SPRINT", "QUALIFYING", "RACE"]


class UserCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=12, max_length=256)
    roles: list[str] = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized:
            raise ValueError("Enter a valid email address")
        return normalized

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, value: list[str]) -> list[str]:
        roles = sorted(set(role.upper() for role in value))
        if any(role not in {"ADMIN", "ANALYST"} for role in roles):
            raise ValueError("Role must be ADMIN or ANALYST")
        return roles


class UserRoleUpdate(BaseModel):
    roles: list[str] = Field(min_length=1)

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, value: list[str]) -> list[str]:
        roles = sorted(set(role.upper() for role in value))
        if any(role not in {"ADMIN", "ANALYST"} for role in roles):
            raise ValueError("Role must be ADMIN or ANALYST")
        return roles


class AdminSessionCreate(BaseModel):
    race_id: int = Field(gt=0)
    session_type: SessionType
    session_date: datetime | None = None


class AdminSessionUpdate(BaseModel):
    session_type: SessionType | None = None
    session_date: datetime | None = None


class ManualRaceResultCreate(BaseModel):
    race_id: int = Field(gt=0)
    driver_team_id: int = Field(gt=0)
    position: int | None = Field(default=None, ge=1, le=999)
    points: Decimal = Field(default=Decimal("0"), ge=0, max_digits=5, decimal_places=2)
    status: str = Field(default="Finished", min_length=1, max_length=48)
    classified_laps: int | None = Field(default=None, ge=0, le=999)


class ManualRaceResultUpdate(BaseModel):
    position: int | None = Field(default=None, ge=1, le=999)
    points: Decimal | None = Field(default=None, ge=0, max_digits=5, decimal_places=2)
    status: str | None = Field(default=None, min_length=1, max_length=48)
    classified_laps: int | None = Field(default=None, ge=0, le=999)
