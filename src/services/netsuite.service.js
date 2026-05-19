import { logger } from "../index.js";
import { getNetsuiteClient } from "../configs/netsuite.config.js";
import { hubspotExecutor, netsuiteExecutor } from "../utils/executors.js";
import { companyProperties } from "../utils/helper.util.js";
import { runSuiteQL } from "./suiteql.js";
//------------------------Mappings Functions --------------------------
import {
  hubspotDealToNetsuiteInvoiceMapping,
  getlineItemPayload,
} from "../mappings/hubspot-netsuite.mapping.js";

// ------------------------HubspotServices Functions --------------------------
import {
  fetchHubSpotAssociationIds,
  fetchHubspotObject,
} from "./hubspot.service.js";

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

async function upsertInvoiceInNetsuite(
  record,
  lineItems = [
    {
      item: {
        id: "182",
      },
      quantity: 1,
      rate: 139,
      custcol_agency_mf_flight_start_date: "2026-03-06",
      custcol_agency_mf_flight_end_date: "2026-03-10",
    },
  ]
) {
  try {
    // search invoice in netsuite by deal id
    // if exist update else create
    let payload = hubspotDealToNetsuiteInvoiceMapping(record);

    lineItems.map((item) => {
      const lineItemPayload = getlineItemPayload(item);
      payload.item.items.push(lineItemPayload);
    });

    // payload.item.items = lineItems;

    logger.info(`Payload: ${JSON.stringify(payload, null, 2)}`);
    return;
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

async function processBatchDealInNetsuiteAsInvoice(
  records = [
    // {
    //   id: "51083915163",
    //   properties: {
    //     account_director: null,
    //     amount: "4995",
    //     amount_in_deal_currency: "4995",
    //     amount_in_home_currency: "4995.0",
    //     amount_paid: null,
    //     are_customizations_required_to_product_: null,
    //     bill_to_client: null,
    //     billing_contact: null,
    //     createdate: "2025-12-03T20:46:15.682Z",
    //     dealname: "Test",
    //     dealstage: "appointmentscheduled",
    //     hs_actual_duration: "2419188491",
    //     hs_acv: "4995.00",
    //     hs_arr: "4995.00",
    //     hs_lastmodifieddate: "2026-03-01T11:18:38.234Z",
    //     hs_object_id: "51083915163",
    //     n3rd_party_tags_assets: null,
    //     pipeline: "default",
    //   },
    //   createdAt: "2025-12-03T20:46:15.682Z",
    //   updatedAt: "2026-03-01T11:18:38.234Z",
    //   archived: false,
    //   url: "https://app.hubspot.com/contacts/47279144/record/0-3/51083915163",
    // },
    {
      id: "42824619364",
      properties: {
        account_director: null,
        amount: null,
        amount_in_deal_currency: null,
        amount_in_home_currency: null,
        amount_paid: null,
        are_customizations_required_to_product_: null,
        bill_to_client: null,
        billing_contact: null,
        createdate: "2025-08-25T15:55:11.993Z",
        dealname: "Allon Bloch",
        dealstage: "1150959772",
        hs_actual_duration: "518371538",
        hs_acv: null,
        hs_arr: null,
        hs_lastmodifieddate: "2025-08-26T13:36:34.108Z",
        hs_object_id: "42824619364",
        n3rd_party_tags_assets: null,
        pipeline: "786521374",
      },
      createdAt: "2025-08-25T15:55:11.993Z",
      updatedAt: "2025-08-26T13:36:34.108Z",
      archived: false,
      url: "https://app.hubspot.com/contacts/47279144/record/0-3/42824619364",
    },
  ]
) {
  try {
    for (const [index, record] of records.entries()) {
      try {
        logger.info(
          `Processing Record: ${JSON.stringify(
            record,
            null,
            2
          )} at index ${index}`
        );
        // process each record in netsuite as invoice and find deal line items parallelly
        // Fettch associated companies from hubspot

        const associationId = await fetchHubSpotAssociationIds(
          "deals",
          "companies",
          record.id
        );

        logger.info(`Associated Companies: ${JSON.stringify(associationId)}`);

        // fetch associated companies from hubspot

        // const properties = companyProperties();

        // for (const [index, value] of associationId.entries()) {
        //   logger.info(`Index: ${index}, Record: ${value}`);
        //   const company = await fetchHubspotObject(
        //     "companies",
        //     value,
        //     properties
        //   );
        //   logger.info(
        //     `Associated Companies: ${JSON.stringify(company, null, 2)}`
        //   );
        // }

        const lineItemsId = await fetchHubSpotAssociationIds(
          "deals",
          "2-55922728",
          "54347292442"
        );

        logger.info(`Line Items: ${JSON.stringify(lineItemsId)}`);

        // const response = await upsertInvoiceInNetsuite(record);
        // logger.info(`Upserted Invoice: ${JSON.stringify(response, null, 2)}`);
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

async function fetchCustomer(customKey, customValue) {
  if (!customKey || !customValue) {
    logger.warn("field or value is empty");
    return;
  }
  // Update the query to filter by the specific ID
  // SELECT id, companyname, firstname, lastname, email, phone, isperson
  const query = `
    SELECT *
    FROM customer 
    WHERE ${customKey} = '${customValue}' 
      AND isinactive = 'F'
  `;

  // logger.info(`Fetching NetSuite customer with ID: ${customerId}...`);

  try {
    // We only need 1 record, so limit = 1 and offset = 0

    const response = await runSuiteQL(query, { limit: 1, offset: 0 });

    const records = response.items || [];

    // Check if the customer actually exists
    if (records.length === 0) {
      logger.warn(`No active customer found with value: ${customValue}`);
      return null;
    }

    const customer = records[0];
    logger.info(
      `Successfully fetched customer: ${JSON.stringify(
        response.items,
        null,
        2
      )}`
    );

    return customer;
  } catch (error) {
    logger.error(`Failed to fetch customer:`, error.message || error);
    // It's usually best to throw the error so the caller (like your webhook handler) can catch it
    throw error;
  }
}

async function* fetchAllActiveCustomers() {
  // The query we discussed earlier
  // SELECT id, companyname, firstname, lastname, email, phone, isperson
  const query = `
        SELECT *
        FROM customer 
        WHERE isinactive = 'F'
    `;

  let allCustomers = [];
  let hasMore = true;
  let offset = 0;
  let pageCount = 0;
  let totalProcessed = 0;
  const limit = 100; // Match the limit in your wrapper
  const startTime = Date.now();

  logger.info("Starting NetSuite customer extraction...");

  try {
    while (hasMore) {
      pageCount++;
      // Call your wrapper
      const response = await runSuiteQL(query, { limit, offset });

      // NetSuite returns the rows inside the 'items' array
      const records = response.items || [];
      // allCustomers.push(...records);
      totalProcessed += records.length;
      const elapsedSeconds = (Date.now() - startTime) / 1000;

      // logger.info(
      //   `Fetched ${records.length} records... (Total: ${
      //     allCustomers.length
      //   }) | ${JSON.stringify(allCustomers[allCustomers.length - 1], null, 2)}`
      // );

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

      // Check if there is another page
      hasMore = response.hasMore;

      if (hasMore) {
        offset += limit;
      }
    }

    logger.info(
      `Extraction complete. Total active customers: ${allCustomers.length}`
    );

    // TODO: Pass allCustomers array to your HubSpot mapping function
    return allCustomers;
  } catch (error) {
    logger.error("Failed to execute SuiteQL:", error);
  }
}

async function processCustomers() {
  try {
    const customerStream = fetchAllActiveCustomers();

    for await (const { records, stats } of customerStream) {
      try {
        // await processBatchOfCustomers(records); // Implement this function to handle the batch processing logic
        logger.info(
          `[Netsuite-Hubspot Progress] Processing Customers: ${
            records.length
          } : ${JSON.stringify(records[0], null, 2)}`
        );

        logger.info(`[Netsuite-Hubspot Progress] `, {
          page: stats.page,
          processed: stats.totalProcessed,
          speed: `${stats.recordsPerSecond} rec/sec`,
        });

        // return;
      } catch (error) {
        logger.error(`Error processing customers`, {
          status: error?.status,
          response: error.response?.data,
          method: error?.method,
          url: error?.config?.url,
          message: error.message,
          stack: error?.stack || error,
        });
      }
    }
  } catch (error) {
    logger.error(`Error processing customers`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}

async function fetchInvoice() {
  //   const query = `
  //   SELECT
  //     tranid,
  //     BUILTIN.DF(entity) AS customername,
  //     foreignamount,
  //     duedate,
  //     BUILTIN.DF(status) AS status
  //   FROM transaction
  //   WHERE type = 'CustInvc'
  // `;
  //   const query = `
  //   SELECT *
  //   FROM transaction
  //   WHERE type = 'CustInvc'
  // `;
  const query = `SELECT 
    id,
    tranid,
    trandate,
    duedate,
    closedate,
    createddate,
    entity,
    BUILTIN.DF(entity) AS entityname,
    status,
    BUILTIN.DF(status) AS statusname,
    total,
    foreigntotal,
    foreignamountpaid,
    foreignamountunpaid,
    currency,
    BUILTIN.DF(currency) AS currencyname,
    terms,
    BUILTIN.DF(terms) AS termsname,
    postingperiod,
    voided,
    daysopen,
    daysoverduesearch,
    externalid,
    shipaddress,
    custbody_stc_amount_after_discount,
    custbody_stc_tax_after_discount,
    custbody_stc_total_after_discount,
    custbody_nwp_notes,
    custbody_atlas_final_cb
FROM transaction 
WHERE type = 'CustInvc'
`;
  let hasMore = true;
  const allInvoices = [];
  const limit = 100; // Match the limit in your wrapper
  let offset = 0;

  try {
    while (hasMore) {
      // Call your wrapper
      const response = await runSuiteQL(query, { limit, offset });

      // NetSuite returns the rows inside the 'items' array
      const records = response.items || [];
      allInvoices.push(...records);

      logger.info(`Fetched : ${JSON.stringify(allInvoices[0], null, 2)}`);

      return;
      // logger.info(
      //   `Fetched ${records.length} records... (Total: ${
      //     allCustomers.length
      //   }) | ${JSON.stringify(allCustomers[allCustomers.length - 1], null, 2)}`
      // );

      // Check if there is another page
      hasMore = response.hasMore;

      if (hasMore) {
        offset += limit;
      }
    }
  } catch (error) {
    logger.error(`Error In Fetching Invoices`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}
async function fetchFromNetsuite(query, limit, offset = 0) {
  let hasMore = true;
  const allRecords = [];

  try {
    while (hasMore) {
      // Call your wrapper
      const response = await runSuiteQL(query, { limit, offset });

      // console.log('Full response:', JSON.stringify(response, null, 2));

      // NetSuite returns the rows inside the 'items' array
      const records = response.items || [];
      allRecords.push(...records);

      // logger.info(`Fetched : ${JSON.stringify(allInvoices[0], null, 2)}`);

      return allRecords; // TODO Remove ,for testing

      // logger.info(
      //   `Fetched ${records.length} records... (Total: ${
      //     allCustomers.length
      //   }) | ${JSON.stringify(allCustomers[allCustomers.length - 1], null, 2)}`
      // );

      // Check if there is another page
      hasMore = response.hasMore;

      if (hasMore) {
        offset += limit;
      }
    }

    return allRecords;
  } catch (error) {
    logger.error(`Error In Fetching Invoices`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}

async function queryOpportunity() {
  try {
    // -- Try these one at a time
    // SELECT * FROM opportunity LIMIT 5
    // SELECT * FROM opport LIMIT 5
    // SELECT * FROM estimate LIMIT 5
    const query = `SELECT * FROM opportunity`;
    const opportunity = await fetchFromNetsuite(query, 100, 0);

    for (const op of opportunity) {
      logger.info(`Fetched : ${JSON.stringify(op, null, 2)}`);
    }
  } catch (error) {
    logger.error(`Error In Fetching Opportunity`, {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}

/**
 * Fetch All Customers from NetSuite using SuiteQL with pagination.
 * @param {*} query - This suiteql query will fetch all active customers and it also has a limit and delta filter which will be passed from the caller function.The delta filter wil ensure that only new/updates customer will be fetched.
 * @returns - It returns all active customers.
 */
async function fetchAllActiveCustomers(query) {
  let allCustomers = [];
  let hasMore = true;
  let offset = 0;
  let pageCount = 0;
  let totalProcessed = 0;
  const limit = 1; // Match the limit in your wrapper

  logger.debug("Starting NetSuite customer extraction...");

  try {
    while (hasMore) {
      pageCount++;
      // Call your wrapper
      const response = await runSuiteQL(query, { limit, offset });

      // NetSuite returns the rows inside the 'items' array
      const records = response.items || [];
      allCustomers.push(...records);

      totalProcessed += records.length;

      // Check if there is another page
      hasMore = response.hasMore;

      if (hasMore) {
        offset += limit;
      }
    }

    logger.info(
      `Extraction complete. Total active customers: ${allCustomers.length}`
    );

    return allCustomers;
  } catch (error) {
    logger.error("Failed to execute SuiteQL:", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
  }
}
/**
 * Fetch All Customers from NetSuite using SuiteQL with pagination.
 * @param {*} query - This suiteql query will fetch all active customers and it also has a limit and delta filter which will be passed from the caller function.The delta filter wil ensure that only new/updates customer will be fetched.
 * @returns - It returns all active customers.
 */
async function* fetchAllActiveCustomersPagingWithGenerator(query) {
  let hasMore = true;
  let offset = 0;
  let pageCount = 0;
  let totalProcessed = 0;
  const limit = 100; // Optimized production batch size
  const startTime = Date.now();

  logger.info("Starting NetSuite customer extraction...");

  // Define executor options outside the loop to prevent repeated allocations
  const executorOptions = {
    name: "fetch-all-active-customers with pagination and generator functionality",
  };

  try {
    while (hasMore) {
      pageCount++;

      // Cleaned up the wrapper invocation using a direct, concise arrow return
      const response = await netsuiteExecutor(
        () => runSuiteQL(query, { limit, offset }),
        executorOptions
      );

      const records = response.items || [];

      // Safeguard: Drop out early if NetSuite returns an empty data set mid-stream
      if (records.length === 0) {
        logger.warn(
          `Received empty items array on page ${pageCount} at offset ${offset}. Ending stream.`
        );
        break;
      }

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

      // Defensively normalize boolean values from response metadata
      hasMore = response.hasMore === true || response.hasMore === "true";

      if (hasMore) {
        offset += limit;
      }
    }

    logger.info(
      `Extraction complete. Total records extracted: ${totalProcessed} across ${pageCount} pages.`
    );
  } catch (error) {
    logger.error("Failed to execute SuiteQL:", {
      status: error?.status,
      response: error.response?.data,
      method: error?.method,
      url: error?.config?.url,
      message: error.message,
      stack: error?.stack || error,
    });
    throw error;
  }
}

export {
  queryOpportunity,
  fetchFromNetsuite,
  fetchInvoice,
  processCustomers,
  fetchAllActiveCustomers,
  fetchCustomer,
  processBatchDealInNetsuiteAsInvoice,
  netsuiteGenerator,
  syncNetsuiteInvoiceToHubspot,
  syncNetsuiteCustomerToHubspot,
  createNetSuiteInvoice,
};
