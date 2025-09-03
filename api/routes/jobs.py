"""
Job management routes for the API server.

This module contains the job creation, status, and management endpoints.
"""

from fastapi import APIRouter, HTTPException, Request, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import httpx

from api.models import (
    JobCreateRequest, JobCreateResponse, JobStatusResponse,
    ArtifactResponse, LogsResponse, JobCancelResponse, JobStatus,
    JobEstimateRequest, JobEstimateResponse, JobDetailsResponse
)
from api.exceptions import APIException
from api.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["jobs"])


def get_app_state(request: Request) -> dict:
    """Get the application state from the request"""
    # FastAPI's app.state stores attributes directly on the state object
    state_dict = {}
    for key in dir(request.app.state):
        if not key.startswith('_'):
            state_dict[key] = getattr(request.app.state, key)
    return state_dict


@router.post("/estimate", response_model=JobEstimateResponse)
async def estimate_job_cost(
    request_obj: Request,
    request: JobEstimateRequest
) -> JobEstimateResponse:
    """
    Estimate the cost and segments for a video generation job.
    
    This endpoint analyzes the prompt to determine how many segments will be generated
    and calculates the estimated cost before actually creating the job.
    """
    try:
        # Import required modules
        from pipeline import PromptEnhancer, load_config
        from generators.factory import create_video_generator
        from api.config_merger import ConfigMerger
        import os
        
        # Load base configuration
        base_config_path = "/app/pipeline_config.yaml"
        if not os.path.exists(base_config_path):
            raise HTTPException(status_code=500, detail="Pipeline configuration not found")
        
        base_config = load_config(base_config_path)
        
        # Use ConfigMerger to get effective configuration
        config_merger = ConfigMerger()
        effective_config = config_merger.merge_for_job(base_config, request.prompt)
        
        # Initialize prompt enhancer
        enhancer = PromptEnhancer(
            api_key=effective_config.get('openai_api_key'),
            base_url=effective_config.get('openai_base_url', 'https://api.openai.com/v1'),
            model=effective_config.get('prompt_enhancement_model', 'gpt-4o-mini')
        )
        
        # Import the enhancement instructions
        from pipeline import PROMPT_ENHANCEMENT_INSTRUCTIONS
        
        # Enhance the prompt to determine segments
        logger.info(f"Analyzing prompt for cost estimation: {request.prompt[:100]}...")
        enhancement_result = enhancer.enhance(PROMPT_ENHANCEMENT_INSTRUCTIONS, request.prompt)
        
        # Extract segment information
        keyframe_prompts = enhancement_result.get('keyframe_prompts', [])
        video_prompts = enhancement_result.get('video_prompts', [])
        segmentation_logic = enhancement_result.get('segmentation_logic', {})
        
        num_segments = len(video_prompts)
        segment_duration = effective_config.get('segment_duration_seconds', 5.0)
        total_duration = num_segments * segment_duration
        
        # Get the backend that will be used
        backend_name = effective_config.get('default_backend', 'veo3')
        
        # Create generator instance to get cost estimation
        generator = create_video_generator(backend_name, effective_config)
        cost_per_segment = generator.estimate_cost(segment_duration)
        total_cost = cost_per_segment * num_segments
        
        # Get reasoning from segmentation logic
        reasoning = segmentation_logic.get('reasoning', 'Prompt analyzed for optimal video pacing')
        
        logger.info(f"Cost estimation complete: {num_segments} segments, ${total_cost:.2f} total")
        
        return JobEstimateResponse(
            prompt=request.prompt,
            title=request.title,
            estimated_segments=num_segments,
            segment_duration=segment_duration,
            total_duration=total_duration,
            cost_per_segment=cost_per_segment,
            total_estimated_cost=total_cost,
            backend=backend_name,
            reasoning=reasoning
        )
        
    except Exception as e:
        logger.error(f"Cost estimation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to estimate cost: {str(e)}"
        )


@router.post("/", response_model=JobCreateResponse, status_code=202)
async def create_job(
    request_obj: Request,
    request: JobCreateRequest,
    background_tasks: BackgroundTasks
) -> JobCreateResponse:
    """
    Create a new video generation job.

    Accepts only a prompt parameter and returns immediately with a task ID.
    The job is queued for processing and can be monitored via the status endpoint.
    """
    from api.queue import JobQueue
    
    # Get job queue from app state
    job_queue: JobQueue = getattr(request_obj.app.state, 'job_queue', None)
    if not job_queue:
        raise HTTPException(status_code=503, detail="Job queue not available")
    
    # Create and queue the job with basic configuration
    effective_config = {
        "prompt": request.prompt,
        "title": request.title,  # Custom job title
        "generator": "minimax",  # Default generator
        "parameters": {}
    }
    
    job = job_queue.enqueue_job(
        request=request,
        effective_config=effective_config
    )
    
    logger.info(f"Created job {job.id} with prompt: {request.prompt[:50]}...")
    
    return JobCreateResponse(
        id=job.id,
        status=job.status,
        created_at=job.created_at
    )


@router.get("/", response_model=List[JobStatusResponse])
async def list_jobs(
    request_obj: Request,
    limit: int = 100,
    offset: int = 0
) -> List[JobStatusResponse]:
    """
    List recent jobs with pagination.
    
    Returns a list of job status objects ordered by creation time.
    """
    # Get job queue from app state
    job_queue: JobQueue = getattr(request_obj.app.state, 'job_queue', None)
    if not job_queue:
        raise HTTPException(status_code=503, detail="Job queue not available")
    
    # Get jobs list from queue
    jobs = job_queue.list_jobs(limit=limit, offset=offset)
    
    return [job.to_status_response() for job in jobs]


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    request_obj: Request,
    job_id: str
) -> JobStatusResponse:
    """
    Get the status of a video generation job.

    Returns current status, progress, timestamps, and GCS URI when available.
    """
    # Get job queue from app state
    job_queue: JobQueue = getattr(request_obj.app.state, 'job_queue', None)
    if not job_queue:
        raise HTTPException(status_code=503, detail="Job queue not available")
    
    # Get job status
    job = job_queue.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job.to_status_response()


@router.get("/{job_id}/details", response_model=JobDetailsResponse)
async def get_job_details(
    request_obj: Request,
    job_id: str
) -> JobDetailsResponse:
    """
    Get detailed information about a video generation job.

    Returns comprehensive details including configuration, logs, processing time,
    and diagnostic information for troubleshooting.
    """
    # Get job queue from app state
    job_queue: JobQueue = getattr(request_obj.app.state, 'job_queue', None)
    if not job_queue:
        raise HTTPException(status_code=503, detail="Job queue not available")
    
    # Get job details
    job = job_queue.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job.to_details_response()


@router.get("/{job_id}/video-url")
async def get_job_video_url(
    request_obj: Request,
    job_id: str,
    expiration_seconds: int = 3600
) -> dict:
    """
    Get a signed video URL for a completed job's video.
    
    Returns a time-limited signed URL that can be used to stream or embed the video
    directly from Google Cloud Storage without authentication.
    
    Args:
        job_id: The job identifier
        expiration_seconds: URL expiration time in seconds (default: 1 hour)
    
    Returns:
        A dictionary containing the signed URL and expiration time
    """
    from api.gcs_client import create_gcs_client
    from api.config import get_config_from_env
    
    # Get job queue from app state
    job_queue = getattr(request_obj.app.state, 'job_queue', None)
    if not job_queue:
        raise HTTPException(status_code=503, detail="Job queue not available")
    
    # Get job status
    job = job_queue.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.FINISHED:
        raise HTTPException(
            status_code=400, 
            detail=f"Job is not completed. Current status: {job.status}"
        )
    
    if not job.gcs_uri:
        raise HTTPException(
            status_code=404, 
            detail="No video artifact found for this job"
        )
    
    # Create GCS client and generate signed URL
    try:
        # Get GCS config from app state or load it
        config = getattr(request_obj.app.state, 'config', None)
        if not config:
            config = get_config_from_env()
        
        gcs_client = create_gcs_client(config.gcs)
        
        signed_url = gcs_client.generate_signed_url(
            gcs_uri=job.gcs_uri,
            expiration_seconds=expiration_seconds
        )
        
        expiration_time = datetime.now(timezone.utc) + timedelta(seconds=expiration_seconds)
        
        logger.info(f"Generated signed URL for job {job_id}, expires at {expiration_time}")
        
        return {
            "video_url": signed_url,
            "expires_at": expiration_time.isoformat(),
            "expiration_seconds": expiration_seconds,
            "mime_type": "video/mp4"
        }
        
    except Exception as e:
        logger.error(f"Failed to generate signed URL for job {job_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate video URL"
        )


@router.get("/{job_id}/download")
async def download_job_video(
    request_obj: Request,
    job_id: str
):
    """
    Download the video file for a completed job.
    
    This endpoint proxies the download from Google Cloud Storage to avoid CORS issues.
    The video is streamed directly through the backend to the client.
    
    Args:
        job_id: The job identifier
    
    Returns:
        StreamingResponse with the video file
    """
    from api.gcs_client import create_gcs_client
    from api.config import get_config_from_env
    
    # Get job queue from app state
    job_queue = getattr(request_obj.app.state, 'job_queue', None)
    if not job_queue:
        raise HTTPException(status_code=503, detail="Job queue not available")
    
    # Get job status
    job = job_queue.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != JobStatus.FINISHED:
        raise HTTPException(
            status_code=400, 
            detail=f"Job is not completed. Current status: {job.status}"
        )
    
    if not job.gcs_uri:
        raise HTTPException(
            status_code=404, 
            detail="No video artifact found for this job"
        )
    
    # Create GCS client and generate signed URL
    try:
        # Get GCS config from app state or load it
        config = getattr(request_obj.app.state, 'config', None)
        if not config:
            config = get_config_from_env()
        
        gcs_client = create_gcs_client(config.gcs)
        
        # Generate signed URL with longer expiration for download
        signed_url = gcs_client.generate_signed_url(
            gcs_uri=job.gcs_uri,
            expiration_seconds=3600  # 1 hour
        )
        
        # Generate filename from job title or prompt
        if job.title:
            # Use job title for filename
            filename = job.title.strip()
            # Sanitize filename
            filename = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_')).rstrip()
            filename = filename.replace(' ', '_')
            if not filename:
                filename = f"video_{job_id[:8]}"
        else:
            filename = f"video_{job_id[:8]}"
        
        filename = f"{filename}.mp4"
        
        logger.info(f"Proxying video download for job {job_id} as filename: {filename}")
        
        # Fetch the video from GCS and stream it to the client
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            response = await client.get(signed_url)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to fetch video from storage: {response.status_code}"
                )
            
            # Stream the video content
            def generate():
                for chunk in response.iter_bytes(chunk_size=8192):
                    yield chunk
            
            return StreamingResponse(
                generate(),
                media_type="video/mp4",
                headers={
                    "Content-Disposition": f"attachment; filename=\"{filename}\"",
                    "Content-Type": "video/mp4",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                }
            )
        
    except httpx.HTTPError as e:
        logger.error(f"HTTP error while downloading video for job {job_id}: {e}")
        raise HTTPException(
            status_code=503,
            detail="Failed to download video from storage"
        )
    except Exception as e:
        logger.error(f"Failed to download video for job {job_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to download video"
        )


@router.delete("/{job_id}", response_model=JobCancelResponse)
async def delete_job(
    job_id: str,
    request: Request
) -> JobCancelResponse:
    """
    Delete a job from the queue and storage.
    
    This will cancel the job if it's running and remove all associated data.
    Useful for cleaning up failed jobs or canceling unwanted jobs.
    """
    from api.queue import JobQueue
    
    # Get job queue from app state
    job_queue: JobQueue = getattr(request.app.state, 'job_queue', None)
    if not job_queue:
        raise HTTPException(status_code=503, detail="Job queue not available")
    
    # Check if job exists
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Handle different job statuses for deletion
    try:
        if job.status in [JobStatus.QUEUED, JobStatus.PROGRESS]:
            # For running jobs, try to cancel first
            cancel_success = job_queue.cancel_job(job_id)
            if not cancel_success:
                logger.warning(f"Failed to cancel running job {job_id}, proceeding with deletion")
        
        # Always delete the job data from storage
        job_queue._delete_job_data(job_id)
        
        logger.info(f"Job {job_id} deleted successfully")
        return JobCancelResponse(
            id=job_id,
            status=JobStatus.CANCELED,
            message="Job deleted successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to delete job {job_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete job: {str(e)}"
        )