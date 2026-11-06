from pydantic import BaseModel, ConfigDict


class DashboardSummary(BaseModel):
    races: int
    drivers: int
    constructors: int
    race_results: int
    average_finish: float | None


class DriverSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    driver_id: int
    full_name: str
    nationality: str | None = None
    seasons: int = 0
    race_starts: int = 0
    points: float = 0


class ApiError(BaseModel):
    detail: str
