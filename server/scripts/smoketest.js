import crypto from 'crypto';
// import axios from 'axios';

/**
 * CONFIGURATION: Use the same credentials as your loadtest.js
 */
const CREDENTIALS = [
    { key: '31c0cfc7-0f9f-4bec-9ee3-d9aeda86426e', secret: '8a7e789af4434d8329f4b59af8d6b21bca53b2b267a0d666d5882c8625cdfa15' },
    // { key: 'PASTE_YOUR_KEY_2_HERE', secret: 'PASTE_YOUR_SECRET_2_HERE' },
];

// const TARGET_URL = 'https://monito-api-hrtu4.ondigitalocean.app/api/v1/ingest';
const TARGET_URL = 'http://localhost:3000/api/v1/ingest';

async function runSmokeTest() {
    console.log(`🔍 Running Smoke Test on ${TARGET_URL}...\n`);

    const validCredentials = CREDENTIALS.filter(c => !c.key.includes('PASTE_YOUR_KEY'));

    if (validCredentials.length === 0) {
        console.error('❌ Error: No valid credentials found. Please update the CREDENTIALS array.');
        return;
    }

    for (const [index, user] of validCredentials.entries()) {
        console.log(`[User ${index + 1}] Testing Key: ${user.key.substring(0, 8)}...`);

        const payload = JSON.stringify({
            service: 'smoke-test-service',
            endpoint: '/api/v1/test',
            method: 'POST',
            status: 200,
            latency: 10,
            environment: 'development',
            timestamp: new Date().toISOString()
        });

        const timestamp = Date.now().toString();
        const signature = crypto
            .createHmac('sha256', user.secret)
            .update(payload + timestamp)
            .digest('hex');

        try {
            const response = await fetch(TARGET_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': user.key,
                    'x-timestamp': timestamp,
                    'x-signature': signature
                },
                body: payload
            });

            console.log(`✅ Success: ${response.status} ${response.statusText}`);
            console.log('---');
        } catch (error) {
            console.error(`❌ Failed: ${error.response?.status || 'Error'} ${error.response?.data?.message || error.message}`);
            if (error.response?.data) {
                console.error('Response details:', JSON.stringify(error.response.data, null, 2));
            }
            console.log('---');
        }
    }

    console.log('\n✨ Smoke test complete.');
}

runSmokeTest();
