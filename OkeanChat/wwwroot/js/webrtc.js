// WebRTC functionality for OkeanChat

class WebRTCManager {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.currentCall = null;
        this.connection = null;
        this.isInCall = false;
        this.pendingOffer = null;
        this.pendingIceCandidates = []; // Store ICE candidates received before peer connection is ready
        this.onlineUserIds = new Set();
        this.presenceIntervalId = null;
        this.isCaller = false;
        this.callState = 'idle'; // idle, calling, ringing, connecting, connected, ended
        this.isMuted = false;
        this.isVideoEnabled = true;
        this.callTimeoutId = null;
        this.iceGatheringTimeoutId = null;
        
        // WebRTC configuration with multiple STUN servers for better connectivity
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
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
        this.connection.on("IncomingCall", (callerInfo, callType) => {
            // Store call info immediately
            this.currentCall = { 
                userId: callerInfo.Id, 
                userName: callerInfo.DisplayName || callerInfo.UserName,
                avatar: callerInfo.Avatar,
                callType: callType 
            };
            this.isCaller = false;
            this.callState = 'ringing';
            this.showIncomingCallModal(callerInfo, callType);
        });

        this.connection.on("CallInitiated", (targetUserId, callType) => {
            if (this.currentCall && this.currentCall.userId === targetUserId) {
                this.callState = 'calling';
                this.updateCallInfo('Calling...');
            }
        });

        this.connection.on("ReceiveOffer", (callerInfo, offer) => {
            this.handleReceiveOffer(callerInfo, offer);
        });

        this.connection.on("ReceiveAnswer", (receiverInfo, answer) => {
            this.handleReceiveAnswer(receiverInfo, answer);
        });

        this.connection.on("ReceiveIceCandidate", (userInfo, candidate) => {
            this.handleReceiveIceCandidate(userInfo.Id, candidate);
        });

        this.connection.on("CallAccepted", (receiverInfo) => {
            this.handleCallAccepted(receiverInfo);
        });

        this.connection.on("CallRejected", (receiverInfo) => {
            this.handleCallRejected(receiverInfo);
        });

        this.connection.on("CallEnded", (userInfo) => {
            this.handleCallEnded(userInfo);
        });

        this.connection.on("CallError", (errorMessage) => {
            this.handleCallError(errorMessage);
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
            if (e.target.closest('.call-btn')) {
                const btn = e.target.closest('.call-btn');
                const userId = btn.dataset.userId;
                const callType = btn.dataset.callType;
                this.startCall(userId, callType);
            }
            
            if (e.target.closest('.end-call-btn')) {
                this.endCall();
            }
            
            if (e.target.closest('.accept-call-btn')) {
                this.acceptCall();
            }
            
            if (e.target.closest('.reject-call-btn')) {
                this.rejectCall();
            }
            
            if (e.target.closest('#muteBtn') || e.target.closest('#muteBtn i')) {
                this.toggleMute();
            }
            
            if (e.target.closest('#videoBtn') || e.target.closest('#videoBtn i')) {
                this.toggleVideo();
            }
        });
    }

    async startCall(userId, callType) {
        try {
            if (this.isInCall || this.callState !== 'idle') {
                this.showNotification("You are already in a call", "error");
                return;
            }

            this.currentCall = { userId, callType };
            this.isCaller = true;
            this.callState = 'calling';
            this.isMuted = false;
            this.isVideoEnabled = callType === 'video';
            this.pendingIceCandidates = [];
            
            // Get user media with error handling
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: callType === 'video',
                    audio: true
                });
            } catch (mediaError) {
                console.error("Media access error:", mediaError);
                if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
                    this.showNotification("Camera/Microphone permission denied. Please enable permissions and try again.", "error");
                } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
                    this.showNotification("No camera/microphone found. Please connect a device and try again.", "error");
                } else {
                    this.showNotification("Failed to access camera/microphone. Please check your device settings.", "error");
                }
                this.cleanup();
                return;
            }

            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.config);

            // Handle connection state changes
            this.peerConnection.onconnectionstatechange = () => {
                console.log("Peer connection state:", this.peerConnection.connectionState);
                if (this.peerConnection.connectionState === 'connected') {
                    this.callState = 'connected';
                    this.updateCallInfo('Connected');
                    this.clearCallTimeout();
                } else if (this.peerConnection.connectionState === 'disconnected' || 
                          this.peerConnection.connectionState === 'failed' ||
                          this.peerConnection.connectionState === 'closed') {
                    if (this.callState !== 'ended') {
                        this.handleCallEnded(null);
                    }
                }
            };

            // Handle ICE connection state
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log("ICE connection state:", this.peerConnection.iceConnectionState);
                if (this.peerConnection.iceConnectionState === 'connected' || 
                    this.peerConnection.iceConnectionState === 'completed') {
                    this.clearCallTimeout();
                } else if (this.peerConnection.iceConnectionState === 'failed') {
                    this.showNotification("Connection failed. Please try again.", "error");
                    this.handleCallEnded(null);
                }
            };

            // Add local stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                console.log("Received remote stream");
                this.remoteStream = event.streams[0];
                this.setupRemoteVideo();
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.connection.invoke("SendIceCandidate", userId, JSON.stringify(event.candidate))
                        .catch(err => console.error("Error sending ICE candidate:", err));
                } else {
                    // ICE gathering complete
                    console.log("ICE gathering complete");
                }
            };

            // Set timeout for call (60 seconds)
            this.setCallTimeout(60000);

            // Create and send offer
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: callType === 'video'
            });
            await this.peerConnection.setLocalDescription(offer);

            // Initiate call through hub (this sends IncomingCall to receiver)
            await this.connection.invoke("InitiateCall", userId, callType);

            // Send offer to receiver
            await this.connection.invoke("SendOffer", userId, JSON.stringify(offer));

            // Show call interface (waiting for answer)
            this.showCallInterface(callType, true);
            this.updateCallInfo('Calling...');

        } catch (error) {
            console.error("Error starting call:", error);
            this.cleanup();
            this.showNotification("Failed to start call: " + (error.message || "Unknown error"), "error");
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
            this.isCaller = false;
            this.callState = 'connecting';
            this.isInCall = true;
            this.isMuted = false;
            this.isVideoEnabled = callType === 'video';
            this.pendingIceCandidates = [];

            // Notify hub that call is accepted
            await this.connection.invoke("AcceptCall", callerId);

            // Get user media with error handling
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: callType === 'video',
                    audio: true
                });
            } catch (mediaError) {
                console.error("Media access error:", mediaError);
                this.showNotification("Failed to access camera/microphone. Please check permissions.", "error");
                await this.rejectCall();
                return;
            }

            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.config);

            // Handle connection state changes
            this.peerConnection.onconnectionstatechange = () => {
                console.log("Peer connection state:", this.peerConnection.connectionState);
                if (this.peerConnection.connectionState === 'connected') {
                    this.callState = 'connected';
                    this.updateCallInfo('Connected');
                    this.clearCallTimeout();
                } else if (this.peerConnection.connectionState === 'disconnected' || 
                          this.peerConnection.connectionState === 'failed' ||
                          this.peerConnection.connectionState === 'closed') {
                    if (this.callState !== 'ended') {
                        this.handleCallEnded(null);
                    }
                }
            };

            // Handle ICE connection state
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log("ICE connection state:", this.peerConnection.iceConnectionState);
                if (this.peerConnection.iceConnectionState === 'connected' || 
                    this.peerConnection.iceConnectionState === 'completed') {
                    this.clearCallTimeout();
                } else if (this.peerConnection.iceConnectionState === 'failed') {
                    this.showNotification("Connection failed. Please try again.", "error");
                    this.handleCallEnded(null);
                }
            };

            // Add local stream
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                console.log("Received remote stream");
                this.remoteStream = event.streams[0];
                this.setupRemoteVideo();
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.connection.invoke("SendIceCandidate", callerId, JSON.stringify(event.candidate))
                        .catch(err => console.error("Error sending ICE candidate:", err));
                } else {
                    console.log("ICE gathering complete");
                }
            };

            // Set timeout for call
            this.setCallTimeout(60000);

            // Process pending offer if available
            if (this.pendingOffer && this.pendingOffer.callerId === callerId) {
                try {
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingOffer.offer));
                    this.pendingOffer = null;
                    
                    // Process any pending ICE candidates
                    for (const candidate of this.pendingIceCandidates) {
                        try {
                            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (err) {
                            console.warn("Error adding pending ICE candidate:", err);
                        }
                    }
                    this.pendingIceCandidates = [];
                    
                    // Create and send answer
                    const answer = await this.peerConnection.createAnswer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: callType === 'video'
                    });
                    await this.peerConnection.setLocalDescription(answer);
                    await this.connection.invoke("SendAnswer", callerId, JSON.stringify(answer));
                } catch (error) {
                    console.error("Error processing offer:", error);
                    this.showNotification("Error processing call offer", "error");
                    await this.rejectCall();
                    return;
                }
            }

            // Show call interface
            this.showCallInterface(callType, false);
            this.hideIncomingCallModal();
            this.updateCallInfo('Connecting...');

        } catch (error) {
            console.error("Error accepting call:", error);
            this.cleanup();
            this.showNotification("Failed to accept call: " + (error.message || "Unknown error"), "error");
            this.hideIncomingCallModal();
        }
    }

    async handleReceiveOffer(callerInfo, offer) {
        try {
            const callerId = callerInfo.Id || callerInfo;
            const offerObj = typeof offer === 'string' ? JSON.parse(offer) : offer;
            
            // If we're the receiver and have accepted the call, handle the offer immediately
            if (this.peerConnection && this.currentCall && this.currentCall.userId === callerId && !this.isCaller && this.isInCall) {
                try {
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerObj));
                    
                    // Process any pending ICE candidates
                    for (const candidate of this.pendingIceCandidates) {
                        try {
                            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (err) {
                            console.warn("Error adding pending ICE candidate:", err);
                        }
                    }
                    this.pendingIceCandidates = [];
                    
                    // Create and send answer if not already sent
                    if (this.peerConnection.localDescription === null) {
                        const callType = this.currentCall.callType;
                        const answer = await this.peerConnection.createAnswer({
                            offerToReceiveAudio: true,
                            offerToReceiveVideo: callType === 'video'
                        });
                        await this.peerConnection.setLocalDescription(answer);
                        await this.connection.invoke("SendAnswer", callerId, JSON.stringify(answer));
                    }
                } catch (error) {
                    console.error("Error processing offer:", error);
                    this.showNotification("Error processing call offer", "error");
                }
            } else {
                // Store offer for when user accepts
                this.pendingOffer = { callerId, offer: offerObj };
            }
            
        } catch (error) {
            console.error("Error handling offer:", error);
            this.showNotification("Error handling call offer", "error");
        }
    }

    async handleReceiveAnswer(receiverInfo, answer) {
        try {
            if (!this.peerConnection) {
                console.warn("Received answer but no peer connection");
                return;
            }
            
            // Only process if we're the caller and waiting for answer
            if (!this.isCaller || (this.callState !== 'calling' && this.callState !== 'connecting')) {
                console.warn("Received answer but not in correct state");
                return;
            }
            
            const answerObj = typeof answer === 'string' ? JSON.parse(answer) : answer;
            
            // Check if we already have a remote description
            if (this.peerConnection.remoteDescription) {
                console.warn("Already have remote description, ignoring duplicate answer");
                return;
            }
            
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerObj));
            
            // Process any pending ICE candidates
            for (const candidate of this.pendingIceCandidates) {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.warn("Error adding pending ICE candidate:", err);
                }
            }
            this.pendingIceCandidates = [];
            
            this.callState = 'connecting';
            this.updateCallInfo('Connecting...');
        } catch (error) {
            console.error("Error handling answer:", error);
            this.showNotification("Error handling call answer", "error");
        }
    }

    async handleReceiveIceCandidate(userId, candidate) {
        try {
            const candidateObj = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
            
            if (!this.peerConnection) {
                // Store candidate for later if peer connection not ready
                this.pendingIceCandidates.push(candidateObj);
                return;
            }
            
            // Only add if remote description is set
            if (this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateObj));
            } else {
                // Store candidate for later
                this.pendingIceCandidates.push(candidateObj);
            }
        } catch (error) {
            // Ignore errors for ICE candidates that are already processed
            if (error.message && !error.message.includes('already processed') && 
                !error.message.includes('InvalidStateError')) {
                console.error("Error handling ICE candidate:", error);
            }
        }
    }

    handleCallAccepted(receiverInfo) {
        if (this.isCaller && this.callState === 'calling') {
            this.callState = 'connecting';
            this.isInCall = true;
            const userName = receiverInfo?.DisplayName || receiverInfo?.UserName || 'User';
            this.updateCallInfo(`Call accepted by ${userName}, connecting...`);
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

    handleCallRejected(receiverInfo) {
        const userName = receiverInfo?.DisplayName || receiverInfo?.UserName || 'User';
        this.showNotification(`Call was rejected by ${userName}`, "info");
        this.callState = 'ended';
        this.cleanup();
        this.hideCallInterface();
        this.hideIncomingCallModal();
    }

    handleCallEnded(userInfo) {
        if (userInfo) {
            const userName = userInfo.DisplayName || userInfo.UserName || 'User';
            this.showNotification(`Call ended by ${userName}`, "info");
        } else {
            this.showNotification("Call ended", "info");
        }
        this.callState = 'ended';
        this.cleanup();
        this.hideCallInterface();
        this.hideIncomingCallModal();
    }

    handleCallError(errorMessage) {
        this.showNotification(errorMessage || "Call error occurred", "error");
        this.callState = 'ended';
        this.cleanup();
        this.hideCallInterface();
        this.hideIncomingCallModal();
    }

    cleanup() {
        this.clearCallTimeout();
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            this.localStream = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            this.remoteStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.onicecandidate = null;
            this.peerConnection.ontrack = null;
            this.peerConnection.onconnectionstatechange = null;
            this.peerConnection.oniceconnectionstatechange = null;
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.currentCall = null;
        this.isInCall = false;
        this.isCaller = false;
        this.pendingOffer = null;
        this.pendingIceCandidates = [];
        this.callState = 'idle';
        this.isMuted = false;
        this.isVideoEnabled = true;
    }
    
    setCallTimeout(duration) {
        this.clearCallTimeout();
        this.callTimeoutId = setTimeout(() => {
            if (this.callState === 'calling' || this.callState === 'ringing') {
                this.showNotification("Call timeout. No response received.", "error");
                this.handleCallEnded(null);
            }
        }, duration);
    }
    
    clearCallTimeout() {
        if (this.callTimeoutId) {
            clearTimeout(this.callTimeoutId);
            this.callTimeoutId = null;
        }
    }
    
    toggleMute() {
        if (!this.localStream) return;
        
        this.isMuted = !this.isMuted;
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = !this.isMuted;
        });
        
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            const icon = muteBtn.querySelector('i');
            if (icon) {
                icon.className = this.isMuted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
            }
            muteBtn.classList.toggle('bg-red-600', this.isMuted);
            muteBtn.classList.toggle('bg-gray-600', !this.isMuted);
        }
    }
    
    toggleVideo() {
        if (!this.localStream || !this.currentCall || this.currentCall.callType !== 'video') return;
        
        this.isVideoEnabled = !this.isVideoEnabled;
        this.localStream.getVideoTracks().forEach(track => {
            track.enabled = this.isVideoEnabled;
        });
        
        const videoBtn = document.getElementById('videoBtn');
        if (videoBtn) {
            const icon = videoBtn.querySelector('i');
            if (icon) {
                icon.className = this.isVideoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
            }
            videoBtn.classList.toggle('bg-red-600', !this.isVideoEnabled);
            videoBtn.classList.toggle('bg-gray-600', this.isVideoEnabled);
        }
        
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.style.opacity = this.isVideoEnabled ? '1' : '0.5';
        }
    }

    setupRemoteVideo() {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && this.remoteStream) {
            remoteVideo.srcObject = this.remoteStream;
        }
    }

    showIncomingCallModal(callerInfo, callType) {
        const modal = document.getElementById('incomingCallModal');
        const callerNameElement = document.getElementById('callerName');
        const callTypeElement = document.getElementById('callType');
        
        const callerName = callerInfo.DisplayName || callerInfo.UserName || 'Unknown';
        if (callerNameElement) callerNameElement.textContent = callerName;
        if (callTypeElement) callTypeElement.textContent = callType === 'video' ? 'Video Call' : 'Audio Call';
        
        // Update icon based on call type
        if (modal) {
            const iconContainer = modal.querySelector('.bg-blue-500, .w-16');
            if (iconContainer) {
                const icon = iconContainer.querySelector('i');
                if (icon) {
                    icon.className = callType === 'video' ? 'fas fa-video text-white text-2xl' : 'fas fa-phone text-white text-2xl';
                }
            }
            
            // Show avatar if available
            if (callerInfo.Avatar) {
                const avatarImg = iconContainer?.querySelector('img');
                if (avatarImg) {
                    avatarImg.src = callerInfo.Avatar;
                    avatarImg.style.display = 'block';
                } else if (iconContainer) {
                    iconContainer.innerHTML = `<img src="${callerInfo.Avatar}" alt="${callerName}" class="w-full h-full rounded-full object-cover">`;
                }
            }
            
            modal.classList.remove('hidden');
        }
    }

    updateCallInfo(message) {
        const callInfo = document.getElementById('callInfo');
        if (callInfo) {
            callInfo.textContent = message;
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
        const controlsContainer = callInterface?.querySelector('.absolute.bottom-4');
        
        if (callInterface) {
            callInterface.classList.remove('hidden');
        }
        
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
        }
        
        // Update call info
        if (callInfo) {
            const userName = this.currentCall?.userName || 'User';
            callInfo.textContent = callType === 'video' ? `Video Call with ${userName}` : `Audio Call with ${userName}`;
        }
        
        // Update controls with mute/video buttons
        const muteBtn = document.getElementById('muteBtn');
        const videoBtn = document.getElementById('videoBtn');
        
        if (muteBtn) {
            muteBtn.classList.remove('hidden');
            const icon = muteBtn.querySelector('i');
            if (icon) {
                icon.className = this.isMuted ? 'fas fa-microphone-slash text-xl' : 'fas fa-microphone text-xl';
            }
            muteBtn.classList.toggle('bg-red-600', this.isMuted);
            muteBtn.classList.toggle('bg-gray-600', !this.isMuted);
        }
        
        if (videoBtn) {
            if (callType === 'video') {
                videoBtn.classList.remove('hidden');
                const icon = videoBtn.querySelector('i');
                if (icon) {
                    icon.className = this.isVideoEnabled ? 'fas fa-video text-xl' : 'fas fa-video-slash text-xl';
                }
                videoBtn.classList.toggle('bg-red-600', !this.isVideoEnabled);
                videoBtn.classList.toggle('bg-gray-600', this.isVideoEnabled);
            } else {
                videoBtn.classList.add('hidden');
            }
        }
        
        // Show/hide video elements based on call type
        if (callType === 'audio') {
            if (localVideo) localVideo.style.display = 'none';
            if (remoteVideo) remoteVideo.style.display = 'none';
            // Show audio placeholder
            if (remoteVideo && remoteVideo.parentElement) {
                let audioPlaceholder = remoteVideo.parentElement.querySelector('.audio-placeholder');
                if (!audioPlaceholder) {
                    audioPlaceholder = document.createElement('div');
                    audioPlaceholder.className = 'audio-placeholder w-full h-full flex items-center justify-center bg-gray-800';
                    const userName = this.currentCall?.userName || 'User';
                    audioPlaceholder.innerHTML = `
                        <div class="text-center">
                            <div class="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-phone text-white text-5xl"></i>
                            </div>
                            <p class="text-white text-2xl font-semibold">${userName}</p>
                            <p class="text-gray-400 text-lg mt-2">Audio Call</p>
                        </div>
                    `;
                    remoteVideo.parentElement.appendChild(audioPlaceholder);
                }
            }
        } else {
            if (localVideo) {
                localVideo.style.display = 'block';
                localVideo.style.opacity = this.isVideoEnabled ? '1' : '0.5';
            }
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
