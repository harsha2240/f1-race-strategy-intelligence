from pydantic import BaseModel, Field


class FastF1RaceImport(BaseModel):
    season: int = Field(ge=1950, le=2100)
    event: str = Field(min_length=1, max_length=120)


class JolpicaSeasonImport(BaseModel):
    season: int = Field(ge=1950, le=2100)
    include_laps: bool = False
