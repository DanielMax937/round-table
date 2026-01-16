import https from 'https';
import http from 'http';

const proxyUrl = process.env.OPENAI_BASE_URL || 'http://openai-proxy.miracleplus.com';
const url = new URL(proxyUrl);

console.log('Testing proxy connectivity...');
console.log('URL:', proxyUrl);
console.log('');

const client = url.protocol === 'https:' ? https : http;

const req = client.get(url, (res) => {
    console.log('✅ Proxy reachable!');
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\nResponse:', data.substring(0, 500));
    });
});

req.on('error', (error) => {
    console.error('❌ Proxy not reachable:', error.message);
});

req.setTimeout(5000, () => {
    console.error('❌ Timeout - proxy not responding');
    req.destroy();
});
