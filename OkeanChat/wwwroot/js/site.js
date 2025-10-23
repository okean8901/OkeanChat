// Please see documentation at https://learn.microsoft.com/aspnet/core/client-side/bundling-and-minification
// for details on configuring this project to bundle and minify static web assets.

// OkeanChat JavaScript functions

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

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Set up any global event listeners
    console.log('OkeanChat initialized');
});
