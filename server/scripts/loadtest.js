import autocannon from 'autocannon';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Configuration for the load test.
 * Set these in your server/.env file for testing.
 */
const TARGET_URL = process.env.TEST_TARGET_URL || 'http://localhost:3000/api/v1/ingest';

/**
 * Discover all TEST_API_KEY_N and TEST_API_SECRET_N pairs.
 */
function getCredentials() {
    const credentials = [];
    let i = 1;
    
    // Support both the original single-key format and the new numbered format
    if (process.env.TEST_API_KEY && process.env.TEST_API_SECRET) {
        credentials.push({ 
            key: process.env.TEST_API_KEY, 
            secret: process.env.TEST_API_SECRET 
        });
    }

    while (process.env[`TEST_API_KEY_${i}`] && process.env[`TEST_API_SECRET_${i}`]) {
        credentials.push({
            key: process.env[`TEST_API_KEY_${i}`],
            secret: process.env[`TEST_API_SECRET_${i}`]
        });
        i++;
    }

    return credentials;
}

const credentialsList = getCredentials();

if (credentialsList.length === 0) {
    console.error('ERROR: No test credentials found.');
    console.error('Please set TEST_API_KEY_1 and TEST_API_SECRET_1 (and so on) in your server/.env');
    process.exit(1);
}

/**
 * Generates a realistic telemetry payload.
 */
function generatePayload() {
    const endpoints = ['/api/user/login', '/api/products/list', '/api/order/create', '/api/cart/add'];
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    const environments = ['production', 'staging', 'development'];

    return JSON.stringify({
        service: 'web-api-gateway',
        endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
        method: methods[Math.floor(Math.random() * methods.length)],
        status: Math.random() > 0.1 ? 200 : 500,
        latency: Math.floor(Math.random() * 500),
        environment: environments[Math.floor(Math.random() * environments.length)],
        timestamp: new Date().toISOString()
    });
}

/**
 * Computes the HMAC SHA256 signature for the request.
 */
function signRequest(payload, timestamp, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(payload + timestamp)
        .digest('hex');
}

/**
 * Starts the autocannon benchmark.
 */
function runTest() {
    const CONNECTIONS = 12; // Adjusted to be a multiple of typical user counts (4, 6, etc)
    const DURATION = 30;

    console.log(`🚀 Starting Multi-User Load Test on ${TARGET_URL}...`);
    console.log(`Discovered ${credentialsList.length} user(s)/project(s).`);
    console.log(`Simulating ${CONNECTIONS} concurrent connections across all users.`);

    const instance = autocannon({
        url: TARGET_URL,
        connections: CONNECTIONS,
        pipelining: 1,
        duration: DURATION,
        headers: {
            'content-type': 'application/json'
        },
        setupClient: (client) => {
            // Assign a "user" to this client connection based on its local ID
            // Autocannon doesn't directly expose a connection index here, 
            // so we'll pick one and stick with it for this connection.
            const userIndex = Math.floor(Math.random() * credentialsList.length);
            const user = credentialsList[userIndex];

            client.setBody = () => {
                const payload = generatePayload();
                const timestamp = Date.now().toString();
                const signature = signRequest(payload, timestamp, user.secret);

                // Update headers dynamically per-request using this connection's user
                client.setHeaders({
                    ...client.headers,
                    'x-api-key': user.key,
                    'x-timestamp': timestamp,
                    'x-signature': signature
                });

                return payload;
            };
        }
    }, (err, result) => {
        if (err) {
            console.error('Load test failed:', err);
        } else {
            console.log('\n📊 Multi-User Load Test Results:');
            console.log('-------------------');
            console.log(`Total Requests: ${result.requests.total}`);
            console.log(`Total Duration: ${result.duration}s`);
            console.log(`Requests/sec:   ${result.requests.average}`);
            console.log(`Latency (ms):   Avg: ${result.latency.average}, Max: ${result.latency.max}, P99: ${result.latency.p99}`);
            console.log(`Errors (Non-2xx): ${result.non2xx}`);
            console.log('-------------------\n');
            
            if (result.non2xx > 0) {
                console.warn('⚠️ Note: Non-2xx responses (like 429 or 503) are common when testing the limits of your circuit breaker and rate limiter.');
            }
        }
    });

    // Capture Ctrl+C to stop gracefully
    process.on('SIGINT', () => {
        instance.stop();
    });

    autocannon.track(instance, { renderProgressBar: true });
}

runTest();
