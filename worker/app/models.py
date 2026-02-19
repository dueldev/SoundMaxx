from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl

ToolType = Literal[
    "stem_isolation",
    "mastering",
    "key_bpm",
    "loudness_report",
    "midi_extract",
]


class SourceAsset(BaseModel):
    id: str
    blobUrl: HttpUrl
    durationSec: float


class CallbackConfig(BaseModel):
    webhookUrl: HttpUrl
    webhookSecret: str = Field(min_length=16)


class DatasetConfig(BaseModel):
    captureMode: Literal["implied_use"] = "implied_use"
    policyVersion: str = Field(min_length=1, max_length=64)
    sourceSessionId: str


class JobRequest(BaseModel):
    jobId: str
    toolType: ToolType
    params: dict[str, Any]
    sourceAsset: SourceAsset
    callback: CallbackConfig
    dataset: DatasetConfig


class ArtifactPayload(BaseModel):
    blobUrl: HttpUrl
    blobKey: str
    format: str
    sizeBytes: int


class WorkerJobStatus(BaseModel):
    externalJobId: str
    status: Literal["queued", "running", "succeeded", "failed"]
    model: str
    etaSec: int | None = None
    progressPct: int | None = None
    errorCode: str | None = None
    artifacts: list[ArtifactPayload] = Field(default_factory=list)
