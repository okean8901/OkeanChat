// WebRTC functionality for OkeanChat

class WebRTCManager {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.currentCall = null;
        this.connection = null;
        this.isInCall = false;
        
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
        }).catch(err => console.error("WebRTC Hub connection error:", err));

        // SignalR event handlers
        this.connection.on("IncomingCall", (callerId, callerName, callType) => {
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
        });

        this.connection.on("UserOnline", (userId, userName) => {
            this.addOnlineUser(userId, userName);
        });

        this.connection.on("UserOffline", (userId) => {
            this.removeOnlineUser(userId);
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

            // Send call notification
            await this.connection.invoke("SendCallNotification", userId, callType);

            // Show call interface
            this.showCallInterface(callType, true);

        } catch (error) {
            console.error("Error starting call:", error);
            this.showNotification("Failed to start call. Please check your camera/microphone permissions.", "error");
        }
    }

    async acceptCall() {
        try {
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: this.currentCall.callType === 'video',
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
                    this.connection.invoke("SendIceCandidate", this.currentCall.userId, JSON.stringify(event.candidate));
                }
            };

            // Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.connection.invoke("SendAnswer", this.currentCall.userId, JSON.stringify(answer));

            // Show call interface
            this.showCallInterface(this.currentCall.callType, false);
            this.hideIncomingCallModal();

        } catch (error) {
            console.error("Error accepting call:", error);
            this.showNotification("Failed to accept call.", "error");
        }
    }

    async handleReceiveOffer(callerId, offer) {
        try {
            this.currentCall = { userId: callerId };
            
            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.config);

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

            // Set remote description
            await this.peerConnection.setRemoteDescription(JSON.parse(offer));

            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: this.currentCall.callType === 'video',
                audio: true
            });

            // Add local stream
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.connection.invoke("SendAnswer", callerId, JSON.stringify(answer));

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
            this.hideIncomingCallModal();
        } catch (error) {
            console.error("Error rejecting call:", error);
        }
    }

    handleCallRejected() {
        this.showNotification("Call was rejected", "info");
        this.cleanup();
        this.hideCallInterface();
    }

    handleCallEnded() {
        this.showNotification("Call ended", "info");
        this.cleanup();
        this.hideCallInterface();
    }

    cleanup() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.currentCall = null;
        this.isInCall = false;
    }

    setupRemoteVideo() {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
        }
    }

    showIncomingCallModal(callerId, callerName, callType) {
        const modal = document.getElementById('incomingCallModal');
        const callerNameElement = document.getElementById('callerName');
        const callTypeElement = document.getElementById('callType');
        
        if (callerNameElement) callerNameElement.textContent = callerName;
        if (callTypeElement) callTypeElement.textContent = callType === 'video' ? 'Video Call' : 'Audio Call';
        
        if (modal) {
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
        
        if (callInterface) {
            callInterface.classList.remove('hidden');
        }
        
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
        }
        
        // Show/hide video elements based on call type
        if (callType === 'audio') {
            if (localVideo) localVideo.style.display = 'none';
            if (remoteVideo) remoteVideo.style.display = 'none';
        } else {
            if (localVideo) localVideo.style.display = 'block';
            if (remoteVideo) remoteVideo.style.display = 'block';
        }
    }

    hideCallInterface() {
        const callInterface = document.getElementById('callInterface');
        if (callInterface) {
            callInterface.classList.add('hidden');
        }
    }

    updateOnlineUsers(users) {
        const onlineUsersList = document.getElementById('onlineUsersList');
        if (onlineUsersList) {
            onlineUsersList.innerHTML = '';
            users.forEach(user => {
                const userElement = this.createUserElement(user);
                onlineUsersList.appendChild(userElement);
            });
        }
    }

    addOnlineUser(userId, userName) {
        const onlineUsersList = document.getElementById('onlineUsersList');
        if (onlineUsersList) {
            const userElement = this.createUserElement({
                Id: userId,
                UserName: userName,
                DisplayName: userName,
                Avatar: null
            });
            onlineUsersList.appendChild(userElement);
        }
    }

    removeOnlineUser(userId) {
        const userElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (userElement) {
            userElement.remove();
        }
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
