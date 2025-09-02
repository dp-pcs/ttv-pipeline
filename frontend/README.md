# TTV Pipeline Frontend

A user-friendly web interface for the TTV Pipeline that allows non-technical users to easily generate AI videos through a simple dashboard.

## ✨ Features

### 🚀 **Easy Launcher**
- One-click system startup
- Automatic health monitoring
- Visual status indicators
- No command line required

### 🎨 **Modern Interface**
- Clean, intuitive dashboard
- Real-time job progress tracking
- Responsive design for all devices
- Toast notifications for feedback

### ⚙️ **Simple Configuration**
- Visual settings page
- API key management with show/hide
- System status monitoring
- Connection testing

### 📊 **Job Management**
- Real-time queue status
- Progress tracking with visual progress bars
- Job cancellation and retry
- Detailed job history

### 📥 **Easy Downloads**
- One-click video downloads
- Automatic filename generation
- Download history and management
- Direct GCS integration

## 🖥️ **Screenshots**

### Dashboard
The main interface where users enter prompts and monitor job progress.

### Settings
Configuration page for API keys and system settings.

### Downloads
Access completed videos with one-click download.

## 🚀 **Quick Start**

### Option 1: Using the Launcher Script (Recommended)

**macOS/Linux:**
```bash
./start-ttv.sh
```

**Windows:**
```batch
start-ttv.bat
```

The launcher will:
1. Check Docker status
2. Start all services
3. Open the frontend automatically
4. Show system status

### Option 2: Manual Start

1. **Start the backend services:**
   ```bash
   make dev
   ```

2. **Open the frontend:**
   - Open `frontend/launcher.html` in your browser
   - Or directly open `frontend/index.html`

## 📁 **File Structure**

```
frontend/
├── index.html          # Main application interface
├── launcher.html       # System launcher page
├── css/
│   └── style.css      # Modern styling and responsive design
├── js/
│   ├── api.js         # API communication and helpers
│   └── app.js         # Main application logic
└── README.md          # This file
```

## 🔧 **Configuration**

### First-Time Setup

1. **Start the system** using the launcher
2. **Open Settings** in the web interface
3. **Configure your API keys:**
   - OpenAI API Key (required)
   - Google Cloud Project ID (required)
4. **Test connection** to verify setup
5. **Start creating videos!**

### Settings Stored

The frontend automatically saves your settings locally:
- API keys (stored securely in browser)
- Video generation preferences
- Backend selection
- Video duration settings

## 🌐 **Browser Compatibility**

The frontend works in all modern browsers:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 📱 **Mobile Support**

The interface is fully responsive and works on:
- 📱 Smartphones
- 📱 Tablets
- 💻 Laptops
- 🖥️ Desktop computers

## 🔒 **Security**

- **Local Storage**: Settings stored only in your browser
- **No Server**: Frontend runs entirely client-side
- **Secure Keys**: API keys never transmitted unnecessarily
- **HTTPS Ready**: Works with HTTPS deployments

## 🎯 **Usage Guide**

### Creating Your First Video

1. **Launch System:**
   - Run `./start-ttv.sh` (Mac/Linux) or `start-ttv.bat` (Windows)
   - Wait for "System is ready!" message

2. **Configure Settings:**
   - Click "Settings" tab
   - Enter your OpenAI API key
   - Enter your Google Cloud Project ID
   - Click "Save Settings"

3. **Generate Video:**
   - Go to "Dashboard" tab
   - Enter a descriptive prompt
   - Click "Generate Video"
   - Watch progress in real-time

4. **Download Result:**
   - Go to "Downloads" tab when complete
   - Click "Download" button
   - Video saves to your Downloads folder

### Example Prompts

**Good prompts are detailed and descriptive:**

```
A golden retriever dog running through a sunny park, with flowers blooming and birds flying overhead. The camera follows the dog as it playfully chases butterflies.
```

```
A serene mountain lake at sunset, with gentle ripples on the water surface. Snow-capped peaks reflect in the crystal-clear water while an eagle soars overhead.
```

```
A bustling city street at night, with neon lights reflecting on wet pavement. People walk by with umbrellas as light rain falls, creating a cinematic atmosphere.
```

## 🛠️ **Troubleshooting**

### System Won't Start
- Ensure Docker Desktop is running
- Check if ports 8000 and 6379 are available
- Run `./start-ttv.sh status` to check system status

### Frontend Won't Connect
- Verify backend is running: http://localhost:8000/healthz
- Check browser console for errors
- Try refreshing the page

### Jobs Stuck in Queue
- Check worker status in Settings tab
- Verify API keys are correctly configured
- Check Docker logs: `docker logs ttv-pipeline-worker-1`

### Video Generation Fails
- Verify Google Cloud credentials are set up
- Check that Vertex AI API is enabled
- Ensure GCS bucket exists and is accessible

## 🔄 **Updates**

To update the frontend and system:

```bash
./start-ttv.sh update
```

This will:
- Pull latest code changes
- Rebuild Docker containers
- Restart services
- Preserve your settings

## 🤝 **Support**

### Getting Help

1. **Check Status**: Use the Settings tab to verify all components are healthy
2. **View Logs**: Run `./start-ttv.sh logs` to see detailed logs
3. **Reset System**: Run `./start-ttv.sh restart` to restart all services

### Common Solutions

- **Connection Issues**: Restart Docker Desktop
- **Slow Performance**: Ensure sufficient disk space and memory
- **API Errors**: Verify API keys and quotas in respective cloud consoles

## 🌟 **Features Coming Soon**

- **Video Preview**: Preview videos before download
- **Batch Processing**: Generate multiple videos at once
- **Custom Templates**: Save and reuse prompt templates
- **Advanced Settings**: Fine-tune generation parameters
- **Cloud Deployment**: Deploy to cloud platforms
- **Team Collaboration**: Share projects with team members

## 📄 **License**

This frontend is part of the TTV Pipeline project and follows the same license terms.
