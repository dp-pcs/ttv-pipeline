@echo off
:: VisionWeave Launcher Script for Windows
:: Complete launcher for the VisionWeave AI Video Generation Platform
:: Starts backend API services and modern Next.js frontend

setlocal enabledelayedexpansion

:: Colors (if supported)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

:: Function to print status
:print_status
echo %BLUE%[%time:~0,8%]%NC% %~1
goto :eof

:print_success
echo %GREEN%[%time:~0,8%]%NC% ✅ %~1
goto :eof

:print_warning
echo %YELLOW%[%time:~0,8%]%NC% ⚠️  %~1
goto :eof

:print_error
echo %RED%[%time:~0,8%]%NC% ❌ %~1
goto :eof

:: Function to check if Docker is available
:check_docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "Docker is not installed. Please install Docker Desktop."
    echo Download from: https://www.docker.com/products/docker-desktop
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "Docker is not running. Please start Docker Desktop."
    exit /b 1
)

call :print_success "Docker is running"
goto :eof

:: Function to start services
:start_services
call :print_status "Starting TTV Pipeline services..."

:: Check if .env.dev exists
if not exist ".env.dev" (
    call :print_warning ".env.dev not found. Creating from template..."
    if exist ".env.example" (
        copy ".env.example" ".env.dev" >nul
        call :print_status "Please edit .env.dev to add your API keys"
    ) else (
        call :print_error ".env.example not found. Please check your installation."
        exit /b 1
    )
)

:: Build and start services
call :print_status "Building Docker images (this may take a few minutes on first run)..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache

call :print_status "Starting services..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev --profile dev up -d

call :print_status "Waiting for services to be ready..."
timeout /t 10 /nobreak >nul

:: Check if services are healthy
set /a max_attempts=30
set /a attempt=1

:wait_loop
curl -s http://localhost:8000/healthz >nul 2>&1
if %errorlevel% equ 0 (
    call :print_success "API server is ready!"
    goto :continue_start
)

call :print_status "Waiting for API server... (attempt !attempt!/!max_attempts!)"
timeout /t 2 /nobreak >nul
set /a attempt+=1

if !attempt! leq !max_attempts! goto :wait_loop

call :print_error "API server failed to start. Check logs with: docker logs ttv-pipeline-api-1"
exit /b 1

:continue_start
:: Check readiness
call :print_status "Checking system readiness..."
curl -s http://localhost:8000/readyz >temp_ready.json 2>nul
if %errorlevel% equ 0 (
    findstr "ready" temp_ready.json >nul
    if !errorlevel! equ 0 (
        call :print_success "System is fully ready!"
    ) else (
        call :print_warning "System started but some components may not be ready"
        type temp_ready.json
    )
    del temp_ready.json >nul 2>&1
) else (
    call :print_warning "Could not check readiness status"
)

goto :eof

:: Function to start frontend
:start_frontend
call :print_status "Starting VisionWeave Frontend..."

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
    exit /b 1
)

:: Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "npm is not installed. Please install Node.js from https://nodejs.org"
    exit /b 1
)

:: Navigate to frontend directory
cd frontend

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    call :print_status "Installing frontend dependencies (this may take a few minutes)..."
    npm install --legacy-peer-deps
)

:: Start the development server in background
call :print_status "Starting Next.js development server..."
start /b npm run dev > ../frontend.log 2>&1

:: Go back to root directory
cd ..

:: Wait for frontend to be ready
call :print_status "Waiting for frontend to be ready..."
set /a attempt=1
set /a max_attempts=30

:wait_frontend_loop
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    call :print_success "Frontend is ready!"
    goto :frontend_ready
)
call :print_status "Waiting for frontend... (attempt !attempt!/!max_attempts!)"
timeout /t 2 /nobreak >nul
set /a attempt+=1
if !attempt! leq !max_attempts! goto :wait_frontend_loop

call :print_error "Frontend failed to start. Check logs: type frontend.log"
exit /b 1

:frontend_ready
goto :eof

:: Function to open frontend
:open_frontend
call :print_status "Opening VisionWeave Frontend..."
start "" "http://localhost:3000"
goto :eof

:: Function to show status
:show_status
call :print_status "TTV Pipeline Status:"
echo.

echo 🐳 Docker Containers:
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps 2>nul || echo No containers running
echo.

echo 🏥 Health Status:
curl -s http://localhost:8000/healthz >nul 2>&1
if %errorlevel% equ 0 (
    curl -s http://localhost:8000/healthz
) else (
    echo ❌ API is not responding
)
echo.

echo ✅ Readiness Status:
curl -s http://localhost:8000/readyz >nul 2>&1
if %errorlevel% equ 0 (
    curl -s http://localhost:8000/readyz
) else (
    echo ❌ API is not ready
)
goto :eof

:: Function to stop services
:stop_services
call :print_status "Stopping VisionWeave services..."

:: Stop frontend if running
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo table /nh 2^>nul') do (
    taskkill /pid %%i /f >nul 2>&1
)
if exist "frontend.log" del frontend.log

:: Stop backend services
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev down
call :print_success "All services stopped"
goto :eof

:: Function to show logs
:show_logs
call :print_status "Showing recent logs (press Ctrl+C to exit)..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f --tail=50
goto :eof

:: Function to update system
:update_system
call :print_status "Updating TTV Pipeline..."

:: Pull latest changes if git is available
if exist ".git" (
    call :print_status "Pulling latest code..."
    git pull
)

:: Rebuild containers
call :print_status "Rebuilding containers..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache

:: Restart services
call :print_status "Restarting services..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev --profile dev down
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev --profile dev up -d

call :print_success "Update complete!"
goto :eof

:: Function to show help
:show_help
echo VisionWeave AI Video Generation Platform
echo Complete launcher for backend services and Next.js frontend
echo.
echo Usage: %~nx0 [command]
echo.
echo Commands:
echo   start     Start VisionWeave (backend + frontend) - default
echo   stop      Stop all services (backend + frontend)
echo   restart   Restart all services
echo   status    Show system status
echo   logs      Show service logs
echo   update    Update and rebuild the system
echo   help      Show this help message
echo.
echo Examples:
echo   %~nx0              # Start full system and open browser
echo   %~nx0 start        # Start backend + frontend
echo   %~nx0 status       # Check system status
echo   %~nx0 logs         # View logs
echo.
echo Access Points:
echo   Frontend:  http://localhost:3000
echo   API:       http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
goto :eof

:: Main execution
:main
set "command=%~1"
if "%command%"=="" set "command=start"

if /i "%command%"=="start" (
    call :check_docker
    if !errorlevel! neq 0 exit /b 1
    call :start_services
    call :start_frontend
    call :open_frontend
    call :print_success "VisionWeave is ready!"
    echo.
    echo 🎬 Frontend: http://localhost:3000
    echo 🔗 API Docs: http://localhost:8000/docs
    echo 📊 Health: http://localhost:8000/healthz
    echo 🔥 Backend API: http://localhost:8000
    echo.
    echo Run '%~nx0 stop' to stop the system
    echo Run '%~nx0 logs' to view logs
) else if /i "%command%"=="stop" (
    call :stop_services
) else if /i "%command%"=="restart" (
    call :check_docker
    if !errorlevel! neq 0 exit /b 1
    call :stop_services
    timeout /t 2 /nobreak >nul
    call :start_services
    call :print_success "System restarted!"
) else if /i "%command%"=="status" (
    call :show_status
) else if /i "%command%"=="logs" (
    call :show_logs
) else if /i "%command%"=="update" (
    call :check_docker
    if !errorlevel! neq 0 exit /b 1
    call :update_system
) else if /i "%command%"=="help" (
    call :show_help
) else if /i "%command%"=="--help" (
    call :show_help
) else if /i "%command%"=="-h" (
    call :show_help
) else (
    call :print_error "Unknown command: %command%"
    echo.
    call :show_help
    exit /b 1
)

goto :eof

:: Run main function
call :main %*
