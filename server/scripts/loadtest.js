import autocannon from 'autocannon';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
/**
 * CONFIGURATION: Paste your API Keys and Secrets here.
 */
const CREDENTIALS = [
    { key: 'cb1cd47c-645d-448f-8ae4-a455ff928ec1', secret: '3b6962992f8692473202107a220dc2b43feb4de2c2dd40adfd60de5ecad74f7b' },
    { key: '1d770efa-f733-4ed4-a19f-fa01b905a7bc', secret: 'cbef831bebb3ca5f3864ddda93c40cfc85325ad7ca3555aba6b8003d9154aa1c' },
    { key: 'e1e61179-cf08-4266-a696-b1c1feaf55ba', secret: '8b85745c798e6fd32e95ae996925b8fb82ac046b90297e73c09e395fdf8d2557' },
    { key: '0020490a-cf6e-46f1-ac7a-58d341e73f59', secret: '7a9a9b1cf60d8e965e852fdffcf30d1ad7677fb74b2197e7f90505b41e8ea574' },
    { key: '00547a81-aa00-4e98-8145-e81bfaee645a', secret: '271e1ac88c1bfeb7f5d6d6808abfb58c509319c8ba39554085a5be81252d2a1f' }

];

const TARGET_URL = 'https://monito-api-hrtu4.ondigitalocean.app/api/v1/ingest'; // Change this to your DigitalOcean URL

/**
 * Discover credentials from the array.
 */
function getCredentials() {
    // Filter out placeholder values
    return CREDENTIALS.filter(c => !c.key.includes('PASTE_YOUR_KEY'));
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
    const CONNECTIONS = 50;
    const DURATION = 30;

    console.log(`🚀 Starting Multi-User Load Test on ${TARGET_URL}...`);
    console.log(`Discovered ${credentialsList.length} user(s)/project(s).`);
    console.log(`Simulating ${CONNECTIONS} concurrent connections across all users.`);

    const instance = autocannon({
        url: TARGET_URL,
        connections: CONNECTIONS,
        pipelining: 2,
        duration: DURATION,
        requests: [
            {
                method: 'POST',
                path: '/api/v1/ingest', // Full path is more reliable here
                setupRequest: (request, client) => {
                    // Pick a sticky user for this client if not already assigned
                    if (!client.user) {
                        const userIndex = Math.floor(Math.random() * credentialsList.length);
                        client.user = credentialsList[userIndex];
                    }

                    const payload = generatePayload();
                    const timestamp = Date.now().toString();
                    const signature = signRequest(payload, timestamp, client.user.secret);

                    request.body = payload;
                    request.headers['content-type'] = 'application/json';
                    request.headers['x-api-key'] = client.user.key;
                    request.headers['x-timestamp'] = timestamp;
                    request.headers['x-signature'] = signature;

                    return request;
                }
            }
        ]
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
