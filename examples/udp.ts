/**
 * UDP Server Examples
 * 
 * Run with: bun run examples/udp.ts
 * Test with netcat: echo "Hello UDP" | nc -u localhost 3002
 * Or use the built-in UDP client examples
 */

import {
	createUDPServer,
	createUDPEchoServer,
	createDiscoveryServer,
	createMulticastGroup,
	UDPClient,
} from "../src/index.ts";

console.log("🚀 Starting UDP server examples...\n");

// Example 1: Basic UDP Server
console.log("1️⃣ Basic UDP Server (Port 3002)");
const basicServer = createUDPServer({
	port: 3002,
	handlers: {
		message(message, rinfo) {
			const msg = message.toString();
			console.log(`📨 Received from ${rinfo.address}:${rinfo.port}: ${msg}`);
			
			// Send response back
			const response = `Echo: ${msg} [${new Date().toLocaleTimeString()}]`;
			basicServer.send(response, rinfo.port, rinfo.address);
		},
		
		listening(address) {
			console.log(`🎧 Basic UDP server listening on ${address.address}:${address.port}`);
		},
		
		error(error) {
			console.error("❌ Basic server error:", error);
		},
	},
});

// Example 2: Echo Server
console.log("2️⃣ UDP Echo Server (Port 3003)");
const echoServer = createUDPEchoServer(3003);

// Example 3: Service Discovery Server
console.log("3️⃣ Service Discovery Server (Port 3004)");
const discoveryServer = createDiscoveryServer(3004, {
	name: "verb-service",
	version: "1.0.0",
	description: "High-performance HTTP/WebSocket/UDP server",
	capabilities: ["http", "websocket", "udp", "http2"],
});

// Example 4: Custom Protocol Server
console.log("4️⃣ Custom Protocol Server (Port 3005)");
const protocolServer = createUDPServer({
	port: 3005,
	handlers: {
		message(message, rinfo) {
			try {
				// Expect JSON messages
				const data = JSON.parse(message.toString());
				console.log(`📋 Protocol message from ${rinfo.address}:${rinfo.port}:`, data);
				
				let response: any = { status: "error", message: "Unknown command" };
				
				switch (data.type) {
					case "ping":
						response = { 
							status: "success", 
							type: "pong", 
							timestamp: Date.now(),
							server: "verb-udp"
						};
						break;
						
					case "time":
						response = {
							status: "success",
							type: "time",
							timestamp: Date.now(),
							iso: new Date().toISOString(),
						};
						break;
						
					case "echo":
						response = {
							status: "success",
							type: "echo",
							data: data.data,
							timestamp: Date.now(),
						};
						break;
						
					case "stats":
						response = {
							status: "success",
							type: "stats",
							uptime: process.uptime(),
							memory: process.memoryUsage(),
							timestamp: Date.now(),
						};
						break;
				}
				
				protocolServer.send(JSON.stringify(response), rinfo.port, rinfo.address);
			} catch (error) {
				const errorResponse = {
					status: "error",
					message: "Invalid JSON format",
					timestamp: Date.now(),
				};
				protocolServer.send(JSON.stringify(errorResponse), rinfo.port, rinfo.address);
			}
		},
		
		listening(address) {
			console.log(`🎧 Custom protocol server listening on ${address.address}:${address.port}`);
		},
	},
});

// Example 5: Multicast Group Server
console.log("5️⃣ Multicast Group Server (Port 3006)");
const multicastServer = createMulticastGroup("224.0.0.100", 3006, {
	message(message, rinfo) {
		console.log(`🌐 Multicast message from ${rinfo.address}:${rinfo.port}: ${message.toString()}`);
	},
	
	listening(address) {
		console.log(`🌐 Multicast server listening on ${address.address}:${address.port}`);
		console.log("📡 Joined multicast group 224.0.0.100");
	},
});

// Example 6: Broadcast Server
console.log("6️⃣ Broadcast Server (Port 3007)");
const broadcastServer = createUDPServer({
	port: 3007,
	handlers: {
		message(message, rinfo) {
			const msg = message.toString();
			console.log(`📢 Broadcast request from ${rinfo.address}:${rinfo.port}: ${msg}`);
			
			if (msg === "ANNOUNCE") {
				const announcement = JSON.stringify({
					type: "announcement",
					server: "verb-broadcast",
					timestamp: Date.now(),
					message: "This is a broadcast message!",
				});
				
				// Broadcast to subnet
				broadcastServer.broadcast(announcement, 3008);
				console.log("📢 Announcement broadcasted to subnet");
			}
		},
		
		listening(address) {
			console.log(`📢 Broadcast server listening on ${address.address}:${address.port}`);
		},
	},
});

// Example 7: UDP Client Demonstrations
console.log("7️⃣ UDP Client Demonstrations");

setTimeout(async () => {
	console.log("\n🔌 Testing UDP clients...");
	
	const client = new UDPClient();
	
	try {
		// Test basic server
		console.log("📤 Testing basic server...");
		await client.send("Hello from UDP client!", 3002, "localhost");
		
		// Test echo server
		console.log("📤 Testing echo server...");
		await client.send("Testing echo functionality", 3003, "localhost");
		
		// Test discovery server
		console.log("📤 Testing service discovery...");
		const discoveryResponse = await client.sendAndReceive("DISCOVER", 3004, "localhost", 2000);
		console.log("🔍 Discovery response:", discoveryResponse.message.toString());
		
		// Test custom protocol
		console.log("📤 Testing custom protocol...");
		const pingResponse = await client.sendAndReceive(
			JSON.stringify({ type: "ping" }), 
			3005, 
			"localhost", 
			2000
		);
		console.log("🏓 Ping response:", pingResponse.message.toString());
		
		const timeResponse = await client.sendAndReceive(
			JSON.stringify({ type: "time" }),
			3005,
			"localhost",
			2000
		);
		console.log("⏰ Time response:", timeResponse.message.toString());
		
		const statsResponse = await client.sendAndReceive(
			JSON.stringify({ type: "stats" }),
			3005,
			"localhost",
			2000
		);
		console.log("📊 Stats response:", statsResponse.message.toString());
		
		// Test broadcast
		console.log("📤 Testing broadcast...");
		await client.send("ANNOUNCE", 3007, "localhost");
		
	} catch (error) {
		console.error("❌ Client test error:", error);
	} finally {
		client.close();
	}
}, 2000);

// Example 8: Stress Test
console.log("8️⃣ UDP Stress Test");

setTimeout(async () => {
	console.log("\n⚡ Starting UDP stress test...");
	
	const stressClient = new UDPClient();
	const messageCount = 100;
	const startTime = Date.now();
	
	try {
		for (let i = 0; i < messageCount; i++) {
			await stressClient.send(`Stress test message ${i + 1}/${messageCount}`, 3003, "localhost");
		}
		
		const endTime = Date.now();
		const duration = endTime - startTime;
		const messagesPerSecond = Math.round((messageCount / duration) * 1000);
		
		console.log(`✅ Sent ${messageCount} messages in ${duration}ms`);
		console.log(`📈 Rate: ${messagesPerSecond} messages/second`);
		
	} catch (error) {
		console.error("❌ Stress test error:", error);
	} finally {
		stressClient.close();
	}
}, 5000);

// Example 9: Periodic Data Sender
console.log("9️⃣ Periodic Data Sender");

const dataClient = new UDPClient();
let dataCounter = 0;

const dataSender = setInterval(async () => {
	try {
		const sensorData = {
			type: "sensor-reading",
			id: ++dataCounter,
			timestamp: Date.now(),
			temperature: Math.round((Math.random() * 40 + 10) * 100) / 100,
			humidity: Math.round((Math.random() * 50 + 30) * 100) / 100,
			pressure: Math.round((Math.random() * 100 + 1000) * 100) / 100,
		};
		
		await dataClient.send(JSON.stringify(sensorData), 3005, "localhost");
		
		if (dataCounter >= 10) {
			clearInterval(dataSender);
			dataClient.close();
			console.log("📊 Periodic data sending completed");
		}
	} catch (error) {
		console.error("❌ Data sender error:", error);
		clearInterval(dataSender);
		dataClient.close();
	}
}, 3000);

console.log(`
📚 UDP Examples Running:

1. Basic Server: localhost:3002
   - Echo with timestamps
   - Test: echo "Hello" | nc -u localhost 3002

2. Echo Server: localhost:3003  
   - Pure echo functionality
   - Test: echo "Test" | nc -u localhost 3003

3. Discovery Server: localhost:3004
   - Send "DISCOVER" to get service info
   - Test: echo "DISCOVER" | nc -u localhost 3004

4. Custom Protocol: localhost:3005
   - JSON protocol with commands: ping, time, echo, stats
   - Test: echo '{"type":"ping"}' | nc -u localhost 3005

5. Multicast Group: 224.0.0.100:3006
   - Multicast messaging
   - Requires multicast-enabled network

6. Broadcast Server: localhost:3007
   - Send "ANNOUNCE" to trigger broadcast
   - Test: echo "ANNOUNCE" | nc -u localhost 3007

🧪 Testing:
- netcat: nc -u localhost <port>
- Built-in clients will run automatically in 2-8 seconds

Press Ctrl+C to stop all servers
`);

// Graceful shutdown
process.on("SIGINT", () => {
	console.log("\n🛑 Shutting down UDP servers...");
	basicServer.close();
	echoServer.close();
	discoveryServer.close();
	protocolServer.close();
	multicastServer.close();
	broadcastServer.close();
	dataClient.close();
	process.exit(0);
});