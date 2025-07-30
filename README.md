# 📝 Reminders Vault

A modern, responsive web application for managing reminders and tasks. Built with vanilla JavaScript, HTML5, and CSS3 with a focus on maintainability and user experience.

## ✨ Features

- **User Authentication** - Secure login system with session management
- **Dashboard** - Comprehensive overview of reminders and statistics
- **Reminder Management** - Create, view, and manage reminders
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **Local Storage** - Data persistence without requiring a backend
- **Modern UI** - Clean, intuitive interface with smooth animations
- **Accessibility** - WCAG compliant with keyboard navigation support
- **Offline Support** - Works without internet connection

## 🏗️ Project Structure

'''
reminder-manager/
├── index.html                 # Main entry point (redirects to login/dashboard)
├── pages/
│   ├── login.html            # Login page
│   └── dashboard.html        # Main dashboard
├── css/
│   ├── styles.css            # Global styles and utilities
│   ├── login.css             # Login page specific styles
│   └── dashboard.css         # Dashboard specific styles
├── js/
│   ├── app.js                # Main application controller
│   ├── auth.js               # Authentication and session management
│   ├── dashboard.js          # Dashboard functionality
│   └── utils.js              # Utility functions
├── config/
│   └── constants.js          # Application constants and configuration
├── assets/
│   ├── images/               # Images and graphics
│   └── icons/                # Icons and favicons
└── README.md                 # This file
'''

## 🚀 Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Web server (for proper file serving)

### Installation

1. **Clone or download the project**
   '''bash
   git clone <repository-url>
   cd reminder-manager
   '''

2. **Set up a local web server**

   **Option A: Using IntelliJ IDEA**
    - Open the project in IntelliJ IDEA
    - Right-click on 'index.html' → "Open in Browser" → "Built-in Server"
    - Or use the "Run" configuration for JavaScript applications

   **Option B: Using Node.js (http-server)**
   '''bash
   npx http-server
   # Navigate to http://localhost:8080
   '''

   **Option C: Using Python**
   '''bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   
   # Navigate to http://localhost:8000
   '''

   **Option D: Using Live Server (VS Code Extension)**
    - Install "Live Server" extension in VS Code
    - Right-click on 'index.html' → "Open with Live Server"

3. **Access the application**
    - Open your browser and navigate to the local server URL
    - You'll be redirected to the login page automatically

## 🔐 Demo Credentials

The application comes with pre-configured demo accounts:

| Role | Username | Password |
|------|----------|----------|
| Admin | 'admin' | 'password123' |
| User | 'user' | 'userpass123' |
| Manager | 'manager' | 'manager456' |

## 🎯 Usage

### Login
1. Navigate to the application
2. Use one of the demo credentials or click on the credential boxes to auto-fill
3. Click "Sign In" to access the dashboard

### Dashboard
- **Stats Overview**: View total, active, completed, and overdue reminders
- **Quick Actions**: Add new reminders, view all, or access settings
- **Recent Reminders**: See your most important upcoming reminders
- **Today's Schedule**: View scheduled items for today

### Adding Reminders
1. Click the "Add Reminder" button
2. Fill in the title, date/time, and optional description
3. Click "Add Reminder" to save

### Managing Reminders
- Click on any reminder in the recent list to mark it as completed
- Use the refresh button to update data
- Access keyboard shortcuts for quick actions

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| 'Ctrl/Cmd + N' | New reminder (dashboard) |
| 'Ctrl/Cmd + R' | Refresh dashboard |
| 'Ctrl/Cmd + Shift + D' | Show debug information |
| 'Ctrl/Cmd + Shift + R' | Reset application data |
| 'Escape' | Close modal/dialog |

## 🔧 Configuration

### Application Settings

Edit 'config/constants.js' to customize:

- **Session timeout duration**
- **Storage keys**
- **UI colors and themes**
- **Validation rules**
- **Demo user accounts**

### CSS Variables

Customize the appearance by modifying CSS variables in 'css/styles.css':

'''css
:root {
    --primary-color: #4CAF50;
    --secondary-color: #2196F3;
    --danger-color: #f44336;
    /* ... more variables */
}
'''

## 🛠️ Development

### Adding New Features

1. **New Page**: Create HTML file in 'pages/' and corresponding CSS in 'css/'
2. **New Module**: Add JavaScript module in 'js/' following the existing pattern
3. **Styling**: Use existing CSS variables and utility classes for consistency

### Code Structure

- **Modular Architecture**: Each feature is in its own module
- **Separation of Concerns**: HTML structure, CSS styling, and JS logic are separated
- **Utility-First**: Common functions are centralized in 'utils.js'
- **Event-Driven**: Uses custom events for inter-module communication

### Best Practices

- Use semantic HTML elements
- Follow BEM CSS naming convention for new styles
- Use JSDoc comments for functions
- Test across different browsers and devices
- Maintain accessibility standards

## 📱 Browser Support

- **Chrome** 60+
- **Firefox** 55+
- **Safari** 11+
- **Edge** 79+

**Required Browser Features:**
- Local Storage
- ES6 JavaScript features
- CSS Grid and Flexbox
- Fetch API or XMLHttpRequest

## 🚀 Deployment

### Static Hosting

The application can be deployed to any static hosting service:

- **GitHub Pages**
- **Netlify**
- **Vercel**
- **AWS S3**
- **Firebase Hosting**

Simply upload all files to your hosting provider.

### Production Optimizations

For production deployment, consider:

1. **Minify CSS and JavaScript** files
2. **Optimize images** for web
3. **Enable GZIP compression**
4. **Set up proper caching headers**
5. **Add HTTPS** for security

## 🔍 Troubleshooting

### Common Issues

**Blank Page After Opening**
- Ensure you're using a web server, not opening files directly
- Check browser console for JavaScript errors
- Verify all file paths are correct

**Login Not Working**
- Check that localStorage is enabled in your browser
- Clear browser cache and try again
- Verify demo credentials are entered correctly

**Data Not Persisting**
- Ensure localStorage is not disabled
- Check if you're in private/incognito mode
- Verify sufficient storage space

### Debug Mode

Enable debug mode by setting 'enableDebug: true' in 'config/constants.js' or use the keyboard shortcut 'Ctrl/Cmd + Shift + D'.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch ('git checkout -b feature/amazing-feature')
3. Commit your changes ('git commit -m 'Add amazing feature'')
4. Push to the branch ('git push origin feature/amazing-feature')
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Look for existing issues in the repository
3. Create a new issue with detailed information
4. Include browser version, operating system, and steps to reproduce

## 🎉 Acknowledgments

- Built with vanilla JavaScript for maximum compatibility
- Inspired by modern task management applications
- Uses CSS Grid and Flexbox for responsive layouts
- Follows web accessibility guidelines (WCAG 2.1)

---

**Made with ❤️ for productivity enthusiasts**