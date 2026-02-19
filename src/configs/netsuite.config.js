import axios from "axios";
import OAuth from "oauth-1.0a";
import crypto from "crypto";

let netsuiteClient = null;

function getNetsuiteClient() {
  if (netsuiteClient) return netsuiteClient;

  // INITIALIZE OAUTH HERE - Inside the function to ensure process.env is ready
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

  netsuiteClient = axios.create({
    baseURL: process.env.NETSUITE_BASE_URL,
    headers: { "Content-Type": "application/json" },
  });

  netsuiteClient.interceptors.request.use((config) => {
    const fullUrl = config.baseURL + config.url;

    const requestData = {
      url: fullUrl,
      method: config.method.toUpperCase(),
    };

    // Use the local oauth instance
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));
    const realm = process.env.NS_ACCOUNT_ID.toUpperCase().replace("-", "_");

    config.headers[
      "Authorization"
    ] = `${authHeader.Authorization}, realm="${realm}"`;
    return config;
  });

  return netsuiteClient;
}

export { getNetsuiteClient };

/**Usage Example
 const client = getNetsuiteClient();

// To POST a new invoice
await client.post('/services/rest/record/v1/invoice', {
  entity: { id: "123" }, // Customer ID
  trandate: "2023-10-27",
  item: {
    items: [
      { item: { id: "456" }, quantity: 1 }
    ]
  }
});
 */
