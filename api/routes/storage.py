"""
Storage browser API routes.

Provides endpoints for browsing and downloading files from the GCS bucket.
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse, RedirectResponse
from pydantic import BaseModel
import httpx

from api.gcs_client import create_gcs_client, GCSClientError
from api.config import get_config_from_env

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/storage", tags=["storage"])


class BrowseResponse(BaseModel):
    """Response model for bucket browsing"""
    bucket: str
    current_path: str
    folders: list[str]
    files: list[dict]
    total_files: int
    total_folders: int


class BucketInfoResponse(BaseModel):
    """Response model for bucket information"""
    name: str
    location: str
    storage_class: str
    created: Optional[str]
    updated: Optional[str]


@router.get("/browse", response_model=BrowseResponse)
async def browse_storage(
    request: Request,
    path: str = Query(default="", description="Path prefix to browse"),
    limit: int = Query(default=500, le=1000, description="Maximum items to return")
):
    """
    Browse the contents of the GCS bucket.
    
    Provides folder-like navigation through the bucket contents.
    Use the 'path' parameter to navigate into subfolders.
    
    Args:
        path: Path prefix to browse (e.g., "videos/2024-01/")
        limit: Maximum number of items to return
        
    Returns:
        BrowseResponse with folders and files at the specified path
    """
    try:
        config = getattr(request.app.state, 'config', None)
        if not config:
            config = get_config_from_env()
        
        gcs_client = create_gcs_client(config.gcs)
        result = gcs_client.browse_bucket(prefix=path, limit=limit)
        
        return BrowseResponse(**result)
        
    except GCSClientError as e:
        logger.error(f"GCS error while browsing: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to browse storage: {e}")
        raise HTTPException(status_code=500, detail="Failed to browse storage")


@router.get("/info", response_model=BucketInfoResponse)
async def get_bucket_info(request: Request):
    """
    Get information about the configured GCS bucket.
    
    Returns:
        Bucket metadata including name, location, and storage class
    """
    try:
        config = getattr(request.app.state, 'config', None)
        if not config:
            config = get_config_from_env()
        
        gcs_client = create_gcs_client(config.gcs)
        info = gcs_client.get_bucket_info()
        
        return BucketInfoResponse(
            name=info['name'],
            location=info['location'],
            storage_class=info['storage_class'],
            created=info['created'].isoformat() if info.get('created') else None,
            updated=info['updated'].isoformat() if info.get('updated') else None
        )
        
    except GCSClientError as e:
        logger.error(f"GCS error getting bucket info: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get bucket info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get bucket info")


@router.get("/download")
async def download_file(
    request: Request,
    path: str = Query(..., description="Full path to the file in the bucket"),
    filename: Optional[str] = Query(default=None, description="Optional custom filename for download")
):
    """
    Download a file from the GCS bucket.
    
    This endpoint proxies the download through the backend to handle
    authentication and avoid exposing signed URLs to the client.
    
    Args:
        path: Full path to the file in the bucket
        filename: Optional custom filename for the downloaded file
        
    Returns:
        StreamingResponse with the file content
    """
    try:
        config = getattr(request.app.state, 'config', None)
        if not config:
            config = get_config_from_env()
        
        gcs_client = create_gcs_client(config.gcs)
        
        # Generate signed URL
        signed_url = gcs_client.generate_download_url(
            blob_path=path,
            expiration_seconds=300,  # 5 minutes
            filename=filename
        )
        
        # Determine filename
        download_filename = filename or path.split('/')[-1]
        
        # Determine content type
        content_type = 'application/octet-stream'
        if download_filename.endswith('.mp4'):
            content_type = 'video/mp4'
        elif download_filename.endswith('.mov'):
            content_type = 'video/quicktime'
        elif download_filename.endswith('.png'):
            content_type = 'image/png'
        elif download_filename.endswith('.jpg') or download_filename.endswith('.jpeg'):
            content_type = 'image/jpeg'
        
        logger.info(f"Proxying download for: {path}")
        
        # Fetch and stream the file
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
            response = await client.get(signed_url)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to fetch file from storage: {response.status_code}"
                )
            
            def generate():
                for chunk in response.iter_bytes(chunk_size=65536):
                    yield chunk
            
            return StreamingResponse(
                generate(),
                media_type=content_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{download_filename}"',
                    "Content-Type": content_type,
                    "Access-Control-Allow-Origin": "*"
                }
            )
            
    except GCSClientError as e:
        logger.error(f"GCS error during download: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except httpx.HTTPError as e:
        logger.error(f"HTTP error during download: {e}")
        raise HTTPException(status_code=503, detail="Failed to download file from storage")
    except Exception as e:
        logger.error(f"Failed to download file: {e}")
        raise HTTPException(status_code=500, detail="Failed to download file")


@router.get("/stream")
async def stream_file(
    request: Request,
    path: str = Query(..., description="Full path to the file in the bucket")
):
    """
    Get a signed URL for streaming a file directly from GCS.
    
    This is useful for video playback where the client needs
    direct access to the file URL for seeking support.
    
    Args:
        path: Full path to the file in the bucket
        
    Returns:
        Redirect to the signed URL for streaming
    """
    try:
        config = getattr(request.app.state, 'config', None)
        if not config:
            config = get_config_from_env()
        
        gcs_client = create_gcs_client(config.gcs)
        
        # Generate signed URL for streaming (inline, not attachment)
        from datetime import datetime, timedelta
        
        blob = gcs_client._bucket.blob(path)
        if not blob.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        content_type = blob.content_type or 'application/octet-stream'
        
        signed_url = blob.generate_signed_url(
            expiration=datetime.utcnow() + timedelta(hours=1),
            method="GET",
            version="v4",
            response_disposition="inline",
            response_type=content_type
        )
        
        return RedirectResponse(url=signed_url)
        
    except GCSClientError as e:
        logger.error(f"GCS error getting stream URL: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get stream URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to get stream URL")

