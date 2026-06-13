import { registerAs } from '@nestjs/config';


export default registerAs('google', () => {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL ?? '';

  return {
    clientId: clientId,
    clientSecret: clientSecret,
    callbackUrl: callbackUrl,
    enabled: !!(clientId && clientSecret && callbackUrl),
  };
});
