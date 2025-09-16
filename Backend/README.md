# Student Attendance Management System - Backend

A comprehensive Node.js backend API for managing student attendance using QR codes, built with Express.js and MongoDB.

## 🚀 Features

- **User Authentication**: JWT-based authentication for students and admins
- **QR Code Attendance**: Generate and validate QR codes for check-in/check-out
- **Leave Management**: Students can apply for leave, admins can approve/reject
- **Admin Dashboard**: Comprehensive analytics and student management
- **Real-time Statistics**: Attendance tracking and reporting
- **Security**: Rate limiting, CORS, input validation, and data sanitization

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy the example environment file
   cp env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

4. **Configure Environment Variables**
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/attendance_management
   
   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
   JWT_EXPIRE=7d
   
   # CORS Configuration
   FRONTEND_URL=http://localhost:5173
   ```

5. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running
   mongod
   ```

6. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password

### Attendance
- `POST /api/attendance` - Mark attendance (check-in/check-out)
- `GET /api/attendance` - Get attendance history
- `GET /api/attendance/stats` - Get attendance statistics

### Leave Management
- `POST /api/leave` - Apply for leave
- `GET /api/leave` - Get leave applications
- `GET /api/leave/:id` - Get specific leave application
- `PUT /api/leave/:id/status` - Update leave status (admin)
- `PUT /api/leave/:id` - Update leave application
- `DELETE /api/leave/:id` - Delete leave application
- `GET /api/leave/stats` - Get leave statistics

### QR Code Management
- `POST /api/qr/generate` - Generate QR code (admin)
- `POST /api/qr/validate` - Validate QR code
- `GET /api/qr` - Get QR codes (admin)
- `GET /api/qr/:id` - Get specific QR code
- `PUT /api/qr/:id/deactivate` - Deactivate QR code
- `GET /api/qr/stats` - Get QR code statistics
- `DELETE /api/qr/cleanup` - Clean up expired QR codes

### Admin Panel
- `GET /api/admin/students` - Get all students
- `GET /api/admin/students/:id` - Get specific student
- `PUT /api/admin/students/:id` - Update student
- `DELETE /api/admin/students/:id` - Delete student
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/reports/attendance` - Get attendance reports
- `GET /api/admin/export` - Export data

## 🗄️ Database Models

### User
- Basic user information (name, email, password, role)
- Authentication and authorization

### Student
- Extended student information (department, year, phone)
- Attendance statistics

### Attendance
- Daily attendance records
- Check-in/check-out times
- Location tracking

### Leave
- Leave applications
- Approval workflow
- Status tracking

### QRCode
- QR code generation and validation
- Expiration and usage tracking
- Location-based validation

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Input Validation**: express-validator for data validation
- **Rate Limiting**: Prevent abuse and DDoS attacks
- **CORS Protection**: Configured for frontend communication
- **Helmet**: Security headers for Express
- **Data Sanitization**: Prevent injection attacks

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker (Optional)
```bash
# Build Docker image
docker build -t attendance-backend .

# Run container
docker run -p 5000:5000 attendance-backend
```

## 📊 Monitoring

- Health check endpoint: `GET /health`
- Request logging
- Error tracking
- Performance monitoring

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/attendance_management |
| `JWT_SECRET` | JWT secret key | Required |
| `JWT_EXPIRE` | JWT expiration time | 7d |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:5173 |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, email your-email@example.com or create an issue in the repository.

## 🔄 Updates

- **v1.0.0**: Initial release with basic functionality
- **v1.1.0**: Added QR code generation and validation
- **v1.2.0**: Enhanced admin dashboard and reporting
