// // netsuiteOAuthClient.js
// import axios from "axios";
// import OAuth from "oauth-1.0a";
// import crypto from "crypto";

// const baseURL = process.env.NETSUITE_BASE_URL?.replace(/\/+$/, "");
// const consumerKey = process.env.NS_CONSUMER_KEY;
// const consumerSecret = process.env.NS_CONSUMER_SECRET;
// const tokenKey = process.env.NS_TOKEN_ID;
// const tokenSecret = process.env.NS_TOKEN_SECRET;

// if (!baseURL || !consumerKey || !consumerSecret || !tokenKey || !tokenSecret) {
//   console.error(
//     "Missing one of NETSUITE_BASE_URL, NETSUITE_CONSUMER_KEY, NETSUITE_CONSUMER_SECRET, NETSUITE_TOKEN_ID, or NETSUITE_TOKEN_SECRET in .env"
//   );
// }

// // OAuth1 instance using HMAC-SHA256 (match Postman)
// const oauth = new OAuth({
//   consumer: { key: consumerKey, secret: consumerSecret },
//   signature_method: "HMAC-SHA256",
//   hash_function(base_string, key) {
//     return crypto
//       .createHmac("sha256", key)
//       .update(base_string)
//       .digest("base64");
//   },
// });

// // helper: extract 'realm' from the host subdomain (e.g. 6762947 from 6762947.suitetalk.api.netsuite.com)
// function getRealmFromBase(base) {
//   try {
//     const u = new URL(base);
//     const host = u.host; // e.g. 6762947.suitetalk.api.netsuite.com
//     const parts = host.split(".");
//     return parts[0]; // account id
//   } catch (err) {
//     return undefined;
//   }
// }

// /**
//  * Build Authorization header string: include realm param first (required by Postman/NetSuite)
//  */
// function buildAuthHeader(requestData) {
//   const token = { key: tokenKey, secret: tokenSecret };
//   const headerObj = oauth.toHeader(oauth.authorize(requestData, token));
//   // oauth.toHeader returns: { Authorization: 'OAuth oauth_consumer_key="...", oauth_token="...", ...' }
//   const realm = getRealmFromBase(baseURL);
//   if (realm) {
//     const rest = headerObj.Authorization.replace(/^OAuth\s*/, "");
//     return `OAuth realm="${realm}",${rest}`;
//   }
//   return headerObj.Authorization;
// }

// export async function oauthRequest(
//   method,
//   fullUrl,
//   body,
//   additionalHeaders = {}
// ) {
//   const requestData = { url: fullUrl, method };
//   const Authorization = buildAuthHeader(requestData);

//   const headers = {
//     Authorization,
//     "Content-Type": "application/json",
//     Accept: "application/json",
//     ...additionalHeaders,
//   };

//   try {
//     const config = { method, url: fullUrl, headers, timeout: 20000 };
//     if (body && (method === "POST" || method === "PUT")) {
//       config.data = body;
//     }
//     const resp = await axios(config);
//     return resp.data;
//   } catch (err) {
//     if (err.response) {
//       const { status, data } = err.response;
//       throw new Error(`NetSuite error ${status}: ${JSON.stringify(data)}`);
//     } else {
//       throw new Error(`Network or Axios error: ${err.message}`);
//     }
//   }
// }

// /**
//  * Make a POST request signed with OAuth1.0a (NetSuite TBA)
//  * @param {string} path - e.g. "/services/rest/query/v1/suiteql"
//  * @param {object} body - JSON body to send
//  */
// export async function oauthPost(path, body) {
//   const url = baseURL + path;
//   return await oauthRequest("POST", url, body, { Prefer: "transient" });
// }

// /**
//  * Make a POST request specifically for a standard NetSuite RESTlet execution
//  * Extracts the correct restlets.api.netsuite.com subdomain from the suitecall base URL.
//  */
// export async function oauthRestletPost(scriptId, deployId, body) {
//   const restletBaseURL = baseURL.replace(
//     "suitetalk.api.netsuite.com",
//     "restlets.api.netsuite.com"
//   );
//   const params = new URLSearchParams({
//     script: scriptId,
//     deploy: deployId,
//   }).toString();
//   const url = `${restletBaseURL}/app/site/hosting/restlet.nl?${params}`;

//   return await oauthRequest("POST", url, body);
// }

// netsuiteOAuthClient.js
import axios from "axios";
import OAuth from "oauth-1.0a";
import crypto from "crypto";

/**
 * Dynamically load environment variables at request time.
 * This prevents "Invalid URL" errors caused by importing this module
 * before dotenv.config() has finished loading in the main entry file.
 */
function getConfig() {
  const baseURL = process.env.NETSUITE_BASE_URL?.replace(/\/+$/, "");
  const consumerKey = process.env.NS_CONSUMER_KEY;
  const consumerSecret = process.env.NS_CONSUMER_SECRET;
  const tokenKey = process.env.NS_TOKEN_ID;
  const tokenSecret = process.env.NS_TOKEN_SECRET;

  if (
    !baseURL ||
    !consumerKey ||
    !consumerSecret ||
    !tokenKey ||
    !tokenSecret
  ) {
    throw new Error(
      "Missing NetSuite environment variables. Ensure dotenv is loaded properly before making a request."
    );
  }

  return { baseURL, consumerKey, consumerSecret, tokenKey, tokenSecret };
}

// Generate the OAuth instance dynamically
function getOAuthInstance(config) {
  return new OAuth({
    consumer: { key: config.consumerKey, secret: config.consumerSecret },
    signature_method: "HMAC-SHA256",
    hash_function(base_string, key) {
      return crypto
        .createHmac("sha256", key)
        .update(base_string)
        .digest("base64");
    },
  });
}

// helper: extract 'realm' from the host subdomain (e.g. 6762947-sb3 from 6762947-sb3.suitetalk.api.netsuite.com)
function getRealmFromBase(base) {
  try {
    const u = new URL(base);
    const host = u.host;
    const parts = host.split(".");

    // CRITICAL: NetSuite requires Sandbox Account IDs in realms to be
    // uppercase and use underscores (e.g., 7057913-sb3 -> 7057913_SB3)
    return parts[0].toUpperCase().replace(/-/g, "_");
  } catch (err) {
    return undefined;
  }
}

/**
 * Build Authorization header string: include realm param first (required by Postman/NetSuite)
 */
function buildAuthHeader(requestData, config) {
  const oauth = getOAuthInstance(config);
  const token = { key: config.tokenKey, secret: config.tokenSecret };
  const headerObj = oauth.toHeader(oauth.authorize(requestData, token));

  // oauth.toHeader returns: { Authorization: 'OAuth oauth_consumer_key="...", oauth_token="...", ...' }
  const realm = getRealmFromBase(config.baseURL);
  if (realm) {
    const rest = headerObj.Authorization.replace(/^OAuth\s*/, "");
    return `OAuth realm="${realm}",${rest}`;
  }
  return headerObj.Authorization;
}

export async function oauthRequest(
  method,
  fullUrl,
  body,
  additionalHeaders = {}
) {
  const config = getConfig(); // Load config here so process.env is definitely populated
  const requestData = { url: fullUrl, method };
  const Authorization = buildAuthHeader(requestData, config);

  const headers = {
    Authorization,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...additionalHeaders,
  };

  try {
    const axiosConfig = { method, url: fullUrl, headers, timeout: 20000 };
    if (body && (method === "POST" || method === "PUT")) {
      axiosConfig.data = body;
    }
    const resp = await axios(axiosConfig);
    return resp.data;
  } catch (err) {
    if (err.response) {
      const { status, data } = err.response;
      throw new Error(`NetSuite error ${status}: ${JSON.stringify(data)}`);
    } else {
      throw new Error(`Network or Axios error: ${err.message}`);
    }
  }
}

/**
 * Make a POST request signed with OAuth1.0a (NetSuite TBA)
 * @param {string} path - e.g. "/services/rest/query/v1/suiteql"
 * @param {object} body - JSON body to send
 */
export async function oauthPost(path, body) {
  const { baseURL } = getConfig();
  // Ensure path leads with a slash if missing
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const url = baseURL + safePath;

  return await oauthRequest("POST", url, body, { Prefer: "transient" });
}

/**
 * Make a POST request specifically for a standard NetSuite RESTlet execution
 * Extracts the correct restlets.api.netsuite.com subdomain from the suitecall base URL.
 */
export async function oauthRestletPost(scriptId, deployId, body) {
  const { baseURL } = getConfig();
  const restletBaseURL = baseURL.replace(
    "suitetalk.api.netsuite.com",
    "restlets.api.netsuite.com"
  );
  const params = new URLSearchParams({
    script: scriptId,
    deploy: deployId,
  }).toString();
  const url = `${restletBaseURL}/app/site/hosting/restlet.nl?${params}`;

  return await oauthRequest("POST", url, body);
}
