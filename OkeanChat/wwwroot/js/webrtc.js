q// WebRTC functionality for OkeanChat

class WebRTCManager {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.currentCall = null;
        this.connection = null;
        this.isInCall = false;
        this.pendingOffer = null;
        this.onlineUserIds = new Set();
        this.presenceIntervalId = null;
        
        // WebRTC configuration
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.init();
    }

    init() {
        this.setupSignalRConnection();
        this.setupEventListeners();
    }

    setupSignalRConnection() {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl("/webrtcHub")
            .build();

        this.connection.start().then(() => {
            console.log("WebRTC Hub connected");
            this.getOnlineUsers();
            // Periodic presence refresh to correct drift
            if (this.presenceIntervalId) clearInterval(this.presenceIntervalId);
            this.presenceIntervalId = setInterval(() => this.getOnlineUsers(), 30000);
        }).catch(err => console.error("WebRTC Hub connection error:", err));

        // Handle connection lifecycle
        this.connection.onclose(() => {
            if (this.presenceIntervalId) {
                clearInterval(this.presenceIntervalId);
                this.presenceIntervalId = null;
            }
        });
        if (typeof this.connection.onreconnected === 'function') {
            this.connection.onreconnected(() => {
                this.getOnlineUsers();
            });
        }

        // SignalR event handlers
        this.connection.on("IncomingCall", (callerId, callerName, callType) => {
            // Store call info immediately
            this.currentCall = { userId: callerId, callType };
            this.showIncomingCallModal(callerId, callerName, callType);
        });

        this.connection.on("ReceiveOffer", (callerId, offer) => {
            this.handleReceiveOffer(callerId, offer);
        });

        this.connection.on("ReceiveAnswer", (callerId, answer) => {
            this.handleReceiveAnswer(callerId, answer);
        });

        this.connection.on("ReceiveIceCandidate", (callerId, candidate) => {
            this.handleReceiveIceCandidate(callerId, candidate);
        });

        this.connection.on("CallRejected", (callerId) => {
            this.handleCallRejected();
        });

        this.connection.on("CallEnded", (callerId) => {
            this.handleCallEnded();
        });

        this.connection.on("OnlineUsers", (users) => {
            this.updateOnlineUsers(users);
            this.syncFriendsPresence(users);
            this.relayPresenceToUI();
        });

        this.connection.on("UserOnline", (userId, userName) => {
            this.addOnlineUser(userId, userName);
            this.setFriendOnlineState(userId, true);
            this.relayPresenceToUI();
        });

        this.connection.on("UserOffline", (userId) => {
            this.removeOnlineUser(userId);
            this.setFriendOnlineState(userId, false);
            this.relayPresenceToUI();
        });
    }

    setupEventListeners() {
        // Call buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('call-btn')) {
                const userId = e.target.dataset.userId;
                const callType = e.target.dataset.callType;
                this.startCall(userId, callType);
            }
            
            if (e.target.classList.contains('end-call-btn')) {
                this.endCall();
            }
            
            if (e.target.classList.contains('accept-call-btn')) {
                this.acceptCall();
            }
            
            if (e.target.classList.contains('reject-call-btn')) {
                this.rejectCall();
            }
        });
    }

    async startCall(userId, callType) {
        try {
            if (this.isInCall) {
                this.showNotification("You are already in a call", "error");
                return;
            }

            this.currentCall = { userId, callType };
            this.isInCall = true;
            
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: callType === 'video',
                audio: true
            });

            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.config);

            // Add local stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                this.setupRemoteVideo();
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.connection.invoke("SendIceCandidate", userId, JSON.stringify(event.candidate));
                }
            };

            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            await this.connection.invoke("SendOffer", userId, JSON.stringify(offer));

            // Send call notification
            await this.connection.invoke("SendCallNotification", userId, callType);

            // Show call interface (waiting for answer)
            this.showCallInterface(callType, true);

        } catch (error) {
            console.error("Error starting call:", error);
            this.cleanup();
            this.showNotification("Failed to start call. Please check your camera/microphone permissions.", "error");
        }
    }

    async acceptCall() {
        try {
            if (!this.currentCall) {
                console.error("No call to accept");
                this.hideIncomingCallModal();
                return;
            }

            const callerId = this.currentCall.userId;
            const callType = this.currentCall.callType;
            this.isInCall = true;

            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: callType === 'video',
                audio: true
            });

            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.config);

            // Add local stream
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                this.setupRemoteVideo();
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.connection.invoke("SendIceCandidate", callerId, JSON.stringify(event.candidate));
                }
            };

            // If we have a pending offer, use it; otherwise wait for offer
            if (this.pendingOffer && this.pendingOffer.callerId === callerId) {
                await this.peerConnection.setRemoteDescription(this.pendingOffer.offer);
                this.pendingOffer = null;
            }

            // Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.connection.invoke("SendAnswer", callerId, JSON.stringify(answer));

            // Show call interface
            this.showCallInterface(callType, false);
            this.hideIncomingCallModal();

        } catch (error) {
            console.error("Error accepting call:", error);
            this.cleanup();
            this.showNotification("Failed to accept call. Please check your camera/microphone permissions.", "error");
            this.hideIncomingCallModal();
        }
    }

    async handleReceiveOffer(callerId, offer) {
        try {
            // Store offer for when user accepts
            this.pendingOffer = { callerId, offer: JSON.parse(offer) };
            
            // If we already have a peer connection (user accepted before offer arrived), set the remote description
            if (this.peerConnection && this.currentCall && this.currentCall.userId === callerId) {
                await this.peerConnection.setRemoteDescription(this.pendingOffer.offer);
                // Create and send answer if we haven't already
                if (this.peerConnection.localDescription === null) {
                    const answer = await this.peerConnection.createAnswer();
                    await this.peerConnection.setLocalDescription(answer);
                    await this.connection.invoke("SendAnswer", callerId, JSON.stringify(answer));
                }
                this.pendingOffer = null;
            }
            
        } catch (error) {
            console.error("Error handling offer:", error);
        }
    }

    async handleReceiveAnswer(callerId, answer) {
        try {
            await this.peerConnection.setRemoteDescription(JSON.parse(answer));
        } catch (error) {
            console.error("Error handling answer:", error);
        }
    }

    async handleReceiveIceCandidate(callerId, candidate) {
        try {
            await this.peerConnection.addIceCandidate(JSON.parse(candidate));
        } catch (error) {
            console.error("Error handling ICE candidate:", error);
        }
    }

    async endCall() {
        try {
            if (this.currentCall) {
                await this.connection.invoke("EndCall", this.currentCall.userId);
            }
            this.cleanup();
            this.hideCallInterface();
        } catch (error) {
            console.error("Error ending call:", error);
        }
    }

    async rejectCall() {
        try {
            if (this.currentCall) {
                await this.connection.invoke("RejectCall", this.currentCall.userId);
            }
            this.cleanup();
            this.hideIncomingCallModal();
            this.pendingOffer = null;
        } catch (error) {
            console.error("Error rejecting call:", error);
        }
    }

    handleCallRejected() {
        this.showNotification("Call was rejected", "info");
        this.cleanup();
        this.hideCallInterface();
        this.hideIncomingCallModal();
    }

    handleCallEnded() {
        this.showNotification("Call ended", "info");
        this.cleanup();
        this.hideCallInterface();
        this.hideIncomingCallModal();
    }

    cleanup() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.currentCall = null;
        this.isInCall = false;
        this.pendingOffer = null;
    }

    setupRemoteVideo() {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
        }
    }

    showIncomingCallModal(callerId, callerName, callType) {
        // Ensure call info is stored
        if (!this.currentCall || this.currentCall.userId !== callerId) {
            this.currentCall = { userId: callerId, callType };
        }
        
        const modal = document.getElementById('incomingCallModal');
        const callerNameElement = document.getElementById('callerName');
        const callTypeElement = document.getElementById('callType');
        
        if (callerNameElement) callerNameElement.textContent = callerName;
        if (callTypeElement) callTypeElement.textContent = callType === 'video' ? 'Video Call' : 'Audio Call';
        
        // Update icon based on call type
        if (modal) {
            const iconContainer = modal.querySelector('.bg-blue-500');
            if (iconContainer) {
                const icon = iconContainer.querySelector('i');
                if (icon) {
                    icon.className = callType === 'video' ? 'fas fa-video text-white text-2xl' : 'fas fa-phone text-white text-2xl';
                }
            }
            modal.classList.remove('hidden');
        }
    }

    hideIncomingCallModal() {
        const modal = document.getElementById('incomingCallModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showCallInterface(callType, isCaller) {
        const callInterface = document.getElementById('callInterface');
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        const callInfo = document.getElementById('callInfo');
        
        if (callInterface) {
            callInterface.classList.remove('hidden');
        }
        
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
        }
        
        // Update call info
        if (callInfo) {
            callInfo.textContent = callType === 'video' ? 'Video Call in progress...' : 'Audio Call in progress...';
        }
        
        // Show/hide video elements based on call type
        if (callType === 'audio') {
            if (localVideo) localVideo.style.display = 'none';
            if (remoteVideo) remoteVideo.style.display = 'none';
            // Show audio placeholder
            if (remoteVideo && remoteVideo.parentElement) {
                const audioPlaceholder = remoteVideo.parentElement.querySelector('.audio-placeholder');
                if (!audioPlaceholder) {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'audio-placeholder w-full h-full flex items-center justify-center bg-gray-800';
                    placeholder.innerHTML = `
                        <div class="text-center">
                            <i class="fas fa-phone text-white text-6xl mb-4"></i>
                            <p class="text-white text-xl">Audio Call</p>
                        </div>
                    `;
                    remoteVideo.parentElement.appendChild(placeholder);
                }
            }
        } else {
            if (localVideo) localVideo.style.display = 'block';
            if (remoteVideo) remoteVideo.style.display = 'block';
            // Remove audio placeholder if exists
            const audioPlaceholder = remoteVideo?.parentElement?.querySelector('.audio-placeholder');
            if (audioPlaceholder) {
                audioPlaceholder.remove();
            }
        }
    }

    hideCallInterface() {
        const callInterface = document.getElementById('callInterface');
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        
        if (callInterface) {
            callInterface.classList.add('hidden');
        }
        
        // Clear video sources
        if (localVideo) {
            localVideo.srcObject = null;
        }
        if (remoteVideo) {
            remoteVideo.srcObject = null;
        }
        
        // Remove audio placeholder
        const audioPlaceholder = document.querySelector('.audio-placeholder');
        if (audioPlaceholder) {
            audioPlaceholder.remove();
        }
    }

    updateOnlineUsers(users) {
        const onlineUsersList = document.getElementById('onlineUsersList');
        if (!onlineUsersList) return;

        // Normalize: keep only users marked online if such flag exists; otherwise assume provided list is online-only
        const normalized = Array.isArray(users) ? users.filter(u => {
            const flags = [u.IsOnline, u.isOnline, u.Online];
            const hasFlag = flags.some(v => typeof v !== 'undefined');
            return hasFlag ? !!(u.IsOnline || u.isOnline || u.Online) : true;
        }) : [];

        // Track online ids
        this.onlineUserIds = new Set(normalized.map(u => String(u.Id)));

        // Only show online FRIENDS: intersect with ids present in #friendsList
        const friendItems = document.querySelectorAll('#friendsList .friend-item');
        const friendIdSet = new Set(Array.from(friendItems).map(el => String(el.getAttribute('data-friend-id'))));

        // Optional: don't display self if available on window
        const selfId = window.currentUserId ? String(window.currentUserId) : null;

        onlineUsersList.innerHTML = '';
        normalized.forEach(user => {
            if (selfId && String(user.Id) === selfId) return;
            if (!friendIdSet.has(String(user.Id))) return;
            // de-dup by Id
            if (onlineUsersList.querySelector(`[data-user-id="${user.Id}"]`)) return;
            const userElement = this.createUserElement(user);
            onlineUsersList.appendChild(userElement);
        });
    }

    // Presence helpers for Friends list (left sidebar)
    syncFriendsPresence(users) {
        try {
            const onlineSet = new Set((users || []).map(u => String(u.Id)));
            const friendItems = document.querySelectorAll('#friendsList .friend-item');
            friendItems.forEach(item => {
                const friendId = item.getAttribute('data-friend-id');
                if (!friendId) return;
                const isOnline = onlineSet.has(String(friendId));
                this.applyPresenceToFriendItem(item, isOnline);
            });
        } catch (e) {
            console.warn('syncFriendsPresence error:', e);
        }
    }

    setFriendOnlineState(userId, isOnline) {
        try {
            const item = document.querySelector(`#friendsList .friend-item[data-friend-id="${userId}"]`);
            if (item) {
                this.applyPresenceToFriendItem(item, isOnline);
            }
        } catch (e) {
            console.warn('setFriendOnlineState error:', e);
        }
    }

    applyPresenceToFriendItem(item, isOnline) {
        // Dot indicator
        const dot = item.querySelector('.friend-status-indicator');
        if (dot) {
            dot.classList.remove('bg-green-500', 'bg-gray-500');
            dot.classList.add(isOnline ? 'bg-green-500' : 'bg-gray-500');
        }
        // Status text (use stable class)
        const statusText = item.querySelector('.friend-status-text');
        if (statusText) {
            statusText.textContent = isOnline ? 'Online' : 'Offline';
            statusText.classList.remove('text-gray-400', 'text-gray-500');
            statusText.classList.add(isOnline ? 'text-gray-400' : 'text-gray-500');
        }
        // Optional: opacity styling if you want to dim offline users (kept subtle)
        item.style.opacity = isOnline ? '1' : '0.95';
    }

    addOnlineUser(userId, userName) {
        const onlineUsersList = document.getElementById('onlineUsersList');
        if (!onlineUsersList) return;
        // prevent self and duplicates
        const selfId = window.currentUserId ? String(window.currentUserId) : null;
        if (selfId && String(userId) === selfId) return;
        // only show if user is in friends list
        const isFriend = !!document.querySelector(`#friendsList .friend-item[data-friend-id="${userId}"]`);
        if (!isFriend) return;
        if (onlineUsersList.querySelector(`[data-user-id="${userId}"]`)) return;
        this.onlineUserIds.add(String(userId));
        const userElement = this.createUserElement({
            Id: userId,
            UserName: userName,
            DisplayName: userName,
            Avatar: null,
            IsOnline: true
        });
        onlineUsersList.appendChild(userElement);
    }

    removeOnlineUser(userId) {
        const onlineUsersList = document.getElementById('onlineUsersList');
        if (!onlineUsersList) return;
        const userElement = onlineUsersList.querySelector(`[data-user-id="${userId}"]`);
        if (userElement) userElement.remove();
        this.onlineUserIds.delete(String(userId));
    }

    // Expose presence
    isUserOnline(userId) {
        return this.onlineUserIds.has(String(userId));
    }

    relayPresenceToUI() {
        try {
            const event = new CustomEvent('presence:updated');
            window.dispatchEvent(event);
        } catch (_) {}
    }

    createUserElement(user) {
        const userDiv = document.createElement('div');
        userDiv.className = 'flex items-center justify-between p-2 hover:bg-gray-700 rounded';
        userDiv.setAttribute('data-user-id', user.Id);
        
        userDiv.innerHTML = `
            <div class="flex items-center">
                <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                    ${user.Avatar ? 
                        `<img src="${user.Avatar}" alt="${user.DisplayName}" class="w-8 h-8 rounded-full">` :
                        `<span class="text-sm font-semibold text-white">${user.DisplayName.charAt(0).toUpperCase()}</span>`
                    }
                </div>
                <span class="text-white text-sm">${user.DisplayName}</span>
            </div>
            <div class="flex space-x-2">
                <button class="call-btn bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs" 
                        data-user-id="${user.Id}" data-call-type="audio">
                    <i class="fas fa-phone"></i>
                </button>
                <button class="call-btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs" 
                        data-user-id="${user.Id}" data-call-type="video">
                    <i class="fas fa-video"></i>
                </button>
            </div>
        `;
        
        return userDiv;
    }

    async getOnlineUsers() {
        try {
            await this.connection.invoke("GetOnlineUsers");
        } catch (error) {
            console.error("Error getting online users:", error);
        }
    }

    showNotification(message, type = 'info') {
        // Use existing notification function if available
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Initialize WebRTC when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.webrtcManager = new WebRTCManager();
});
