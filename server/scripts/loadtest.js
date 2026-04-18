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
    { key: 'dd522a26-3db0-4021-9058-2d98e9bfff0b', secret: '52c303361ec61d3fb8e4cd6beb3196cdaccce73f75af85b7d5596486c6b54e7f' },
    { key: '31c0cfc7-0f9f-4bec-9ee3-d9aeda86426e', secret: '8a7e789af4434d8329f4b59af8d6b21bca53b2b267a0d666d5882c8625cdfa15' },
    { key: '52b1c1c9-0deb-4219-bb16-427a27419c90', secret: 'ef5f8e8bce57469b264a50d3e895f8a380f2825ef165879c5ac7cd41ffb21dd7' },
];

// const TARGET_URL = 'https://monito-api-hrtu4.ondigitalocean.app/api/v1/ingest'; // Cahange this to your DigitalOcean URL
const TARGET_URL = 'http://localhost:3000/api/v1/ingest';

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
    // Allow CLI overrides: node loadTest.js 50 120 5
    const CONNECTIONS = parseInt(process.argv[2]) || 50;
    const DURATION = parseInt(process.argv[3]) || 120;
    const PIPELINING = parseInt(process.argv[4]) || 5;

    console.log(`🚀 Load Test Config:`);
    console.log(`URL: ${TARGET_URL}`);
    console.log(`Connections: ${CONNECTIONS}`);
    console.log(`Duration: ${DURATION}s`);
    console.log(`Pipelining: ${PIPELINING}`);
    console.log(`Users: ${credentialsList.length}`);
    console.log('----------------------------------');

    const instance = autocannon({
        url: TARGET_URL,
        connections: CONNECTIONS,
        duration: DURATION,
        pipelining: PIPELINING,

        requests: [
            {
                method: 'POST',
                path: '/api/v1/ingest',
                setupRequest: (request, client) => {
                    if (!client.user) {
                        client.user = credentialsList[
                            Math.floor(Math.random() * credentialsList.length)
                        ];
                    }

                    const payload = generatePayload();
                    const timestamp = Date.now().toString();
                    const signature = signRequest(
                        payload,
                        timestamp,
                        client.user.secret
                    );

                    request.body = payload;
                    request.headers = {
                        'content-type': 'application/json',
                        'x-api-key': client.user.key,
                        'x-timestamp': timestamp,
                        'x-signature': signature
                    };

                    return request;
                }
            }
        ]
    }, (err, result) => {
        if (err) {
            console.error('❌ Load test failed:', err);
            return;
        }

        console.log('\n📊 Results:');
        console.log('----------------------------------');
        console.log(`Req Total:      ${result.requests.total}`);
        console.log(`Req/sec:        ${result.requests.average}`);
        console.log(`Latency Avg:    ${result.latency.average} ms`);
        console.log(`Latency P99:    ${result.latency.p99} ms`);
        console.log(`Max Latency:    ${result.latency.max} ms`);
        console.log(`Throughput:     ${(result.throughput.average / 1024).toFixed(2)} KB/s`);
        console.log(`Non-2xx:        ${result.non2xx}`);
        console.log('----------------------------------\n');
    });

    process.on('SIGINT', () => instance.stop());
    autocannon.track(instance, { renderProgressBar: true });
}
runTest();
