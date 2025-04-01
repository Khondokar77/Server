const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());

// Store connected users with their data
const users = new Map();

io.on("connection", (socket) => {
    console.log("A user connected");

    // Handle new user joining
    socket.on("join", (userData) => {
        // Store user data with socket ID as key
        users.set(socket.id, {
            username: userData.username,
            avatarUrl: userData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username)}&background=random&color=fff&size=100`,
            socketId: socket.id
        });

        // Broadcast updated user list to all clients
        broadcastUserList();

        // Send welcome message to the new user
        socket.emit("systemMessage", {
            text: `Welcome to the chat, ${userData.username}!`,
            timestamp: userData.timestamp
        });

        // Notify others about the new user
        socket.broadcast.emit("systemMessage", {
            text: `${userData.username} joined the chat`,
            timestamp: userData.timestamp
        });
    });

    // Handle message sending
    socket.on("sendMessage", (data) => {
        const user = users.get(socket.id);
        if (!user) return;

        // Broadcast message to all clients including sender
        io.emit("receiveMessage", {
            username: user.username,
            avatarUrl: user.avatarUrl,
            message: data.message,
            timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // Handle typing indicator
    socket.on("typing", (data) => {
        const user = users.get(socket.id);
        if (!user) return;

        // Broadcast typing status to all except sender
        socket.broadcast.emit("typing", {
            isTyping: data.isTyping,
            username: user.username
        });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        const user = users.get(socket.id);
        if (user) {
            // Notify others about user leaving
            io.emit("systemMessage", {
                text: `${user.username} left the chat`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

            // Remove user from map
            users.delete(socket.id);

            // Broadcast updated user list
            broadcastUserList();
        }
    });

    // Function to broadcast updated user list
    function broadcastUserList() {
        const userArray = Array.from(users.values());
        io.emit("updateUsers", userArray);
        io.emit("userCount", users.size);
    }
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});