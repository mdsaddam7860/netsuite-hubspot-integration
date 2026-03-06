import { logger } from "../index.js";
import { getNetsuiteClient } from "../configs/netsuite.config.js";
import { hubspotExecutor, netsuiteExecutor } from "../utils/executors.js";
import { hubspotDealToNetsuiteInvoiceMapping } from "../mappings/hubspot-netsuite.mapping.js";

async function* netsuiteGenerator(endpoint, limit = 1, offset = 1) {
  try {
    const client = getNetsuiteClient();
    // const limit = 100;
    // let offset = 0;
    let hasMore = true;
    let pageCount = 0;
    let totalProcessed = 0;
    const startTime = Date.now();

    do {
      pageCount++;
      const response = await netsuiteExecutor(
        () =>
          client.get(endpoint, {
            params: { limit, offset },
          }),
        { name: "Netsuite Generator", endpoint }
      );

      const records = response.data?.items || [];
      totalProcessed += records.length;
      const elapsedSeconds = (Date.now() - startTime) / 1000;

      yield {
        records,
        stats: {
          page: pageCount,
          totalProcessed,
          recordsPerSecond:
            elapsedSeconds > 0
              ? (totalProcessed / elapsedSeconds).toFixed(2)
              : "0.00",
        },
      };
      offset += limit;
      hasMore = response.data?.hasMore;
    } while (hasMore);
  } catch (error) {
    logger.error("❌ Critical startup failure:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
  }
}

async function syncNetsuiteInvoiceToHubspot() {
  try {
    // get invoice stream from invoice endpoint
    const endpoint = "/services/rest/record/v1/invoice";
    const invoiceStream = netsuiteGenerator(endpoint, 100, 100);
    for await (const { records, stats } of invoiceStream) {
      logger.info(
        `[Netsuite Progress] Processing Invoices: ${
          records.length
        } : ${JSON.stringify(records[0], null, 2)}`
      );
      logger.info(`[Netsuite Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
      return; // TODO Remove after testing
    }
  } catch (error) {
    logger.error("❌ Critical startup failure:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
  }
}
async function syncNetsuiteCustomerToHubspot() {
  try {
    // get invoice stream from invoice endpoint
    const endpoint = "/services/rest/record/v1/customer";
    const invoiceStream = netsuiteGenerator(endpoint, 100, 100);
    for await (const { records, stats } of invoiceStream) {
      logger.info(
        `[Netsuite Progress] Processing Customers: ${
          records.length
        } : ${JSON.stringify(records[0], null, 2)}`
      );
      logger.info(`[Netsuite Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
      return; // TODO Remove after testing
    }
  } catch (error) {
    logger.error("❌ Critical startup failure:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
  }
}

/**
 * Creates an Invoice in NetSuite via REST API
 * @param {Object} invoiceData - The invoice object containing entity, department, and items
 * @returns {Promise<Object>} - The NetSuite API response
 */
async function createNetSuiteInvoice(payload) {
  try {
    const client = getNetsuiteClient();

    // Log the payload for debugging
    logger.info(`Payload: ${JSON.stringify(payload, null, 2)}`);

    // The endpoint based on your CURL call
    const endpoint = "/services/rest/record/v1/invoice";

    const response = await client.post(endpoint, payload, {
      headers: {
        Prefer: "return=representation",
      },
    });

    console.log("Invoice Created Successfully:", response?.data?.id);
    logger.info(
      `Invoice Created Successfully: ${JSON.stringify(response?.data)}`
    );
    logger.info(
      `Invoice Created Successfully: ${JSON.stringify(
        response?.headers,
        null,
        2
      )}`
    );
    return response?.data;
  } catch (error) {
    // Log detailed error for debugging (NetSuite provides detailed error objects)
    console.error(
      "NetSuite Invoice Error:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Example Usage:

// createNetSuiteInvoice(myInvoice);

async function upsertInvoiceInNetsuite(record, lineItems) {
  try {
    // search invoice in netsuite by deal id
    // if exist update else create
    const payload = hubspotDealToNetsuiteInvoiceMapping(record);
    return await createNetSuiteInvoice(payload);
  } catch (error) {
    logger.error("❌ Critical startup failure:", {
      httpStatus: error?.status,
      message: error.message,
      data: error.response?.data,
      stack: error?.stack,
    });
  }
}

async function processBatchDealInNetsuiteAsInvoice(records = []) {
  try {
    for (const [index, record] of records.entries()) {
      try {
        // process each record in netsuite as invoice and find deal line items parallelly
        const response = await upsertInvoiceInNetsuite(record);
        logger.info(`Upserted Invoice: ${JSON.stringify(response, null, 2)}`);
      } catch (error) {
        logger.error("❌ Critical startup failure:", {
          httpStatus: error?.status,
          message: error.message,
          data: error.response?.data,
          stack: error?.stack,
        });
      }
    }
  } catch (error) {
    logger.error("❌ Critical startup failure:", {
      httpStatus: error?.status,
      message: error.message,
      data: error.response?.data,
      stack: error?.stack,
    });
  }
}
export {
  processBatchDealInNetsuiteAsInvoice,
  netsuiteGenerator,
  syncNetsuiteInvoiceToHubspot,
  syncNetsuiteCustomerToHubspot,
  createNetSuiteInvoice,
};
