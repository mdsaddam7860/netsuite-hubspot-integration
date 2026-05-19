import { logger } from "../index.js";
import { getHSAxios } from "../configs/hubspot.config.js";
import { hubspotExecutor, netsuiteExecutor } from "../utils/executors.js";
import { processBatchDealInNetsuiteAsInvoice } from "./netsuite.service.js";

async function* hubspotGenerator(
  endpoint,
  {
    properties = [],
    filterGroups = null,
    axiosInstance = getHSAxios(),
    executor = hubspotExecutor,
    log = logger,
  } = {}
) {
  let after = undefined;
  let pageCount = 0;
  let totalProcessed = 0;
  const startTime = Date.now();

  const isDelta = Array.isArray(filterGroups) && filterGroups.length > 0;

  try {
    do {
      pageCount++;

      const response = await executor(async () => {
        if (isDelta) {
          // 🔥 Use Search API for delta
          return axiosInstance.post(`${endpoint}/search`, {
            filterGroups,
            properties,
            limit: 100,
            after,
          });
        } else {
          // 🔹 Normal list mode
          return axiosInstance.get(endpoint, {
            params: {
              limit: 100,
              after,
              ...(properties.length && {
                properties: properties.join(","),
              }),
              // associations: ["companies"],
            },
          });
        }
      });

      const records = response.data?.results || [];
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

      after = response.data?.paging?.next?.after;
    } while (after);
  } catch (error) {
    log.error("HubSpot Stream Error", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
}

async function syncHubspotContactToServiceM8Client() {
  try {
    const lastSyncTime = "2026-02-14T10:00:00.000Z";
    const endpoint = "/crm/v3/objects/invoices";

    const filterGroups = [
      {
        filters: [
          {
            propertyName: "lastmodifieddate",
            operator: "GT",
            value: lastSyncTime,
          },
        ],
      },
    ];

    const contactStream = hubspotGenerator(endpoint, {
      properties: contactProperties(),
      filterGroups,
    });

    // const contactStream = hubspotGenerator(endpoint, properties, filterGroups);

    for await (const { records, stats } of contactStream) {
      // await processBatchContactInServiceM8(records);
      logger.info(`[ServiceM8 Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
      // return;
    }
  } catch (error) {
    logger.error("❌ Error processing Deal in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
  }
}
async function syncHubspotInvoiceToNetSuiteInvoice() {
  try {
    const lastSyncTime = "2026-02-14T10:00:00.000Z";
    const endpoint = "/crm/v3/objects/invoices";

    // const filterGroups = [
    //   {
    //     filters: [
    //       {
    //         propertyName: "lastmodifieddate",
    //         operator: "GT",
    //         value: lastSyncTime,
    //       },
    //     ],
    //   },
    // ];

    const contactStream = hubspotGenerator(endpoint, {
      // properties: contactProperties(),
      // filterGroups,
    });

    // const contactStream = hubspotGenerator(endpoint, properties, filterGroups);

    for await (const { records, stats } of contactStream) {
      // await processBatchContactInServiceM8(records);
      logger.info(`Invoice : ${JSON.stringify(records[0], null, 2)}`);
      logger.info(`[Netsuite Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
      return;
    }
  } catch (error) {
    logger.error("❌ Error processing Invoice in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
  }
}

// Get deal from hubspots and create invoice in netsuite

async function syncHubspotDealToNetSuiteInvoice() {
  try {
    const lastSyncTime = "2026-02-14T10:00:00.000Z";
    const endpoint = "/crm/v3/objects/deals";

    const filterGroups = [
      {
        filters: [
          {
            propertyName: "lastmodifieddate",
            operator: "GT",
            value: lastSyncTime,
          },
        ],
      },
    ];

    const recordStream = hubspotGenerator(endpoint, {
      properties: contactProperties(),
      // filterGroups,
    });

    // const contactStream = hubspotGenerator(endpoint, properties, filterGroups);

    for await (const { records, stats } of recordStream) {
      await processBatchDealInNetsuiteAsInvoice(records);
      logger.info(`[Netsuite Progress] ${endpoint}`, {
        page: stats.page,
        processed: stats.totalProcessed,
        speed: `${stats.recordsPerSecond} rec/sec`,
      });
      // return;
    }
  } catch (error) {
    logger.error("❌ Error processing Deal in Batch", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
  }
}

async function fetchHubSpotAssociationIds(
  fromObject = "companies",
  toObject = "contacts",
  objectId
) {
  if (!fromObject || !toObject || !objectId) {
    logger.warn(
      `Missing fromObject or toObject or objectId fromObject:${fromObject}, toObject:${toObject}, objectId:${objectId}`
    );
    return null;
  }
  let associatedIds = [];
  try {
    // fetch associated ids from hubspot
    const endpoint = `/crm/v3/objects/${fromObject}/${objectId}/associations/${toObject}`;
    const client = getHSAxios();
    const response = await client.get(endpoint);

    const results = response.data?.results || [];

    associatedIds = results.reduce((acc, item) => {
      acc.push(item.id);
      return acc;
    }, []);

    // logger.info(
    //   `[Hubspot] ${endpoint} : ${JSON.stringify(associatedIds, null, 2)}`
    // );

    return associatedIds || [];
  } catch (error) {
    logger.error(`❌ Error processing search in Hubspot:getAssociatedIds`, {
      httpStatus: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      headers: error?.config?.headers,
      message: error.message,
    });
  }
}
async function fetchHubspotObject(
  fromObject = "companies",
  objectId,
  properties = [] // Default to empty array to prevent length errors
) {
  if (!fromObject || !objectId) {
    logger.warn(
      `Missing fromObject or objectId. fromObject: ${fromObject}, objectId: ${objectId}`
    );
    return null;
  }

  // Ensure we have a valid comma-separated string or undefined
  const propertyString =
    properties?.length > 0 ? properties.join(",") : undefined;

  try {
    const endpoint = `/crm/v3/objects/${fromObject}/${objectId}`;
    const client = getHSAxios();

    // Axios GET request structure: client.get(url, { params: { key: value } })
    const response = await client.get(endpoint, {
      params: {
        properties: propertyString,
      },
    });

    return response?.data;
  } catch (error) {
    logger.error(`❌ Error fetching HubSpot object:`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return null; // Explicitly return null on failure
  }
}

export {
  fetchHubspotObject,
  fetchHubSpotAssociationIds,
  syncHubspotInvoiceToNetSuiteInvoice,
  syncHubspotDealToNetSuiteInvoice,
};
