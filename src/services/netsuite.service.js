import { logger } from "../index.js";
import { getNetsuiteClient } from "../configs/netsuite.config.js";
import { hubspotExecutor, netsuiteExecutor } from "../utils/executors.js";

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

export {
  netsuiteGenerator,
  syncNetsuiteInvoiceToHubspot,
  syncNetsuiteCustomerToHubspot,
};
