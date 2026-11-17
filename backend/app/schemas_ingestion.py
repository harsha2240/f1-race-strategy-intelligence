from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator


class FastF1RaceImport(BaseModel):
    season: int = Field(ge=1950, le=2100)
    event: str = Field(min_length=1, max_length=120)


class JolpicaSeasonImport(BaseModel):
    season: int = Field(ge=1950, le=2100)
    include_laps: bool = False


class JolpicaSessionImport(BaseModel):
    season: int = Field(ge=1950, le=2100)
    race_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)] | None = None
    round_number: int | None = Field(default=None, ge=1, le=99)
    session_type: Literal["RACE", "QUALIFYING"]

    @model_validator(mode="after")
    def require_event(self):
        if (self.race_name is None) == (self.round_number is None):
            raise ValueError("Provide one race name or round number")
        return self
