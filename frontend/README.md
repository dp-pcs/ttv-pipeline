# VisionWeave Frontend

A modern Next.js application for the VisionWeave AI Video Generation Platform.

## 🚀 Features

- **🎬 Video Generation**: Create stunning videos from text prompts
- **🎙️ Audio Transcription**: Convert speech to text with timestamps using OpenAI Whisper
- **📊 Real-time Dashboard**: Monitor video generation progress with live updates
- **⚙️ Settings Management**: Configure API keys and backend preferences
- **📱 Responsive Design**: Works seamlessly on desktop and mobile
- **🎨 Modern UI**: Built with Tailwind CSS and Radix UI components

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Icons**: Lucide React
- **State Management**: React Hooks + Local Storage
- **HTTP Client**: Fetch API

## 🏃‍♂️ Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- VisionWeave API server running (see backend setup)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🔧 Configuration

The frontend automatically connects to the VisionWeave API at `http://localhost:8000`. You can configure API settings through the Settings page:

1. **OpenAI API Key**: For transcription services
2. **Google Project ID**: For video generation services  
3. **Backend Selection**: Choose your video generation backend
4. **Budget Cap**: Set maximum cost per video

## 📂 Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx          # Homepage (Dashboard)
│   ├── downloads/        # Downloads page
│   ├── settings/         # Settings page
│   └── transcription/    # Transcription page
├── components/            # Reusable React components
│   ├── ui/               # Base UI components (Radix UI)
│   ├── dashboard/        # Dashboard-specific components
│   ├── layout/           # Layout components
│   └── [feature]/        # Feature-specific components
├── lib/                   # Utilities and configurations
│   ├── api.ts            # API client
│   ├── types.ts          # TypeScript definitions
│   └── utils.ts          # Helper functions
└── public/               # Static assets
    └── assets/           # Images and media
```

## 🎨 Design System

VisionWeave uses a modern design system with:

- **Colors**: Professional blue/indigo theme with accent colors
- **Typography**: Inter font family for clean, readable text
- **Spacing**: Consistent spacing scale using Tailwind
- **Components**: Accessible components built on Radix UI primitives

## 🔌 API Integration

The frontend integrates with the VisionWeave backend API for:

- **Job Management**: Create, monitor, and manage video generation jobs
- **Transcription**: Upload and transcribe audio files
- **Health Monitoring**: Check API and service status
- **File Downloads**: Secure video and transcript downloads

## 🧪 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Component Development

Components follow these conventions:

- Use TypeScript for type safety
- Implement responsive design with Tailwind CSS
- Follow accessibility best practices
- Use proper error handling and loading states

## 📱 Pages

### Dashboard (`/`)
- Video generation interface
- Job queue monitoring
- API status indicator
- Pipeline overview

### Transcription (`/transcription`)
- Audio file upload (drag & drop)
- Speech-to-text conversion
- SRT format output with timestamps
- Copy to clipboard and download options

### Downloads (`/downloads`)
- List of completed videos
- Download management
- Job history and status

### Settings (`/settings`)
- API configuration
- Service status monitoring
- Backend selection
- Budget controls

## 🚀 Deployment

The frontend can be deployed to any hosting platform that supports Next.js:

- **Vercel** (recommended)
- **Netlify** 
- **AWS Amplify**
- **Docker** (with the provided Dockerfile)

Make sure to update the API base URL for production deployments.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
