from pydantic import BaseModel, Field


class ProgressUpdate(BaseModel):
    seen_steps: list[int] = Field(default_factory=list, max_length=4)
    checks: list[bool] = Field(default_factory=list, max_length=3)
    completed: bool = False
