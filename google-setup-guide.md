# Google Cloud Setup Guide for TTV Pipeline

## Required Google Services
Based on your `pipeline_config.yaml`, you need:

1. **Google Veo 3** (Video Generation) - Default backend
2. **Google Gemini 2.5 Flash** (Image Generation)

## Step-by-Step Setup

### 1. Google Cloud Console Setup

#### Create/Verify Project
- Project ID: `dpvidgenproject` (as configured in your pipeline_config.yaml)
- Make sure this project exists in your Google Cloud Console

#### Enable Required APIs
Enable these APIs in your Google Cloud project:
```bash
# Via gcloud CLI (if you have it installed)
gcloud services enable aiplatform.googleapis.com
gcloud services enable generativelanguage.googleapis.com
gcloud services enable storage-component.googleapis.com

# Or enable via Cloud Console:
# - Vertex AI API (for Veo 3)
# - Generative Language API (for Gemini)
# - Cloud Storage API (for file storage)
```

### 2. Service Account Setup

#### Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** → **Service Accounts**
3. Click **Create Service Account**
4. Name: `ttv-pipeline-service`
5. Description: `Service account for TTV Pipeline video generation`

#### Assign Roles
Add these IAM roles to your service account:
- **Vertex AI User** - For Veo 3 video generation
- **AI Platform Developer** - For Gemini image generation
- **Storage Admin** - For GCS bucket access (if using)
- **Generative AI Administrator** - For AI model access

#### Generate JSON Key
1. Click on your service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key** → **JSON**
4. Download the JSON file
5. Rename it to `credentials.json`

### 3. Place Credentials File

#### Move to Credentials Directory
```bash
# Copy your downloaded JSON file
cp ~/Downloads/your-downloaded-key.json ./credentials/credentials.json

# Verify it's in the right place
ls -la credentials/
```

#### Docker Mount Path
The credentials file will be automatically mounted to `/app/credentials/credentials.json` in the Docker containers.

### 4. API Keys (Alternative/Additional)

#### Gemini API Key (Simpler Alternative)
If you prefer using API keys instead of service accounts for Gemini:

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Add to your `pipeline_config.yaml`:
```yaml
gemini_api_key: "your_actual_gemini_api_key_here"
```

### 5. Update Configuration

#### Required Fields in pipeline_config.yaml
```yaml
# Google Veo 3 Configuration
google_veo:
  project_id: "dpvidgenproject"           # Your actual GCP project ID
  credentials_path: "credentials.json"    # Path to service account JSON
  region: "us-central1"                   # Region for Veo 3
  veo_model: "veo-3.0-generate-preview"

# Gemini Configuration (choose one method)
# Method 1: Using service account (recommended)
image_generation_model: "gemini-2.5-flash-image-preview"

# Method 2: Using API key (simpler)
gemini_api_key: "your_gemini_api_key_here"
```

### 6. Test Your Setup

#### Quick Test
```bash
# Restart services with your new credentials
make dev

# Check if API is accessible
curl http://localhost:8000/healthz
```

### 7. Verify Access

#### Check Veo 3 Access
- Veo 3 is currently in limited preview
- You need to be allowlisted for access
- Apply at: [Google Cloud Vertex AI](https://cloud.google.com/vertex-ai)

## Troubleshooting

### Common Issues
1. **Credentials not found**: Ensure `credentials.json` is in the `./credentials/` directory
2. **Permission denied**: Check that your service account has the required IAM roles
3. **Veo 3 access**: Veo 3 requires allowlisting - you may need to apply for access
4. **Region errors**: Ensure `us-central1` region is available for your services

### Fallback Options
If Veo 3 isn't available, you can switch backends:
```yaml
# Change in pipeline_config.yaml
default_backend: "runway"  # or "minimax"
```

## Security Notes
- Never commit `credentials.json` to version control
- The `credentials/` directory should be in your `.gitignore`
- Consider using environment variables for API keys in production
