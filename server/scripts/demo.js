import autocannon from "autocannon";

async function runLoadTest() {
    const port = 4000;

    const result = await autocannon({
        url: `http://localhost:${port}`,
        connections: 10,
        pipelining: 1,
        duration: 30,
        requests: [
            {
                path: '/',
                method: 'GET'
            }
        ]
    });

    console.log('Load test results:', result);
}

runLoadTest().catch(err => console.error('Test failed:', err));