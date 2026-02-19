from __future__ import annotations

import asyncio
import hashlib
import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .dataset import capture_training_sample
from .models import ArtifactPayload, JobRequest, WorkerJobStatus
from .processing import build_stem_timeout_fallback, download_source_audio, run_processing, run_processing_with_hard_timeout
from .security import assert_bearer_token, sign_payload

OUTPUT_ROOT = Path(os.getenv("OUTPUT_ROOT", "worker/data/outputs")).resolve()
TMP_ROOT = Path(os.getenv("TMP_ROOT", "worker/data/tmp")).resolve()
SOURCE_CACHE_ROOT = Path(os.getenv("SOURCE_CACHE_ROOT", str(TMP_ROOT / "source-cache"))).resolve()
PUBLIC_BASE_URL = os.getenv("WORKER_PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
AUDIO_SUFFIXES = {".wav", ".mp3", ".flac", ".ogg", ".aac", ".m4a", ".aif", ".aiff"}

OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
TMP_ROOT.mkdir(parents=True, exist_ok=True)
SOURCE_CACHE_ROOT.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="SoundMaxx Worker", version="1.0.0")
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_ROOT)), name="outputs")

job_statuses: dict[str, WorkerJobStatus] = {}


def initial_model(tool_type: str) -> str:
    if tool_type == "stem_isolation":
        return os.getenv("STEM_MODEL_ROFORMER_NAME", "UVR-MDX-NET-Inst_HQ_5.onnx")
    if tool_type == "mastering":
        return "matchering_2_0"
    if tool_type == "key_bpm":
        return "essentia"
    if tool_type == "loudness_report":
        return "pyloudnorm"
    return "basic_pitch"


def output_url(job_id: str, filename: str) -> str:
    return f"{PUBLIC_BASE_URL}/outputs/{job_id}/{filename}"


def source_audio_suffix(source_url: str) -> str:
    parsed = urlparse(source_url)
    suffix = Path(parsed.path).suffix.lower()
    return suffix if suffix in AUDIO_SUFFIXES else ".wav"


def source_cache_path(source_url: str) -> Path:
    parsed = urlparse(source_url)
    identity = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    suffix = source_audio_suffix(source_url)
    cache_key = hashlib.sha256(identity.encode("utf-8")).hexdigest()
    return SOURCE_CACHE_ROOT / f"{cache_key}{suffix}"


def link_or_copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        target.unlink()

    try:
        os.link(source, target)
    except OSError:
        shutil.copy2(source, target)


def stage_source_audio(source_url: str, target_path: Path) -> None:
    cached_path = source_cache_path(source_url)
    if cached_path.exists() and cached_path.stat().st_size > 0:
        link_or_copy(cached_path, target_path)
        return

    temp_path = SOURCE_CACHE_ROOT / f"{cached_path.name}.tmp-{os.getpid()}-{uuid.uuid4().hex}"
    if temp_path.exists():
        temp_path.unlink()

    download_source_audio(source_url, temp_path)
    if temp_path.stat().st_size <= 0:
        temp_path.unlink(missing_ok=True)
        raise RuntimeError("Downloaded source audio is empty")

    os.replace(temp_path, cached_path)
    link_or_copy(cached_path, target_path)


def post_callback(job: JobRequest, payload: dict[str, Any]) -> None:
    raw = json.dumps(payload, default=str)
    signature = sign_payload(job.callback.webhookSecret, raw)

    requests.post(
        str(job.callback.webhookUrl),
        data=raw,
        timeout=30,
        headers={
            "content-type": "application/json",
            "x-soundmaxx-signature": signature,
        },
    )


async def execute_job(job: JobRequest, external_job_id: str) -> None:
    status = job_statuses[external_job_id]
    status.status = "running"
    status.progressPct = 20

    try:
        await asyncio.to_thread(post_callback, job, {
            "externalJobId": external_job_id,
            "status": "running",
            "progressPct": 20,
        })
    except Exception:
        pass

    workspace = TMP_ROOT / external_job_id
    output_dir = OUTPUT_ROOT / external_job_id

    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    source_url = str(job.sourceAsset.blobUrl)
    input_path = workspace / f"input{source_audio_suffix(source_url)}"

    try:
        await asyncio.to_thread(stage_source_audio, source_url, input_path)
        status.progressPct = 40

        if job.toolType == "stem_isolation":
            timeout_sec = max(int(os.getenv("STEM_ISOLATION_TIMEOUT_SEC", "120")), 30)
            try:
                model_name, produced_files = await asyncio.to_thread(
                    run_processing_with_hard_timeout,
                    job.toolType,
                    input_path,
                    output_dir,
                    job.params,
                    timeout_sec,
                )
            except TimeoutError:
                model_name, produced_files = await asyncio.to_thread(
                    build_stem_timeout_fallback,
                    input_path,
                    output_dir,
                    int(job.params.get("stems", 4)),
                )
        else:
            model_name, produced_files = await asyncio.to_thread(
                run_processing,
                job.toolType,
                input_path,
                output_dir,
                job.params,
            )

        artifacts = []
        for file in produced_files:
            if not file.exists():
                continue
            artifacts.append(
                ArtifactPayload(
                    blobUrl=output_url(external_job_id, file.name),
                    blobKey=file.name,
                    format=file.suffix.replace(".", "") or "bin",
                    sizeBytes=file.stat().st_size,
                )
            )

        status.status = "succeeded"
        status.model = model_name
        status.progressPct = 100
        status.etaSec = 0
        status.artifacts = artifacts

        if job.dataset.captureMode == "implied_use":
            await asyncio.to_thread(
                capture_training_sample,
                source_session_id=job.dataset.sourceSessionId,
                job_id=external_job_id,
                tool_type=job.toolType,
                input_file=input_path,
                output_files=produced_files,
                params=job.params,
                policy_version=job.dataset.policyVersion,
            )

        payload = {
            "externalJobId": external_job_id,
            "status": "succeeded",
            "progressPct": 100,
            "model": model_name,
            "qualityFlags": ["fallback_passthrough_output"] if model_name.startswith("fallback_") else [],
            "artifacts": [artifact.model_dump(mode="json") for artifact in artifacts],
        }
        await asyncio.to_thread(post_callback, job, payload)
    except Exception as exc:
        status.status = "failed"
        status.progressPct = 100
        status.errorCode = str(exc)[:120]

        payload = {
            "externalJobId": external_job_id,
            "status": "failed",
            "progressPct": 100,
            "errorCode": status.errorCode,
        }
        try:
            await asyncio.to_thread(post_callback, job, payload)
        except Exception:
            pass
    finally:
        if workspace.exists():
            shutil.rmtree(workspace)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"ok": True, "worker": "soundmaxx"})


@app.post("/jobs", response_model=WorkerJobStatus)
async def create_job(job: JobRequest, authorization: str | None = Header(default=None)) -> WorkerJobStatus:
    try:
        assert_bearer_token(authorization)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    external_job_id = job.jobId
    status = WorkerJobStatus(
        externalJobId=external_job_id,
        status="queued",
        model=initial_model(job.toolType),
        etaSec=180,
        progressPct=5,
    )

    job_statuses[external_job_id] = status
    asyncio.create_task(execute_job(job, external_job_id))
    return status


@app.get("/jobs/{external_job_id}", response_model=WorkerJobStatus)
async def get_job_status(external_job_id: str, authorization: str | None = Header(default=None)) -> WorkerJobStatus:
    try:
        assert_bearer_token(authorization)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    status = job_statuses.get(external_job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")

    return status
