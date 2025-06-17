/**
 * WebSocket Server Examples
 * 
 * Run with: bun run examples/websocket.ts
 * Test with WebSocket clients or browser console:
 * 
 * const ws = new WebSocket('ws://localhost:3001');
 * ws.onmessage = (event) => console.log('Received:', event.data);
 * ws.send('Hello Server!');
 */

import {
	createWebSocketServer,
	createEchoServer,
	createChatServer,
	WebSocketClient,
} from "../src/index.ts";

console.log("🚀 Starting WebSocket server examples...\n");

// Example 1: Basic WebSocket Server
console.log("1️⃣ Basic WebSocket Server (Port 3001)");
const basicServer = createWebSocketServer({
	port: 3001,
	websocket: {
		open(ws) {
			console.log("📝 Client connected to basic server");
			ws.send("Welcome to the basic WebSocket server!");
		},

		message(ws, message) {
			const msg = message.toString();
			console.log("📨 Received:", msg);
			
			// Echo with timestamp
			ws.send(`Echo [${new Date().toLocaleTimeString()}]: ${msg}`);
		},

		close(ws, code, reason) {
			console.log(`📝 Client disconnected: ${code} ${reason}`);
		},

		error(ws, error) {
			console.error("❌ WebSocket error:", error);
		},
	},
});

// Example 2: Echo Server
console.log("2️⃣ Echo Server (Port 3002)");
const echoServer = createEchoServer(3002);

// Example 3: Chat Server with Rooms
console.log("3️⃣ Chat Server with Rooms (Port 3003)");
const chatServer = createChatServer(3003);

// Example 4: Broadcasting Server
console.log("4️⃣ Broadcasting Server (Port 3004)");
const broadcastServer = createWebSocketServer({
	port: 3004,
	websocket: {
		open(ws) {
			console.log("📢 Client connected to broadcast server");
			ws.subscribe("announcements");
			ws.send("Connected to broadcast server. You'll receive announcements!");
		},

		message(ws, message) {
			const msg = message.toString();
			
			// Admin commands
			if (msg.startsWith("/broadcast ")) {
				const announcement = msg.slice(11);
				console.log(`📢 Broadcasting: ${announcement}`);
				broadcastServer.publish("announcements", `📢 Announcement: ${announcement}`);
				ws.send("✅ Broadcast sent!");
			} else {
				ws.send(`You said: ${msg}. Use "/broadcast <message>" to send announcements.`);
			}
		},
	},
});

// Example 5: Real-time Data Server
console.log("5️⃣ Real-time Data Server (Port 3005)");
const dataServer = createWebSocketServer({
	port: 3005,
	websocket: {
		open(ws) {
			console.log("📊 Client connected to data server");
			ws.subscribe("data-feed");
			ws.send("Connected to real-time data feed!");
		},
	},
});

// Send real-time data every 2 seconds
setInterval(() => {
	const data = {
		timestamp: Date.now(),
		temperature: Math.round((Math.random() * 40 + 10) * 100) / 100,
		humidity: Math.round((Math.random() * 50 + 30) * 100) / 100,
		pressure: Math.round((Math.random() * 100 + 1000) * 100) / 100,
	};
	
	dataServer.publish("data-feed", JSON.stringify({
		type: "sensor-data",
		data,
	}));
}, 2000);

// Example 6: WebSocket Client Demo
console.log("6️⃣ WebSocket Client Demo");

setTimeout(async () => {
	console.log("\n🔌 Testing WebSocket client...");
	
	const client = new WebSocketClient("ws://localhost:3001", {
		open() {
			console.log("✅ Client connected successfully");
		},
		
		message(ws, message) {
			console.log("📨 Client received:", message);
		},
		
		close() {
			console.log("🔌 Client disconnected");
		},
	});

	try {
		await client.connect();
		client.send("Hello from WebSocket client!");
		
		setTimeout(() => {
			client.send("Testing automated client");
		}, 1000);
		
		setTimeout(() => {
			client.close();
		}, 3000);
	} catch (error) {
		console.error("❌ Client error:", error);
	}
}, 2000);

// Example 7: Chat Room Demo
console.log("7️⃣ Chat Room Demo");

setTimeout(async () => {
	console.log("\n💬 Testing chat rooms...");
	
	const chatClient1 = new WebSocketClient("ws://localhost:3003", {
		message(ws, message) {
			console.log("👤 User1 received:", message);
		},
	});
	
	const chatClient2 = new WebSocketClient("ws://localhost:3003", {
		message(ws, message) {
			console.log("👥 User2 received:", message);
		},
	});

	try {
		await chatClient1.connect();
		await chatClient2.connect();
		
		// Join room
		chatClient1.send(JSON.stringify({
			type: "join",
			room: "general"
		}));
		
		chatClient2.send(JSON.stringify({
			type: "join", 
			room: "general"
		}));
		
		setTimeout(() => {
			// Send messages
			chatClient1.send(JSON.stringify({
				type: "message",
				room: "general",
				message: "Hello from User1!"
			}));
			
			chatClient2.send(JSON.stringify({
				type: "message",
				room: "general", 
				message: "Hi User1, this is User2!"
			}));
		}, 1000);
		
		setTimeout(() => {
			chatClient1.close();
			chatClient2.close();
		}, 5000);
		
	} catch (error) {
		console.error("❌ Chat demo error:", error);
	}
}, 5000);

console.log(`
📚 WebSocket Examples Running:

1. Basic Server: ws://localhost:3001
   - Simple echo with timestamps
   - Connection logging

2. Echo Server: ws://localhost:3002
   - Pure echo functionality

3. Chat Server: ws://localhost:3003
   - Room-based messaging
   - JSON message format:
     {"type": "join", "room": "roomname"}
     {"type": "message", "room": "roomname", "message": "text"}

4. Broadcast Server: ws://localhost:3004
   - Admin announcements
   - Use "/broadcast <message>" to send

5. Real-time Data: ws://localhost:3005
   - Live sensor data every 2 seconds
   - Automatic data feed

🧪 Testing:
- Browser Console: new WebSocket('ws://localhost:3001')
- WebSocket clients will connect automatically in 2-7 seconds

Press Ctrl+C to stop all servers
`);

// Graceful shutdown
process.on("SIGINT", () => {
	console.log("\n🛑 Shutting down WebSocket servers...");
	basicServer.stop();
	echoServer.stop();
	chatServer.stop();
	broadcastServer.stop();
	dataServer.stop();
	process.exit(0);
});