const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const { Client } = require('pg');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// PostgreSQL client setup
const client = new Client({
    host: 'database-1.cluster-cz86gu4sy328.ap-south-1.rds.amazonaws.com', // Replace with your RDS endpoint
    port: 5432,
    user: 'postgres', // Replace with your DB username
    password: 'Rishiraj2024', // Replace with your DB password
    database: 'database-1' // Replace with your DB name
});

client.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('Connection error', err.stack));

// Create table if it doesn't exist
client.query(`
    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50),
        message TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`)
.catch(err => console.error('Table creation error', err.stack));

app.use(express.static('public')); // Serve static files from 'public' directory
app.use(express.json());

// Load previous messages from the database
app.get('/messages', async (req, res) => {
    try {
        const result = await client.query('SELECT username, message FROM messages ORDER BY timestamp ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving messages');
    }
});

wss.on('connection', (ws) => {
    console.log('New client connected');

    // Send previous messages to the newly connected client
    client.query('SELECT username, message FROM messages ORDER BY timestamp ASC')
        .then(result => {
            result.rows.forEach(msg => {
                ws.send(`${msg.username}: ${msg.message}`);
            });
        });

    ws.on('message', async (message) => {
        const msgData = message.split(': ', 2);
        const username = msgData[0];
        const msg = msgData[1];

        // Save the message to the database
        try {
            await client.query('INSERT INTO messages (username, message) VALUES ($1, $2)', [username, msg]);
            // Broadcast the message to all connected clients
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(`${username}: ${msg}`);
                }
            });
        } catch (err) {
            console.error('Error saving message', err.stack);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});
