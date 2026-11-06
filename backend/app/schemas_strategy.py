from pydantic import BaseModel, Field, model_validator


class StrategyDocumentCreate(BaseModel):
    strategy_id: int = Field(gt=0)
    race_id: int = Field(gt=0)
    driver_id: int = Field(gt=0)
    strategy_type: str = Field(min_length=1, max_length=64)
    assumptions: list[str] = Field(default_factory=list, max_length=30)
    tyre_sequence: list[str] = Field(default_factory=list, max_length=12)
    analysis_metrics: dict[str, float | int | str | bool | None] = Field(default_factory=dict)
    report_text: str = Field(default="", max_length=20000)


class StrategyDocumentUpdate(BaseModel):
    strategy_type: str | None = Field(default=None, min_length=1, max_length=64)
    assumptions: list[str] | None = Field(default=None, max_length=30)
    tyre_sequence: list[str] | None = Field(default=None, max_length=12)
    analysis_metrics: dict[str, float | int | str | bool | None] | None = None
    report_text: str | None = Field(default=None, max_length=20000)


class StrategyStintInput(BaseModel):
    compound: str = Field(min_length=1, max_length=32)
    start_lap: int = Field(ge=1, le=1000)
    end_lap: int = Field(ge=1, le=1000)

    @model_validator(mode="after")
    def valid_range(self):
        if self.end_lap < self.start_lap:
            raise ValueError("end_lap must be greater than or equal to start_lap")
        return self


class StrategyPlanInput(BaseModel):
    race_id: int = Field(gt=0)
    driver_id: int = Field(gt=0)
    strategy_type: str = Field(min_length=1, max_length=48)
    stints: list[StrategyStintInput] = Field(min_length=1, max_length=12)
    pit_loss_ms: int = Field(ge=0, le=120000)
    degradation_ms_per_lap: float = Field(ge=0, le=10000)
    baseline_lap_ms: int | None = Field(default=None, ge=30000, le=300000)

    @model_validator(mode="after")
    def contiguous_stints(self):
        stints = self.stints
        if stints[0].start_lap != 1:
            raise ValueError("The first stint must start at lap 1")
        for previous, current in zip(stints, stints[1:]):
            if current.start_lap != previous.end_lap + 1:
                raise ValueError("Stints must be ordered and cover consecutive laps")
        return self


class StrategyComparisonInput(BaseModel):
    race_id: int = Field(gt=0)
    driver_id: int = Field(gt=0)
    pit_loss_ms: int = Field(default=22000, ge=0, le=120000)
    degradation_ms_per_lap: float = Field(default=80, ge=0, le=10000)
    baseline_lap_ms: int | None = Field(default=None, ge=30000, le=300000)
