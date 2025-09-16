# 🚀 Backend Setup Guide for Beginners

This guide will help you set up the backend for your Student Attendance Management System step by step.

## 📋 What You Need

1. **Node.js** - Download from [nodejs.org](https://nodejs.org/)
2. **MongoDB** - Download from [mongodb.com](https://www.mongodb.com/try/download/community)
3. **A code editor** - VS Code recommended

## 🛠️ Step-by-Step Setup

### Step 1: Install Node.js
1. Go to [nodejs.org](https://nodejs.org/)
2. Download the LTS version (recommended)
3. Run the installer and follow the instructions
4. Open Command Prompt/Terminal and verify installation:
   ```bash
   node --version
   npm --version
   ```

### Step 2: Install MongoDB
1. Go to [mongodb.com](https://www.mongodb.com/try/download/community)
2. Download MongoDB Community Server
3. Install it (choose "Complete" installation)
4. MongoDB will start automatically as a Windows service

### Step 3: Set Up Your Project
1. Open Command Prompt/Terminal
2. Navigate to your project folder:
   ```bash
   cd "C:\Users\chand\OneDrive\Desktop\2.0\Backend"
   ```

3. Install all required packages:
   ```bash
   npm install
   ```

### Step 4: Configure Environment Variables
1. Copy the example environment file:
   ```bash
   copy env.example .env
   ```

2. Open the `.env` file in your code editor
3. Update the following values:

   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/attendance_management
   
   # JWT Configuration - CHANGE THIS TO SOMETHING SECURE!
   JWT_SECRET=my_super_secret_jwt_key_12345_change_this_in_production
   JWT_EXPIRE=7d
   
   # CORS Configuration
   FRONTEND_URL=http://localhost:5173
   ```

   **Important**: Change the `JWT_SECRET` to something unique and secure!

### Step 5: Start MongoDB
1. Open Command Prompt as Administrator
2. Start MongoDB service:
   ```bash
   net start MongoDB
   ```

   Or if MongoDB is not running as a service:
   ```bash
   mongod
   ```

### Step 6: Start Your Backend Server
1. In your project folder, run:
   ```bash
   npm run dev
   ```

2. You should see:
   ```
   Server running on port 5000
   Environment: development
   Frontend URL: http://localhost:5173
   MongoDB Connected: localhost
   ```

## 🧪 Testing Your Setup

### Test 1: Health Check
Open your browser and go to: `http://localhost:5000/health`

You should see:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "development"
}
```

### Test 2: Register a User
Use Postman or any API testing tool:

**POST** `http://localhost:5000/api/auth/register`
```json
{
  "name": "Admin User",
  "email": "admin@example.com",
  "password": "password123",
  "role": "admin"
}
```

### Test 3: Register a Student
**POST** `http://localhost:5000/api/auth/register`
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "student"
}
```

## 🔧 Common Issues & Solutions

### Issue 1: "MongoDB connection failed"
**Solution**: Make sure MongoDB is running
```bash
# Check if MongoDB is running
net start MongoDB

# Or start manually
mongod
```

### Issue 2: "Port 5000 already in use"
**Solution**: Change the port in your `.env` file:
```env
PORT=5001
```

### Issue 3: "Cannot find module"
**Solution**: Reinstall dependencies:
```bash
rm -rf node_modules
npm install
```

### Issue 4: "JWT_SECRET not defined"
**Solution**: Make sure your `.env` file exists and has the JWT_SECRET:
```bash
# Check if .env file exists
ls -la .env

# If not, copy from example
cp env.example .env
```

## 📱 Frontend Integration

Once your backend is running, update your frontend's environment:

1. In your Frontend folder, create/update `.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

2. Start your frontend:
   ```bash
   cd ../Frontend
   npm run dev
   ```

## 🎯 What Each Part Does

### 📁 Models (Database Structure)
- **User.js**: Stores user login information
- **Student.js**: Stores student-specific information
- **Attendance.js**: Records when students check in/out
- **Leave.js**: Handles leave applications
- **QRCode.js**: Manages QR codes for attendance

### 🛡️ Middleware (Security)
- **auth.js**: Checks if users are logged in
- **protect**: Requires login for certain routes
- **restrictTo**: Only allows certain user types (admin/student)

### 🛣️ Routes (API Endpoints)
- **auth.js**: Login, register, profile management
- **attendance.js**: Mark attendance, view history
- **leave.js**: Apply for leave, approve/reject
- **qr.js**: Generate and validate QR codes
- **admin.js**: Admin dashboard and student management

### ⚙️ Server (Main Application)
- **server.js**: Starts the server, connects to database
- **database.js**: MongoDB connection configuration

## 🚀 Next Steps

1. **Test all endpoints** using Postman or your frontend
2. **Create some test data** (users, students, attendance records)
3. **Explore the admin dashboard** features
4. **Integrate with your frontend** application

## 📞 Need Help?

If you encounter any issues:
1. Check the console logs for error messages
2. Verify MongoDB is running
3. Ensure all environment variables are set correctly
4. Make sure no other application is using port 5000

## 🎉 Congratulations!

You now have a fully functional backend API for your Student Attendance Management System! The backend can handle:
- User authentication and authorization
- Student attendance tracking with QR codes
- Leave application management
- Admin dashboard with analytics
- Data export and reporting

Your frontend can now communicate with this backend to provide a complete attendance management solution.
