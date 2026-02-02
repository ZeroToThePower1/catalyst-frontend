
const CONFIG = {
    API_BASE_URL: 'https://catalyst-server-a057.onrender.com',
    SOCKET_RECONNECT_DELAY: 3000,
    NOTIFICATION_DURATION: 3000,
    MAX_RECONNECT_ATTEMPTS: 5
};


const AppState = {
    currentUser: null,
    accessToken: null,
    socket: null,
    currentChatRoom: null,
    currentChatUserId: null,
    contacts: [],
    groups: [],
    reconnectAttempts: 0,
    isSocketInitializing: false,
    messageQueue: []
};


const DOM = {
    // Theme
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeToggle')?.querySelector('i'),
    body: document.body,

    // Navigation
    menuToggle: document.getElementById('menuToggle'),
    closeMenu: document.getElementById('closeMenu'),
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('overlay'),

    // Auth
    authBtn: document.getElementById('authBtn'),
    authWindow: document.getElementById('authWindow'),
    authTabs: document.querySelectorAll('.auth-tab'),
    authForms: document.querySelectorAll('.auth-form'),
    authError: document.getElementById('authError'),
    authLoading: document.getElementById('authLoading'),

    // Notifications
    notificationBtn: document.getElementById('notificationBtn'),
    notificationPopup: document.getElementById('notificationPopup'),

    // Chat
    chatInput: document.getElementById('chatInput'),
    sendMessageBtn: document.getElementById('sendMessageBtn'),
    chatMessages: document.getElementById('chatMessages'),
    chatInputArea: document.getElementById('chatInputArea'),
    chatList: document.getElementById('chatList'),
    contactList: document.getElementById('contactList'),
    chatWithName: document.getElementById('chatWithName'),
    userStats: document.getElementById('userStats'),
    welcomeTitle: document.getElementById('welcomeTitle'),
    welcomeMessage: document.getElementById('welcomeMessage'),

    // New chat buttons
    createGroupBtn: document.getElementById('createGroupBtn'),
    newPrivateChatBtn: document.getElementById('newPrivateChatBtn'),
    refreshContactsBtn: document.getElementById('refreshContactsBtn')
};


const Utils = {
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    formatTime(date) {
        return new Date(date).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    generateRoomId(userId1, userId2) {
        return [userId1, userId2].sort().join('-');
    },

    sanitizeMessage(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    isObjectEmpty(obj) {
        return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
    },

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.querySelectorAll('.auth-window.show, .notification-popup.show').forEach(el => {
            el.classList.remove('show');
        });
    }
};


class ThemeManager {
    static init() {
        if (!DOM.themeToggle) return;

        DOM.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.applySavedTheme();
    }

    static toggleTheme() {
        const isDark = DOM.body.classList.toggle('dark-theme');
        DOM.body.classList.toggle('light-theme');

        if (DOM.themeIcon) {
            DOM.themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }

        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    static applySavedTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            DOM.body.classList.add('dark-theme');
            DOM.body.classList.remove('light-theme');
            if (DOM.themeIcon) {
                DOM.themeIcon.className = 'fas fa-sun';
            }
        }
    }
}


class NavigationManager {
    static init() {
        if (!DOM.menuToggle || !DOM.closeMenu || !DOM.overlay) return;

        DOM.menuToggle.addEventListener('click', () => this.openSidebar());
        DOM.closeMenu.addEventListener('click', () => this.closeSidebar());
        DOM.overlay.addEventListener('click', () => this.closeAllModals());

        this.setupMenuItems();
    }

    static openSidebar() {
        DOM.sidebar?.classList.add('show');
        DOM.overlay?.classList.add('show');
    }

    static closeSidebar() {
        DOM.sidebar?.classList.remove('show');
        DOM.overlay?.classList.remove('show');
    }

    static closeAllModals() {
        this.closeSidebar();
        DOM.notificationPopup?.classList.remove('show');
        DOM.authWindow?.classList.remove('show');
        Utils.closeAllModals();
    }

    static setupMenuItems() {
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                this.closeSidebar();

                const menuText = item.querySelector('span')?.textContent;
                if (menuText) {
                    NotificationManager.show(`Loading ${menuText}...`);
                }
            });
        });
    }
}


class NotificationManager {
    static show(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icon = type === 'success' ? 'check-circle' :
            type === 'error' ? 'exclamation-circle' : 'info-circle';

        notification.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;

        Object.assign(notification.style, {
            position: 'fixed',
            top: '100px',
            right: '20px',
            background: this.getColor(type),
            color: 'white',
            padding: '12px 20px',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: '9999',
            animation: 'slideIn 0.3s ease'
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, CONFIG.NOTIFICATION_DURATION);
    }

    static getColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }
}


class AuthManager {
    static init() {
        if (!DOM.authBtn || !DOM.authWindow) return;

        DOM.authBtn.addEventListener('click', (e) => this.toggleAuthWindow(e));
        this.setupAuthTabs();
        this.setupAuthForms();
        this.setupCloseListeners();
    }

    static toggleAuthWindow(e) {
        e.stopPropagation();
        DOM.authWindow.classList.toggle('show');
        DOM.notificationPopup?.classList.remove('show');
        this.updateAuthButton();
    }

    static setupAuthTabs() {
        DOM.authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                DOM.authTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                DOM.authForms.forEach(form => {
                    form.classList.remove('active');
                    if (form.id === `${tabName}Form`) {
                        form.classList.add('active');
                    }
                });

                this.clearAuthError();
            });
        });
    }

    static setupAuthForms() {
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;

            if (!username || !password) {
                this.showAuthError('Please fill in all fields');
                return;
            }

            await this.login(username, password);
        });

        document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const username = document.getElementById('signupUsername').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;

            const validation = this.validateSignup(name, username, password, confirmPassword);
            if (!validation.valid) {
                this.showAuthError(validation.message);
                return;
            }

            await this.signup(name, username, password);
        });
    }

    static validateSignup(name, username, password, confirmPassword) {
        if (!name || !username || !password || !confirmPassword) {
            return { valid: false, message: 'Please fill in all fields' };
        }

        if (password !== confirmPassword) {
            return { valid: false, message: 'Passwords do not match' };
        }

        if (password.length < 6) {
            return { valid: false, message: 'Password must be at least 6 characters' };
        }

        return { valid: true };
    }

    static async login(username, password) {
        try {
            this.showLoading(true);

            const response = await fetch(`${CONFIG.API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            AppState.accessToken = data.accesstoken;
            AppState.currentUser = data.user;

            localStorage.setItem('accessToken', AppState.accessToken);
            localStorage.setItem('user', JSON.stringify(AppState.currentUser));

            this.updateAuthButton();
            UIManager.updateContentForUser();
            SocketManager.init();
            ChatManager.setupActionButtons();

            DOM.authWindow.classList.remove('show');
            NotificationManager.show('Login successful!', 'success');

        } catch (error) {
            this.showAuthError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    static async signup(name, username, password) {
        try {
            this.showLoading(true);

            const response = await fetch(`${CONFIG.API_BASE_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, password }),
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Signup failed');
            }

            AppState.accessToken = data.accesstoken;
            AppState.currentUser = data.user;

            localStorage.setItem('accessToken', AppState.accessToken);
            localStorage.setItem('user', JSON.stringify(AppState.currentUser));
            localStorage.setItem('userData', JSON.stringify({
                id: response.user.id,           // MongoDB _id
                username: response.user.username,
                name: response.user.name
            }));

            this.updateAuthButton();
            UIManager.updateContentForUser();
            SocketManager.init();
            ChatManager.setupActionButtons();

            DOM.authWindow.classList.remove('show');
            NotificationManager.show('Account created successfully!', 'success');


            DOM.authTabs[0]?.click();

        } catch (error) {
            this.showAuthError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    static async logout() {
        try {
            await fetch(`${CONFIG.API_BASE_URL}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        AppState.currentUser = null;
        AppState.accessToken = null;
        AppState.messageQueue = [];
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');

        if (AppState.socket) {
            AppState.socket.disconnect();
            AppState.socket = null;
        }

        this.updateAuthButton();
        UIManager.updateContentForUser();
        NotificationManager.show('Logged out successfully', 'success');
    }

    static updateAuthButton() {
        if (!DOM.authBtn) return;

        if (AppState.currentUser) {
            DOM.authBtn.innerHTML = `<i class="fas fa-user"></i> ${AppState.currentUser.username}`;
            DOM.authBtn.classList.add('logged-in');
        } else {
            DOM.authBtn.textContent = 'Login / Sign Up';
            DOM.authBtn.classList.remove('logged-in');
        }
    }

    static showAuthError(message) {
        if (!DOM.authError) return;

        DOM.authError.textContent = message;
        DOM.authError.style.display = 'block';
    }

    static clearAuthError() {
        if (!DOM.authError) return;

        DOM.authError.textContent = '';
        DOM.authError.style.display = 'none';
    }

    static showLoading(show) {
        if (!DOM.authLoading) return;

        DOM.authLoading.style.display = show ? 'block' : 'none';
        document.querySelectorAll('.submit-btn').forEach(btn => {
            btn.disabled = show;
        });
    }

    static setupCloseListeners() {
        document.addEventListener('click', (e) => {
            if (!DOM.authBtn?.contains(e.target) && !DOM.authWindow?.contains(e.target)) {
                DOM.authWindow.classList.remove('show');
            }
        });
    }
}


class SocketManager {
    static async init() {
        if (!AppState.accessToken || AppState.socket || AppState.isSocketInitializing) {
            return;
        }

        AppState.isSocketInitializing = true;
        console.log('Initializing socket connection...');

        try {

            if (this.isTokenExpired(AppState.accessToken)) {
                console.log('Access token expired, refreshing...');
                await this.refreshAccessToken();
            }

            AppState.socket = io(CONFIG.API_BASE_URL, {
                auth: {
                    token: AppState.accessToken
                },
                withCredentials: true,
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: CONFIG.MAX_RECONNECT_ATTEMPTS,
                reconnectionDelay: CONFIG.SOCKET_RECONNECT_DELAY
            });

            this.setupEventListeners();
        } catch (error) {
            console.error('Failed to initialize socket:', error);
            AppState.isSocketInitializing = false;
            NotificationManager.show('Failed to connect to chat', 'error');
        }
    }

    static isTokenExpired(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiresAt = payload.exp * 1000;
            const oneDayBefore = 24 * 60 * 60 * 1000; // 1 day before
            return Date.now() >= (expiresAt - oneDayBefore); // 1 day pehle se refresh karega
        } catch (error) {
            console.error('Error checking token expiration:', error);
            return true;
        }
    }

    static async refreshAccessToken() {
        try {
            console.log('Refreshing access token...');

            const response = await fetch(`${CONFIG.API_BASE_URL}/refresh`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }

            const data = await response.json();
            AppState.accessToken = data.accesstoken;
            localStorage.setItem('accessToken', AppState.accessToken);

            console.log('Access token refreshed successfully');
            NotificationManager.show('Session refreshed', 'success');

        } catch (error) {
            console.error('Token refresh failed:', error);

            AuthManager.logout();
            throw error;
        }
    }

    static setupEventListeners() {
        if (!AppState.socket) return;

        AppState.socket.on('connect', () => {
            console.log('✅ Socket connected:', AppState.socket.id);
            AppState.reconnectAttempts = 0;
            AppState.isSocketInitializing = false;


            if (AppState.socket.newAccessToken) {
                AppState.accessToken = AppState.socket.newAccessToken;
                localStorage.setItem('accessToken', AppState.accessToken);
                console.log('Received new access token from server');
            }


            AppState.socket.emit('joinroom', `user-${AppState.currentUser.id}`);


            ChatManager.loadContacts();

            NotificationManager.show('Chat connected', 'success');
        });


        AppState.socket.on('pvtmsg', (data) => {
            console.log('📨 Received private message:', data);


            let senderId = data.Sender;

            if (senderId && !senderId.includes('-')) {
                const contact = AppState.contacts.find(c => c.Username === senderId);
                if (contact) {
                    senderId = contact._id;
                }
            }


            if (AppState.currentChatUserId === senderId ||
                data.roomId === AppState.currentChatRoom ||
                data.toUserId === AppState.currentUser.id) {


                ChatManager.displayMessage(data);


                const contactItem = document.querySelector(`.contact-item[data-user-id="${senderId}"]`);
                if (contactItem) {
                    const unreadBadge = contactItem.querySelector('.unread-count');
                    if (unreadBadge) {
                        unreadBadge.style.display = 'none';
                        unreadBadge.textContent = '0';
                    }
                }
            } else {

                AppState.messageQueue.push({
                    ...data,
                    senderId: senderId
                });


                this.updateUnreadCount(senderId);


                this.showDesktopNotification(data);
            }
        });


        AppState.socket.on('messageSent', (data) => {
            console.log('✅ Message sent confirmation:', data);

            if (data.roomId === AppState.currentChatRoom) {
                ChatManager.displayMessage({
                    Sender: AppState.currentUser.username,
                    message: data.message,
                    timestamp: new Date()
                });
            }
        });

        AppState.socket.on('userStatus', (data) => {
            console.log('User status update:', data);
            ChatManager.updateUserStatus(data.userId, data.status);
        });

        AppState.socket.on('error', (error) => {
            console.error('Socket error:', error);
            NotificationManager.show(`Socket error: ${error.message}`, 'error');
        });

        AppState.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            NotificationManager.show('Chat disconnected. Reconnecting...', 'warning');


            setTimeout(() => {
                if (!AppState.socket?.connected) {
                    this.init();
                }
            }, CONFIG.SOCKET_RECONNECT_DELAY);
        });

        AppState.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            AppState.isSocketInitializing = false;

            if (error.message.includes('auth') || error.message.includes('token')) {
                NotificationManager.show('Session expired. Please login again.', 'error');
                AuthManager.logout();
            }
        });
    }

    static updateUnreadCount(senderId) {
        const contactItem = document.querySelector(`.contact-item[data-user-id="${senderId}"]`);
        if (contactItem) {
            const unreadBadge = contactItem.querySelector('.unread-count');
            if (unreadBadge) {
                let currentCount = parseInt(unreadBadge.textContent) || 0;
                currentCount++;
                unreadBadge.textContent = currentCount;
                unreadBadge.style.display = 'block';


                ChatManager.updateChatBadge();
            } else {

                const badge = document.createElement('span');
                badge.className = 'unread-count';
                badge.textContent = '1';
                badge.style.cssText = 'display: block; background: var(--primary); color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px;';
                contactItem.appendChild(badge);

                ChatManager.updateChatBadge();
            }
        }
    }

    static showDesktopNotification(data) {
        if (!("Notification" in window)) {
            return;
        }

        if (Notification.permission === "granted") {
            new Notification(`New message from ${data.Sender}`, {
                body: data.messge || data.message,
                icon: '/favicon.ico'
            });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification(`New message from ${data.Sender}`, {
                        body: data.messge || data.message,
                        icon: '/favicon.ico'
                    });
                }
            });
        }
    }

    static async sendMessage(messageData) {
        if (!AppState.socket?.connected) {
            NotificationManager.show('Chat is not connected', 'error');
            return false;
        }

        try {

            AppState.socket.emit('pvtmsg', messageData);


            const tempMessage = {
                Sender: AppState.currentUser.username,
                message: messageData.msg,
                timestamp: new Date(),
                isTemp: true
            };

            ChatManager.addMessageToUI(tempMessage, true);

            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            NotificationManager.show('Failed to send message', 'error');
            return false;
        }
    }

    static isTokenAboutToExpire(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiresAt = payload.exp * 1000;
            const twoMinutes = 2 * 60 * 1000;
            return Date.now() >= (expiresAt - twoMinutes);
        } catch (error) {
            return true;
        }
    }

    static async reconnectWithNewToken() {
        if (AppState.socket) {
            AppState.socket.disconnect();
            AppState.socket = null;
        }
        await this.init();
    }
}


class ChatManager {
    static async loadContacts() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/users`, {
                headers: { 'authenticate': `Bearer ${AppState.accessToken}` }
            });

            if (response.ok) {
                AppState.contacts = await response.json();
                this.displayContacts(AppState.contacts);
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
        }
    }

    static displayContacts(contactsList) {
        if (!DOM.contactList) return;

        const contactCount = document.getElementById('contactCount');
        if (contactCount) {
            contactCount.textContent = contactsList.length;
        }

        if (contactsList.length === 0) {
            DOM.contactList.innerHTML = `
                <div class="no-contacts">
                    <i class="fas fa-user-friends"></i>
                    <p>No contacts yet</p>
                    <button id="findContactsBtn" class="small-btn">Find users</button>
                </div>
            `;
            return;
        }

        DOM.contactList.innerHTML = contactsList.map(contact => `
            <div class="contact-item" data-user-id="${contact._id}" data-username="${contact.Username}">
                <div class="contact-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="contact-details">
                    <div class="contact-name">${contact.Name}</div>
                    <div class="contact-lastmsg">@${contact.Username}</div>
                </div>
                <span class="unread-count" style="display: none;">0</span>
            </div>
        `).join('');


        DOM.contactList.querySelectorAll('.contact-item').forEach(item => {
            item.addEventListener('click', async () => {
                const userId = item.dataset.userId;
                await this.startPrivateChat(userId);

                const unreadBadge = item.querySelector('.unread-count');
                if (unreadBadge) {
                    unreadBadge.style.display = 'none';
                    unreadBadge.textContent = '0';
                    this.updateChatBadge();
                }


                this.processMessageQueue(userId);
            });
        });
    }

    static async startPrivateChat(otherUserId) {
        AppState.currentChatUserId = otherUserId;

        const contact = AppState.contacts.find(c => c._id === otherUserId);
        if (!contact) return;


        if (DOM.chatWithName) {
            DOM.chatWithName.textContent = contact.Name;
        }

        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.userId === otherUserId) {
                item.classList.add('active');
            }
        });

        const roomId = Utils.generateRoomId(AppState.currentUser.id, otherUserId);
        AppState.currentChatRoom = roomId;

        if (AppState.socket) {
            AppState.socket.emit('joinroom', roomId);
            console.log(`Joined room: ${roomId}`);
        }

        await this.loadPrivateChatHistory(otherUserId);

        this.showChatInput(true);
    }

    static async loadPrivateChatHistory(otherUserId) {
        try {
            console.log(`Loading chat history for user: ${otherUserId}`);
            const response = await fetch(`${CONFIG.API_BASE_URL}/chat/private/${otherUserId}`, {
                headers: { 'authenticate': `Bearer ${AppState.accessToken}` }
            });

            if (response.ok) {
                const messages = await response.json();
                console.log(`Loaded ${messages.length} messages`);
                this.displayChatHistory(messages);
            } else {
                console.error('Failed to load chat history:', response.status);
            }
        } catch (error) {
            console.error('Error loading private chat:', error);
        }
    }

    static displayChatHistory(messages) {
        if (!DOM.chatMessages) return;

        DOM.chatMessages.innerHTML = '';

        if (messages.length === 0) {
            DOM.chatMessages.innerHTML = `
                <div class="no-chat-selected">
                    <i class="fas fa-comment-slash"></i>
                    <h3>No messages yet</h3>
                    <p>Be the first to start the conversation!</p>
                </div>
            `;
            return;
        }


        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        messages.forEach(msg => {
            const isSent = msg.username === AppState.currentUser?.username;
            this.addMessageToUI(msg, isSent);
        });

        this.scrollToBottom();
    }

    static displayMessage(data) {
        if (!DOM.chatMessages) return;

        const noChatElement = DOM.chatMessages.querySelector('.no-chat-selected');
        if (noChatElement) {
            noChatElement.remove();
        }


        let isSent = false;
        if (data.Sender === AppState.currentUser?.username) {
            isSent = true;
        } else {
            const contact = AppState.contacts.find(c => c.Username === data.Sender);
            isSent = false;
        }

        this.addMessageToUI({
            Sender: data.Sender,
            message: data.messge || data.message,
            timestamp: new Date(data.timestamp || Date.now())
        }, isSent);
    }

    static addMessageToUI(msg, isSent) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;

        const time = Utils.formatTime(msg.timestamp);
        const sanitizedMessage = Utils.sanitizeMessage(msg.message || msg.messge);

        messageDiv.innerHTML = `
            <div class="message-sender">${msg.Sender || msg.username}</div>
            <div class="message-text">${sanitizedMessage}</div>
            <div class="message-time">${time}</div>
        `;

        // Add a data attribute to identify temporary messages
        if (msg.isTemp) {
            messageDiv.setAttribute('data-temp', 'true');
        }

        DOM.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    static scrollToBottom() {
        if (DOM.chatMessages) {
            setTimeout(() => {
                DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
            }, 100);
        }
    }

    static async sendMessage() {
        if (!AppState.socket || !AppState.currentChatRoom || !AppState.currentChatUserId) {
            NotificationManager.show('Select a contact first', 'error');
            return;
        }

        if (!DOM.chatInput) return;

        const message = DOM.chatInput.value.trim();
        if (!message) return;

        const messageData = {
            roomId: AppState.currentChatRoom,
            msg: message,
            toUserId: AppState.currentChatUserId
        };

        if (await SocketManager.sendMessage(messageData)) {
            // Clear input
            DOM.chatInput.value = '';

            // Focus back on input
            DOM.chatInput.focus();
        }
    }

    static updateChatBadge() {
        const unreadElements = document.querySelectorAll('.unread-count');
        let totalUnread = 0;

        unreadElements.forEach(el => {
            if (el.style.display !== 'none') {
                const count = parseInt(el.textContent) || 0;
                totalUnread += count;
            }
        });

        const badge = document.querySelector('.chats-badge');
        if (badge) {
            badge.style.display = totalUnread > 0 ? 'block' : 'none';
            badge.textContent = totalUnread > 0 ? totalUnread : '';
        }

        const chatTabBadge = document.querySelector('.tab-btn[data-tab="chat"] .unread-badge');
        if (chatTabBadge) {
            chatTabBadge.textContent = totalUnread > 0 ? totalUnread : '';
            chatTabBadge.style.display = totalUnread > 0 ? 'inline-flex' : 'none';
        }
    }

    static updateUserStatus(userId, status) {
        const contactItem = document.querySelector(`.contact-item[data-user-id="${userId}"]`);
        if (contactItem) {
            const avatar = contactItem.querySelector('.contact-avatar');
            if (avatar) {
                // Remove all status classes
                avatar.classList.remove('online', 'offline');

                // Add new status class
                if (status === 'online') {
                    avatar.classList.add('online');
                } else if (status === 'offline') {
                    avatar.classList.add('offline');
                }
            }
        }
    }

    static showChatInput(show) {
        if (DOM.chatInputArea) {
            DOM.chatInputArea.style.display = show ? 'flex' : 'none';
            if (show) {
                DOM.chatInput.focus();
            }
        }
    }

    static processMessageQueue(userId) {
        // Find and display queued messages for this user
        const queuedMessages = AppState.messageQueue.filter(msg =>
            msg.senderId === userId ||
            msg.Sender === document.querySelector(`.contact-item[data-user-id="${userId}"]`)?.dataset.username
        );

        if (queuedMessages.length > 0) {
            queuedMessages.forEach(msg => {
                this.displayMessage(msg);
            });

            // Remove processed messages from queue
            AppState.messageQueue = AppState.messageQueue.filter(msg =>
                !(msg.senderId === userId ||
                    msg.Sender === document.querySelector(`.contact-item[data-user-id="${userId}"]`)?.dataset.username)
            );
        }
    }

    static setupActionButtons() {
        // Create Group Button
        const createGroupBtn = document.getElementById('createGroupBtn');
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', () => {
                if (!AppState.currentUser) {
                    NotificationManager.show('Please login first', 'error');
                    return;
                }
                this.showCreateGroupModal();
            });
        }

        // Add Contact Button (New Private Chat)
        const newPrivateChatBtn = document.getElementById('newPrivateChatBtn');
        if (newPrivateChatBtn) {
            newPrivateChatBtn.addEventListener('click', () => {
                if (!AppState.currentUser) {
                    NotificationManager.show('Please login first', 'error');
                    return;
                }
                this.showAddContactModal();
            });
        }

        // Refresh Contacts Button
        const refreshContactsBtn = document.getElementById('refreshContactsBtn');
        if (refreshContactsBtn) {
            refreshContactsBtn.addEventListener('click', async () => {
                if (!AppState.currentUser) return;

                const icon = refreshContactsBtn.querySelector('i');
                icon.classList.add('fa-spin');
                await this.loadContacts();
                icon.classList.remove('fa-spin');
                NotificationManager.show('Contacts refreshed', 'success');
            });
        }

        // Find Contacts Button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'findContactsBtn' ||
                e.target.closest('#findContactsBtn')) {
                this.showFindUsersModal();
            }
        });

        // Chat search input
        const contactSearch = document.getElementById('contactSearch');
        if (contactSearch) {
            contactSearch.addEventListener('input', Utils.debounce((e) => {
                this.searchContacts(e.target.value);
            }, 300));
        }
    }

    static searchContacts(query) {
        if (!query.trim()) {
            // Reset to all contacts
            this.displayContacts(AppState.contacts);
            return;
        }

        const filteredContacts = AppState.contacts.filter(contact =>
            contact.Name.toLowerCase().includes(query.toLowerCase()) ||
            contact.Username.toLowerCase().includes(query.toLowerCase())
        );

        this.displayContacts(filteredContacts);
    }

    static showCreateGroupModal() {
        // ... (same as before, but add CSS for modal display)
        const modalHTML = `
            <div class="modal" id="createGroupModal" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-content" style="background: white; padding: 20px; border-radius: 8px; width: 90%; max-width: 500px;">
                    <div class="modal-header">
                        <h3>Create Study Group</h3>
                        <button class="modal-close" id="closeGroupModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Group Name</label>
                            <input type="text" id="groupNameInput" placeholder="Enter group name" autocomplete="off">
                        </div>
                        <div class="form-group">
                            <label>Description (Optional)</label>
                            <textarea id="groupDescInput" placeholder="Describe the purpose of this group" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Add Members</label>
                            <div class="contacts-selector" id="contactsSelector" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                                ${AppState.contacts.length > 0 ? AppState.contacts.map(contact => `
                                    <div class="contact-checkbox" style="margin: 5px 0;">
                                        <input type="checkbox" id="contact-${contact._id}" value="${contact._id}">
                                        <label for="contact-${contact._id}" style="margin-left: 5px; cursor: pointer;">
                                            <i class="fas fa-user"></i>
                                            ${contact.Name} (@${contact.Username})
                                        </label>
                                    </div>
                                `).join('') : '<p>No contacts available. Add some friends first!</p>'}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                        <button class="btn-secondary" id="cancelGroupBtn">Cancel</button>
                        <button class="btn-primary" id="createGroupSubmitBtn">Create Group</button>
                    </div>
                </div>
            </div>
        `;

        const modalsContainer = document.getElementById('modalsContainer');
        modalsContainer.innerHTML = modalHTML;

        // Add event listeners
        document.getElementById('closeGroupModal')?.addEventListener('click', () => {
            document.getElementById('createGroupModal').style.display = 'none';
        });

        document.getElementById('cancelGroupBtn')?.addEventListener('click', () => {
            document.getElementById('createGroupModal').style.display = 'none';
        });

        document.getElementById('createGroupSubmitBtn')?.addEventListener('click', async () => {
            await this.createGroup();
        });

        // Close modal when clicking outside
        document.getElementById('createGroupModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'createGroupModal') {
                e.target.style.display = 'none';
            }
        });
    }

    static async createGroup() {
        // ... (same as before)
        const groupName = document.getElementById('groupNameInput')?.value;
        const groupDesc = document.getElementById('groupDescInput')?.value;

        if (!groupName) {
            NotificationManager.show('Please enter a group name', 'error');
            return;
        }

        const selectedContacts = [];
        document.querySelectorAll('#contactsSelector input[type="checkbox"]:checked').forEach(checkbox => {
            selectedContacts.push(checkbox.value);
        });

        if (selectedContacts.length === 0) {
            NotificationManager.show('Please select at least one member', 'error');
            return;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/groups/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'authenticate': `Bearer ${AppState.accessToken}`
                },
                body: JSON.stringify({
                    name: groupName,
                    description: groupDesc,
                    members: selectedContacts
                })
            });

            if (response.ok) {
                NotificationManager.show('Group created successfully!', 'success');
                document.getElementById('createGroupModal').style.display = 'none';
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create group');
            }
        } catch (error) {
            NotificationManager.show(error.message, 'error');
        }
    }

    static showAddContactModal() {
        const modalHTML = `
            <div class="modal" id="addContactModal" style="display: flex; align-items: center; justify-content: center;">
                <div class="modal-content" style="background: white; padding: 20px; border-radius: 8px; width: 90%; max-width: 500px;">
                    <div class="modal-header">
                        <h3>Add New Contact</h3>
                        <button class="modal-close" id="closeContactModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Search by Username</label>
                            <input type="text" id="searchUsernameInput" placeholder="Enter username" autocomplete="off">
                            <button id="searchUserBtn" class="small-btn" style="margin-top: 10px;">Search</button>
                        </div>
                        <div id="searchResults" style="margin-top: 20px;"></div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; margin-top: 20px;">
                        <button class="btn-secondary" id="cancelContactBtn">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        const modalsContainer = document.getElementById('modalsContainer');
        modalsContainer.innerHTML = modalHTML;

        // Add event listeners
        document.getElementById('closeContactModal')?.addEventListener('click', () => {
            document.getElementById('addContactModal').style.display = 'none';
        });

        document.getElementById('cancelContactBtn')?.addEventListener('click', () => {
            document.getElementById('addContactModal').style.display = 'none';
        });

        document.getElementById('searchUserBtn')?.addEventListener('click', () => {
            this.searchUser();
        });

        // Search on Enter key
        document.getElementById('searchUsernameInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchUser();
            }
        });

        // Close modal when clicking outside
        document.getElementById('addContactModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'addContactModal') {
                e.target.style.display = 'none';
            }
        });
    }

    static async searchUser() {
        const username = document.getElementById('searchUsernameInput')?.value;
        if (!username) {
            NotificationManager.show('Please enter a username', 'error');
            return;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/users/search/${username}`, {
                headers: { 'authenticate': `Bearer ${AppState.accessToken}` }
            });

            const searchResults = document.getElementById('searchResults');

            if (response.ok) {
                const users = await response.json();

                if (users.length === 0) {
                    searchResults.innerHTML = '<p>No users found</p>';
                    return;
                }

                searchResults.innerHTML = users.map(user => `
                    <div class="user-result" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #ddd;">
                        <div>
                            <strong>${user.Name}</strong><br>
                            <small>@${user.Username}</small>
                        </div>
                        <button class="add-contact-btn small-btn" data-user-id="${user._id}" 
                                ${AppState.contacts.some(c => c._id === user._id) ? 'disabled' : ''}>
                            ${AppState.contacts.some(c => c._id === user._id) ? 'Already Added' : 'Add Contact'}
                        </button>
                    </div>
                `).join('');

                // Add event listeners to add buttons
                searchResults.querySelectorAll('.add-contact-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const userId = btn.dataset.userId;
                        await this.addContact(userId);
                    });
                });
            }
        } catch (error) {
            console.error('Search error:', error);
            NotificationManager.show('Failed to search user', 'error');
        }
    }

    static async addContact(userId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/contacts/add/${userId}`, {
                method: 'POST',
                headers: { 'authenticate': `Bearer ${AppState.accessToken}` }
            });

            if (response.ok) {
                NotificationManager.show('Contact added successfully!', 'success');
                await this.loadContacts();
                document.getElementById('addContactModal').style.display = 'none';
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to add contact');
            }
        } catch (error) {
            NotificationManager.show(error.message, 'error');
        }
    }

    static showFindUsersModal() {
        this.showAddContactModal();
    }

    static setupEventListeners() {
        DOM.sendMessageBtn?.addEventListener('click', () => this.sendMessage());

        DOM.chatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Setup action buttons
        this.setupActionButtons();

        // Auto-refresh messages every 30 seconds (fallback)
        setInterval(() => {
            if (AppState.currentChatUserId && AppState.socket?.connected) {
                this.loadPrivateChatHistory(AppState.currentChatUserId);
            }
        }, 30000);
    }
}

// ==================== UI MANAGER ====================
class UIManager {
    static updateContentForUser() {
        if (!DOM.welcomeTitle || !DOM.welcomeMessage || !DOM.userStats) return;

        if (AppState.currentUser) {
            DOM.welcomeTitle.textContent = `Welcome back, ${AppState.currentUser.name}!`;
            DOM.welcomeMessage.textContent = 'Ready to continue your learning journey?';

            DOM.userStats.innerHTML = this.getUserStatsHTML();
            DOM.userStats.style.display = 'block';

            this.setupLogoutButton();
        } else {
            DOM.welcomeTitle.textContent = 'Welcome to Catalyst';
            DOM.welcomeMessage.textContent = 'Your personalized learning accelerator platform. Start winning with smart study tools, games, notes, and mock tests.';
            DOM.userStats.style.display = 'none';
        }
    }

    static getUserStatsHTML() {
        return `
            <div class="user-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px;">
                <div class="stat-card">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">0</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Study Hours</div>
                </div>
                <div class="stat-card">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--accent);">0</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Notes Created</div>
                </div>
                <div class="stat-card">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--highlight);">0</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">Streak Days</div>
                </div>
            </div>
            <button id="logoutBtn" style="margin-top: 30px; padding: 12px 24px; background: var(--primary); color: white; border: none; border-radius: var(--radius); cursor: pointer;">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        `;
    }

    static setupLogoutButton() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', AuthManager.logout);
        }
    }

    static setupTabNavigation() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const tabId = this.dataset.tab;

                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                const targetTab = document.getElementById(`${tabId}-tab`);
                if (targetTab) {
                    targetTab.classList.add('active');
                }

                if (tabId === 'chat' && AppState.currentUser && !AppState.socket) {
                    SocketManager.init();
                }
            });
        });
    }
}

// ==================== NOTIFICATION POPUP ====================
class NotificationPopup {
    static init() {
        if (!DOM.notificationBtn || !DOM.notificationPopup) return;

        DOM.notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.notificationPopup.classList.toggle('show');
            DOM.authWindow?.classList.remove('show');
        });

        document.addEventListener('click', (e) => {
            if (!DOM.notificationBtn?.contains(e.target) && !DOM.notificationPopup?.contains(e.target)) {
                DOM.notificationPopup.classList.remove('show');
            }
        });
    }
}






// ==================== NOTES MANAGER (Unit-Based Architecture) ====================
class NotesManager {
    static availableUnits = [];      // Array of unit objects from backend [{title, url}, ...]
    static currentUnit = null;       // Currently selected unit
    static currentUnitData = null;   // Loaded JSON for current unit
    static topics = [];              // Topics in current unit
    static currentTopicIndex = -1;   // Currently selected topic index
    static userProgress = {};        // User progress data {unitId: {completedTopics, totalTopics}, topicId: {completed}}
    static isInUnitsView = true;     // Are we viewing units list or topics list?

    static async init() {
        try {
            // Add custom styles
            this.addCustomStyles();

            // Load user progress from localStorage
            this.loadUserProgress();

            // Setup event listeners
            this.setupEventListeners();

            // Load available units from server
            await this.loadAvailableUnits();
        } catch (error) {
            console.error('Failed to initialize notes:', error);
            NotificationManager.show('Failed to load notes. Please try again.', 'error');
        }
    }

    static async loadAvailableUnits() {
        try {
            this.showLoading(true, 'Loading available units...');

            // Fetch units from backend
            const response = await fetch(`${CONFIG.API_BASE_URL}/notes/urls`, {
                headers: {
                    'authenticate': `Bearer ${AppState.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const unitsArray = await response.json();
                console.log('Available units loaded:', unitsArray);

                // Store units
                this.availableUnits = unitsArray;

                // Display units list
                this.displayUnitsList();

                if (unitsArray.length > 0) {
                    NotificationManager.show(`Loaded ${unitsArray.length} study units`, 'success');
                }
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading units:', error);

            // Show error state
            this.showErrorState('Failed to load units. Please check your connection.');

            // Use fallback units for testing
            this.availableUnits = [
                { title: "Sample Unit", url: "https://gist.githubusercontent.com/username/gistid/raw" }
            ];
            this.displayUnitsList();

            NotificationManager.show('Using sample data (server unavailable)', 'warning');
        } finally {
            this.showLoading(false);
        }
    }

    static async loadUnit(unitIndex) {
        if (unitIndex < 0 || unitIndex >= this.availableUnits.length) return;

        const unit = this.availableUnits[unitIndex];
        this.currentUnit = unit;

        try {
            this.showLoading(true, `Loading ${unit.title}...`);

            // Get direct URL
            const directUrl = this.convertToDirectUrl(unit.url);
            console.log(`Loading unit from:`, directUrl);

            // Fetch unit data
            const response = await fetch(directUrl);

            if (!response.ok) {
                throw new Error(`Failed to load unit: ${response.status}`);
            }

            const data = await response.json();

            // Parse unit data based on structure
            if (data.unit && data.topics) {
                // New structure with unit metadata
                this.currentUnitData = data;
                this.topics = data.topics.sort((a, b) => (a.order || 0) - (b.order || 0));
            } else if (data.type === 'notes' && data.topics) {
                // Old structure - wrap it
                this.currentUnitData = {
                    unit: {
                        name: unit.title,
                        id: `unit_${Date.now()}`,
                        contentType: 'notes',
                        createdAt: new Date().toISOString(),
                        totalTopics: data.topics.length,
                        totalBlocks: data.topics.reduce((sum, topic) => sum + (topic.blocks?.length || 0), 0)
                    },
                    topics: data.topics
                };
                this.topics = data.topics;
            } else {
                throw new Error('Invalid unit data format');
            }

            // Update user progress for this unit
            this.updateUnitProgress(unit.title, this.topics.length);

            // Switch to topics view
            this.switchToTopicsView();

            // Display topics
            this.displayTopicsList();

            // Update progress stats
            this.updateProgressStats();

            NotificationManager.show(`${unit.title} loaded successfully!`, 'success');

        } catch (error) {
            console.error('Error loading unit:', error);
            NotificationManager.show(`Failed to load ${unit.title}: ${error.message}`, 'error');
            this.showErrorState(`Failed to load ${unit.title}`);

            // Go back to units view
            this.switchToUnitsView();
        } finally {
            this.showLoading(false);
        }
    }

    static async loadTopic(topicIndex) {
        if (topicIndex < 0 || topicIndex >= this.topics.length) return;

        this.currentTopicIndex = topicIndex;
        const topic = this.topics[topicIndex];

        // Update active state in sidebar
        document.querySelectorAll('.topic-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeItem = document.querySelector(`.topic-item[data-topic-index="${topicIndex}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // Update header with unit and topic info
        this.updateTopicHeader(topic);

        // Show action buttons
        document.getElementById('bookmarkBtn').style.display = 'inline-flex';
        document.getElementById('markCompleteBtn').style.display = 'inline-flex';
        document.getElementById('printNotesBtn').style.display = 'inline-flex';

        // Update button states
        this.updateBookmarkButton(topic.id);
        this.updateCompleteButton(topic.id);

        // Display topic content
        const sortedBlocks = topic.blocks ? [...topic.blocks].sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
        this.displayTopicContent(sortedBlocks, topic);

        // Update navigation
        this.updateNavigation();

        // Update user progress
        this.updateTopicProgress(topic.id, { lastAccessed: new Date().toISOString() });

        // Scroll to top
        document.getElementById('notesViewer').scrollTop = 0;
    }

    static displayUnitsList() {
        const topicsList = document.getElementById('topicsList');
        if (!topicsList) return;

        if (this.availableUnits.length === 0) {
            topicsList.innerHTML = `
                <div class="no-units">
                    <i class="fas fa-folder-open"></i>
                    <h4>No Study Units Available</h4>
                    <p>Study units will appear here once added</p>
                </div>
            `;
            return;
        }

        topicsList.innerHTML = this.availableUnits.map((unit, index) => {
            const unitProgress = this.userProgress[unit.title] || { completedTopics: 0, totalTopics: 0 };
            const completionPercentage = unitProgress.totalTopics > 0
                ? Math.round((unitProgress.completedTopics / unitProgress.totalTopics) * 100)
                : 0;

            return `
                <div class="unit-item" data-unit-index="${index}">
                    <div class="unit-icon">
                        <i class="fas fa-book"></i>
                    </div>
                    <div class="unit-info">
                        <div class="unit-title">${unit.title}</div>
                        <div class="unit-meta">
                            <span class="unit-type">
                                <i class="fas ${unit.contentType === 'mock' ? 'fa-file-alt' : 'fa-sticky-note'}"></i>
                                ${unit.contentType || 'Study Unit'}
                            </span>
                            <span class="unit-progress ${completionPercentage === 100 ? 'complete' : ''}">
                                <i class="fas fa-chart-line"></i>
                                ${completionPercentage}% Complete
                            </span>
                        </div>
                    </div>
                    <div class="unit-action">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        topicsList.querySelectorAll('.unit-item').forEach(item => {
            item.addEventListener('click', () => {
                const unitIndex = parseInt(item.dataset.unitIndex);
                this.loadUnit(unitIndex);
            });
        });

        // Update sidebar header
        this.updateSidebarHeader('units');

        // Update main content area
        this.updateMainContentForUnitsView();
    }

    static displayTopicsList() {
        const topicsList = document.getElementById('topicsList');
        if (!topicsList || !this.topics) return;

        if (this.topics.length === 0) {
            topicsList.innerHTML = `
                <div class="no-topics">
                    <i class="fas fa-book"></i>
                    <h4>No Topics in This Unit</h4>
                    <p>This unit doesn't contain any topics yet</p>
                </div>
            `;
            return;
        }

        topicsList.innerHTML = this.topics.map((topic, index) => {
            const progress = this.userProgress[topic.id] || { completed: false, lastAccessed: null };
            const isCompleted = progress.completed;

            return `
                <div class="topic-item ${isCompleted ? 'completed' : ''} ${index === this.currentTopicIndex ? 'active' : ''}" 
                     data-topic-index="${index}" data-topic-id="${topic.id}">
                    <div class="topic-order">${topic.order || index + 1}</div>
                    <div class="topic-icon">
                        <i class="fas fa-${isCompleted ? 'check-circle' : 'file-alt'}"></i>
                    </div>
                    <div class="topic-info">
                        <div class="topic-title">${topic.title}</div>
                        <div class="topic-meta">
                            <span class="topic-blocks">
                                <i class="fas fa-cube"></i> ${topic.blocks?.length || 0} blocks
                            </span>
                            <span class="topic-status">
                                ${isCompleted ? '<span class="status-completed">Completed</span>' : '<span class="status-pending">Not Started</span>'}
                            </span>
                        </div>
                    </div>
                    <div class="topic-duration">
                        <i class="far fa-clock"></i>
                        <span>${this.estimateDuration(topic.blocks)} min</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        topicsList.querySelectorAll('.topic-item').forEach(item => {
            item.addEventListener('click', () => {
                const topicIndex = parseInt(item.dataset.topicIndex);
                this.loadTopic(topicIndex);
            });
        });

        // Update sidebar header
        this.updateSidebarHeader('topics');
    }

    static switchToTopicsView() {
        this.isInUnitsView = false;

        // Show back button
        document.getElementById('backToUnitsBtn').style.display = 'flex';

        // Update search placeholder
        const searchInput = document.getElementById('notesSearch');
        if (searchInput) {
            searchInput.placeholder = 'Search topics...';
        }

        // Hide unit-specific info if any
        const unitMeta = document.getElementById('unitMeta');
        if (unitMeta) {
            unitMeta.style.display = 'none';
        }
    }

    static switchToUnitsView() {
        this.isInUnitsView = true;
        this.currentUnit = null;
        this.currentUnitData = null;
        this.topics = [];
        this.currentTopicIndex = -1;

        // Hide back button
        document.getElementById('backToUnitsBtn').style.display = 'none';

        // Update search placeholder
        const searchInput = document.getElementById('notesSearch');
        if (searchInput) {
            searchInput.placeholder = 'Search units...';
        }

        // Reset main content
        this.updateMainContentForUnitsView();

        // Hide action buttons
        document.getElementById('bookmarkBtn').style.display = 'none';
        document.getElementById('markCompleteBtn').style.display = 'none';
        document.getElementById('printNotesBtn').style.display = 'none';
        document.getElementById('notesNavigation').style.display = 'none';

        // Display units list
        this.displayUnitsList();
    }

    static updateMainContentForUnitsView() {
        const currentTopicTitle = document.getElementById('currentTopicTitle');
        const notesViewer = document.getElementById('notesViewer');

        if (currentTopicTitle) {
            currentTopicTitle.innerHTML = `
                <h2>Study Units</h2>
                <p class="subtitle">Select a unit to start learning</p>
            `;
        }

        if (notesViewer) {
            notesViewer.innerHTML = `
                <div class="units-overview">
                    <div class="overview-header">
                        <i class="fas fa-graduation-cap"></i>
                        <h3>Welcome to Study Units</h3>
                    </div>
                    <div class="overview-content">
                        <p>Each unit contains organized topics with study materials. Click on a unit from the sidebar to begin.</p>
                        <div class="units-stats">
                            <div class="stat-card">
                                <div class="stat-value">${this.availableUnits.length}</div>
                                <div class="stat-label">Available Units</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${this.getTotalTopics()}</div>
                                <div class="stat-label">Total Topics</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${this.getTotalBlocks()}</div>
                                <div class="stat-label">Study Blocks</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    static getTotalTopics() {
        // This would need to load all units to calculate accurately
        // For now, return placeholder
        return this.availableUnits.length * 5; // Estimate
    }

    static getTotalBlocks() {
        // Placeholder
        return this.availableUnits.length * 15; // Estimate
    }

    static updateTopicHeader(topic) {
        const currentTopicTitle = document.getElementById('currentTopicTitle');
        if (!currentTopicTitle) return;

        const unitName = this.currentUnit ? this.currentUnit.title : '';

        currentTopicTitle.innerHTML = `
            <span class="unit-name">${unitName}</span>
            <span class="topic-name">${topic.title}</span>
            <div class="topic-meta-header">
                <span class="topic-order">Topic ${topic.order || ''}</span>
                <span class="topic-info">
                    <i class="far fa-clock"></i> ${this.estimateDuration(topic.blocks)} min
                    <i class="fas fa-cube"></i> ${topic.blocks?.length || 0} blocks
                </span>
            </div>
        `;
    }

    static displayTopicContent(blocks, topic) {
        const notesViewer = document.getElementById('notesViewer');
        if (!notesViewer) return;

        notesViewer.innerHTML = '';

        if (!blocks || blocks.length === 0) {
            notesViewer.innerHTML = `
                <div class="no-content">
                    <i class="fas fa-file-alt"></i>
                    <h3>${topic.title}</h3>
                    <p>No content available for this topic</p>
                </div>
            `;
            return;
        }

        // Add topic description if available
        if (topic.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'topic-description';
            descDiv.innerHTML = `<p>${topic.description}</p>`;
            notesViewer.appendChild(descDiv);
        }

        // Add blocks
        blocks.forEach((block, index) => {
            const blockElement = this.createBlockElement(block, index);
            if (blockElement) {
                notesViewer.appendChild(blockElement);
            }
        });

        // Hide "no topic selected" message
        const noTopicElement = notesViewer.querySelector('.no-topic-selected');
        if (noTopicElement) {
            noTopicElement.remove();
        }

        // Show navigation
        document.getElementById('notesNavigation').style.display = 'flex';
    }

    static createBlockElement(block, index) {
        const container = document.createElement('div');
        container.className = `notes-block notes-block-${block.type} block-order-${block.order || index + 1}`;

        // Add block order badge
        if (block.order) {
            const orderBadge = document.createElement('div');
            orderBadge.className = 'block-order';
            orderBadge.textContent = block.order;
            container.appendChild(orderBadge);
        }

        switch (block.type) {
            case 'text':
                const textLines = block.value.split('\n');
                textLines.forEach(line => {
                    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                        const listItem = document.createElement('div');
                        listItem.className = 'notes-list-item';
                        listItem.innerHTML = `<i class="fas fa-circle"></i> ${line.substring(1).trim()}`;
                        container.appendChild(listItem);
                    } else if (line.trim().startsWith('#')) {
                        const headingLevel = line.match(/^#+/)[0].length;
                        const heading = document.createElement(`h${Math.min(headingLevel, 6)}`);
                        heading.textContent = line.replace(/^#+\s*/, '').trim();
                        container.appendChild(heading);
                    } else if (line.trim()) {
                        const paragraph = document.createElement('p');
                        paragraph.textContent = line.trim();
                        container.appendChild(paragraph);
                    }
                });
                break;

            case 'image':
                const imageUrl = block.url || block.value;
                container.innerHTML = `
                    <div class="notes-image-container">
                        <div class="image-title">${block.title || 'Image'}</div>
                        <img src="${imageUrl}" alt="${block.title || 'Study image'}" 
                             onerror="this.onerror=null; this.src='https://via.placeholder.com/600x400?text=Image+Not+Found'">
                        <div class="image-caption">${block.caption || ''}</div>
                    </div>
                `;
                break;

            case 'video':
                const videoUrl = block.url || block.value;
                container.innerHTML = `
                    <div class="notes-video-container">
                        <div class="video-title">${block.title || 'Video'}</div>
                        <div class="video-wrapper">
                            <iframe src="${videoUrl}" 
                                    frameborder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen></iframe>
                        </div>
                        <div class="video-description">${block.description || ''}</div>
                    </div>
                `;
                break;

            case 'code':
                container.innerHTML = `
                    <div class="notes-code-container">
                        <div class="code-header">
                            <span class="code-language">${block.language || 'code'}</span>
                            <button class="copy-code-btn" data-code="${index}">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                        <pre><code>${block.value || ''}</code></pre>
                    </div>
                `;
                break;

            default:
                return null;
        }

        return container;
    }

    static updateSidebarHeader(mode) {
        const sidebarHeader = document.querySelector('.notes-categories .category-header h3');
        if (sidebarHeader) {
            sidebarHeader.textContent = mode === 'units' ? 'Study Units' : 'Topics';
        }
    }

    static updateNavigation() {
        if (this.currentTopicIndex === -1 || !this.topics.length) {
            document.getElementById('notesNavigation').style.display = 'none';
            return;
        }

        const currentNum = this.currentTopicIndex + 1;
        const totalNum = this.topics.length;

        document.getElementById('currentTopicNumber').textContent = currentNum;
        document.getElementById('totalTopics').textContent = totalNum;

        // Enable/disable navigation buttons
        document.getElementById('prevTopicBtn').disabled = this.currentTopicIndex <= 0;
        document.getElementById('nextTopicBtn').disabled = this.currentTopicIndex >= totalNum - 1;
    }

    static loadNextTopic() {
        if (this.currentTopicIndex < this.topics.length - 1) {
            this.loadTopic(this.currentTopicIndex + 1);
        }
    }

    static loadPreviousTopic() {
        if (this.currentTopicIndex > 0) {
            this.loadTopic(this.currentTopicIndex - 1);
        }
    }

    static estimateDuration(blocks) {
        if (!blocks) return 5;
        const textBlocks = blocks.filter(b => b.type === 'text');
        const totalText = textBlocks.reduce((sum, block) => sum + (block.value?.length || 0), 0);
        return Math.max(1, Math.ceil(totalText / 1000)); // 1000 chars = 1 minute
    }

    static convertToDirectUrl(url) {
        console.log('Converting URL:', url);

        // GitHub Gist
        if (url.includes('gist.github.com')) {
            const match = url.match(/gist\.github\.com\/([^\/]+)\/([^\/]+)/);
            if (match) {
                const username = match[1];
                const gistId = match[2];
                return `https://gist.githubusercontent.com/${username}/${gistId}/raw`;
            }
        }

        // GitHub raw
        if (url.includes('raw.githubusercontent.com') || url.includes('gist.githubusercontent.com')) {
            return url;
        }

        // Google Drive
        if (url.includes('drive.google.com')) {
            const patterns = [
                /\/d\/([a-zA-Z0-9_-]+)/,
                /id=([a-zA-Z0-9_-]+)/,
                /\/file\/d\/([a-zA-Z0-9_-]+)/
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    const fileId = match[1];
                    return `https://drive.google.com/uc?export=download&id=${fileId}`;
                }
            }
        }

        return url; // Return as-is
    }

    static searchContent(query) {
        if (!query.trim()) {
            if (this.isInUnitsView) {
                this.displayUnitsList();
            } else if (this.topics) {
                this.displayTopicsList();
            }
            return;
        }

        const normalizedQuery = query.toLowerCase().trim();

        if (this.isInUnitsView) {
            // Search units
            const filteredUnits = this.availableUnits.filter(unit =>
                unit.title.toLowerCase().includes(normalizedQuery) ||
                (unit.description && unit.description.toLowerCase().includes(normalizedQuery))
            );
            this.displayFilteredUnits(filteredUnits);
        } else {
            // Search topics
            const filteredTopics = this.topics.filter(topic => {
                if (topic.title.toLowerCase().includes(normalizedQuery)) return true;
                if (topic.description && topic.description.toLowerCase().includes(normalizedQuery)) return true;
                if (topic.blocks) {
                    return topic.blocks.some(block =>
                        block.type === 'text' &&
                        block.value.toLowerCase().includes(normalizedQuery)
                    );
                }
                return false;
            });
            this.displayFilteredTopics(filteredTopics);
        }
    }

    static displayFilteredUnits(filteredUnits) {
        const topicsList = document.getElementById('topicsList');
        if (!topicsList) return;

        if (filteredUnits.length === 0) {
            topicsList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h4>No Units Found</h4>
                    <p>No units match your search</p>
                </div>
            `;
            return;
        }

        topicsList.innerHTML = filteredUnits.map((unit, index) => {
            const originalIndex = this.availableUnits.findIndex(u => u.title === unit.title);
            return `
                <div class="unit-item" data-unit-index="${originalIndex}">
                    <div class="unit-icon">
                        <i class="fas fa-book"></i>
                    </div>
                    <div class="unit-info">
                        <div class="unit-title">${unit.title}</div>
                        <div class="unit-meta">
                            <span class="unit-type">Search Result</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        topicsList.querySelectorAll('.unit-item').forEach(item => {
            item.addEventListener('click', () => {
                const unitIndex = parseInt(item.dataset.unitIndex);
                this.loadUnit(unitIndex);
            });
        });
    }

    static displayFilteredTopics(filteredTopics) {
        const topicsList = document.getElementById('topicsList');
        if (!topicsList) return;

        if (filteredTopics.length === 0) {
            topicsList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h4>No Topics Found</h4>
                    <p>No topics match your search</p>
                </div>
            `;
            return;
        }

        topicsList.innerHTML = filteredTopics.map((topic, index) => {
            const originalIndex = this.topics.findIndex(t => t.id === topic.id);
            const progress = this.userProgress[topic.id] || { completed: false };
            const isCompleted = progress.completed;

            return `
                <div class="topic-item ${isCompleted ? 'completed' : ''}" 
                     data-topic-index="${originalIndex}" data-topic-id="${topic.id}">
                    <div class="topic-order">${topic.order || ''}</div>
                    <div class="topic-icon">
                        <i class="fas fa-${isCompleted ? 'check-circle' : 'file-alt'}"></i>
                    </div>
                    <div class="topic-info">
                        <div class="topic-title">${topic.title}</div>
                        <div class="topic-meta">
                            <span class="search-match">Search Result</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        topicsList.querySelectorAll('.topic-item').forEach(item => {
            item.addEventListener('click', () => {
                const topicIndex = parseInt(item.dataset.topicIndex);
                this.loadTopic(topicIndex);
            });
        });
    }

    static toggleBookmark() {
        if (this.currentTopicIndex === -1) return;

        const topicId = this.topics[this.currentTopicIndex].id;
        const currentBookmarks = JSON.parse(localStorage.getItem('bookmarkedTopics') || '[]');

        if (currentBookmarks.includes(topicId)) {
            const updatedBookmarks = currentBookmarks.filter(id => id !== topicId);
            localStorage.setItem('bookmarkedTopics', JSON.stringify(updatedBookmarks));
            NotificationManager.show('Removed from bookmarks', 'info');
        } else {
            currentBookmarks.push(topicId);
            localStorage.setItem('bookmarkedTopics', JSON.stringify(currentBookmarks));
            NotificationManager.show('Added to bookmarks', 'success');
        }

        this.updateBookmarkButton(topicId);
    }

    static updateBookmarkButton(topicId) {
        const bookmarkBtn = document.getElementById('bookmarkBtn');
        if (!bookmarkBtn) return;

        const currentBookmarks = JSON.parse(localStorage.getItem('bookmarkedTopics') || '[]');
        const isBookmarked = currentBookmarks.includes(topicId);

        bookmarkBtn.innerHTML = isBookmarked
            ? '<i class="fas fa-bookmark"></i>'
            : '<i class="far fa-bookmark"></i>';

        bookmarkBtn.title = isBookmarked ? 'Remove Bookmark' : 'Add Bookmark';
    }

    static toggleComplete() {
        if (this.currentTopicIndex === -1) return;

        const topicId = this.topics[this.currentTopicIndex].id;
        const currentProgress = this.userProgress[topicId] || { completed: false, lastAccessed: null };

        currentProgress.completed = !currentProgress.completed;
        currentProgress.completedAt = currentProgress.completed ? new Date().toISOString() : null;

        this.userProgress[topicId] = currentProgress;
        this.saveUserProgress();

        // Update UI
        this.updateCompleteButton(topicId);
        this.updateTopicInSidebar(topicId);
        this.updateProgressStats();

        // Update unit progress
        if (this.currentUnit) {
            this.updateUnitProgress(this.currentUnit.title, this.topics.length);
        }

        NotificationManager.show(
            currentProgress.completed ? 'Marked as complete!' : 'Marked as incomplete',
            currentProgress.completed ? 'success' : 'info'
        );
    }

    static updateCompleteButton(topicId) {
        const completeBtn = document.getElementById('markCompleteBtn');
        if (!completeBtn) return;

        const progress = this.userProgress[topicId] || { completed: false };
        const isCompleted = progress.completed;

        completeBtn.innerHTML = isCompleted
            ? '<i class="fas fa-check-circle"></i>'
            : '<i class="far fa-check-circle"></i>';

        completeBtn.title = isCompleted ? 'Mark as Incomplete' : 'Mark as Complete';
    }

    static updateTopicInSidebar(topicId) {
        const topicItem = document.querySelector(`.topic-item[data-topic-id="${topicId}"]`);
        if (!topicItem) return;

        const progress = this.userProgress[topicId] || { completed: false };
        const isCompleted = progress.completed;

        const icon = topicItem.querySelector('.topic-icon i');
        if (icon) {
            icon.className = isCompleted ? 'fas fa-check-circle' : 'fas fa-file-alt';
        }

        const status = topicItem.querySelector('.topic-status');
        if (status) {
            status.innerHTML = isCompleted
                ? '<span class="status-completed">Completed</span>'
                : '<span class="status-pending">Not Started</span>';
        }

        topicItem.classList.toggle('completed', isCompleted);
    }

    static updateUnitProgress(unitTitle, totalTopics) {
        if (!unitTitle) return;

        const completedTopics = this.topics.filter(topic => {
            const progress = this.userProgress[topic.id] || { completed: false };
            return progress.completed;
        }).length;

        this.userProgress[unitTitle] = {
            completedTopics: completedTopics,
            totalTopics: totalTopics,
            lastAccessed: new Date().toISOString()
        };

        this.saveUserProgress();
    }

    static updateTopicProgress(topicId, updates) {
        const currentProgress = this.userProgress[topicId] || { completed: false, lastAccessed: null };
        this.userProgress[topicId] = { ...currentProgress, ...updates };
        this.saveUserProgress();
    }

    static updateProgressStats() {
        const totalTopicsCount = document.getElementById('totalTopicsCount');
        const completedCount = document.getElementById('completedCount');
        const inProgressCount = document.getElementById('inProgressCount');

        if (!totalTopicsCount || !completedCount || !inProgressCount) return;

        if (this.isInUnitsView) {
            // Show overall stats
            const totalUnits = this.availableUnits.length;
            const completedUnits = Object.keys(this.userProgress)
                .filter(key => key.includes('unit') || this.availableUnits.some(u => u.title === key))
                .length;

            totalTopicsCount.textContent = totalUnits;
            completedCount.textContent = completedUnits;
            inProgressCount.textContent = totalUnits - completedUnits;
        } else {
            // Show unit-specific stats
            const totalTopics = this.topics.length;
            const completedTopics = this.topics.filter(topic => {
                const progress = this.userProgress[topic.id] || { completed: false };
                return progress.completed;
            }).length;

            totalTopicsCount.textContent = totalTopics;
            completedCount.textContent = completedTopics;
            inProgressCount.textContent = totalTopics - completedTopics;
        }
    }

    static loadUserProgress() {
        try {
            const savedProgress = localStorage.getItem('userNotesProgress');
            this.userProgress = savedProgress ? JSON.parse(savedProgress) : {};
        } catch (error) {
            console.error('Error loading user progress:', error);
            this.userProgress = {};
        }
    }

    static saveUserProgress() {
        try {
            localStorage.setItem('userNotesProgress', JSON.stringify(this.userProgress));
        } catch (error) {
            console.error('Error saving user progress:', error);
        }
    }

    static printNotes() {
        if (this.currentTopicIndex === -1) return;

        const topic = this.topics[this.currentTopicIndex];
        const unitName = this.currentUnit ? this.currentUnit.title : '';

        const printWindow = window.open('', '_blank');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${unitName} - ${topic.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
                    .unit-header { color: #666; font-size: 14px; margin-bottom: 5px; }
                    h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-top: 0; }
                    .topic-meta { color: #666; font-size: 12px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
                    .block { margin-bottom: 20px; page-break-inside: avoid; }
                    .list-item { margin: 5px 0; padding-left: 20px; }
                    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; color: #666; text-align: center; }
                </style>
            </head>
            <body>
                <div class="unit-header">${unitName}</div>
                <h1>${topic.title}</h1>
                <div class="topic-meta">
                    ${topic.order ? `Topic ${topic.order}` : ''} • Printed: ${new Date().toLocaleDateString()}
                </div>
                ${topic.blocks ? topic.blocks.sort((a, b) => (a.order || 0) - (b.order || 0)).map(block => {
            if (block.type === 'text') {
                const lines = block.value.split('\n');
                return lines.map(line => {
                    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                        return `<div class="list-item">${line}</div>`;
                    } else if (line.trim()) {
                        return `<p>${line}</p>`;
                    }
                    return '';
                }).join('');
            }
            return `<div class="block">[${block.type.toUpperCase()} CONTENT]</div>`;
        }).join('') : '<p>No content available</p>'}
                <div class="footer">
                    <p>Printed from Catalyst Learning Platform</p>
                    <p>© ${new Date().getFullYear()} Catalyst. All rights reserved.</p>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    }

    static showLoading(show, message = 'Loading...') {
        const topicsList = document.getElementById('topicsList');
        if (!topicsList) return;

        if (show) {
            topicsList.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    static showErrorState(message = 'An error occurred') {
        const topicsList = document.getElementById('topicsList');
        if (topicsList) {
            topicsList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Error</h4>
                    <p>${message}</p>
                    <button id="retryLoadBtn" class="small-btn">Try Again</button>
                </div>
            `;

            document.getElementById('retryLoadBtn')?.addEventListener('click', () => {
                if (this.isInUnitsView) {
                    this.loadAvailableUnits();
                } else if (this.currentUnit) {
                    const unitIndex = this.availableUnits.findIndex(u => u.title === this.currentUnit.title);
                    if (unitIndex !== -1) {
                        this.loadUnit(unitIndex);
                    }
                }
            });
        }
    }

    static addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Unit Item Styling */
            .unit-item {
                display: flex;
                align-items: center;
                padding: 12px;
                border-radius: var(--radius);
                background: var(--bg);
                border: 1px solid var(--border);
                cursor: pointer;
                transition: all 0.2s;
                gap: 12px;
                margin-bottom: 8px;
            }
            
            .unit-item:hover {
                background: var(--hover-bg);
                transform: translateX(2px);
            }
            
            .unit-icon {
                font-size: 18px;
                color: var(--primary);
                width: 40px;
                height: 40px;
                background: rgba(37, 99, 235, 0.1);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .unit-info {
                flex: 1;
                min-width: 0;
            }
            
            .unit-title {
                font-weight: 600;
                margin-bottom: 4px;
                color: var(--text-primary);
                font-size: 15px;
            }
            
            .unit-meta {
                display: flex;
                gap: 10px;
                font-size: 12px;
                color: var(--text-secondary);
            }
            
            .unit-type, .unit-progress {
                display: flex;
                align-items: center;
                gap: 4px;
                background: rgba(37, 99, 235, 0.1);
                color: var(--primary);
                padding: 2px 8px;
                border-radius: 10px;
            }
            
            .unit-progress.complete {
                background: rgba(34, 197, 94, 0.1);
                color: var(--success);
            }
            
            .unit-action {
                color: var(--text-tertiary);
                font-size: 12px;
            }
            
            /* Units Overview */
            .units-overview {
                background: var(--card-bg);
                border-radius: var(--radius);
                padding: 30px;
                text-align: center;
                box-shadow: var(--shadow-sm);
            }
            
            .overview-header {
                margin-bottom: 20px;
            }
            
            .overview-header i {
                font-size: 48px;
                color: var(--primary);
                margin-bottom: 15px;
            }
            
            .overview-header h3 {
                margin: 0;
                color: var(--text-primary);
            }
            
            .overview-content p {
                color: var(--text-secondary);
                margin-bottom: 25px;
                line-height: 1.6;
            }
            
            .units-stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-top: 20px;
            }
            
            .stat-card {
                background: var(--bg);
                border-radius: var(--radius);
                padding: 15px;
                border: 1px solid var(--border);
            }
            
            .stat-value {
                font-size: 24px;
                font-weight: bold;
                color: var(--primary);
                margin-bottom: 5px;
            }
            
            .stat-label {
                font-size: 12px;
                color: var(--text-secondary);
            }
            
            /* Header Styling */
            .subtitle {
                color: var(--text-secondary);
                font-size: 14px;
                margin-top: 5px;
            }
            
            .unit-name {
                display: block;
                font-size: 14px;
                color: var(--text-secondary);
                margin-bottom: 5px;
            }
            
            .topic-name {
                display: block;
                font-size: 22px;
                color: var(--text-primary);
                font-weight: 600;
            }
            
            .topic-meta-header {
                display: flex;
                gap: 15px;
                margin-top: 10px;
                font-size: 13px;
                color: var(--text-secondary);
            }
            
            .topic-order {
                background: var(--primary);
                color: white;
                padding: 4px 10px;
                border-radius: 12px;
                font-weight: bold;
            }
            
            .topic-info {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            
            /* Loading and Error States */
            .loading-state, .error-state, .no-units, .no-topics, .no-results {
                text-align: center;
                padding: 40px 20px;
                color: var(--text-secondary);
            }
            
            .loading-state i, .error-state i, .no-units i, .no-topics i, .no-results i {
                font-size: 36px;
                margin-bottom: 15px;
                color: var(--text-tertiary);
            }
            
            .error-state h4, .no-units h4, .no-topics h4, .no-results h4 {
                margin: 0 0 10px 0;
                color: var(--text-primary);
            }
            
            /* Back Button */
            .back-to-units-btn {
                background: var(--border);
                color: var(--text-primary);
                border: none;
                padding: 8px 15px;
                border-radius: var(--radius);
                font-size: 13px;
                cursor: pointer;
                display: none;
                align-items: center;
                gap: 8px;
                margin-left: auto;
            }
            
            .back-to-units-btn:hover {
                background: var(--hover-bg);
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .units-stats {
                    grid-template-columns: 1fr;
                }
                
                .unit-meta {
                    flex-direction: column;
                    gap: 5px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    static setupEventListeners() {
        // Navigation buttons
        document.getElementById('prevTopicBtn')?.addEventListener('click', () => {
            this.loadPreviousTopic();
        });

        document.getElementById('nextTopicBtn')?.addEventListener('click', () => {
            this.loadNextTopic();
        });

        // Action buttons
        document.getElementById('bookmarkBtn')?.addEventListener('click', () => {
            this.toggleBookmark();
        });

        document.getElementById('markCompleteBtn')?.addEventListener('click', () => {
            this.toggleComplete();
        });

        document.getElementById('printNotesBtn')?.addEventListener('click', () => {
            this.printNotes();
        });

        // Create and setup back button
        const backBtn = document.createElement('button');
        backBtn.id = 'backToUnitsBtn';
        backBtn.className = 'back-to-units-btn';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Units';
        backBtn.style.display = 'none';

        const categoryHeader = document.querySelector('.category-header');
        if (categoryHeader) {
            categoryHeader.appendChild(backBtn);
        }

        backBtn.addEventListener('click', () => {
            this.switchToUnitsView();
        });

        // Search
        const notesSearch = document.getElementById('notesSearch');
        if (notesSearch) {
            notesSearch.addEventListener('input', Utils.debounce((e) => {
                this.searchContent(e.target.value);
            }, 300));
        }

        // Refresh button
        document.getElementById('refreshNotesBtn')?.addEventListener('click', async () => {
            const btn = document.getElementById('refreshNotesBtn');
            const icon = btn?.querySelector('i');
            if (icon) icon.classList.add('fa-spin');

            if (this.isInUnitsView) {
                await this.loadAvailableUnits();
            } else if (this.currentUnit) {
                const unitIndex = this.availableUnits.findIndex(u => u.title === this.currentUnit.title);
                if (unitIndex !== -1) {
                    await this.loadUnit(unitIndex);
                }
            }

            if (icon) icon.classList.remove('fa-spin');
            NotificationManager.show('Refreshed successfully', 'success');
        });

        // Tab switch
        document.addEventListener('tabChange', (e) => {
            if (e.detail.tabId === 'notes') {
                if (this.availableUnits.length === 0) {
                    this.loadAvailableUnits();
                }
            }
        });
    }
}

// ==================== MOCK TESTS MANAGER ====================
// ==================== MOCK TESTS MANAGER (COMPLETE) ====================
class MockManager {
    static availableMocks = [];
    static currentMock = null;
    static currentMockData = null;
    static originalQuestions = [];
    static questions = [];
    static currentQuestionIndex = -1;
    static userAnswers = {};
    static score = 0;
    static isTestActive = false;
    static isInReviewMode = false;
    static timerInterval = null;
    static timerSeconds = 0;

    static async init() {
        try {
            this.addCustomStyles();
            this.loadUserAnswers();
            this.setupEventListeners();
            await this.loadAvailableMocks();
        } catch (error) {
            console.error('Failed to initialize mocks:', error);
            NotificationManager.show('Failed to load mock tests. Please try again.', 'error');
        }
    }

    static async loadAvailableMocks() {
        try {
            this.showLoading(true, 'Loading available mock tests...');

            const response = await fetch(`${CONFIG.API_BASE_URL}/mocks/urls`, {
                headers: {
                    'authenticate': `Bearer ${AppState.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const mocksArray = await response.json();
                this.availableMocks = mocksArray;
                this.displayMocksList();

                if (mocksArray.length > 0) {
                    NotificationManager.show(`Loaded ${mocksArray.length} mock tests`, 'success');
                }
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading mocks:', error);
            this.showErrorState('Failed to load mock tests. Please check your connection.');

            // Fallback data
            this.availableMocks = [
                {
                    title: "Sample Mock Test",
                    url: "https://gist.githubusercontent.com/username/gistid/raw/sample-mock.json",
                    duration: 30,
                    questionCount: 10
                }
            ];
            this.displayMocksList();
            NotificationManager.show('Using sample data (server unavailable)', 'warning');
        } finally {
            this.showLoading(false);
        }
    }

    static async loadMock(mockIndex) {
        if (mockIndex < 0 || mockIndex >= this.availableMocks.length) return;

        const mock = this.availableMocks[mockIndex];
        this.currentMock = mock;

        try {
            this.showLoading(true, `Loading ${mock.title}...`);

            const directUrl = this.convertToDirectUrl(mock.url);
            console.log('Loading mock from:', directUrl);

            const response = await fetch(directUrl);

            if (!response.ok) {
                throw new Error(`Failed to load mock: ${response.status}`);
            }

            const data = await response.json();

            if (data.questions && Array.isArray(data.questions)) {
                this.currentMockData = data;
                this.originalQuestions = JSON.parse(JSON.stringify(data.questions)); // Deep copy
                this.prepareNewTest(); // This will shuffle and prepare questions
                this.isTestActive = true;
                this.isInReviewMode = false;

                this.startTest();
                NotificationManager.show(`${mock.title} loaded successfully!`, 'success');
            } else {
                throw new Error('Invalid mock data format');
            }

        } catch (error) {
            console.error('Error loading mock:', error);
            NotificationManager.show(`Failed to load ${mock.title}: ${error.message}`, 'error');
            this.showErrorState(`Failed to load ${mock.title}`);
            this.backToMocksList();
        } finally {
            this.showLoading(false);
        }
    }

    static prepareNewTest() {
        // Reset everything
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.score = 0;

        // Deep copy and shuffle questions
        const questionsCopy = JSON.parse(JSON.stringify(this.originalQuestions));

        // Shuffle the questions array
        for (let i = questionsCopy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questionsCopy[i], questionsCopy[j]] = [questionsCopy[j], questionsCopy[i]];
        }

        // Process each question: shuffle options and store them
        this.questions = questionsCopy.map((question, index) => {
            // Create options array with correct flag
            const options = [
                { text: question.Correct, isCorrect: true, id: 'correct' },
                { text: question.OptionOne, isCorrect: false, id: 'option1' },
                { text: question.OptionTwo, isCorrect: false, id: 'option2' },
                { text: question.OptionThree, isCorrect: false, id: 'option3' }
            ];

            // Shuffle options
            for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
            }

            // Return new question object with shuffled options
            return {
                id: `q${index}`,
                text: question.Question,
                original: {
                    Correct: question.Correct,
                    OptionOne: question.OptionOne,
                    OptionTwo: question.OptionTwo,
                    OptionThree: question.OptionThree
                },
                shuffledOptions: options
            };
        });

        console.log('Questions prepared:', this.questions.length);
        console.log('First question options:', this.questions[0]?.shuffledOptions);
    }

    static startTest() {
        this.updateTestHeader();
        this.displayCurrentQuestion();
        this.updateNavigation();

        // Show/Hide elements
        document.getElementById('mockSubmitBtn').style.display = 'none';
        document.getElementById('mockResultSection').style.display = 'none';
        document.getElementById('mocksList').style.display = 'none';
        document.getElementById('questionSection').style.display = 'block';
        document.getElementById('mockNavigation').style.display = 'flex';

        // Start timer if duration is specified
        if (this.currentMock.duration) {
            this.startTimer(this.currentMock.duration * 60);
        }
    }

    static displayCurrentQuestion() {
        if (this.currentQuestionIndex < 0 || this.currentQuestionIndex >= this.questions.length) {
            return;
        }

        const question = this.questions[this.currentQuestionIndex];
        const questionSection = document.getElementById('questionSection');
        const userAnswerIndex = this.userAnswers[this.currentQuestionIndex];

        if (!questionSection) return;

        questionSection.innerHTML = `
            <div class="question-header">
                <div class="question-number">Question ${this.currentQuestionIndex + 1} of ${this.questions.length}</div>
                <div class="question-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${((this.currentQuestionIndex + 1) / this.questions.length) * 100}%"></div>
                    </div>
                </div>
            </div>
            
            <div class="question-content">
                <div class="question-text">${this.escapeHtml(question.text)}</div>
                
                <div class="options-container">
                    ${question.shuffledOptions.map((option, index) => {
            let className = 'option-item';
            if (userAnswerIndex === index) className += ' selected';
            if (this.isInReviewMode) {
                if (option.isCorrect) className += ' correct-answer';
                if (userAnswerIndex === index && !option.isCorrect) className += ' wrong-answer';
            }

            return `
                            <div class="${className}" 
                                 data-option-index="${index}"
                                 data-is-correct="${option.isCorrect}">
                                <div class="option-letter">${String.fromCharCode(65 + index)}</div>
                                <div class="option-text">${this.escapeHtml(option.text)}</div>
                                <div class="option-check">
                                    <i class="fas fa-check"></i>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
                
                ${this.isInReviewMode ? this.getExplanationHTML(question, userAnswerIndex) : ''}
                
                <div class="question-note">
                    <i class="fas fa-info-circle"></i>
                    ${this.isInReviewMode ? 'Reviewing answers' : 'Select the correct answer by clicking on an option'}
                </div>
            </div>
        `;

        // Add click handlers if not in review mode
        if (!this.isInReviewMode) {
            questionSection.querySelectorAll('.option-item').forEach(option => {
                option.addEventListener('click', () => {
                    this.selectOption(parseInt(option.dataset.optionIndex));
                });
            });
        }
    }

    static getExplanationHTML(question, userAnswerIndex) {
        const correctOption = question.shuffledOptions.find(opt => opt.isCorrect);
        const userOption = userAnswerIndex !== undefined ? question.shuffledOptions[userAnswerIndex] : null;

        return `
            <div class="answer-explanation">
                <div class="explanation-header">
                    <i class="fas fa-lightbulb"></i> Explanation
                </div>
                <div class="explanation-content">
                    ${userOption && userOption.isCorrect
                ? '<p class="correct-text">✓ Your answer is correct!</p>'
                : '<p class="incorrect-text">✗ Your answer is incorrect.</p>'
            }
                    ${userOption ? `<p><strong>Your answer:</strong> ${this.escapeHtml(userOption.text)}</p>` : ''}
                    <p><strong>Correct answer:</strong> ${this.escapeHtml(correctOption.text)}</p>
                </div>
            </div>
        `;
    }

    static selectOption(optionIndex) {
        // Remove selection from all options
        document.querySelectorAll('.option-item').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Add selection to clicked option
        const selectedOption = document.querySelector(`.option-item[data-option-index="${optionIndex}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }

        // Save answer
        this.userAnswers[this.currentQuestionIndex] = optionIndex;
        this.saveUserAnswers();

        // Auto-advance to next question after 0.5s (optional)
        setTimeout(() => {
            if (this.currentQuestionIndex < this.questions.length - 1) {
                this.nextQuestion();
            } else {
                // Show submit button on last question
                document.getElementById('mockSubmitBtn').style.display = 'block';
            }
        }, 500);
    }

    static nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.displayCurrentQuestion();
            this.updateNavigation();
        }
    }

    static previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayCurrentQuestion();
            this.updateNavigation();
        }
    }

    static submitTest() {
        this.calculateScore();
        this.showResults();
        this.isTestActive = false;
        this.stopTimer();
        this.saveBestScore();
    }

    static calculateScore() {
        let correct = 0;

        this.questions.forEach((question, index) => {
            const userAnswerIndex = this.userAnswers[index];
            if (userAnswerIndex !== undefined) {
                const selectedOption = question.shuffledOptions[userAnswerIndex];
                if (selectedOption && selectedOption.isCorrect) {
                    correct++;
                }
            }
        });

        this.score = correct;
        return correct;
    }

    static showResults() {
        const totalQuestions = this.questions.length;
        const percentage = Math.round((this.score / totalQuestions) * 100);

        document.getElementById('questionSection').style.display = 'none';
        document.getElementById('mockNavigation').style.display = 'none';

        const resultSection = document.getElementById('mockResultSection');
        resultSection.style.display = 'block';
        resultSection.innerHTML = `
            <div class="results-container">
                <div class="results-header">
                    <i class="fas fa-trophy"></i>
                    <h3>Test Completed!</h3>
                    <p>${this.currentMock.title}</p>
                </div>
                
                <div class="score-display">
                    <div class="score-circle" style="background: conic-gradient(var(--primary) ${percentage}%, var(--border) 0%)">
                        <div class="score-value">${this.score}/${totalQuestions}</div>
                        <div class="score-percentage">${percentage}%</div>
                    </div>
                    
                    <div class="score-details">
                        <div class="score-detail">
                            <span class="detail-label">Correct</span>
                            <span class="detail-value correct">${this.score}</span>
                        </div>
                        <div class="score-detail">
                            <span class="detail-label">Incorrect</span>
                            <span class="detail-value incorrect">${totalQuestions - this.score}</span>
                        </div>
                        <div class="score-detail">
                            <span class="detail-label">Unanswered</span>
                            <span class="detail-value">${totalQuestions - Object.keys(this.userAnswers).length}</span>
                        </div>
                    </div>
                </div>
                
                <div class="result-actions">
                    <button class="btn-primary" id="reviewTestBtn">
                        <i class="fas fa-eye"></i> Review Answers
                    </button>
                    <button class="btn-secondary" id="retryTestBtn">
                        <i class="fas fa-redo"></i> Retry Test
                    </button>
                    <button class="btn-outline" id="backToMocksBtn">
                        <i class="fas fa-arrow-left"></i> Back to Tests
                    </button>
                </div>
            </div>
        `;

        document.getElementById('reviewTestBtn').addEventListener('click', () => this.reviewAnswers());
        document.getElementById('retryTestBtn').addEventListener('click', () => this.retryTest());
        document.getElementById('backToMocksBtn').addEventListener('click', () => this.backToMocksList());
    }

    static reviewAnswers() {
        this.isInReviewMode = true;
        this.currentQuestionIndex = 0;

        document.getElementById('mockResultSection').style.display = 'none';
        document.getElementById('questionSection').style.display = 'block';
        document.getElementById('mockNavigation').style.display = 'flex';

        const submitBtn = document.getElementById('mockSubmitBtn');
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Show Answer';
        submitBtn.onclick = () => this.showAnswerReview();
        submitBtn.style.display = 'block';

        this.displayCurrentQuestion();
        this.updateNavigation();
    }

    static showAnswerReview() {
        // In review mode, we already show explanations
        // Just advance to next question or finish
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.nextQuestion();
        } else {
            const submitBtn = document.getElementById('mockSubmitBtn');
            submitBtn.innerHTML = '<i class="fas fa-flag-checkered"></i> Finish Review';
            submitBtn.onclick = () => {
                this.isInReviewMode = false;
                this.backToMocksList();
            };
        }
    }

    static retryTest() {
        this.prepareNewTest(); // This reshuffles everything
        this.isTestActive = true;
        this.isInReviewMode = false;
        this.startTest();
        NotificationManager.show('Starting new test with reshuffled questions!', 'success');
    }

    static backToMocksList() {
        this.currentMock = null;
        this.currentMockData = null;
        this.originalQuestions = [];
        this.questions = [];
        this.currentQuestionIndex = -1;
        this.userAnswers = {};
        this.score = 0;
        this.isTestActive = false;
        this.isInReviewMode = false;

        this.stopTimer();

        document.getElementById('questionSection').style.display = 'none';
        document.getElementById('mockResultSection').style.display = 'none';
        document.getElementById('mockNavigation').style.display = 'none';
        document.getElementById('mocksList').style.display = 'block';

        const submitBtn = document.getElementById('mockSubmitBtn');
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Test';
        submitBtn.onclick = () => this.submitTest();
        submitBtn.style.display = 'none';

        this.displayMocksList();
    }

    static displayMocksList() {
        const mocksList = document.getElementById('mocksList');
        if (!mocksList) return;

        if (this.availableMocks.length === 0) {
            mocksList.innerHTML = `
                <div class="no-mocks">
                    <i class="fas fa-file-alt"></i>
                    <h4>No Mock Tests Available</h4>
                    <p>Mock tests will appear here once added</p>
                </div>
            `;
            return;
        }

        mocksList.innerHTML = this.availableMocks.map((mock, index) => {
            const bestScore = this.getBestScore(mock.title);

            return `
                <div class="mock-item" data-mock-index="${index}">
                    <div class="mock-icon">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div class="mock-info">
                        <div class="mock-title">${mock.title}</div>
                        <div class="mock-meta">
                            <span class="mock-questions">
                                <i class="fas fa-question-circle"></i>
                                ${mock.questionCount || '?'} questions
                            </span>
                            <span class="mock-duration">
                                <i class="far fa-clock"></i>
                                ${mock.duration || '--'} min
                            </span>
                            ${bestScore !== null ? `
                                <span class="mock-best-score">
                                    <i class="fas fa-trophy"></i>
                                    Best: ${bestScore}%
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="mock-action">
                        <i class="fas fa-play-circle"></i>
                        Start Test
                    </div>
                </div>
            `;
        }).join('');

        mocksList.querySelectorAll('.mock-item').forEach(item => {
            item.addEventListener('click', () => {
                const mockIndex = parseInt(item.dataset.mockIndex);
                this.loadMock(mockIndex);
            });
        });
    }

    static updateTestHeader() {
        const mockHeader = document.getElementById('mockHeader');
        if (!mockHeader) return;

        mockHeader.innerHTML = `
            <div class="test-header-left">
                <h2>${this.currentMock.title}</h2>
                <div class="test-meta">
                    <span class="timer-display" id="timerDisplay">
                        <i class="far fa-clock"></i>
                        <span id="timeRemaining">${this.currentMock.duration ? `${this.currentMock.duration}:00` : '--:--'}</span>
                    </span>
                    <span class="questions-count">
                        <i class="fas fa-question-circle"></i>
                        ${this.questions.length} questions
                    </span>
                </div>
            </div>
            <div class="test-header-right">
                <button class="btn-outline" id="endTestBtn">
                    <i class="fas fa-sign-out-alt"></i> End Test
                </button>
            </div>
        `;

        document.getElementById('endTestBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to end the test? Your progress will be saved.')) {
                this.submitTest();
            }
        });
    }

    static updateNavigation() {
        if (this.currentQuestionIndex === -1 || !this.questions.length) {
            document.getElementById('mockNavigation').style.display = 'none';
            return;
        }

        document.getElementById('currentQuestionNumber').textContent = this.currentQuestionIndex + 1;
        document.getElementById('totalQuestions').textContent = this.questions.length;

        document.getElementById('prevQuestionBtn').disabled = this.currentQuestionIndex <= 0;
        document.getElementById('nextQuestionBtn').disabled = this.currentQuestionIndex >= this.questions.length - 1;

        // Show submit button only on last question and not in review mode
        const submitBtn = document.getElementById('mockSubmitBtn');
        if (this.currentQuestionIndex === this.questions.length - 1 && !this.isInReviewMode) {
            submitBtn.style.display = 'block';
        } else if (!this.isInReviewMode) {
            submitBtn.style.display = 'none';
        }
    }

    static startTimer(totalSeconds) {
        this.timerSeconds = totalSeconds;
        this.updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            this.timerSeconds--;
            this.updateTimerDisplay();

            if (this.timerSeconds <= 0) {
                this.stopTimer();
                NotificationManager.show('Time is up! Submitting test...', 'warning');
                setTimeout(() => this.submitTest(), 1000);
            }
        }, 1000);
    }

    static stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    static updateTimerDisplay() {
        const minutes = Math.floor(this.timerSeconds / 60);
        const seconds = this.timerSeconds % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const timerElement = document.getElementById('timeRemaining');
        if (timerElement) {
            timerElement.textContent = timeString;

            if (this.timerSeconds < 300) {
                timerElement.parentElement.classList.add('time-warning');
            }
            if (this.timerSeconds < 60) {
                timerElement.parentElement.classList.add('time-critical');
            }
        }
    }

    static getBestScore(mockTitle) {
        try {
            const scores = JSON.parse(localStorage.getItem('mockScores') || '{}');
            return scores[mockTitle] || null;
        } catch {
            return null;
        }
    }

    static saveBestScore() {
        if (!this.currentMock) return;

        const totalQuestions = this.questions.length;
        const percentage = Math.round((this.score / totalQuestions) * 100);

        try {
            const scores = JSON.parse(localStorage.getItem('mockScores') || '{}');
            const currentBest = scores[this.currentMock.title];

            if (!currentBest || percentage > currentBest) {
                scores[this.currentMock.title] = percentage;
                localStorage.setItem('mockScores', JSON.stringify(scores));
                console.log('Saved best score:', percentage, '% for', this.currentMock.title);
            }
        } catch (error) {
            console.error('Error saving score:', error);
        }
    }

    static loadUserAnswers() {
        try {
            const saved = localStorage.getItem(`mockAnswers_${this.currentMock?.title}`);
            this.userAnswers = saved ? JSON.parse(saved) : {};
        } catch {
            this.userAnswers = {};
        }
    }

    static saveUserAnswers() {
        if (this.currentMock) {
            try {
                localStorage.setItem(`mockAnswers_${this.currentMock.title}`, JSON.stringify(this.userAnswers));
            } catch (error) {
                console.error('Error saving answers:', error);
            }
        }
    }

    static convertToDirectUrl(url) {
        // Same conversion logic as NotesManager
        if (url.includes('gist.github.com')) {
            const match = url.match(/gist\.github\.com\/([^\/]+)\/([^\/]+)/);
            if (match) {
                const username = match[1];
                const gistId = match[2];
                return `https://gist.githubusercontent.com/${username}/${gistId}/raw`;
            }
        }

        if (url.includes('raw.githubusercontent.com') || url.includes('gist.githubusercontent.com')) {
            return url;
        }

        if (url.includes('drive.google.com')) {
            const patterns = [
                /\/d\/([a-zA-Z0-9_-]+)/,
                /id=([a-zA-Z0-9_-]+)/,
                /\/file\/d\/([a-zA-Z0-9_-]+)/
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    const fileId = match[1];
                    return `https://drive.google.com/uc?export=download&id=${fileId}`;
                }
            }
        }

        return url;
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static showLoading(show, message = 'Loading...') {
        const mocksList = document.getElementById('mocksList');
        if (!mocksList) return;

        if (show) {
            mocksList.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    static showErrorState(message = 'An error occurred') {
        const mocksList = document.getElementById('mocksList');
        if (mocksList) {
            mocksList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Error</h4>
                    <p>${message}</p>
                    <button id="retryLoadMocksBtn" class="small-btn">Try Again</button>
                </div>
            `;

            document.getElementById('retryLoadMocksBtn')?.addEventListener('click', () => {
                this.loadAvailableMocks();
            });
        }
    }

    static addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Mock Tests Styles */
            .mock-container {
                display: flex;
                flex-direction: column;
                height: calc(100vh - 140px);
                background: var(--card-bg);
                border-radius: var(--radius);
                overflow: hidden;
                box-shadow: var(--shadow-md);
            }
            
            .mock-header {
                padding: 20px;
                border-bottom: 1px solid var(--border);
                background: var(--card-bg);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .test-header-left h2 {
                margin: 0 0 8px 0;
                font-size: 22px;
                color: var(--text-primary);
            }
            
            .test-meta {
                display: flex;
                gap: 15px;
                font-size: 13px;
                color: var(--text-secondary);
            }
            
            .timer-display {
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 5px 10px;
                background: var(--bg);
                border-radius: 20px;
            }
            
            .timer-display.time-warning {
                background: rgba(245, 158, 11, 0.1);
                color: #f59e0b;
            }
            
            .timer-display.time-critical {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
            }
            
            #mocksList {
                padding: 20px;
                overflow-y: auto;
            }
            
            .mock-item {
                display: flex;
                align-items: center;
                padding: 15px;
                border-radius: var(--radius);
                background: var(--bg);
                border: 1px solid var(--border);
                cursor: pointer;
                transition: all 0.2s;
                gap: 15px;
                margin-bottom: 10px;
            }
            
            .mock-item:hover {
                background: var(--hover-bg);
                transform: translateX(2px);
                border-color: var(--primary);
            }
            
            .mock-icon {
                font-size: 20px;
                color: var(--primary);
                width: 50px;
                height: 50px;
                background: rgba(37, 99, 235, 0.1);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .mock-info {
                flex: 1;
                min-width: 0;
            }
            
            .mock-title {
                font-weight: 600;
                margin-bottom: 8px;
                color: var(--text-primary);
                font-size: 16px;
            }
            
            .mock-meta {
                display: flex;
                gap: 15px;
                font-size: 12px;
                color: var(--text-secondary);
            }
            
            .mock-questions, .mock-duration, .mock-best-score {
                display: flex;
                align-items: center;
                gap: 4px;
                background: rgba(37, 99, 235, 0.1);
                color: var(--primary);
                padding: 4px 10px;
                border-radius: 12px;
            }
            
            .mock-best-score {
                background: rgba(34, 197, 94, 0.1);
                color: var(--success);
            }
            
            .mock-action {
                display: flex;
                align-items: center;
                gap: 8px;
                color: white;
                font-weight: 500;
                padding: 8px 15px;
                background: var(--primary);
                border-radius: var(--radius);
                transition: all 0.2s;
            }
            
            .mock-item:hover .mock-action {
                background: var(--primary-hover);
            }
            
            #questionSection {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }
            
            .question-header {
                margin-bottom: 20px;
            }
            
            .question-number {
                font-size: 14px;
                color: var(--text-secondary);
                margin-bottom: 10px;
            }
            
            .progress-bar {
                height: 6px;
                background: var(--border);
                border-radius: 3px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: var(--primary);
                transition: width 0.3s ease;
            }
            
            .question-content {
                background: var(--bg);
                border-radius: var(--radius);
                padding: 25px;
                border: 1px solid var(--border);
            }
            
            .question-text {
                font-size: 18px;
                font-weight: 500;
                margin-bottom: 25px;
                color: var(--text-primary);
                line-height: 1.5;
            }
            
            .options-container {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .option-item {
                display: flex;
                align-items: center;
                padding: 15px;
                border-radius: var(--radius);
                border: 1px solid var(--border);
                cursor: pointer;
                transition: all 0.2s;
                gap: 15px;
            }
            
            .option-item:hover {
                background: var(--hover-bg);
                border-color: var(--primary);
            }
            
            .option-item.selected {
                background: rgba(37, 99, 235, 0.1);
                border-color: var(--primary);
                animation: optionSelect 0.2s ease;
            }
            
            .option-item.correct-answer {
                background: rgba(34, 197, 94, 0.15);
                border-color: #10b981;
            }
            
            .option-item.wrong-answer {
                background: rgba(239, 68, 68, 0.15);
                border-color: #ef4444;
            }
            
            .option-letter {
                width: 30px;
                height: 30px;
                background: var(--border);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 14px;
                flex-shrink: 0;
                transition: all 0.2s;
            }
            
            .option-item.selected .option-letter {
                background: var(--primary);
                color: white;
            }
            
            .option-item.correct-answer .option-letter {
                background: #10b981;
                color: white;
            }
            
            .option-item.wrong-answer .option-letter {
                background: #ef4444;
                color: white;
            }
            
            .option-text {
                flex: 1;
                font-size: 15px;
                line-height: 1.4;
            }
            
            .option-check {
                opacity: 0;
                color: var(--primary);
                transition: opacity 0.2s;
            }
            
            .option-item.selected .option-check {
                opacity: 1;
            }
            
            @keyframes optionSelect {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }
            
            .question-note {
                font-size: 13px;
                color: var(--text-secondary);
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px;
                background: var(--bg);
                border-radius: var(--radius);
            }
            
            .answer-explanation {
                margin-top: 25px;
                padding: 20px;
                background: var(--bg);
                border-radius: var(--radius);
                border-left: 4px solid var(--primary);
            }
            
            .explanation-header {
                font-weight: 600;
                margin-bottom: 10px;
                color: var(--text-primary);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .explanation-content {
                color: var(--text-primary);
                line-height: 1.5;
            }
            
            .correct-text {
                color: #10b981;
                font-weight: 500;
            }
            
            .incorrect-text {
                color: #ef4444;
                font-weight: 500;
            }
            
            #mockResultSection {
                padding: 20px;
                display: none;
            }
            
            .results-container {
                background: var(--bg);
                border-radius: var(--radius);
                padding: 30px;
                text-align: center;
                border: 1px solid var(--border);
            }
            
            .results-header i {
                font-size: 48px;
                color: var(--primary);
                margin-bottom: 15px;
            }
            
            .results-header h3 {
                margin: 0 0 5px 0;
                font-size: 24px;
                color: var(--text-primary);
            }
            
            .results-header p {
                color: var(--text-secondary);
                margin-bottom: 25px;
            }
            
            .score-display {
                margin: 30px 0;
            }
            
            .score-circle {
                width: 150px;
                height: 150px;
                border-radius: 50%;
                margin: 0 auto 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: relative;
            }
            
            .score-circle::before {
                content: '';
                position: absolute;
                width: 120px;
                height: 120px;
                background: var(--card-bg);
                border-radius: 50%;
            }
            
            .score-value, .score-percentage {
                position: relative;
                z-index: 1;
            }
            
            .score-value {
                font-size: 32px;
                font-weight: bold;
                color: var(--text-primary);
            }
            
            .score-percentage {
                font-size: 18px;
                color: var(--text-secondary);
            }
            
            .score-details {
                display: flex;
                justify-content: center;
                gap: 30px;
                margin-top: 20px;
            }
            
            .score-detail {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .detail-label {
                font-size: 12px;
                color: var(--text-secondary);
                margin-bottom: 5px;
            }
            
            .detail-value {
                font-size: 24px;
                font-weight: bold;
            }
            
            .detail-value.correct {
                color: #10b981;
            }
            
            .detail-value.incorrect {
                color: #ef4444;
            }
            
            .result-actions {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-top: 30px;
            }
            
            .mock-navigation {
                padding: 15px 20px;
                border-top: 1px solid var(--border);
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: var(--card-bg);
            }
            
            .btn-primary, .btn-secondary, .btn-outline {
                padding: 10px 20px;
                border-radius: var(--radius);
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s;
                border: none;
            }
            
            .btn-primary {
                background: var(--primary);
                color: white;
            }
            
            .btn-primary:hover {
                background: var(--primary-hover);
            }
            
            .btn-secondary {
                background: var(--bg);
                color: var(--text-primary);
                border: 1px solid var(--border);
            }
            
            .btn-secondary:hover {
                background: var(--hover-bg);
            }
            
            .btn-outline {
                background: transparent;
                color: var(--text-primary);
                border: 1px solid var(--border);
            }
            
            .btn-outline:hover {
                background: var(--hover-bg);
            }
            
            .no-mocks, .loading-state, .error-state {
                text-align: center;
                padding: 60px 20px;
                color: var(--text-secondary);
            }
            
            .no-mocks i, .loading-state i, .error-state i {
                font-size: 48px;
                margin-bottom: 20px;
                color: var(--text-tertiary);
            }
            
            .no-mocks h4, .error-state h4 {
                margin: 0 0 10px 0;
                color: var(--text-primary);
            }
            
            @media (max-width: 768px) {
                .mock-meta, .score-details, .result-actions {
                    flex-direction: column;
                    gap: 10px;
                }
                
                .btn-primary, .btn-secondary, .btn-outline {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;
        document.head.appendChild(style);
    }

    static setupEventListeners() {
        document.getElementById('prevQuestionBtn')?.addEventListener('click', () => {
            this.previousQuestion();
        });

        document.getElementById('nextQuestionBtn')?.addEventListener('click', () => {
            this.nextQuestion();
        });

        document.getElementById('mockSubmitBtn')?.addEventListener('click', () => {
            this.submitTest();
        });

        document.getElementById('refreshMocksBtn')?.addEventListener('click', async () => {
            const btn = document.getElementById('refreshMocksBtn');
            const icon = btn?.querySelector('i');
            if (icon) icon.classList.add('fa-spin');

            await this.loadAvailableMocks();

            if (icon) icon.classList.remove('fa-spin');
            NotificationManager.show('Mock tests refreshed', 'success');
        });

        document.addEventListener('tabChange', (e) => {
            if (e.detail.tabId === 'mocks') {
                if (this.availableMocks.length === 0) {
                    this.loadAvailableMocks();
                }
            }
        });
    }
}

class AppInitializer {
    static init() {
        this.addGlobalStyles();
        this.loadSavedSession();

        ThemeManager.init();
        NavigationManager.init();
        NotificationPopup.init();
        AuthManager.init();
        ChatManager.setupEventListeners();
        UIManager.setupTabNavigation();
        MockManager.init();

        console.log('🎯 Catalyst App Initialized');
    }

    static addGlobalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .auth-btn.logged-in { 
                background-color: var(--accent) !important; 
            }
            .auth-btn.logged-in:hover { 
                background-color: var(--accent) !important; 
                opacity: 0.9; 
            }
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: none;
                z-index: 10000;
            }
            .modal-content {
                background: var(--card-bg);
                padding: 20px;
                border-radius: var(--radius);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                margin: 50px auto;
            }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            .modal-close {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: var(--text-secondary);
            }
            .modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
            }
            .btn-primary {
                background: var(--primary);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: var(--radius);
                cursor: pointer;
            }
            .btn-secondary {
                background: var(--border);
                color: var(--text-primary);
                border: none;
                padding: 10px 20px;
                border-radius: var(--radius);
                cursor: pointer;
            }
            .small-btn {
                padding: 5px 15px;
                background: var(--primary);
                color: white;
                border: none;
                border-radius: var(--radius);
                cursor: pointer;
                font-size: 0.9rem;
            }
            .small-btn:disabled {
                background: var(--border);
                cursor: not-allowed;
            }
            .contact-avatar.online {
                color: #10b981;
            }
            .contact-avatar.offline {
                color: #9ca3af;
            }
            .contact-item {
                cursor: pointer;
                padding: 10px;
                border-radius: var(--radius);
                display: flex;
                align-items: center;
                gap: 10px;
                transition: background-color 0.2s;
            }
            .contact-item:hover {
                background-color: var(--hover-bg);
            }
            .contact-item.active {
                background-color: var(--primary);
                color: white;
            }
            .unread-count {
                background: var(--primary);
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                margin-left: auto;
            }
            .message {
                margin: 10px 0;
                padding: 10px;
                border-radius: var(--radius);
                max-width: 70%;
                word-wrap: break-word;
            }
            .message.sent {
                background-color: var(--primary);
                color: white;
                margin-left: auto;
            }
            .message.received {
                background-color: var(--hover-bg);
                color: var(--text-primary);
            }
            .fa-spin {
                animation: fa-spin 1s infinite linear;
            }
            @keyframes fa-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    static loadSavedSession() {
        const savedToken = localStorage.getItem('accessToken');
        const savedUser = localStorage.getItem('user');

        if (savedToken && savedUser) {
            try {
                AppState.accessToken = savedToken;
                AppState.currentUser = JSON.parse(savedUser);
                AuthManager.updateAuthButton();
                UIManager.updateContentForUser();
                SocketManager.init();
                ChatManager.setupActionButtons();
            } catch (error) {
                console.error('Error loading saved session:', error);
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
            }
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    AppInitializer.init();
});


class GamesManager {
    static state = {
        gameStatus: 'idle',
        currentRoom: null,
        opponent: null,
        questions: [],
        playerAnswers: {},
        opponentAnswers: {},
        timeLeft: 60,
        timer: null,
        isHost: false,
        playerName: 'Player',
        playerId: null,
        socket: null,
        scores: { player: 0, opponent: 0 },
        playerUsername: '',
        gameStartedAt: null
    };

    static API_BASE = 'http://localhost:3000';

    // Initialize
    static async init() {
        console.log('🎮 GamesManager Initialized');
        await this.getUserInfo();
        this.connectSocket();
        this.updateUI();
    }

    // Get user info
    static async getUserInfo() {
        try {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                this.state.playerName = localStorage.getItem('username') || 'Player';
                this.state.playerId = 'unknown';
                this.state.playerUsername = this.state.playerName;
                return;
            }

            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                this.state.playerId = payload.userId || 'unknown';
                this.state.playerName = payload.username || localStorage.getItem('username') || 'Player';
                this.state.playerUsername = payload.username || this.state.playerName;
                console.log(`✅ User: ${this.state.playerName} (${this.state.playerId})`);
            }
        } catch (e) {
            console.log('Could not decode token:', e);
            this.state.playerName = 'Player';
            this.state.playerId = 'unknown';
            this.state.playerUsername = 'Player';
        }
    }

    // Connect WebSocket
    static connectSocket() {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        this.state.socket = io(this.API_BASE, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        this.state.socket.on('connect', () => {
            console.log('✅ Connected');
            this.updateUI();
        });

        this.state.socket.on('gameStarted', (data) => {
            console.log('🎮 Game started via socket!');
            this.handleGameStarted(data);
        });

        this.state.socket.on('gameFinished', (data) => {
            console.log('🏁 Game finished via socket!');
            this.handleGameFinished(data);
        });

        this.state.socket.on('playerJoined', (data) => {
            console.log('👤 Player joined:', data);
            if (String(data.userId) !== String(this.state.playerId)) {
                this.state.opponent = { 
                    username: data.username, 
                    userId: data.userId 
                };
                this.updateUI();
            }
        });

        this.state.socket.on('playerLeft', (data) => {
            console.log('👤 Player left:', data);
            if (String(data.userId) !== String(this.state.playerId)) {
                this.state.opponent = null;
                this.updateUI();
            }
        });
    }

    // API call
    static async apiCall(endpoint, method = 'GET', body = null) {
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const options = { method, headers, credentials: 'include' };
            if (body) options.body = JSON.stringify(body);

            const response = await fetch(`${this.API_BASE}${endpoint}`, options);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            return await response.json();
        } catch (error) {
            console.error('❌ API Error:', error);
            throw error;
        }
    }

    // Create room
    static async createRoom() {
        try {
            const result = await this.apiCall('/games/create-private', 'POST');
            this.state.currentRoom = result.roomCode;
            this.state.gameStatus = 'waiting';
            this.state.isHost = true;
            this.state.opponent = null;
            
            if (this.state.socket) {
                this.state.socket.emit('joinGameRoom', this.state.currentRoom);
            }
            
            this.updateUI();
            alert(`✅ Room created!\nCode: ${result.roomCode}\nYou are HOST`);
        } catch (error) {
            alert('❌ Failed to create room: ' + error.message);
        }
    }

    // Join room
    static async joinRoom() {
        const roomCode = prompt('Enter room code:');
        if (!roomCode || roomCode.length !== 6) {
            alert('Invalid room code!');
            return;
        }

        try {
            const result = await this.apiCall(`/games/join-private/${roomCode.toUpperCase()}`, 'POST');
            this.state.currentRoom = result.roomCode;
            this.state.gameStatus = 'waiting';
            
            const roomInfo = await this.apiCall(`/games/room/${roomCode.toUpperCase()}`);
            
            if (roomInfo.players && roomInfo.players.length > 0) {
                const firstPlayer = roomInfo.players[0];
                this.state.isHost = (String(firstPlayer.userId) === String(this.state.playerId));
                
                for (const player of roomInfo.players) {
                    if (String(player.userId) !== String(this.state.playerId)) {
                        this.state.opponent = { 
                            username: player.username, 
                            userId: player.userId,
                            score: player.score || 0
                        };
                        this.state.scores.opponent = player.score || 0;
                    } else {
                        this.state.scores.player = player.score || 0;
                    }
                }
            }
            
            if (this.state.socket) {
                this.state.socket.emit('joinGameRoom', this.state.currentRoom);
            }
            
            this.updateUI();
            alert(`✅ Joined room ${roomCode}!\nYou are ${this.state.isHost ? 'HOST' : 'PLAYER'}`);
        } catch (error) {
            alert('❌ Failed to join room: ' + error.message);
        }
    }

    // Start game
    static async startGame() {
        if (!this.state.isHost) {
            alert('❌ Only host can start!');
            return;
        }

        if (!this.state.opponent) {
            alert('❌ Wait for player to join!');
            return;
        }

        try {
            await this.apiCall(`/games/start/${this.state.currentRoom}`, 'POST');
        } catch (error) {
            alert('❌ Failed to start: ' + error.message);
        }
    }

    // Submit answer - Frontend ONLY sends answer, backend validates
    static async submitAnswer(questionIndex, answerIndex) {
        // Check if already answered this question
        if (this.state.playerAnswers[questionIndex] !== undefined) {
            console.log(`Already answered question ${questionIndex + 1}`);
            return;
        }

        try {
            console.log(`📤 Submitting answer for Q${questionIndex + 1}: ${answerIndex}`);
            
            // Store answer locally immediately (without isCorrect - backend will tell us)
            this.state.playerAnswers[questionIndex] = {
                answerIndex: answerIndex,
                timestamp: Date.now(),
                isCorrect: null // Will be set by backend response
            };
            
            // Update UI immediately (shows selected answer)
            this.updateUI();
            
            // Send to backend for validation
            const response = await this.apiCall(`/games/answer/${this.state.currentRoom}`, 'POST', {
                questionIndex: questionIndex,
                answerIndex: answerIndex
            });
            
            console.log('📊 Backend response:', response);
            
            // Update local answer with correctness from backend
            if (response.isCorrect !== undefined) {
                this.state.playerAnswers[questionIndex].isCorrect = response.isCorrect;
                this.state.playerAnswers[questionIndex].correctAnswerIndex = response.correctIndex;
                this.state.playerAnswers[questionIndex].selectedOption = response.selectedOption;
                this.state.playerAnswers[questionIndex].correctOption = response.correctOption;
            }
            
            // Update scores from response
            if (response.scores && Array.isArray(response.scores)) {
                response.scores.forEach(player => {
                    if (String(player.userId) === String(this.state.playerId)) {
                        this.state.scores.player = player.score || 0;
                    } else {
                        this.state.scores.opponent = player.score || 0;
                    }
                });
            }
            
            // Check if game finished
            if (response.gameState === 'finished') {
                this.state.gameStatus = 'finished';
                this.stopTimer();
            }
            
            this.updateUI();
            
        } catch (error) {
            console.error('Submit error:', error);
            // Remove the answer on error
            delete this.state.playerAnswers[questionIndex];
            this.updateUI();
            alert('❌ Failed to submit answer: ' + error.message);
        }
    }

    // Handle game started - NO SHUFFLING HERE
    static handleGameStarted(data) {
        console.log('🎮 Game started with data:', data);
        
        this.state.gameStatus = 'playing';
        this.state.playerAnswers = {};
        this.state.opponentAnswers = {};
        this.state.timeLeft = 60;
        this.state.scores = { player: 0, opponent: 0 };
        this.state.gameStartedAt = Date.now();
        
        if (data.questions) {
            this.state.questions = data.questions.slice(0, 5).map((q, idx) => {
                // Use questions AS-IS from backend - NO SHUFFLING
                console.log(`Q${idx + 1} from backend:`, q);
                console.log(`Correct index: ${q.correctIndex}`);
                console.log(`Options: ${JSON.stringify(q.options)}`);
                console.log(`Correct answer: "${q.options[q.correctIndex]}"`);
                return q;
            });
        }
        
        this.startTimer();
        this.updateUI();
    }

    // Timer
    static startTimer() {
        this.stopTimer();
        
        this.state.timer = setInterval(() => {
            this.state.timeLeft--;
            
            if (this.state.timeLeft <= 0) {
                this.stopTimer();
                this.forceFinishGame();
            }
            
            this.updateUI();
        }, 1000);
    }

    static stopTimer() {
        if (this.state.timer) {
            clearInterval(this.state.timer);
            this.state.timer = null;
        }
    }

    // Force finish when time's up
    static async forceFinishGame() {
        console.log('⏰ Time\'s up! Force finishing game...');
        
        try {
            // Get final scores from server
            const roomInfo = await this.apiCall(`/games/room/${this.state.currentRoom}`);
            
            if (roomInfo.players) {
                roomInfo.players.forEach(player => {
                    if (String(player.userId) === String(this.state.playerId)) {
                        this.state.scores.player = player.score || 0;
                    } else {
                        this.state.scores.opponent = player.score || 0;
                    }
                });
            }
            
            this.state.gameStatus = 'finished';
            this.updateUI();
            
            alert('⏰ Time\'s up! Game finished.');
            
        } catch (error) {
            console.error('Force finish error:', error);
            // Calculate local score as fallback (using correctIndex from backend)
            this.calculateLocalScore();
            this.state.gameStatus = 'finished';
            this.updateUI();
        }
    }

    // Calculate local score as fallback
    static calculateLocalScore() {
        let score = 0;
        for (let i = 0; i < 5; i++) {
            const answer = this.state.playerAnswers[i];
            const question = this.state.questions[i];
            
            if (answer && question && question.correctIndex !== undefined) {
                if (answer.answerIndex === question.correctIndex) {
                    score++;
                }
            }
        }
        this.state.scores.player = score;
    }

    // Handle game finished
    static handleGameFinished(data) {
        console.log('🏁 Game finished with data:', data);
        
        this.state.gameStatus = 'finished';
        this.stopTimer();
        
        if (data.scores) {
            data.scores.forEach(player => {
                if (String(player.userId) === String(this.state.playerId)) {
                    this.state.scores.player = player.score || 0;
                } else {
                    this.state.scores.opponent = player.score || 0;
                }
            });
        }
        
        this.updateUI();
    }

    // Leave room
    static async leaveRoom() {
        try {
            if (this.state.currentRoom) {
                await this.apiCall(`/games/leave/${this.state.currentRoom}`, 'POST');
                if (this.state.socket) {
                    this.state.socket.emit('leaveGameRoom', this.state.currentRoom);
                }
            }
        } catch (error) {
            console.error('Leave error:', error);
        }
        
        this.resetGame();
    }

    // Reset game
    static resetGame() {
        this.state.gameStatus = 'idle';
        this.state.currentRoom = null;
        this.state.opponent = null;
        this.state.questions = [];
        this.state.playerAnswers = {};
        this.state.opponentAnswers = {};
        this.state.timeLeft = 60;
        this.state.isHost = false;
        this.state.scores = { player: 0, opponent: 0 };
        this.state.gameStartedAt = null;
        
        this.stopTimer();
        this.updateUI();
    }

    // Update UI
    static updateUI() {
        const container = document.getElementById('gamesContent');
        if (!container) return;
        
        let html = '';
        
        switch (this.state.gameStatus) {
            case 'idle':
                html = this.getLobbyHTML();
                break;
            case 'waiting':
                html = this.getWaitingHTML();
                break;
            case 'playing':
                html = this.getPlayingHTML();
                break;
            case 'finished':
                html = this.getFinishedHTML();
                break;
        }
        
        container.innerHTML = html;
        this.attachEvents();
    }

    // HTML Templates - Playing screen (NO SHUFFLING LOGIC)
    static getPlayingHTML() {
        const answeredCount = Object.keys(this.state.playerAnswers).length;
        const playerScore = this.state.scores.player || 0;
        const opponentScore = this.state.scores.opponent || 0;
        
        return `
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div style="font-size: 18px; font-weight: bold;">
                        Time: <span style="color: ${this.state.timeLeft <= 10 ? '#dc3545' : '#28a745'}">${this.state.timeLeft}s</span>
                    </div>
                    <div style="font-size: 16px;">
                        Answered: ${answeredCount}/5 | Score: ${playerScore}
                    </div>
                </div>
                
                <div style="display: flex; justify-content: center; gap: 40px; margin-bottom: 30px;">
                    <div style="text-align: center;">
                        <div style="font-size: 14px; color: #666;">YOU</div>
                        <div style="font-size: 20px; font-weight: bold;">${this.state.playerName}</div>
                        <div style="font-size: 36px; font-weight: bold; color: #007bff;">${playerScore}</div>
                    </div>
                    
                    <div style="text-align: center; align-self: center;">
                        <div style="font-size: 20px; font-weight: bold; color: #6c757d;">VS</div>
                    </div>
                    
                    <div style="text-align: center;">
                        <div style="font-size: 14px; color: #666;">OPPONENT</div>
                        <div style="font-size: 20px; font-weight: bold;">${this.state.opponent?.username || 'Opponent'}</div>
                        <div style="font-size: 36px; font-weight: bold; color: #007bff;">${opponentScore}</div>
                    </div>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h3 style="text-align: center; margin-bottom: 30px;">Answer all 5 questions within 60 seconds!</h3>
                    
                    <div style="display: grid; gap: 20px;">
                        ${[0,1,2,3,4].map(qIndex => {
                            const question = this.state.questions[qIndex];
                            const answer = this.state.playerAnswers[qIndex];
                            const hasAnswered = answer !== undefined;
                            const isCorrect = hasAnswered && answer.isCorrect === true;
                            const correctAnswerIndex = hasAnswered ? answer.correctAnswerIndex : null;
                            
                            return `
                                <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; ${hasAnswered ? (isCorrect ? 'border-left: 5px solid #28a745;' : 'border-left: 5px solid #dc3545;') : ''}">
                                    <div style="font-weight: bold; margin-bottom: 15px; color: #333;">
                                        Question ${qIndex + 1}: ${question?.text || 'Loading...'}
                                    </div>
                                    
                                    <div style="display: grid; gap: 10px;">
                                        ${question ? question.options.map((option, aIndex) => {
                                            const isSelected = hasAnswered && answer.answerIndex === aIndex;
                                            const isCorrectOption = hasAnswered && correctAnswerIndex === aIndex;
                                            
                                            return `
                                                <button onclick="GamesManager.submitAnswer(${qIndex}, ${aIndex})" 
                                                        style="
                                                            padding: 12px;
                                                            border: 2px solid ${isSelected ? (isCorrectOption ? '#28a745' : '#dc3545') : '#e0e0e0'};
                                                            background: ${isSelected ? (isCorrectOption ? '#d4edda' : '#f8d7da') : 'white'};
                                                            border-radius: 6px;
                                                            text-align: left;
                                                            cursor: ${hasAnswered ? 'default' : 'pointer'};
                                                            transition: all 0.2s;
                                                        "
                                                        ${hasAnswered ? 'disabled' : ''}
                                                        onmouseover="${hasAnswered ? '' : 'this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 4px 8px rgba(0,0,0,0.1)\''}"
                                                        onmouseout="${hasAnswered ? '' : 'this.style.transform=\'none\'; this.style.boxShadow=\'none\''}">
                                                    ${option}
                                                    ${hasAnswered && isCorrectOption ? ' ✅' : ''}
                                                    ${hasAnswered && isSelected && !isCorrectOption ? ' ❌' : ''}
                                                </button>
                                            `;
                                        }).join('') : 'Loading options...'}
                                    </div>
                                    
                                    ${hasAnswered ? `
                                        <div style="margin-top: 15px; ${isCorrect ? 'color: #28a745;' : 'color: #dc3545;'} font-weight: bold;">
                                            ${isCorrect ? '✅ Correct!' : '❌ Incorrect!'}
                                        </div>
                                        ${!isCorrect && answer.correctOption ? `
                                            <div style="margin-top: 5px; color: #666; font-size: 14px;">
                                                Correct answer: ${answer.correctOption}
                                            </div>
                                        ` : ''}
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <button onclick="GamesManager.forceFinishGame()" style="
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s;
                    "
                    onmouseover="this.style.transform='scale(1.05)'; this.style.background='#c82333'"
                    onmouseout="this.style.transform='none'; this.style.background='#dc3545'">
                        ⏰ End Game Now
                    </button>
                </div>
            </div>
        `;
    }

    // Lobby HTML
    static getLobbyHTML() {
        return `
            <div style="text-align: center; padding: 40px;">
                <h2>🎮 Quiz Game</h2>
                <p style="color: #666; margin-bottom: 10px;">Player: <strong>${this.state.playerName}</strong></p>
                <p style="color: #888; font-size: 14px; margin-bottom: 30px;">Backend-shuffled questions • Secure validation • Real-time multiplayer</p>
                
                <div style="margin: 40px 0;">
                    <button id="createRoomBtn" style="
                        background: linear-gradient(135deg, #007bff, #0056b3);
                        color: white;
                        border: none;
                        padding: 18px 36px;
                        margin: 10px;
                        border-radius: 12px;
                        font-size: 16px;
                        cursor: pointer;
                        transition: all 0.3s;
                        box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
                    "
                    onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 8px 25px rgba(0, 123, 255, 0.3)'"
                    onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(0, 123, 255, 0.2)'">
                        🏠 Create Room (Host)
                    </button>
                    
                    <button id="joinRoomBtn" style="
                        background: linear-gradient(135deg, #28a745, #1e7e34);
                        color: white;
                        border: none;
                        padding: 18px 36px;
                        margin: 10px;
                        border-radius: 12px;
                        font-size: 16px;
                        cursor: pointer;
                        transition: all 0.3s;
                        box-shadow: 0 4px 15px rgba(40, 167, 69, 0.2);
                    "
                    onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 8px 25px rgba(40, 167, 69, 0.3)'"
                    onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(40, 167, 69, 0.2)'">
                        👤 Join Room (Player)
                    </button>
                </div>
                
                <div style="margin-top: 50px; background: #f8f9fa; padding: 20px; border-radius: 10px; max-width: 600px; margin-left: auto; margin-right: auto;">
                    <h4 style="color: #495057; margin-bottom: 15px;">🎯 How It Works:</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px; margin-bottom: 8px;">🔒</div>
                            <div style="font-weight: bold; color: #495057;">Secure Validation</div>
                            <div style="font-size: 12px; color: #6c757d;">Backend-only answer checking</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; margin-bottom: 8px;">🔄</div>
                            <div style="font-weight: bold; color: #495057;">Auto Shuffling</div>
                            <div style="font-size: 12px; color: #6c757d;">Questions shuffled server-side</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; margin-bottom: 8px;">⚡</div>
                            <div style="font-weight: bold; color: #495057;">Real-time</div>
                            <div style="font-size: 12px; color: #6c757d;">Live score updates</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; margin-bottom: 8px;">🏆</div>
                            <div style="font-weight: bold; color: #495057;">Competitive</div>
                            <div style="font-size: 12px; color: #6c757d;">1v1 multiplayer</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Waiting room HTML
    static getWaitingHTML() {
        return `
            <div style="text-align: center; padding: 30px;">
                <h2 style="color: #495057; margin-bottom: 10px;">${this.state.isHost ? '🏠 Host Room' : '👤 Player Room'}</h2>
                <p style="color: #6c757d; margin-bottom: 5px;">Share this code with your opponent:</p>
                <div style="
                    font-family: 'Courier New', monospace;
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 4px;
                    background: linear-gradient(135deg, #6c757d, #495057);
                    color: white;
                    padding: 15px 30px;
                    border-radius: 10px;
                    display: inline-block;
                    margin: 20px 0;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                ">
                    ${this.state.currentRoom}
                </div>
                
                <div style="display: flex; justify-content: center; gap: 30px; margin: 40px 0;">
                    <div style="
                        background: linear-gradient(135deg, ${this.state.isHost ? '#007bff' : '#28a745'}, ${this.state.isHost ? '#0056b3' : '#1e7e34'});
                        color: white;
                        padding: 25px;
                        border-radius: 15px;
                        min-width: 180px;
                        box-shadow: 0 6px 20px rgba(0,0,0,0.1);
                        transition: transform 0.3s;
                    "
                    onmouseover="this.style.transform='scale(1.05)'"
                    onmouseout="this.style.transform='scale(1)'">
                        <div style="font-size: 20px; margin-bottom: 10px;">${this.state.playerName}</div>
                        <div style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 20px; font-size: 14px;">
                            ${this.state.isHost ? 'Host (You)' : 'Player (You)'}
                        </div>
                    </div>
                    
                    ${this.state.opponent ? `
                        <div style="
                            background: linear-gradient(135deg, ${this.state.isHost ? '#28a745' : '#007bff'}, ${this.state.isHost ? '#1e7e34' : '#0056b3'});
                            color: white;
                            padding: 25px;
                            border-radius: 15px;
                            min-width: 180px;
                            box-shadow: 0 6px 20px rgba(0,0,0,0.1);
                            transition: transform 0.3s;
                        "
                        onmouseover="this.style.transform='scale(1.05)'"
                        onmouseout="this.style.transform='scale(1)'">
                            <div style="font-size: 20px; margin-bottom: 10px;">${this.state.opponent.username}</div>
                            <div style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 20px; font-size: 14px;">
                                ${this.state.isHost ? 'Player' : 'Host'}
                            </div>
                        </div>
                    ` : `
                        <div style="
                            background: #f8f9fa;
                            color: #6c757d;
                            padding: 25px;
                            border-radius: 15px;
                            min-width: 180px;
                            border: 2px dashed #dee2e6;
                            transition: all 0.3s;
                        "
                        onmouseover="this.style.borderColor='#adb5bd'; this.style.background='#e9ecef'"
                        onmouseout="this.style.borderColor='#dee2e6'; this.style.background='#f8f9fa'">
                            <div style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;">👤</div>
                            <div style="font-size: 18px; margin-bottom: 10px; color: #6c757d;">Waiting...</div>
                            <div style="font-size: 14px; color: #adb5bd;">${this.state.isHost ? 'For player' : 'For host'}</div>
                        </div>
                    `}
                </div>
                
                <div style="margin: 40px 0;">
                    ${this.state.isHost ? `
                        <button id="startGameBtn" ${!this.state.opponent ? 'disabled' : ''} style="
                            background: ${this.state.opponent ? 'linear-gradient(135deg, #ffc107, #e0a800)' : '#adb5bd'};
                            color: ${this.state.opponent ? '#212529' : 'white'};
                            border: none;
                            padding: 20px 50px;
                            border-radius: 12px;
                            font-size: 20px;
                            cursor: ${this.state.opponent ? 'pointer' : 'not-allowed'};
                            transition: all 0.3s;
                            box-shadow: ${this.state.opponent ? '0 6px 20px rgba(255, 193, 7, 0.3)' : 'none'};
                        "
                        ${this.state.opponent ? 'onmouseover="this.style.transform=\'scale(1.05)\'; this.style.boxShadow=\'0 10px 30px rgba(255, 193, 7, 0.4)\'" onmouseout="this.style.transform=\'none\'; this.style.boxShadow=\'0 6px 20px rgba(255, 193, 7, 0.3)\'"' : ''}>
                            ${this.state.opponent ? '🚀 START GAME' : '⏳ WAITING FOR PLAYER'}
                        </button>
                    ` : `
                        <div style="
                            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
                            color: #856404;
                            padding: 25px;
                            border-radius: 12px;
                            max-width: 400px;
                            margin: 0 auto;
                            box-shadow: 0 4px 15px rgba(255, 243, 205, 0.3);
                            border: 1px solid #ffeaa7;
                        ">
                            <div style="font-size: 36px; margin-bottom: 15px;">⏳</div>
                            <h4 style="margin: 0 0 10px 0; color: #856404;">Waiting for Host</h4>
                            <p style="margin: 0; font-size: 14px; color: #856404;">The host will start the game when ready</p>
                        </div>
                    `}
                </div>
                
                <button id="leaveRoomBtn" style="
                    background: linear-gradient(135deg, #dc3545, #c82333);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 10px rgba(220, 53, 69, 0.2);
                "
                onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 15px rgba(220, 53, 69, 0.3)'"
                onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 10px rgba(220, 53, 69, 0.2)'">
                    🚪 Leave Room
                </button>
            </div>
        `;
    }

    // Finished game HTML
    static getFinishedHTML() {
        const playerScore = this.state.scores.player || 0;
        const opponentScore = this.state.scores.opponent || 0;
        const winner = playerScore > opponentScore ? '🎉 You Win!' :
                      playerScore < opponentScore ? 'Opponent Wins!' : '🤝 Draw!';
        
        return `
            <div style="text-align: center; padding: 30px;">
                <h2 style="color: #495057; margin-bottom: 10px;">🏁 Game Over!</h2>
                <h3 style="
                    color: #ffc107; 
                    margin: 20px 0; 
                    font-size: 32px;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
                ">${winner}</h3>
                
                <div style="display: flex; justify-content: center; gap: 40px; margin: 50px 0;">
                    <div style="
                        background: linear-gradient(135deg, ${playerScore > opponentScore ? '#ffc107' : '#f8f9fa'}, ${playerScore > opponentScore ? '#e0a800' : '#e9ecef'});
                        padding: 30px;
                        border-radius: 15px;
                        min-width: 180px;
                        box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                        ${playerScore > opponentScore ? 'border: 3px solid #ffc107; transform: scale(1.05);' : ''}
                        transition: all 0.3s;
                    "
                    onmouseover="${playerScore > opponentScore ? '' : 'this.style.transform=\'scale(1.05)\';'} this.style.boxShadow='0 12px 30px rgba(0,0,0,0.15)'"
                    onmouseout="${playerScore > opponentScore ? '' : 'this.style.transform=\'none\';'} this.style.boxShadow='0 8px 25px rgba(0,0,0,0.1)'">
                        <h4 style="margin: 0 0 20px 0; color: #495057;">${this.state.playerName}</h4>
                        <div style="font-size: 48px; font-weight: bold; color: #007bff;">${playerScore}<span style="font-size: 24px; color: #6c757d;">/5</span></div>
                        <div style="margin-top: 15px; font-size: 14px; color: #6c757d;">Your Score</div>
                        ${playerScore > opponentScore ? `
                            <div style="margin-top: 15px; background: #ffc107; color: #212529; padding: 5px 10px; border-radius: 20px; font-size: 14px; display: inline-block;">
                                🏆 Winner!
                            </div>
                        ` : ''}
                    </div>
                    
                    <div style="align-self: center; font-size: 28px; font-weight: bold; color: #6c757d;">VS</div>
                    
                    <div style="
                        background: linear-gradient(135deg, ${opponentScore > playerScore ? '#ffc107' : '#f8f9fa'}, ${opponentScore > playerScore ? '#e0a800' : '#e9ecef'});
                        padding: 30px;
                        border-radius: 15px;
                        min-width: 180px;
                        box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                        ${opponentScore > playerScore ? 'border: 3px solid #ffc107; transform: scale(1.05);' : ''}
                        transition: all 0.3s;
                    "
                    onmouseover="${opponentScore > playerScore ? '' : 'this.style.transform=\'scale(1.05)\';'} this.style.boxShadow='0 12px 30px rgba(0,0,0,0.15)'"
                    onmouseout="${opponentScore > playerScore ? '' : 'this.style.transform=\'none\';'} this.style.boxShadow='0 8px 25px rgba(0,0,0,0.1)'">
                        <h4 style="margin: 0 0 20px 0; color: #495057;">${this.state.opponent?.username || 'Opponent'}</h4>
                        <div style="font-size: 48px; font-weight: bold; color: #007bff;">${opponentScore}<span style="font-size: 24px; color: #6c757d;">/5</span></div>
                        <div style="margin-top: 15px; font-size: 14px; color: #6c757d;">Opponent Score</div>
                        ${opponentScore > playerScore ? `
                            <div style="margin-top: 15px; background: #ffc107; color: #212529; padding: 5px 10px; border-radius: 20px; font-size: 14px; display: inline-block;">
                                🏆 Winner!
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div style="margin: 50px 0;">
                    <button id="backToLobbyBtn" style="
                        background: linear-gradient(135deg, #007bff, #0056b3);
                        color: white;
                        border: none;
                        padding: 18px 45px;
                        border-radius: 12px;
                        font-size: 18px;
                        cursor: pointer;
                        transition: all 0.3s;
                        box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
                    "
                    onmouseover="this.style.transform='scale(1.05)'; this.style.background='linear-gradient(135deg, #0056b3, #004085)'; this.style.boxShadow='0 10px 30px rgba(0, 123, 255, 0.4)'"
                    onmouseout="this.style.transform='none'; this.style.background='linear-gradient(135deg, #007bff, #0056b3)'; this.style.boxShadow='0 6px 20px rgba(0, 123, 255, 0.3)'">
                        🏠 Play Again
                    </button>
                </div>
                
                ${playerScore !== undefined && opponentScore !== undefined ? `
                    <div style="
                        background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                        padding: 20px;
                        border-radius: 10px;
                        max-width: 400px;
                        margin: 0 auto;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                    ">
                        <div style="font-size: 16px; color: #495057; margin-bottom: 10px;">
                            ${playerScore > opponentScore ? 
                                `🎯 You scored ${playerScore - opponentScore} more point${playerScore - opponentScore === 1 ? '' : 's'}!` :
                              playerScore < opponentScore ? 
                                `🎯 Opponent scored ${opponentScore - playerScore} more point${opponentScore - playerScore === 1 ? '' : 's'}!` :
                                '🤝 You both scored the same!'
                            }
                        </div>
                        <div style="font-size: 14px; color: #6c757d;">
                            ${playerScore === 5 ? '🎉 Perfect score! Amazing!' : 
                              playerScore >= 4 ? '👏 Great job! Almost perfect!' :
                              playerScore >= 3 ? '👍 Good effort! Keep practicing!' :
                              '💪 Keep practicing, you\'ll get better!'}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Attach events
    static attachEvents() {
        const attach = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.onclick = handler.bind(this);
        };
        
        attach('createRoomBtn', () => this.createRoom());
        attach('joinRoomBtn', () => this.joinRoom());
        attach('startGameBtn', () => this.startGame());
        attach('leaveRoomBtn', () => this.leaveRoom());
        attach('backToLobbyBtn', () => this.leaveRoom());
    }
}


window.GamesManager = GamesManager;


document.addEventListener('DOMContentLoaded', () => {
    GamesManager.init();
});


AuthManager.login = async function (username, password) {
    try {
        this.showLoading(true);
        const response = await fetch(`${CONFIG.API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Login failed');

        AppState.accessToken = data.accesstoken;
        AppState.currentUser = data.user;
        localStorage.setItem('accessToken', AppState.accessToken);
        localStorage.setItem('user', JSON.stringify(AppState.currentUser));

        this.updateAuthButton();
        UIManager.updateContentForUser();
        SocketManager.init();
        ChatManager.setupActionButtons();
        NotesManager.init();
        MockManager.init();
        GamesManager.init(); // Initialize games

        DOM.authWindow.classList.remove('show');
        NotificationManager.show('Login successful!', 'success');

    } catch (error) {
        this.showAuthError(error.message);
    } finally {
        this.showLoading(false);
    }
};

// Also initialize games if user is already logged in
AppInitializer.loadSavedSession = function () {
    const savedToken = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
        try {
            AppState.accessToken = savedToken;
            AppState.currentUser = JSON.parse(savedUser);
            AuthManager.updateAuthButton();
            UIManager.updateContentForUser();
            SocketManager.init();
            ChatManager.setupActionButtons();
            NotesManager.init();
            MockManager.init();
            GamesManager.init(); // Initialize games
        } catch (error) {
            console.error('Error loading saved session:', error);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
        }
    }
};

// Add games tab event listener
UIManager.setupTabNavigation = function () {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const tabId = this.dataset.tab;

            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            const targetTab = document.getElementById(`${tabId}-tab`);
            if (targetTab) {
                targetTab.classList.add('active');
            }

            document.dispatchEvent(new CustomEvent('tabChange', {
                detail: { tabId }
            }));

            if (tabId === 'chat' && AppState.currentUser && !AppState.socket) {
                SocketManager.init();
            }
        });
    });
};


// ==================== MOBILE SIDEBAR MANAGER ====================
class MobileSidebarManager {
    static init() {
        this.setupEventListeners();
        this.updateSidebarForUser();
    }

    static setupEventListeners() {
        // Menu toggle
        document.getElementById('menuToggle')?.addEventListener('click', () => this.openSidebar());
        document.getElementById('closeMenu')?.addEventListener('click', () => this.closeSidebar());
        document.getElementById('overlay')?.addEventListener('click', () => this.closeSidebar());

        // Theme toggle in sidebar
        document.getElementById('sidebarThemeToggle')?.addEventListener('click', () => {
            ThemeManager.toggleTheme();
        });

        // Mobile auth forms
        document.getElementById('loginFormMobile')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsernameMobile').value;
            const password = document.getElementById('loginPasswordMobile').value;
            await AuthManager.login(username, password);
            this.closeSidebar();
        });

        document.getElementById('signupFormMobile')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupNameMobile').value;
            const username = document.getElementById('signupUsernameMobile').value;
            const password = document.getElementById('signupPasswordMobile').value;
            const confirmPassword = document.getElementById('signupConfirmPasswordMobile').value;
            
            const validation = AuthManager.validateSignup(name, username, password, confirmPassword);
            if (!validation.valid) {
                this.showAuthErrorMobile(validation.message);
                return;
            }
            
            await AuthManager.signup(name, username, password);
            this.closeSidebar();
        });

        // Logout button
        document.getElementById('logoutBtnMobile')?.addEventListener('click', () => {
            AuthManager.logout();
            this.closeSidebar();
        });

        // Mobile navigation tabs
        document.querySelectorAll('.sidebar-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = item.dataset.tab;
                
                // Update active state
                document.querySelectorAll('.sidebar-menu-item').forEach(i => {
                    i.classList.remove('active');
                });
                item.classList.add('active');
                
                // Switch tab using existing tab system
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.tab === tabId) {
                        btn.classList.add('active');
                    }
                });

                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabId}-tab`) {
                        content.classList.add('active');
                    }
                });
                
                this.closeSidebar();
            });
        });

        // Mobile auth tabs
        document.querySelectorAll('.auth-tab-mobile').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                document.querySelectorAll('.auth-tab-mobile').forEach(t => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');
                
                document.querySelectorAll('.auth-form-mobile').forEach(form => {
                    form.classList.remove('active');
                    if (form.id === `${tabName}FormMobile`) {
                        form.classList.add('active');
                    }
                });
                
                this.clearAuthErrorMobile();
            });
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const menuToggle = document.getElementById('menuToggle');
            
            if (sidebar?.classList.contains('show') && 
                !sidebar.contains(e.target) && 
                !menuToggle?.contains(e.target)) {
                this.closeSidebar();
            }
        });
    }

    static openSidebar() {
        document.getElementById('sidebar')?.classList.add('show');
        document.getElementById('overlay')?.classList.add('show');
        document.body.classList.add('sidebar-open');
        
        // Update sidebar content
        this.updateSidebarForUser();
        this.updateThemeStatus();
    }

    static closeSidebar() {
        document.getElementById('sidebar')?.classList.remove('show');
        document.getElementById('overlay')?.classList.remove('show');
        document.body.classList.remove('sidebar-open');
    }

    static updateSidebarForUser() {
        const userInfo = document.getElementById('userInfoSidebar');
        const authWindow = document.getElementById('authWindowMobile');
        const userActions = document.getElementById('userActionsMobile');
        const userNameMobile = document.getElementById('mobileUserName');
        const sidebarUserName = document.getElementById('sidebarUserName');
        const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');

        if (AppState.currentUser) {
            // User is logged in
            if (userInfo) {
                userInfo.style.display = 'block';
            }
            if (authWindow) {
                authWindow.style.display = 'none';
            }
            if (userActions) {
                userActions.style.display = 'block';
            }
            
            // Update user info
            if (userNameMobile) {
                userNameMobile.textContent = AppState.currentUser.username;
            }
            if (sidebarUserName) {
                sidebarUserName.textContent = AppState.currentUser.name || AppState.currentUser.username;
            }
            if (sidebarUserAvatar) {
                const initials = (AppState.currentUser.name || AppState.currentUser.username)
                    .charAt(0)
                    .toUpperCase();
                sidebarUserAvatar.textContent = initials;
            }
        } else {
            // User is not logged in
            if (userInfo) {
                userInfo.style.display = 'none';
            }
            if (authWindow) {
                authWindow.style.display = 'block';
            }
            if (userActions) {
                userActions.style.display = 'none';
            }
        }
    }

    static updateThemeStatus() {
        const themeStatus = document.getElementById('themeStatus');
        const themeIcon = document.getElementById('sidebarThemeToggle')?.querySelector('i');
        
        if (document.body.classList.contains('dark-theme')) {
            if (themeStatus) themeStatus.textContent = 'On';
            if (themeIcon) themeIcon.className = 'fas fa-sun';
        } else {
            if (themeStatus) themeStatus.textContent = 'Off';
            if (themeIcon) themeIcon.className = 'fas fa-moon';
        }
    }

    static showAuthErrorMobile(message) {
        const errorElement = document.getElementById('authErrorMobile');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    static clearAuthErrorMobile() {
        const errorElement = document.getElementById('authErrorMobile');
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }
}

// ==================== UPDATE EXISTING CLASSES ====================

// Update ThemeManager to also handle mobile theme toggle
const originalToggleTheme = ThemeManager.toggleTheme;
ThemeManager.toggleTheme = function() {
    originalToggleTheme.apply(this);
    MobileSidebarManager.updateThemeStatus();
};

// Update AuthManager to refresh mobile sidebar on auth events
const originalLogin = AuthManager.login;
AuthManager.login = async function(...args) {
    const result = await originalLogin.apply(this, args);
    MobileSidebarManager.updateSidebarForUser();
    return result;
};

const originalSignup = AuthManager.signup;
AuthManager.signup = async function(...args) {
    const result = await originalSignup.apply(this, args);
    MobileSidebarManager.updateSidebarForUser();
    return result;
};

// Update logout to refresh mobile sidebar
AuthManager.logout = async function() {
    // Original logout logic (keep your existing code)
    try {
        await fetch(`${CONFIG.API_BASE_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    AppState.currentUser = null;
    AppState.accessToken = null;
    AppState.messageQueue = [];
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');

    if (AppState.socket) {
        AppState.socket.disconnect();
        AppState.socket = null;
    }

    this.updateAuthButton();
    UIManager.updateContentForUser();
    MobileSidebarManager.updateSidebarForUser(); // Update mobile sidebar
    NotificationManager.show('Logged out successfully', 'success');
};

// Update ChatManager to update mobile badge
const originalUpdateChatBadge = ChatManager.updateChatBadge;
ChatManager.updateChatBadge = function() {
    originalUpdateChatBadge.apply(this);
    
    // Update mobile badge
    const badge = document.getElementById('mobileChatBadge');
    if (badge) {
        const unreadElements = document.querySelectorAll('.unread-count');
        let totalUnread = 0;

        unreadElements.forEach(el => {
            if (el.style.display !== 'none') {
                const count = parseInt(el.textContent) || 0;
                totalUnread += count;
            }
        });

        if (totalUnread > 0) {
            badge.textContent = totalUnread;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
};

// Update AppInitializer to include mobile sidebar
AppInitializer.init = function() {
    this.addGlobalStyles();
    this.loadSavedSession();

    ThemeManager.init();
    NavigationManager.init();
    NotificationPopup.init();
    AuthManager.init();
    ChatManager.setupEventListeners();
    UIManager.setupTabNavigation();
    MockManager.init();
    NotesManager.init();
    GamesManager.init();

    // Initialize mobile sidebar
    MobileSidebarManager.init();

    console.log('🎯 Catalyst App Initialized (Mobile Ready)');
};

// Add CSS for responsive behavior
AppInitializer.addGlobalStyles = function() {
    const style = document.createElement('style');
    style.textContent = `
        /* Mobile responsive */
        @media (max-width: 768px) {
            .nav-items {
                display: none !important;
            }
            
            .menu-toggle {
                display: flex !important;
            }
            
            .searchbar {
                max-width: none;
                flex: 1;
            }
            
            .logo .tagline {
                display: none;
            }
        }
        
        @media (min-width: 769px) {
            .menu-toggle {
                display: none !important;
            }
            
            .sidebar {
                display: none !important;
            }
            
            .nav-items {
                display: flex !important;
            }
        }
        
        /* Sidebar open state */
        body.sidebar-open {
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);
};

