// ===== SIMPLIFIED DASHBOARD MODULE =====

/**
 * Simplified dashboard that uses the DashboardController pattern
 * Removes all redundant functionality that's already in other modules
 */
const Dashboard = {

    /**
     * Initialize dashboard - delegates to DashboardController
     */
    init: function() {
        console.log('Initializing Dashboard (Simplified)...');

        // Check authentication
        if (!Auth.isAuthenticated()) {
            Utils.Navigation.navigateTo('login.html');
            return;
        }

        // Use the DashboardController pattern
        if (typeof DashboardController !== 'undefined') {
            DashboardController.init();
            console.log('Dashboard initialized via DashboardController');
        } else {
            console.error('DashboardController not found - falling back to basic mode');
            this.fallbackInit();
        }
    },

    /**
     * Fallback initialization if DashboardController is not available
     */
    fallbackInit: function() {
        console.log('Using fallback dashboard initialization...');

        // Initialize core modules directly
        if (typeof DataManager !== 'undefined') {
            DataManager.init();
        }

        if (typeof UIManager !== 'undefined') {
            UIManager.init();
        }

        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.init();
        }

        Utils.UI.showNotification('Dashboard loaded in basic mode', 'info');
    },

    /**
     * Test functions for debugging
     */
    testLogoutButton: function() {
        console.log('Testing logout button...');
        const logoutBtn = document.getElementById('logoutBtn');

        if (logoutBtn) {
            console.log('Logout button found, triggering click...');
            logoutBtn.click();
        } else {
            console.error('Logout button not found');
        }
    },

    forceLogout: function() {
        console.log('Force logout initiated...');
        DashboardController.handleLogout();
    },

    testNotification: function() {
        console.log('Testing notification system...');
        DashboardController.testNotificationSystem(5);
    },

    testAlertPopup: function() {
        console.log('Testing alert popup...');
        DashboardController.testAlertPopup();
    }
};

// Make Dashboard available globally with debugging functions
if (typeof window !== 'undefined') {
    window.Dashboard = Dashboard;

    // Add global debugging functions
    window.testLogout = Dashboard.testLogoutButton;
    window.forceLogout = Dashboard.forceLogout;
    window.testNotification = Dashboard.testNotification;
    window.testAlertPopup = Dashboard.testAlertPopup;

    console.log('🔧 Dashboard debug functions available:');
    console.log('- testLogout() - Test logout button functionality');
    console.log('- forceLogout() - Force logout without confirmation');
    console.log('- testNotification() - Test notification system (5 second delay)');
    console.log('- testAlertPopup() - Test alert popup immediately');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dashboard;
}