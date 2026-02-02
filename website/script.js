// ===================================
// Configuration & State Management
// ===================================
const CONFIG = {
    deviceIP: '',
    refreshInterval: 3,
    dataEndpoint: '/fingerprint-data',
    isMonitoring: false
};

const STATE = {
    activeSessions: new Map(),
    activityHistory: [],
    statistics: {
        totalEntries: 0,
        signInsToday: 0,
        signOutsToday: 0
    },
    lastUpdate: null,
    updateInterval: null
};

// ===================================
// DOM Elements
// ===================================
const DOM = {
    // Configuration inputs
    deviceIP: document.getElementById('device-ip'),
    refreshInterval: document.getElementById('refresh-interval'),
    dataEndpoint: document.getElementById('data-endpoint'),
    
    // Buttons
    saveConfigBtn: document.getElementById('save-config'),
    startMonitoringBtn: document.getElementById('start-monitoring'),
    testConnectionBtn: document.getElementById('test-connection'),
    enrollBtn: document.getElementById('enroll-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    clearActivityBtn: document.getElementById('clear-activity'),
    
    // Status elements
    connectionBadge: document.getElementById('connection-badge'),
    monitorText: document.getElementById('monitor-text'),
    
    // Display containers
    activeSessions: document.getElementById('active-sessions'),
    activityFeed: document.getElementById('activity-feed'),
    
    // Statistics
    activeCount: document.getElementById('active-count'),
    totalEntries: document.getElementById('total-entries'),
    signIns: document.getElementById('sign-ins'),
    signOuts: document.getElementById('sign-outs'),
    systemInfo: document.getElementById('system-info'),
    
    // Toast container
    toastContainer: document.getElementById('toast-container')
};

// ===================================
// Initialization
// ===================================
function init() {
    loadConfiguration();
    attachEventListeners();
    updateUI();
    
    // Show demo data if no config
    if (!CONFIG.deviceIP) {
        setTimeout(() => {
            showToast('Configure device IP to start monitoring', 'info');
            simulateDemoData();
        }, 1000);
    }
    
    updateSystemInfo('System initialized');
}

// ===================================
// Configuration Management
// ===================================
function loadConfiguration() {
    const saved = localStorage.getItem('WeSellYourDataConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            CONFIG.deviceIP = config.deviceIP || '';
            CONFIG.refreshInterval = config.refreshInterval || 3;
            CONFIG.dataEndpoint = config.dataEndpoint || '/fingerprint-data';
            
            DOM.deviceIP.value = CONFIG.deviceIP;
            DOM.refreshInterval.value = CONFIG.refreshInterval;
            DOM.dataEndpoint.value = CONFIG.dataEndpoint;
            
            updateSystemInfo('Configuration loaded');
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }
}

function saveConfiguration() {
    CONFIG.deviceIP = DOM.deviceIP.value.trim();
    CONFIG.refreshInterval = parseInt(DOM.refreshInterval.value) || 3;
    CONFIG.dataEndpoint = DOM.dataEndpoint.value.trim() || '/fingerprint-data';
    
    try {
        localStorage.setItem('WeSellYourDataConfig', JSON.stringify(CONFIG));
        showToast('Configuration saved successfully', 'success');
        updateSystemInfo('Configuration saved');
    } catch (error) {
        showToast('Failed to save configuration', 'error');
        console.error('Save error:', error);
    }
}

// ===================================
// Event Listeners
// ===================================
function attachEventListeners() {
    DOM.saveConfigBtn.addEventListener('click', saveConfiguration);
    DOM.startMonitoringBtn.addEventListener('click', toggleMonitoring);
    DOM.testConnectionBtn.addEventListener('click', testConnection);
    DOM.enrollBtn.addEventListener('click', enrollNewUser);
    DOM.refreshBtn.addEventListener('click', manualRefresh);
    DOM.clearActivityBtn.addEventListener('click', clearActivity);
}

// ===================================
// Connection Management
// ===================================
function formatDeviceURL() {
    let url = CONFIG.deviceIP.trim();
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
    }
    
    url = url.replace(/\/$/, '');
    return url + CONFIG.dataEndpoint;
}

async function testConnection() {
    if (!CONFIG.deviceIP) {
        showToast('Please enter device IP address', 'error');
        return;
    }
    
    const originalHTML = DOM.testConnectionBtn.innerHTML;
    DOM.testConnectionBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" class="spin">
            <path d="M12 4V2M12 22v-2M20 12h2M4 12H2M17.657 6.343l1.414-1.414M6.343 17.657l-1.414 1.414M17.657 17.657l1.414 1.414M6.343 6.343L4.93 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `;
    DOM.testConnectionBtn.disabled = true;
    
    try {
        const url = formatDeviceURL();
        updateSystemInfo(`Testing connection to ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            updateConnectionStatus('connected');
            showToast('Connection successful!', 'success');
            updateSystemInfo('Device connected');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        updateConnectionStatus('error');
        showToast(`Connection failed: ${error.message}`, 'error');
        updateSystemInfo(`Connection error: ${error.message}`);
    } finally {
        DOM.testConnectionBtn.innerHTML = originalHTML;
        DOM.testConnectionBtn.disabled = false;
    }
}

function updateConnectionStatus(status) {
    DOM.connectionBadge.classList.remove('connected', 'error');
    
    if (status === 'connected') {
        DOM.connectionBadge.classList.add('connected');
        DOM.connectionBadge.querySelector('.status-text').textContent = 'Connected';
    } else if (status === 'error') {
        DOM.connectionBadge.classList.add('error');
        DOM.connectionBadge.querySelector('.status-text').textContent = 'Connection Error';
    } else {
        DOM.connectionBadge.querySelector('.status-text').textContent = 'Disconnected';
    }
}

// ===================================
// Monitoring Control
// ===================================
function toggleMonitoring() {
    if (CONFIG.isMonitoring) {
        stopMonitoring();
    } else {
        startMonitoring();
    }
}

function startMonitoring() {
    if (!CONFIG.deviceIP) {
        showToast('Please configure device IP first', 'error');
        return;
    }
    
    CONFIG.isMonitoring = true;
    DOM.startMonitoringBtn.classList.add('active');
    DOM.monitorText.textContent = 'Stop Monitoring';
    
    // Fetch immediately
    fetchData();
    
    // Set up interval
    STATE.updateInterval = setInterval(fetchData, CONFIG.refreshInterval * 1000);
    
    showToast('Monitoring started', 'success');
    updateSystemInfo(`Monitoring active (${CONFIG.refreshInterval}s interval)`);
}

function stopMonitoring() {
    CONFIG.isMonitoring = false;
    DOM.startMonitoringBtn.classList.remove('active');
    DOM.monitorText.textContent = 'Start Monitoring';
    
    if (STATE.updateInterval) {
        clearInterval(STATE.updateInterval);
        STATE.updateInterval = null;
    }
    
    updateConnectionStatus('disconnected');
    showToast('Monitoring stopped', 'info');
    updateSystemInfo('Monitoring stopped');
}

// ===================================
// Data Fetching & Processing
// ===================================
async function fetchData() {
    if (!CONFIG.isMonitoring) return;
    
    try {
        const url = formatDeviceURL();
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        processData(data);
        updateConnectionStatus('connected');
        STATE.lastUpdate = new Date();
        updateSystemInfo(`Last update: ${STATE.lastUpdate.toLocaleTimeString()}`);
        
    } catch (error) {
        console.error('Fetch error:', error);
        updateConnectionStatus('error');
        updateSystemInfo(`Fetch error: ${error.message}`);
    }
}

function processData(data) {
    // Expected data format: { name: string, action: 'in'|'out', timestamp: number|string }
    if (!data || !data.name || !data.action) {
        console.error('Invalid data format:', data);
        return;
    }
    
    const entry = {
        name: data.name,
        action: data.action.toLowerCase(),
        timestamp: parseTimestamp(data.timestamp || data.time)
    };
    
    // Update statistics
    STATE.statistics.totalEntries++;
    if (entry.action === 'in') {
        STATE.statistics.signInsToday++;
        addActiveSession(entry);
    } else if (entry.action === 'out') {
        STATE.statistics.signOutsToday++;
        removeActiveSession(entry.name);
    }
    
    // Add to activity history
    addActivityEntry(entry);
    
    // Update UI
    updateUI();
}

function parseTimestamp(timestamp) {
    if (!timestamp) return new Date();
    
    // If it's a Unix timestamp (seconds)
    if (typeof timestamp === 'number' && timestamp > 1000000000 && timestamp < 10000000000) {
        return new Date(timestamp * 1000);
    }
    
    // If it's a Unix timestamp (milliseconds)
    if (typeof timestamp === 'number' && timestamp > 1000000000000) {
        return new Date(timestamp);
    }
    
    // Try to parse as date string
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? new Date() : date;
}

// ===================================
// Session Management
// ===================================
function addActiveSession(entry) {
    STATE.activeSessions.set(entry.name, {
        name: entry.name,
        startTime: entry.timestamp
    });
}

function removeActiveSession(name) {
    STATE.activeSessions.delete(name);
}

// ===================================
// Activity Management
// ===================================
function addActivityEntry(entry) {
    STATE.activityHistory.unshift(entry);
    
    // Keep only last 50 entries
    if (STATE.activityHistory.length > 50) {
        STATE.activityHistory = STATE.activityHistory.slice(0, 50);
    }
}

function clearActivity() {
    STATE.activityHistory = [];
    updateActivityFeed();
    showToast('Activity history cleared', 'info');
}

// ===================================
// UI Updates
// ===================================
function updateUI() {
    updateActiveSessions();
    updateActivityFeed();
    updateStatistics();
}

function updateActiveSessions() {
    DOM.activeCount.textContent = STATE.activeSessions.size;
    
    if (STATE.activeSessions.size === 0) {
        DOM.activeSessions.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 100 100" width="60" height="60">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5,5" opacity="0.3"/>
                </svg>
                <p>No active sessions</p>
            </div>
        `;
        return;
    }
    
    const sessionsHTML = Array.from(STATE.activeSessions.values())
        .map(session => {
            const duration = formatDuration(new Date() - session.startTime);
            return `
                <div class="session-card">
                    <div class="session-info">
                        <span class="session-name">${escapeHtml(session.name)}</span>
                        <span class="session-time">${session.startTime.toLocaleTimeString()}</span>
                    </div>
                    <div class="session-status">Active • ${duration}</div>
                </div>
            `;
        })
        .join('');
    
    DOM.activeSessions.innerHTML = sessionsHTML;
}

function updateActivityFeed() {
    if (STATE.activityHistory.length === 0) {
        DOM.activityFeed.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 100 100" width="60" height="60">
                    <rect x="20" y="30" width="60" height="8" rx="4" fill="currentColor" opacity="0.2"/>
                    <rect x="20" y="46" width="40" height="8" rx="4" fill="currentColor" opacity="0.2"/>
                    <rect x="20" y="62" width="50" height="8" rx="4" fill="currentColor" opacity="0.2"/>
                </svg>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }
    
    const activityHTML = STATE.activityHistory
        .map(entry => {
            const icon = entry.action === 'in' ? '→' : '←';
            const iconClass = entry.action === 'in' ? 'sign-in' : 'sign-out';
            const actionText = entry.action === 'in' ? 'Signed in' : 'Signed out';
            
            return `
                <div class="activity-item">
                    <div class="activity-icon ${iconClass}">${icon}</div>
                    <div class="activity-details">
                        <div class="activity-name">${escapeHtml(entry.name)}</div>
                        <div class="activity-action">${actionText}</div>
                    </div>
                    <div class="activity-timestamp">${entry.timestamp.toLocaleTimeString()}</div>
                </div>
            `;
        })
        .join('');
    
    DOM.activityFeed.innerHTML = activityHTML;
}

function updateStatistics() {
    DOM.totalEntries.textContent = STATE.statistics.totalEntries;
    DOM.signIns.textContent = STATE.statistics.signInsToday;
    DOM.signOuts.textContent = STATE.statistics.signOutsToday;
}

// ===================================
// Control Actions
// ===================================
async function enrollNewUser() {
    if (!CONFIG.deviceIP) {
        showToast('Please configure device IP first', 'error');
        return;
    }
    
    const originalHTML = DOM.enrollBtn.innerHTML;
    DOM.enrollBtn.innerHTML = `
        <div class="btn-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" class="spin">
                <path d="M12 4V2M12 22v-2M20 12h2M4 12H2M17.657 6.343l1.414-1.414M6.343 17.657l-1.414 1.414M17.657 17.657l1.414 1.414M6.343 6.343L4.93 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </div>
        <div class="btn-content">
            <span class="btn-label">Enrolling...</span>
            <span class="btn-sublabel">Waiting for fingerprint</span>
        </div>
    `;
    DOM.enrollBtn.disabled = true;
    
    try {
        let url = CONFIG.deviceIP.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        url = url.replace(/\/$/, '') + '/enroll';
        
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'enroll' })
        });
        
        if (response.ok) {
            showToast('Enrollment initiated. Place finger on scanner.', 'success');
            updateSystemInfo('Enrollment mode activated');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        showToast(`Enrollment failed: ${error.message}`, 'error');
        updateSystemInfo(`Enrollment error: ${error.message}`);
    } finally {
        setTimeout(() => {
            DOM.enrollBtn.innerHTML = originalHTML;
            DOM.enrollBtn.disabled = false;
        }, 2000);
    }
}

async function manualRefresh() {
    if (!CONFIG.deviceIP) {
        showToast('Please configure device IP first', 'error');
        return;
    }
    
    showToast('Refreshing data...', 'info');
    await fetchData();
}

// ===================================
// Toast Notifications
// ===================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close">×</button>
    `;
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));
    
    DOM.toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => removeToast(toast), 5000);
}

function removeToast(toast) {
    if (!toast.parentNode) return;
    
    toast.classList.add('removing');
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 300);
}

// ===================================
// Utility Functions
// ===================================
function updateSystemInfo(message) {
    DOM.systemInfo.textContent = message;
    console.log(`[WeSellYourData] ${message}`);
}

function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===================================
// Demo Data (for testing without device)
// ===================================
function simulateDemoData() {
    const demoNames = ['Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Martinez'];
    let demoIndex = 0;
    
    const addDemoEntry = () => {
        if (CONFIG.deviceIP) return; // Stop if real device is configured
        
        const name = demoNames[demoIndex % demoNames.length];
        const action = Math.random() > 0.5 ? 'in' : 'out';
        
        processData({
            name: name,
            action: action,
            timestamp: Date.now() / 1000
        });
        
        demoIndex++;
        
        // Schedule next demo entry randomly between 3-8 seconds
        if (!CONFIG.deviceIP) {
            setTimeout(addDemoEntry, 3000 + Math.random() * 5000);
        }
    };
    
    // Start demo after 2 seconds
    setTimeout(addDemoEntry, 2000);
}

// ===================================
// CSS Animation Helper
// ===================================
const style = document.createElement('style');
style.textContent = `
    .spin {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// ===================================
// Initialize on DOM Load
// ===================================
document.addEventListener('DOMContentLoaded', init);
