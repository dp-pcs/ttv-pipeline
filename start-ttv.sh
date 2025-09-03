#!/bin/bash

# VisionWeave Launcher Script
# Complete launcher script for the VisionWeave AI Video Generation Platform
# Starts backend API services and modern Next.js frontend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} ✅ $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')]${NC} ⚠️  $1"
}

print_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')]${NC} ❌ $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Docker is running
check_docker() {
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker Desktop."
        echo "Download from: https://www.docker.com/products/docker-desktop"
        exit 1
    fi

    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi

    print_success "Docker is running"
}

# Function to start the services
start_services() {
    print_status "Starting TTV Pipeline services..."
    
    # Check if .env.dev exists
    if [ ! -f ".env.dev" ]; then
        print_warning ".env.dev not found. Creating from template..."
        if [ -f ".env.example" ]; then
            cp .env.example .env.dev
            print_status "Please edit .env.dev to add your API keys"
        else
            print_error ".env.example not found. Please check your installation."
            exit 1
        fi
    fi

    # Build and start services
    print_status "Building Docker images (this may take a few minutes on first run)..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache

    print_status "Starting services..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev --profile dev up -d

    print_status "Waiting for services to be ready..."
    sleep 10

    # Check if services are healthy
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:8000/healthz >/dev/null 2>&1; then
            print_success "API server is ready!"
            break
        else
            print_status "Waiting for API server... (attempt $attempt/$max_attempts)"
            sleep 2
            ((attempt++))
        fi
    done

    if [ $attempt -gt $max_attempts ]; then
        print_error "API server failed to start. Check logs with: docker logs ttv-pipeline-api-1"
        exit 1
    fi

    # Check readiness
    print_status "Checking system readiness..."
    local ready_response=$(curl -s http://localhost:8000/readyz || echo '{"status":"not_ready"}')
    local ready_status=$(echo "$ready_response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$ready_status" = "ready" ]; then
        print_success "System is fully ready!"
    else
        print_warning "System started but some components may not be ready:"
        echo "$ready_response" | python3 -m json.tool 2>/dev/null || echo "$ready_response"
        print_status "You can still use the system, but some features may not work."
    fi
}

# Function to start the frontend
start_frontend() {
    print_status "Starting VisionWeave Frontend..."
    
    # Check if Node.js is installed
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
        return 1
    fi
    
    # Check if npm is installed
    if ! command_exists npm; then
        print_error "npm is not installed. Please install Node.js from https://nodejs.org"
        return 1
    fi
    
    # Navigate to frontend directory
    cd frontend
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies (this may take a few minutes)..."
        npm install --legacy-peer-deps
    fi
    
    # Start the development server in background
    print_status "Starting Next.js development server..."
    npm run dev > ../frontend.log 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > ../frontend.pid
    
    # Go back to root directory
    cd ..
    
    # Wait for frontend to be ready
    print_status "Waiting for frontend to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3000 >/dev/null 2>&1; then
            print_success "Frontend is ready!"
            break
        else
            print_status "Waiting for frontend... (attempt $attempt/$max_attempts)"
            sleep 2
            ((attempt++))
        fi
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "Frontend failed to start. Check logs: cat frontend.log"
        return 1
    fi
    
    return 0
}

# Function to open the frontend
open_frontend() {
    local frontend_url="http://localhost:3000"
    
    print_status "Opening VisionWeave Frontend..."
    
    # Detect OS and open browser
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open "$frontend_url"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command_exists xdg-open; then
            xdg-open "$frontend_url"
        elif command_exists gnome-open; then
            gnome-open "$frontend_url"
        else
            print_warning "Please open this URL manually: $frontend_url"
        fi
    else
        print_warning "Please open this URL manually: $frontend_url"
    fi
}

# Function to show status
show_status() {
    print_status "TTV Pipeline Status:"
    echo
    
    # Check containers
    echo "🐳 Docker Containers:"
    docker compose -f docker-compose.yml -f docker-compose.dev.yml ps 2>/dev/null || echo "No containers running"
    echo
    
    # Check API health
    echo "🏥 Health Status:"
    if curl -s http://localhost:8000/healthz >/dev/null 2>&1; then
        curl -s http://localhost:8000/healthz | python3 -m json.tool 2>/dev/null || echo "API is responding"
    else
        echo "❌ API is not responding"
    fi
    echo
    
    # Check readiness
    echo "✅ Readiness Status:"
    if curl -s http://localhost:8000/readyz >/dev/null 2>&1; then
        curl -s http://localhost:8000/readyz | python3 -m json.tool 2>/dev/null || echo "API is ready"
    else
        echo "❌ API is not ready"
    fi
}

# Function to stop services
stop_services() {
    print_status "Stopping VisionWeave services..."
    
    # Stop frontend if running
    if [ -f "frontend.pid" ]; then
        local frontend_pid=$(cat frontend.pid)
        print_status "Stopping frontend server (PID: $frontend_pid)..."
        kill $frontend_pid 2>/dev/null || true
        rm -f frontend.pid
        rm -f frontend.log
    fi
    
    # Stop backend services
    docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev down
    print_success "All services stopped"
}

# Function to show logs
show_logs() {
    print_status "Showing recent logs (press Ctrl+C to exit)..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f --tail=50
}

# Function to update system
update_system() {
    print_status "Updating TTV Pipeline..."
    
    # Pull latest changes
    if [ -d ".git" ]; then
        print_status "Pulling latest code..."
        git pull
    fi
    
    # Rebuild containers
    print_status "Rebuilding containers..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache
    
    # Restart services
    print_status "Restarting services..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev --profile dev down
    docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev --profile dev up -d
    
    print_success "Update complete!"
}

# Function to show help
show_help() {
    echo "VisionWeave AI Video Generation Platform"
    echo "Complete launcher for backend services and Next.js frontend"
    echo
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  start     Start VisionWeave (backend + frontend) - default"
    echo "  stop      Stop all services (backend + frontend)"
    echo "  restart   Restart all services"
    echo "  status    Show system status"
    echo "  logs      Show service logs"
    echo "  update    Update and rebuild the system"
    echo "  help      Show this help message"
    echo
    echo "Examples:"
    echo "  $0              # Start full system and open browser"
    echo "  $0 start        # Start backend + frontend"
    echo "  $0 status       # Check system status"
    echo "  $0 logs         # View logs"
    echo
    echo "Access Points:"
    echo "  Frontend:  http://localhost:3000"
    echo "  API:       http://localhost:8000"
    echo "  API Docs:  http://localhost:8000/docs"
}

# Main execution
main() {
    local command=${1:-start}
    
    case $command in
        "start")
            check_docker
            start_services
            start_frontend
            open_frontend
            print_success "VisionWeave is ready!"
            echo
            echo "🎬 Frontend: http://localhost:3000"
            echo "🔗 API Docs: http://localhost:8000/docs"
            echo "📊 Health: http://localhost:8000/healthz"
            echo "🔥 Backend API: http://localhost:8000"
            echo
            echo "Run '$0 stop' to stop the system"
            echo "Run '$0 logs' to view logs"
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            check_docker
            stop_services
            sleep 2
            start_services
            print_success "System restarted!"
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "update")
            check_docker
            update_system
            ;;
        "help" | "--help" | "-h")
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
