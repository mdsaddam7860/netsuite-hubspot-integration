const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");

let netsuiteClient = null;

function getNetsuiteClient() {
  if (netsuiteClient) return netsuiteClient;

  // 1. Initialize the OAuth Signer
  const oauth = OAuth({
    consumer: {
      key: process.env.NS_CONSUMER_KEY,
      secret: process.env.NS_CONSUMER_SECRET,
    },
    signature_method: "HMAC-SHA256",
    hash_function(base_string, key) {
      return crypto
        .createHmac("sha256", key)
        .update(base_string)
        .digest("base64");
    },
  });

  const token = {
    key: process.env.NS_TOKEN_ID,
    secret: process.env.NS_TOKEN_SECRET,
  };

  // 2. Create the Axios Instance (Headers start empty)
  netsuiteClient = axios.create({
    baseURL: process.env.NETSUITE_BASE_URL,
    headers: { "Content-Type": "application/json" },
  });

  // 3. Add the Interceptor to sign EVERY request dynamically
  netsuiteClient.interceptors.request.use((config) => {
    const requestData = {
      url: config.baseURL + config.url,
      method: config.method.toUpperCase(),
      data: config.data,
    };

    // Generate fresh OAuth headers
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    // Add the specific NetSuite 'realm'
    config.headers[
      "Authorization"
    ] = `${authHeader.Authorization}, realm="${process.env.NS_ACCOUNT_ID}"`;

    return config;
  });

  return netsuiteClient;
}

export { getNetsuiteClient };
