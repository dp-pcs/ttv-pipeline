"""
Audio transcription routes for the API server.

This module provides endpoints for transcribing audio files to text using OpenAI's Whisper API.
Supports various audio formats and returns transcriptions with timestamps in SRT format.
"""

import logging
import tempfile
import os
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import PlainTextResponse
import openai
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["transcription"])

def _srt_to_plain_text(srt_content: str) -> str:
    """Convert SRT format to plain text by removing timestamps and numbering."""
    if not srt_content:
        return ""
    
    lines = srt_content.strip().split('\n')
    text_lines = []
    
    for line in lines:
        line = line.strip()
        # Skip empty lines, sequence numbers, and timestamp lines
        if (not line or 
            line.isdigit() or 
            '-->' in line or
            (len(line.split()) == 1 and line.replace(':', '').replace(',', '').replace('.', '').isdigit())):
            continue
        text_lines.append(line)
    
    return ' '.join(text_lines)

class TranscriptionResponse(BaseModel):
    """Response model for transcription results"""
    srt_content: str
    plain_text: str
    duration: Optional[float] = None
    language: Optional[str] = None

@router.post("/upload", response_model=TranscriptionResponse)
async def transcribe_audio(
    request: Request,
    file: UploadFile = File(..., description="Audio file to transcribe")
):
    """
    Transcribe an audio file to text with timestamps using OpenAI Whisper.
    
    Supported formats: mp3, mp4, wav, m4a, flac, and more.
    Returns SRT format with timestamps for easy subtitle creation.
    
    Args:
        file: Audio file upload (max 25MB as per OpenAI limits)
    
    Returns:
        TranscriptionResponse with text, format, and metadata
    """
    
    # Validate file type
    if not file.content_type:
        raise HTTPException(status_code=400, detail="Unable to determine file type")
    
    # Check if it's an audio file
    audio_types = [
        "audio/mpeg", "audio/mp4", "audio/wav", "audio/m4a", 
        "audio/flac", "audio/ogg", "audio/webm", "video/mp4"
    ]
    
    if not any(file.content_type.startswith(t.split('/')[0]) for t in audio_types):
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file.content_type}. Please upload an audio file."
        )
    
    # Check file size (OpenAI limit is 25MB)
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    if file_size > 25 * 1024 * 1024:  # 25MB
        raise HTTPException(
            status_code=413, 
            detail="File too large. Maximum size is 25MB."
        )
    
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    
    # Get OpenAI API key from environment
    openai_api_key = os.getenv('OPENAI_API_KEY')
    if not openai_api_key:
        raise HTTPException(
            status_code=500, 
            detail="OpenAI API key not configured. Please check server configuration."
        )
    
    # Set up OpenAI client
    client = openai.OpenAI(api_key=openai_api_key)
    
    # Create temporary file for transcription
    temp_file_path = None
    try:
        # Create temporary file with proper extension
        file_extension = os.path.splitext(file.filename or "audio.mp3")[1] or ".mp3"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        logger.info(f"Transcribing audio file: {file.filename} ({file_size} bytes)")
        
        # Transcribe using OpenAI Whisper
        with open(temp_file_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="srt"  # SRT format includes timestamps
            )
        
        logger.info(f"Successfully transcribed {file.filename}")
        logger.info(f"Transcript content length: {len(str(transcript))}")
        logger.info(f"Transcript preview: {str(transcript)[:200]}...")
        
        # Convert SRT to plain text by removing timestamps
        srt_content = str(transcript)
        plain_text = _srt_to_plain_text(srt_content)
        
        return TranscriptionResponse(
            srt_content=srt_content,
            plain_text=plain_text,
            duration=None,  # Could calculate from file if needed
            language=None   # Could be detected by Whisper
        )
        
    except openai.APIError as e:
        logger.error(f"OpenAI API error during transcription: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Transcription service error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error during transcription: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to transcribe audio file"
        )
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp file {temp_file_path}: {e}")

@router.post("/download")
async def download_transcription(
    request: Request,
    file: UploadFile = File(..., description="Audio file to transcribe")
):
    """
    Transcribe audio and return as downloadable SRT file.
    
    Same as /upload but returns the transcription as a downloadable file
    instead of JSON response.
    """
    
    # Get transcription using the same logic
    result = await transcribe_audio(request, file)
    
    # Return as downloadable SRT file
    filename = f"{os.path.splitext(result.filename)[0]}.srt"
    
    return PlainTextResponse(
        content=result.text,
        media_type="application/x-subrip",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"",
            "Content-Type": "application/x-subrip"
        }
    )
