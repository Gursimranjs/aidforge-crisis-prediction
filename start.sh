#!/bin/bash

echo "🚀 Starting AidForge Crisis Prediction System..."
echo ""

# Check if .env exists
if [ ! -f backend/.env ]; then
    echo "❌ Error: backend/.env file not found!"
    echo "📝 Please create backend/.env with your Databricks token"
    echo ""
    echo "Copy backend/.env.example to backend/.env and add your token:"
    echo "  cp backend/.env.example backend/.env"
    echo "  # Then edit backend/.env with your token"
    exit 1
fi

# Check if token is set
if grep -q "YOUR_TOKEN_HERE" backend/.env || grep -q "your_databricks_token_here" backend/.env; then
    echo "⚠️  Warning: Please update your Databricks token in backend/.env"
    echo ""
    read -p "Press Enter to continue anyway or Ctrl+C to exit..."
fi

echo "📦 Installing dependencies (if needed)..."
echo ""

# Install backend dependencies
cd backend
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi
cd ..

# Install frontend dependencies
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
cd ..

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "🎯 Starting services..."
echo ""
echo "Backend will start on: http://localhost:5000"
echo "Frontend will start on: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

# Start backend in background
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start frontend
cd frontend
npm start

# When frontend is killed, also kill backend
kill $BACKEND_PID
