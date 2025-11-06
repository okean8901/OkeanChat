// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// OkeanChat JavaScript functions

// Global variables
let onlineUsers = new Map(); // userId -> userInfo

// Form validation functions
function addValidationStyles() {
    // Add real-time validation styling
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
    
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            // Remove error styling when user starts typing
            if (this.classList.contains('border-red-500')) {
                this.classList.remove('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
                this.classList.add('border-gray-600', 'focus:ring-blue-500', 'focus:border-blue-500');
            }
        });
    });
}

function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;
    
    // Basic validation rules
    let isValid = true;
    let errorMessage = '';
    
    switch(fieldName) {
        case 'UserName':
            if (!value) {
                isValid = false;
                errorMessage = 'Username is required';
            } else if (value.length < 3) {
                isValid = false;
                errorMessage = 'Username must be at least 3 characters';
            }
            break;
            
        case 'UserNameOrEmail':
            if (!value) {
                isValid = false;
                errorMessage = 'Username or email is required';
            } else if (value.length < 3) {
                isValid = false;
                errorMessage = 'Username or email must be at least 3 characters';
            }
            break;
            
        case 'Password':
            if (!value) {
                isValid = false;
                errorMessage = 'Password is required';
            } else if (value.length < 6) {
                isValid = false;
                errorMessage = 'Password must be at least 6 characters';
            }
            break;
            
        case 'ConfirmPassword':
            const passwordField = document.querySelector('input[name="Password"]');
            if (!value) {
                isValid = false;
                errorMessage = 'Please confirm your password';
            } else if (value !== passwordField.value) {
                isValid = false;
                errorMessage = 'Passwords do not match';
            }
            break;
    }
    
    // Apply styling
    if (!isValid) {
        field.classList.remove('border-gray-600', 'focus:ring-blue-500', 'focus:border-blue-500');
        field.classList.add('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
        
        // Show error message
        showFieldError(field, errorMessage);
    } else {
        field.classList.remove('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
        field.classList.add('border-gray-600', 'focus:ring-blue-500', 'focus:border-blue-500');
        
        // Remove error message
        hideFieldError(field);
    }
    
    return isValid;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showFieldError(field, message) {
    // Remove existing error message
    hideFieldError(field);
    
    // Create error message element
    const errorElement = document.createElement('span');
    errorElement.className = 'text-red-400 text-sm mt-1 block field-error';
    errorElement.textContent = message;
    
    // Insert after the field
    field.parentNode.insertBefore(errorElement, field.nextSibling);
}

function hideFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

// Initialize validation when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    addValidationStyles();
});

// Utility functions
function formatDate(date) {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInHours = (now - messageDate) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
        return 'Just now';
    } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
        return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
        return messageDate.toLocaleDateString();
    }
}

function generateAvatar(username) {
    const colors = ['#7289da', '#43b581', '#faa61a', '#f04747', '#747f8d', '#99aab5'];
    const color = colors[username.length % colors.length];
    return `https://ui-avatars.com/api/?name=${username}&background=${color.replace('#', '')}&color=ffffff&size=40`;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-600' : 
        type === 'error' ? 'bg-red-600' : 
        'bg-blue-600'
    } text-white`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Chat functions
function scrollToBottom(elementId = 'messagesContainer') {
    const container = document.getElementById(elementId);
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function addMessageToUI(message, containerId = 'messagesList') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const messageHtml = `
        <div class="message mb-4 flex">
            <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                ${message.avatar ? 
                    `<img src="${message.avatar}" alt="${message.username}" class="w-10 h-10 rounded-full">` :
                    `<span class="text-sm font-semibold text-white">${message.username.charAt(0).toUpperCase()}</span>`
                }
            </div>
            <div class="flex-1">
                <div class="flex items-baseline mb-1">
                    <span class="font-semibold text-white mr-2">${message.username}</span>
                    <span class="text-xs text-gray-400">${formatDate(message.createdAt)}</span>
                    ${message.isEdited ? '<span class="text-xs text-gray-500 ml-2">(edited)</span>' : ''}
                </div>
                <div class="text-gray-300">${message.content}</div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', messageHtml);
    scrollToBottom();
}

function updateTypingIndicator(usernames, containerId = 'typingIndicator') {
    const container = document.getElementById(containerId);
    const usersSpan = document.getElementById('typingUsers');
    
    if (!container || !usersSpan) return;
    
    if (usernames.length === 0) {
        container.classList.add('hidden');
    } else {
        const text = usernames.length === 1 
            ? `${usernames[0]} is typing...`
            : `${usernames.join(', ')} are typing...`;
        usersSpan.textContent = text;
        container.classList.remove('hidden');
    }
}

// Channel management
function createChannel(name, description) {
    return fetch('/Home/CreateChannel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `name=${encodeURIComponent(name)}&description=${encodeURIComponent(description || '')}`
    })
    .then(response => response.json());
}

// User management
function createUser(username) {
    return fetch('/api/Chat/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username })
    })
    .then(response => response.json());
}

// Local storage helpers
function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

function getFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error('Error reading from localStorage:', e);
        return defaultValue;
    }
}

// Online/Offline status management
function updateUserStatus(userInfo, isOnline) {
    // Update user in online users list
    const onlineUsersList = document.getElementById('onlineUsersList');
    if (onlineUsersList) {
        const userElement = onlineUsersList.querySelector(`[data-user-id="${userInfo.Id}"]`);
        if (isOnline && !userElement) {
            const newUserElement = createOnlineUserElement(userInfo);
            onlineUsersList.appendChild(newUserElement);
        } else if (!isOnline && userElement) {
            userElement.remove();
        }
    }

    // Update user in friends list
    const friendElement = document.querySelector(`.friend-item[data-friend-id="${userInfo.Id}"]`);
    if (friendElement) {
        const statusDot = friendElement.querySelector('.friend-status-indicator');
        
        if (statusDot) {
            statusDot.className = `absolute bottom-0 right-0 w-3 h-3 ${
                isOnline ? 'bg-green-500' : 'bg-gray-500'
            } rounded-full border-2 border-gray-800 shadow-sm friend-status-indicator transition-all duration-300`;
        }
    }

    // Update online/total users count
    updateOnlineUsersCount();
}

function updateOnlineUsersList(users) {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;

    // Clear current list
    usersList.innerHTML = '';

    // Add each user to the list
    users.forEach(user => {
        const userHtml = `
            <div class="user-item flex items-center p-3 hover:bg-gray-700 rounded-lg transition-colors" data-user-id="${user.Id}">
                <div class="relative">
                    <img src="${user.Avatar || generateAvatar(user.DisplayName)}" 
                         alt="${user.DisplayName}" 
                         class="w-10 h-10 rounded-full">
                    <span class="status-dot w-2 h-2 rounded-full bg-green-500 absolute bottom-0 right-0 border-2 border-gray-800"
                          title="Online"></span>
                </div>
                <div class="ml-3 flex-1">
                    <div class="text-white font-medium">${user.DisplayName}</div>
                    <div class="text-gray-400 text-sm last-seen">Online</div>
                </div>
            </div>
        `;
        usersList.insertAdjacentHTML('beforeend', userHtml);
    });
}

// SignalR connection setup
function setupSignalRConnection(hubConnection) {
    // Handle user coming online
    hubConnection.on("UserCameOnline", (userInfo) => {
        onlineUsers.set(userInfo.Id, userInfo);
        updateUserStatus(userInfo, true);
        showNotification(`${userInfo.DisplayName} is now online`, 'info');
    });

    // Handle user going offline
    hubConnection.on("UserWentOffline", (userId) => {
        const userInfo = onlineUsers.get(userId);
        if (userInfo) {
            updateUserStatus(userInfo, false);
            onlineUsers.delete(userId);
            showNotification(`${userInfo.DisplayName} went offline`, 'info');
        }
    });

    // Handle initial online users list
    hubConnection.on("OnlineUsers", (users) => {
        users.forEach(user => onlineUsers.set(user.Id, user));
        updateOnlineUsersList(users);
    });

    // Other existing SignalR handlers...
}

// Online/Offline status functions
function updateOnlineUsersCount() {
    const onlineCount = document.getElementById('onlineUsersCount');
    const totalCount = document.getElementById('totalUsersCount');
    
    if (onlineCount && totalCount) {
        const onlineUsers = document.querySelectorAll('#onlineUsersList [data-user-id]').length;
        const totalUsers = onlineUsers + document.querySelectorAll('.friend-item[data-friend-id]:not([data-online="true"])').length;
        
        onlineCount.textContent = onlineUsers;
        totalCount.textContent = totalUsers;
    }
}

function createOnlineUserElement(user) {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-3 hover:bg-gray-700 rounded-lg transition-colors';
    div.setAttribute('data-user-id', user.Id);
    div.setAttribute('data-online', 'true');
    
    const userInfo = document.createElement('div');
    userInfo.className = 'flex items-center flex-1';
    
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'relative';
    
    const avatar = document.createElement('div');
    avatar.className = 'w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600';
    
    if (user.Avatar) {
        const img = document.createElement('img');
        img.src = user.Avatar;
        img.alt = user.DisplayName;
        img.className = 'w-10 h-10 rounded-full object-cover';
        avatar.appendChild(img);
    } else {
        const span = document.createElement('span');
        span.className = 'text-white font-semibold';
        span.textContent = (user.DisplayName || user.UserName).charAt(0).toUpperCase();
        avatar.appendChild(span);
    }
    
    const statusDot = document.createElement('span');
    statusDot.className = 'absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800 shadow-sm';
    statusDot.title = 'Online';
    
    avatarContainer.appendChild(avatar);
    avatarContainer.appendChild(statusDot);
    
    const textContainer = document.createElement('div');
    textContainer.className = 'ml-3 flex-1';
    
    const name = document.createElement('div');
    name.className = 'text-white font-medium text-sm';
    name.textContent = user.DisplayName || user.UserName;
    
    const status = document.createElement('div');
    status.className = 'text-gray-400 text-xs';
    status.textContent = 'Online';
    
    textContainer.appendChild(name);
    textContainer.appendChild(status);
    
    userInfo.appendChild(avatarContainer);
    userInfo.appendChild(textContainer);
    
    // Action buttons (chat, audio call, video call)
    const actions = document.createElement('div');
    actions.className = 'flex space-x-2';
    
    // Chat button
    const chatBtn = document.createElement('button');
    chatBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-all hover:scale-110';
    chatBtn.innerHTML = '<i class="fas fa-comment"></i>';
    chatBtn.title = 'Send message';
    chatBtn.onclick = () => openPrivateChat(user.Id, user.DisplayName, user.Avatar);
    
    // Audio call button
    const audioBtn = document.createElement('button');
    audioBtn.className = 'call-btn bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition-all hover:scale-110';
    audioBtn.innerHTML = '<i class="fas fa-phone"></i>';
    audioBtn.title = 'Voice call';
    audioBtn.setAttribute('data-user-id', user.Id);
    audioBtn.setAttribute('data-call-type', 'audio');
    
    // Video call button
    const videoBtn = document.createElement('button');
    videoBtn.className = 'call-btn bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs transition-all hover:scale-110';
    videoBtn.innerHTML = '<i class="fas fa-video"></i>';
    videoBtn.title = 'Video call';
    videoBtn.setAttribute('data-user-id', user.Id);
    videoBtn.setAttribute('data-call-type', 'video');
    
    actions.appendChild(chatBtn);
    actions.appendChild(audioBtn);
    actions.appendChild(videoBtn);
    
    div.appendChild(userInfo);
    div.appendChild(actions);
    
    return div;
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Set up any global event listeners
    console.log('OkeanChat initialized');

    // Start checking for online users
    if (connection) {
        connection.invoke("GetOnlineUsers", currentChannelId);
        
        // Refresh online users periodically (every 30 seconds)
        setInterval(() => {
            if (connection && connection.state === signalR.HubConnectionState.Connected) {
                connection.invoke("GetOnlineUsers", currentChannelId);
            }
        }, 30000);
    }
});
