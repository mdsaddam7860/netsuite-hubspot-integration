import dotenv from "dotenv";
import path from "path";
dotenv.config({
  path: path.join(process.cwd(), ".env"),
});
import { app } from "./src/app.js";
import { logger } from "./src/index.js";
import { getHubspotClient, getHSAxios } from "./src/configs/hubspot.config.js";
import { getNetsuiteClient } from "./src/configs/netsuite.config.js";

// Start the server, For CI/CD deployments remove deploy.yml from .gitignore
// npm i express axios node-cron winston winston-daily-rotate-file dotenv @mohammadsaddam-dev/hubspot-toolkit
// remove git from your repo rmdir /s /q .git
import {
  syncNetsuiteInvoiceToHubspot,
  syncNetsuiteCustomerToHubspot,
} from "./src/services/netsuite.service.js";
import { syncHubspotInvoiceToNetSuiteInvoice } from "./src/services/hubspot.service.js";
const PORT = process.env.PORT || 5000;

function serverInit() {
  try {
    // Server is up and running

    app.listen(PORT, () => {
      logger.info(`Server running on PORT:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });

    init(); // Initialize other services and forget about them
  } catch (error) {
    logger.error("❌ Critical startup failure:", error);
  }
}

serverInit();
syncHubspotInvoiceToNetSuiteInvoice();

async function init() {
  try {
    // Initialize Client
    try {
      logger.info(`➡️ Config initializing...`);
      getHubspotClient();
      getHSAxios();
      getNetsuiteClient();
      logger.info(`✅ Config initialized successfully`);
    } catch (error) {
      logger.error("❌ HubSpot client failed to initialize:", error);
    }
  } catch (error) {
    logger.error("❌ Critical startup failure:", error);
  }
}
