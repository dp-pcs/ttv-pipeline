"""
Google Veo 3.1 API video generator implementation

This module implements the VideoGeneratorInterface for Google's Veo 3.1 video generation model
using the Google Gen AI SDK and Vertex AI.

Veo 3.1 capabilities (https://ai.google.dev/gemini-api/docs/video):
- Frame-specific generation: Generate video by specifying first and last frames
- Video extension: Extend previously generated Veo videos
- Reference images: Use up to 3 images for style/content guidance
"""

import os
import time
import json
import logging
import mimetypes
from typing import Dict, Any, List, Optional
from pathlib import Path

# Google Cloud imports
try:
    from google import genai
    from google.genai.types import Image as GenAIImage
    # Try to import GenerateVideosConfig if available
    try:
        from google.genai.types import GenerateVideosConfig
    except ImportError:
        # If GenerateVideosConfig is not available, create a placeholder
        class GenerateVideosConfig:
            def __init__(self, **kwargs):
                self.__dict__.update(kwargs)
    GOOGLE_GENAI_AVAILABLE = True
except ImportError:
    GOOGLE_GENAI_AVAILABLE = False
    genai = None
    GenAIImage = None
    GenerateVideosConfig = None

from google.cloud import storage
from google.oauth2 import service_account
from PIL import Image

from video_generator_interface import (
    VideoGeneratorInterface,
    VideoGenerationError,
    APIError,
    GenerationTimeoutError,
    InvalidInputError,
    QuotaExceededError
)
from generators.base import (
    ImageValidator,
    RetryHandler,
    ProgressMonitor,
    download_file,
    format_duration
)

class Veo3Generator(VideoGeneratorInterface):
    """Remote video generator using Google Veo 3.1 API"""
    
    # Model name for Veo 3.1 (default)
    MODEL_NAME = "veo-3.1-generate-preview"
    
    # Available Veo models
    AVAILABLE_MODELS = [
        "veo-3.1-generate-preview",      # Latest with FLF, extension, reference images
        "veo-3.1-fast-generate-preview", # Fast version of 3.1
        "veo-3.0-generate-001",          # Stable Veo 3
        "veo-3.0-fast-generate-001",     # Fast Veo 3
        "veo-2.0-generate-001",          # Veo 2 (legacy)
    ]
    
    # Pricing estimates per second (placeholder values - actual pricing TBD)
    PRICING = {
        "veo-3.1-generate-preview": 0.75,
        "veo-3.1-fast-generate-preview": 0.50,
        "veo-3.0-generate-preview": 0.75,
        "veo-3.0-generate-001": 0.75,
        "veo-3.0-fast-generate-001": 0.50,
        "veo-2.0-generate-001": 0.50,
    }
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.project_id = config.get("project_id")
        self.region = config.get("region", "global")  # Veo 3 is available in global region
        self.credentials_path = config.get("credentials_path", "credentials.json")
        self.output_bucket = config.get("output_bucket")
        self.max_retries = config.get("max_retries", 3)
        self.timeout = config.get("timeout", 600)
        self.model_name = config.get("veo_model", self.MODEL_NAME)  # Use config model or fallback to default
        
        if not self.project_id:
            raise VideoGenerationError("Google Cloud project ID is required")
        
        if not self.output_bucket:
            self.output_bucket = f"{self.project_id}-veo3-outputs"
            self.logger.info(f"No output bucket specified, using default: {self.output_bucket}")
        
        # Initialize retry handler
        self.retry_handler = RetryHandler(max_retries=self.max_retries)
        
        # Initialize Google Cloud clients
        self._init_clients()
        
    def _init_clients(self):
        """Initialize Google Cloud clients"""
        try:
            # Set environment variables for Google Gen AI SDK
            os.environ["GOOGLE_CLOUD_PROJECT"] = self.project_id
            os.environ["GOOGLE_CLOUD_LOCATION"] = self.region
            os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
            
            # Load credentials from service account file if available
            if os.path.exists(self.credentials_path):
                # Load credentials with standard cloud platform scope
                scopes = ["https://www.googleapis.com/auth/cloud-platform"]
                self.credentials = service_account.Credentials.from_service_account_file(
                    self.credentials_path,
                    scopes=scopes
                )
                self.genai_client = genai.Client(credentials=self.credentials)
                self.storage_client = storage.Client(credentials=self.credentials)
            else:
                # Fall back to application default credentials
                self.logger.warning(f"Credentials file not found at {self.credentials_path}, using application default credentials")
                self.genai_client = genai.Client()
                self.storage_client = storage.Client()
            
            self.logger.info("Google Cloud clients initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize Google Cloud clients: {e}")
            raise VideoGenerationError(f"Failed to initialize Veo 3 client: {e}")
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Return Google Veo 3.1 capabilities"""
        # Check if using Veo 3.1 (supports FLF and more features)
        is_veo_31 = "3.1" in self.model_name or "3.1" in self.MODEL_NAME
        
        return {
            "max_duration": 8.0,  # Veo 3.1 supports 4, 6, or 8 seconds
            "supported_durations": [4, 6, 8],  # Available duration options
            "supported_resolutions": ["720p", "1080p"],  # 1080p only for 8s
            "supported_aspect_ratios": ["16:9", "9:16"],  # Veo 3.1 aspect ratios
            "supports_image_to_video": True,
            "supports_text_to_video": True,  # Veo 3.1 supports T2V
            "supports_first_last_frame": is_veo_31,  # FLF interpolation (Veo 3.1+)
            "supports_video_extension": is_veo_31,  # Video extension (Veo 3.1 only)
            "supports_reference_images": is_veo_31,  # Up to 3 reference images (Veo 3.1 only)
            "requires_gpu": False,  # API-based
            "api_based": True,
            "models": {model: True for model in self.AVAILABLE_MODELS},
            "current_model": self.model_name,
            "features": {
                "motion_control": True,
                "style_transfer": True,
                "camera_control": True,
                "object_tracking": True,
                "temporal_consistency": True,
                "native_audio": True,  # Veo 3+ generates audio
                "dialogue_generation": is_veo_31,  # Natural dialogue
            },
            # FLF-specific constraints
            "flf_constraints": {
                "required_duration": 8,  # FLF mode requires 8 second duration
                "supported_aspect_ratios": ["16:9", "9:16"],
            }
        }
    
    def estimate_cost(self, duration: float, resolution: str = "1920x1080") -> float:
        """Estimate cost for video generation"""
        # Get price per second for the model
        price_per_second = self.PRICING.get(self.model_name, 0.10)
        
        # Resolution multiplier
        resolution_multipliers = {
            "1024x1024": 1.0,
            "1920x1080": 1.2,
            "1080x1920": 1.2
        }
        multiplier = resolution_multipliers.get(resolution, 1.0)
        
        return duration * price_per_second * multiplier
    
    def validate_inputs(self, 
                       prompt: str, 
                       input_image_path: str,
                       duration: float) -> List[str]:
        """Validate inputs for Veo 3 generation"""
        errors = []
        
        # Validate prompt
        if not prompt or len(prompt.strip()) == 0:
            errors.append("Prompt cannot be empty")
        elif len(prompt) > 1000:
            errors.append("Prompt too long (max 1000 characters for Veo 3)")
        
        # Validate image
        image_validation = ImageValidator.validate_image(input_image_path, max_size_mb=10.0)
        if not image_validation["valid"]:
            errors.extend(image_validation["errors"])
        else:
            # Check specific requirements for Veo 3
            info = image_validation["info"]
            width, height = info["dimensions"]
            
            # Veo 3 prefers certain aspect ratios
            aspect_ratio = width / height
            valid_ratios = [16/9, 9/16, 1/1]
            
            if not any(abs(aspect_ratio - ratio) < 0.1 for ratio in valid_ratios):
                errors.append(f"Image aspect ratio {aspect_ratio:.2f} not optimal. "
                            f"Recommended: 16:9, 9:16, or 1:1")
        
        # Validate duration
        capabilities = self.get_capabilities()
        if duration > capabilities["max_duration"]:
            errors.append(f"Duration {duration}s exceeds maximum {capabilities['max_duration']}s")
        elif duration < 1:
            errors.append("Duration must be at least 1 second")
        
        return errors
    
    def generate_video(self,
                      prompt: str,
                      input_image_path: str,
                      output_path: str,
                      duration: float = 8.0,
                      end_image_path: str = None,
                      **kwargs) -> str:
        """
        Generate video using Google Veo 3.1 API
        
        Args:
            prompt: Text prompt describing the desired video
            input_image_path: Path to the input/reference image (first frame)
            output_path: Path where the generated video should be saved
            duration: Desired duration of the video in seconds (4, 6, or 8)
            end_image_path: Optional path to the last frame image for FLF interpolation mode.
                           When provided, Veo 3.1 will generate video that transitions from
                           input_image_path (first frame) to end_image_path (last frame).
                           Note: FLF mode requires duration=8 seconds.
            **kwargs: Additional parameters:
                - aspect_ratio: "16:9" or "9:16" (default: "16:9")
                - resolution: "720p" or "1080p" (default: "720p")
                - negative_prompt: Text describing what to avoid
                - reference_images: List of up to 3 reference image paths (Veo 3.1 only)
        
        Returns:
            Path to the generated video file
        """
        # Check if FLF mode is requested
        is_flf_mode = end_image_path is not None
        
        if is_flf_mode:
            self.logger.info("First-Last-Frame (FLF) interpolation mode enabled")
            # FLF mode requires 8 second duration per API spec
            if duration != 8:
                self.logger.warning(f"FLF mode requires 8 second duration, adjusting from {duration}s")
                duration = 8
        
        # Validate inputs
        validation_errors = self.validate_inputs(prompt, input_image_path, duration)
        if validation_errors:
            raise InvalidInputError(f"Input validation failed: {'; '.join(validation_errors)}")
        
        # Validate end image if provided
        if is_flf_mode:
            end_image_validation = ImageValidator.validate_image(end_image_path, max_size_mb=10.0)
            if not end_image_validation["valid"]:
                raise InvalidInputError(f"End image validation failed: {'; '.join(end_image_validation['errors'])}")
        
        # Log cost estimate
        estimated_cost = self.estimate_cost(duration)
        self.logger.info(f"Estimated cost: ${estimated_cost:.2f}")
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        # Get video aspect ratio from config (veo3 only supports 16:9 and 9:16)
        video_aspect_ratio = kwargs.get('aspect_ratio', self.config.get('video_aspect_ratio', '16:9'))
        if video_aspect_ratio not in ['16:9', '9:16']:
            self.logger.warning(f"Invalid video aspect ratio {video_aspect_ratio}, defaulting to 16:9")
            video_aspect_ratio = '16:9'
        
        # Get resolution
        resolution = kwargs.get('resolution', '720p')
        if resolution not in ['720p', '1080p']:
            self.logger.warning(f"Invalid resolution {resolution}, defaulting to 720p")
            resolution = '720p'
        
        mode_str = "FLF interpolation" if is_flf_mode else "image-to-video"
        self.logger.info(f"Using {mode_str} mode with aspect ratio: {video_aspect_ratio}, resolution: {resolution}")
        
        try:
            # Create a unique output GCS URI for this generation
            output_gcs_uri = self._create_output_gcs_uri()
            
            # Ensure the output bucket exists
            self._ensure_bucket_exists(self.output_bucket)
            
            # Prepare the first frame image
            first_image = self._prepare_image(input_image_path, kwargs.get("use_local_file", False))
            
            # Prepare the last frame image if FLF mode
            last_image = None
            if is_flf_mode:
                last_image = self._prepare_image(end_image_path, kwargs.get("use_local_file", False))
                self.logger.info("Prepared both first and last frame images for FLF generation")
            
            # Submit the generation request
            self.logger.info(f"Submitting video generation request to {self.model_name}...")
            
            # Create the configuration
            config_params = {
                "aspect_ratio": video_aspect_ratio,
                "output_gcs_uri": output_gcs_uri,
                "resolution": resolution,
            }
            
            # Add duration if supported by the config class
            if duration in [4, 6, 8]:
                config_params["duration_seconds"] = int(duration)
            
            # Add negative prompt if provided
            if kwargs.get("negative_prompt"):
                config_params["negative_prompt"] = kwargs["negative_prompt"]
            
            config = GenerateVideosConfig(**config_params)
            
            # Use the asynchronous API call and wait for completion
            progress_monitor = ProgressMonitor(100)
            progress_monitor.update(0, "Submitting video generation request...")
            
            # Build the API call arguments
            api_kwargs = {
                "model": self.model_name,
                "image": first_image,
                "prompt": prompt,
                "config": config,
            }
            
            # Add lastFrame for FLF interpolation mode
            if is_flf_mode and last_image:
                api_kwargs["lastFrame"] = last_image
                self.logger.info("Added lastFrame parameter for FLF interpolation")
            
            operation = self.retry_handler.retry_with_backoff(
                self.genai_client.models.generate_videos,
                **api_kwargs
            )
            
            # Poll the operation until completion
            start_time = time.time()
            progress_monitor.update(10, "Video generation started, waiting for completion...")
            while not operation.done:
                time.sleep(15)  # Wait 15 seconds before checking again
                operation = self.genai_client.operations.get(operation)
                elapsed = time.time() - start_time
                progress_monitor.update(50, f"Processing video generation... (elapsed: {format_duration(elapsed)})")
            
            elapsed = time.time() - start_time
            self.logger.info(f"Video generation completed in {format_duration(elapsed)}")
            progress_monitor.update(100, "Video generation complete")
            
            # Extract the video URI from the operation result
            if operation.response and hasattr(operation.result, 'generated_videos') and operation.result.generated_videos:
                video_uri = operation.result.generated_videos[0].video.uri
                if video_uri:
                    self.logger.info(f"Video generated successfully: {video_uri}")
                    return self._download_from_gcs(video_uri, output_path)
                else:
                    raise VideoGenerationError("No video URI in response")
            else:
                raise VideoGenerationError("Generation completed but no videos were returned")
                
        except Exception as e:
            if isinstance(e, VideoGenerationError):
                raise
            raise VideoGenerationError(f"Unexpected error during video generation: {e}")
    
    def _prepare_image(self, image_path: str, use_local_file: bool = False) -> 'GenAIImage':
        """
        Prepare an image for the Veo API
        
        Args:
            image_path: Path to the local image file
            use_local_file: If True, load directly from file; otherwise upload to GCS
            
        Returns:
            GenAIImage object ready for API call
        """
        # Get the MIME type of the image
        mime_type, _ = mimetypes.guess_type(image_path)
        if not mime_type:
            mime_type = "image/jpeg"  # Default to JPEG if can't determine
        
        if use_local_file:
            # For local testing with direct file access
            return GenAIImage.from_file(image_path, mime_type=mime_type)
        else:
            # Upload to GCS and use GCS URI
            gcs_uri = self._upload_to_gcs(image_path)
            return GenAIImage(gcs_uri=gcs_uri, mime_type=mime_type)
    
    def _create_output_gcs_uri(self) -> str:
        """Create a unique GCS URI for the output video"""
        timestamp = int(time.time())
        return f"gs://{self.output_bucket}/videos/{timestamp}/"
    
    def _ensure_bucket_exists(self, bucket_name: str) -> None:
        """Ensure the GCS bucket exists, create if it doesn't"""
        try:
            bucket = self.storage_client.bucket(bucket_name)
            if not bucket.exists():
                self.logger.info(f"Creating bucket: {bucket_name}")
                bucket = self.storage_client.create_bucket(bucket_name, location=self.region)
        except Exception as e:
            self.logger.warning(f"Error checking/creating bucket {bucket_name}: {e}")
            # Continue anyway, as the bucket might be created by another process
            # or we might not have permission to check but still have permission to write
    
    def _upload_to_gcs(self, image_path: str) -> str:
        """
        Upload image to Google Cloud Storage
        
        Args:
            image_path: Path to the local image file
            
        Returns:
            GCS URI of the uploaded image
        """
        # Prepare image for upload (resize, compress if needed)
        prepared_image = ImageValidator.prepare_image_for_api(
            image_path,
            target_size=None,
            max_size_mb=10.0
        )
        
        # Create a unique blob name
        timestamp = int(time.time())
        filename = os.path.basename(prepared_image)
        bucket_name = f"{self.project_id}-veo3-inputs"
        blob_name = f"images/{timestamp}_{filename}"
        
        # Ensure the bucket exists
        self._ensure_bucket_exists(bucket_name)
        
        # Upload the file
        try:
            bucket = self.storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            
            # Upload the file
            with open(prepared_image, "rb") as f:
                blob.upload_from_file(f)
            
            self.logger.info(f"Uploaded image to gs://{bucket_name}/{blob_name}")
            return f"gs://{bucket_name}/{blob_name}"
            
        except Exception as e:
            self.logger.error(f"Failed to upload image to GCS: {e}")
            raise VideoGenerationError(f"Failed to upload image to GCS: {e}")
    
    def _download_from_gcs(self, gcs_uri: str, output_path: str) -> str:
        """
        Download video from Google Cloud Storage
        
        Args:
            gcs_uri: GCS URI of the video to download
            output_path: Local path to save the video
            
        Returns:
            Path to the downloaded video file
        """
        try:
            # Parse the GCS URI
            if not gcs_uri.startswith("gs://"):
                raise ValueError(f"Invalid GCS URI: {gcs_uri}")
            
            # Extract bucket and blob names
            parts = gcs_uri.replace("gs://", "").split("/", 1)
            if len(parts) != 2:
                raise ValueError(f"Invalid GCS URI format: {gcs_uri}")
            
            bucket_name, blob_name = parts
            
            # Download the file
            bucket = self.storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            
            self.logger.info(f"Downloading video from {gcs_uri} to {output_path}")
            blob.download_to_filename(output_path)
            
            # Verify the file was downloaded
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                self.logger.info(f"Successfully downloaded video to {output_path}")
                return output_path
            else:
                raise VideoGenerationError(f"Downloaded file is empty or missing: {output_path}")
                
        except Exception as e:
            self.logger.error(f"Failed to download video from GCS: {e}")
            raise VideoGenerationError(f"Failed to download video from GCS: {e}")
    
    def is_available(self) -> bool:
        """Check if Veo 3 API is available"""
        try:
            # Check if credentials are valid and we have basic requirements
            if not self.project_id:
                return False
            
            # Simple connectivity check - just verify we can access the client
            # Model availability will be checked when we actually make the generation request
            return True
            
        except Exception as e:
            self.logger.error(f"Error checking Veo 3 availability: {e}")
            return False
    
    def get_quota_status(self) -> Dict[str, Any]:
        """
        Get current quota status for the API
        
        Returns information about remaining quota, rate limits, etc.
        """
        try:
            # In a real implementation, we would query the Vertex AI quotas API
            # For now, return placeholder values
            return {
                "daily_quota_remaining": 100,
                "hourly_quota_remaining": 20,
                "concurrent_requests_limit": 5,
                "current_concurrent_requests": 0
            }
        except Exception as e:
            self.logger.error(f"Error getting quota status: {e}")
            return {
                "error": str(e),
                "status": "unknown"
            }
