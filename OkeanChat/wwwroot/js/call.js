// WebRTC Mesh P2P Call Manager
// Mỗi user tạo peer connection với tất cả users khác trong room

class MeshCallManager {
    constructor() {
        this.localStream = null;
        this.peers = {}; // userId -> { peerConnection, videoElement, userInfo }
        this.currentRoomId = null;
        this.currentUserId = null;
        this.currentUserName = null;
        this.connection = null;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.pendingIceCandidates = {}; // userId -> [candidates]
        
        // WebRTC configuration
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
            .withUrl("/callHub")
            .withAutomaticReconnect()
            .build();

        this.connection.start().then(() => {
            console.log("Call Hub connected");
        }).catch(err => {
            console.error("Call Hub connection error:", err);
            this.showNotification("Failed to connect to call server", "error");
        });

        // SignalR event handlers
        this.connection.on("JoinedRoom", (data) => {
            this.handleJoinedRoom(data);
        });

        this.connection.on("UserJoined", (userInfo) => {
            this.handleUserJoined(userInfo);
        });

        this.connection.on("UserLeft", (data) => {
            this.handleUserLeft(data.UserId);
        });

        this.connection.on("ReceiveOffer", (fromUser, offer) => {
            this.handleReceiveOffer(fromUser, offer);
        });

        this.connection.on("ReceiveAnswer", (fromUser, answer) => {
            this.handleReceiveAnswer(fromUser, answer);
        });

        this.connection.on("ReceiveIceCandidate", (fromUser, candidate) => {
            this.handleReceiveIceCandidate(fromUser, candidate);
        });

        this.connection.on("Error", (message) => {
            this.showNotification(message, "error");
        });

        this.connection.on("RoomUsers", (users) => {
            // Filter out current user from the list
            const otherUsers = users.filter(u => u.UserId !== this.currentUserId);
            this.updateRoomUsersList(otherUsers);
        });
    }

    setupEventListeners() {
        // Start call button
        const startCallBtn = document.getElementById('startCallBtn');
        if (startCallBtn) {
            startCallBtn.addEventListener('click', () => this.startCall());
        }

        // Toggle mic button
        const toggleMicBtn = document.getElementById('toggleMicBtn');
        if (toggleMicBtn) {
            toggleMicBtn.addEventListener('click', () => this.toggleMic());
        }

        // Toggle camera button
        const toggleCameraBtn = document.getElementById('toggleCameraBtn');
        if (toggleCameraBtn) {
            toggleCameraBtn.addEventListener('click', () => this.toggleCamera());
        }

        // Leave call button
        const leaveCallBtn = document.getElementById('leaveCallBtn');
        if (leaveCallBtn) {
            leaveCallBtn.addEventListener('click', () => this.leaveCall());
        }
    }

    async initLocalStream(video = true, audio = true) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: video,
                audio: audio
            });

            // Display local video
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
                localVideo.muted = true; // Mute local video to avoid echo
            }

            return true;
        } catch (error) {
            console.error("Error accessing media devices:", error);
            let errorMessage = "Failed to access camera/microphone. ";
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage += "Please allow camera/microphone access.";
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage += "No camera/microphone found.";
            } else {
                errorMessage += error.message;
            }
            this.showNotification(errorMessage, "error");
            return false;
        }
    }

    createPeerConnection(userId, userInfo) {
        const peerConnection = new RTCPeerConnection(this.config);

        // Add local stream tracks to peer connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log(`Received remote stream from ${userId}`);
            const remoteStream = event.streams[0];
            
            // Update or create video element
            this.updateRemoteVideo(userId, remoteStream, userInfo);
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.connection.invoke("SendIceCandidate", userId, JSON.stringify(event.candidate), this.currentUserId)
                    .catch(err => console.error("Error sending ICE candidate:", err));
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`Peer connection state with ${userId}:`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
                this.showNotification(`Connection with ${userInfo?.DisplayName || userId} lost`, "warning");
            }
        };

        // Handle ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            console.log(`ICE connection state with ${userId}:`, peerConnection.iceConnectionState);
        };

        return peerConnection;
    }

    async startCall() {
        try {
            // Get room ID and user info from page
            const roomId = document.getElementById('roomId')?.value || window.roomId;
            const userId = document.getElementById('userId')?.value || window.userId;
            const userName = document.getElementById('userName')?.value || window.userName;

            if (!roomId || !userId) {
                this.showNotification("Room ID and User ID are required", "error");
                return;
            }

            this.currentRoomId = roomId;
            this.currentUserId = userId;
            this.currentUserName = userName;

            // Initialize local stream
            const hasMedia = await this.initLocalStream(true, true);
            if (!hasMedia) {
                return;
            }

            // Join room via SignalR
            await this.connection.invoke("JoinRoom", roomId, userId);

            // Update UI
            this.updateCallUI(true);
            this.showNotification("Call started", "success");

        } catch (error) {
            console.error("Error starting call:", error);
            this.showNotification("Failed to start call: " + error.message, "error");
        }
    }

    async handleJoinedRoom(data) {
        console.log("Joined room:", data);
        this.currentRoomId = data.RoomId;

        // Update room users list
        this.updateRoomUsersList(data.Users || []);

        // Create peer connections for existing users
        if (data.Users && data.Users.length > 0) {
            for (const user of data.Users) {
                await this.createPeerConnectionForUser(user);
            }
        }

        // Request room users list
        if (this.connection && this.currentRoomId) {
            await this.connection.invoke("GetRoomUsers", this.currentRoomId);
        }
    }

    async handleUserJoined(userInfo) {
        console.log("User joined:", userInfo);
        
        // Don't create connection if it's ourselves
        if (userInfo.UserId === this.currentUserId) {
            return;
        }

        // Show notification
        this.showNotification(`${userInfo.DisplayName || userInfo.UserName || userInfo.UserId} joined the call`, "info");

        // Create peer connection for new user
        await this.createPeerConnectionForUser(userInfo);

        // Update room users list
        if (this.connection && this.currentRoomId) {
            await this.connection.invoke("GetRoomUsers", this.currentRoomId);
        }
    }

    async createPeerConnectionForUser(userInfo) {
        const userId = userInfo.UserId;

        // Skip if peer connection already exists
        if (this.peers[userId]) {
            console.log(`Peer connection for ${userId} already exists`);
            return;
        }

        // Create video element for remote user
        const videoElement = this.createRemoteVideoElement(userId, userInfo);

        // Create peer connection
        const peerConnection = this.createPeerConnection(userId, userInfo);

        // Store peer connection
        this.peers[userId] = {
            peerConnection: peerConnection,
            videoElement: videoElement,
            userInfo: userInfo
        };

        // Initialize pending ICE candidates array
        this.pendingIceCandidates[userId] = [];

        // Create and send offer
        try {
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await peerConnection.setLocalDescription(offer);

            // Send offer via SignalR
            await this.connection.invoke("SendOffer", userId, JSON.stringify(offer), this.currentUserId);
        } catch (error) {
            console.error(`Error creating offer for ${userId}:`, error);
            this.showNotification(`Failed to connect to ${userInfo.DisplayName}`, "error");
        }
    }

    async handleReceiveOffer(fromUser, offer) {
        try {
            const userId = fromUser.UserId;

            // Check if peer connection exists
            let peerConnection = this.peers[userId]?.peerConnection;

            if (!peerConnection) {
                // Create peer connection if it doesn't exist
                const userInfo = {
                    UserId: userId,
                    UserName: fromUser.UserName,
                    DisplayName: fromUser.DisplayName,
                    Avatar: fromUser.Avatar || ''
                };

                const videoElement = this.createRemoteVideoElement(userId, userInfo);
                peerConnection = this.createPeerConnection(userId, userInfo);

                this.peers[userId] = {
                    peerConnection: peerConnection,
                    videoElement: videoElement,
                    userInfo: userInfo
                };

                this.pendingIceCandidates[userId] = [];
            }

            // Set remote description
            const offerObj = typeof offer === 'string' ? JSON.parse(offer) : offer;
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offerObj));

            // Process pending ICE candidates
            if (this.pendingIceCandidates[userId] && this.pendingIceCandidates[userId].length > 0) {
                for (const candidate of this.pendingIceCandidates[userId]) {
                    try {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        console.warn("Error adding pending ICE candidate:", err);
                    }
                }
                this.pendingIceCandidates[userId] = [];
            }

            // Create and send answer
            const answer = await peerConnection.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await peerConnection.setLocalDescription(answer);

            // Send answer via SignalR
            await this.connection.invoke("SendAnswer", userId, JSON.stringify(answer), this.currentUserId);

        } catch (error) {
            console.error("Error handling offer:", error);
            this.showNotification("Error handling call offer", "error");
        }
    }

    async handleReceiveAnswer(fromUser, answer) {
        try {
            const userId = fromUser.UserId;
            const peerConnection = this.peers[userId]?.peerConnection;

            if (!peerConnection) {
                console.warn(`No peer connection found for ${userId}`);
                return;
            }

            const answerObj = typeof answer === 'string' ? JSON.parse(answer) : answer;
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answerObj));

            // Process pending ICE candidates
            if (this.pendingIceCandidates[userId] && this.pendingIceCandidates[userId].length > 0) {
                for (const candidate of this.pendingIceCandidates[userId]) {
                    try {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        console.warn("Error adding pending ICE candidate:", err);
                    }
                }
                this.pendingIceCandidates[userId] = [];
            }

        } catch (error) {
            console.error("Error handling answer:", error);
        }
    }

    async handleReceiveIceCandidate(fromUser, candidate) {
        try {
            const userId = fromUser.UserId;
            const peerConnection = this.peers[userId]?.peerConnection;

            const candidateObj = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;

            if (peerConnection && peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidateObj));
            } else {
                // Store candidate for later
                if (!this.pendingIceCandidates[userId]) {
                    this.pendingIceCandidates[userId] = [];
                }
                this.pendingIceCandidates[userId].push(candidateObj);
            }
        } catch (error) {
            // Ignore errors for ICE candidates that are already processed
            if (error.message && !error.message.includes('already processed')) {
                console.error("Error handling ICE candidate:", error);
            }
        }
    }

    handleUserLeft(userId) {
        console.log("User left:", userId);
        const userInfo = this.peers[userId]?.userInfo;
        const userName = userInfo?.DisplayName || userInfo?.UserName || userId;
        this.removePeer(userId);
        this.showNotification(`${userName} left the call`, "info");

        // Update room users list
        if (this.connection && this.currentRoomId) {
            this.connection.invoke("GetRoomUsers", this.currentRoomId).catch(err => console.error(err));
        }
    }

    removePeer(userId) {
        const peer = this.peers[userId];
        if (peer) {
            // Close peer connection
            if (peer.peerConnection) {
                peer.peerConnection.close();
            }

            // Remove video element
            if (peer.videoElement && peer.videoElement.parentNode) {
                peer.videoElement.parentNode.removeChild(peer.videoElement);
            }

            // Remove from peers object
            delete this.peers[userId];
            delete this.pendingIceCandidates[userId];

            // Update grid layout
            this.updateVideoGrid();
        }
    }

    createRemoteVideoElement(userId, userInfo) {
        const videosContainer = document.getElementById('remoteVideosContainer');
        if (!videosContainer) {
            console.error("Remote videos container not found");
            return null;
        }

        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'remote-video-wrapper';
        videoWrapper.id = `video-wrapper-${userId}`;
        videoWrapper.setAttribute('data-user-id', userId);

        const video = document.createElement('video');
        video.id = `remoteVideo-${userId}`;
        video.autoplay = true;
        video.playsInline = true;
        video.className = 'remote-video';

        const videoLabel = document.createElement('div');
        videoLabel.className = 'video-label';
        videoLabel.textContent = userInfo.DisplayName || userInfo.UserName || userId;

        videoWrapper.appendChild(video);
        videoWrapper.appendChild(videoLabel);
        videosContainer.appendChild(videoWrapper);

        // Update grid layout
        this.updateVideoGrid();

        return video;
    }

    updateRemoteVideo(userId, stream, userInfo) {
        const peer = this.peers[userId];
        if (peer && peer.videoElement) {
            peer.videoElement.srcObject = stream;
        } else {
            // Create video element if it doesn't exist
            const videoElement = this.createRemoteVideoElement(userId, userInfo);
            if (videoElement) {
                videoElement.srcObject = stream;
                if (peer) {
                    peer.videoElement = videoElement;
                }
            }
        }
    }

    updateVideoGrid() {
        const container = document.getElementById('remoteVideosContainer');
        if (!container) return;

        const videoWrappers = container.querySelectorAll('.remote-video-wrapper');
        const count = videoWrappers.length;

        // Hide empty state if there are videos
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.style.display = count > 0 ? 'none' : 'flex';
        }

        // Calculate grid columns based on number of videos
        let columns = 1;
        if (count === 0) columns = 1;
        else if (count === 1) columns = 1;
        else if (count === 2) columns = 2;
        else if (count <= 4) columns = 2;
        else if (count <= 9) columns = 3;
        else columns = 4;

        container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    }

    toggleMic() {
        if (!this.localStream) return;

        this.isAudioEnabled = !this.isAudioEnabled;
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = this.isAudioEnabled;
        });

        const toggleMicBtn = document.getElementById('toggleMicBtn');
        if (toggleMicBtn) {
            const icon = toggleMicBtn.querySelector('i');
            if (icon) {
                icon.className = this.isAudioEnabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
            }
            toggleMicBtn.classList.toggle('muted', !this.isAudioEnabled);
        }

        this.showNotification(this.isAudioEnabled ? "Microphone enabled" : "Microphone muted", "info");
    }

    toggleCamera() {
        if (!this.localStream) return;

        this.isVideoEnabled = !this.isVideoEnabled;
        this.localStream.getVideoTracks().forEach(track => {
            track.enabled = this.isVideoEnabled;
        });

        const toggleCameraBtn = document.getElementById('toggleCameraBtn');
        if (toggleCameraBtn) {
            const icon = toggleCameraBtn.querySelector('i');
            if (icon) {
                icon.className = this.isVideoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
            }
            toggleCameraBtn.classList.toggle('muted', !this.isVideoEnabled);
        }

        // Update local video display
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.style.opacity = this.isVideoEnabled ? '1' : '0.5';
        }

        // Notify peers about video state change
        Object.values(this.peers).forEach(peer => {
            if (peer.peerConnection) {
                const videoTrack = this.localStream?.getVideoTracks()[0];
                if (videoTrack) {
                    const sender = peer.peerConnection.getSenders().find(s => 
                        s.track && s.track.kind === 'video'
                    );
                    if (sender) {
                        sender.track.enabled = this.isVideoEnabled;
                    }
                }
            }
        });

        this.showNotification(this.isVideoEnabled ? "Camera enabled" : "Camera disabled", "info");
    }

    async leaveCall() {
        try {
            // Leave room via SignalR
            if (this.currentRoomId && this.currentUserId) {
                await this.connection.invoke("LeaveRoom", this.currentRoomId, this.currentUserId);
            }

            // Close all peer connections
            Object.keys(this.peers).forEach(userId => {
                this.removePeer(userId);
            });

            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }

            // Clear local video
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = null;
            }

            // Reset state
            this.currentRoomId = null;
            this.peers = {};
            this.pendingIceCandidates = {};

            // Update UI
            this.updateCallUI(false);
            this.showNotification("Left the call", "info");

            // Redirect or hide call interface
            window.location.href = '/Home/Index';

        } catch (error) {
            console.error("Error leaving call:", error);
            this.showNotification("Error leaving call", "error");
        }
    }

    updateCallUI(isInCall) {
        const callInterface = document.getElementById('callInterface');
        const startCallScreen = document.getElementById('startCallScreen');
        const controls = document.getElementById('callControls');

        if (callInterface) {
            callInterface.style.display = isInCall ? 'flex' : 'none';
        }

        if (startCallScreen) {
            startCallScreen.style.display = isInCall ? 'none' : 'flex';
        }

        if (controls) {
            controls.style.display = isInCall ? 'flex' : 'none';
        }

        // Hide empty state when there are remote videos
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) {
            const hasRemoteVideos = Object.keys(this.peers).length > 0;
            emptyState.style.display = hasRemoteVideos ? 'none' : 'flex';
        }
    }

    updateRoomUsersList(users) {
        const usersList = document.getElementById('roomUsersList');
        const participantCount = document.getElementById('participantCount');
        
        if (!usersList) return;

        // Add current user to the list
        const allUsers = [...users];
        if (this.currentUserId) {
            allUsers.push({
                UserId: this.currentUserId,
                UserName: this.currentUserName || 'You',
                DisplayName: this.currentUserName || 'You',
                Avatar: document.getElementById('avatar')?.value || '',
                IsVideoEnabled: this.isVideoEnabled,
                IsAudioEnabled: this.isAudioEnabled
            });
        }

        usersList.innerHTML = '';
        allUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'room-user-item';
            const isCurrentUser = user.UserId === this.currentUserId;
            userItem.innerHTML = `
                <div class="user-avatar">
                    ${user.Avatar ? 
                        `<img src="${user.Avatar}" alt="${user.DisplayName}">` :
                        `<span>${(user.DisplayName || user.UserName || 'U').charAt(0).toUpperCase()}</span>`
                    }
                </div>
                <div class="user-info">
                    <div class="user-name">${user.DisplayName || user.UserName || user.UserId}${isCurrentUser ? ' (You)' : ''}</div>
                    <div class="user-status">
                        <span class="status-indicator ${user.IsVideoEnabled ? 'video-on' : 'video-off'}" title="Video ${user.IsVideoEnabled ? 'On' : 'Off'}"></span>
                        <span class="status-indicator ${user.IsAudioEnabled ? 'audio-on' : 'audio-off'}" title="Audio ${user.IsAudioEnabled ? 'On' : 'Off'}"></span>
                    </div>
                </div>
            `;
            usersList.appendChild(userItem);
        });

        // Update participant count
        if (participantCount) {
            participantCount.textContent = allUsers.length;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Add to page
        const container = document.getElementById('notificationsContainer') || document.body;
        container.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
let meshCallManager = null;

document.addEventListener('DOMContentLoaded', function() {
    meshCallManager = new MeshCallManager();
    window.meshCallManager = meshCallManager; // Make it globally accessible
});
