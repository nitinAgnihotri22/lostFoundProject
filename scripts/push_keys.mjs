// npm run push:keys – prints a new VAPID key pair for browser push notifications.
// Put both lines in .env.local (and in your hosting env), then restart the server.
// Keep VAPID_PRIVATE_KEY secret. Changing the keys later stops existing push subscriptions.
import crypto from 'crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${raw.toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${priv.d}`);
console.log('VAPID_SUBJECT=mailto:support@yourdomain.com');
