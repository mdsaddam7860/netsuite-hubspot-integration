import { logger } from "../index.js";

// function hubspotDealToNetsuiteInvoiceMapping(record) {
//   return (myInvoice = {
//     entity: { id: "9033" },
//     department: { id: "4" },
//     item: {
//       items: [
//         {
//           item: { id: "182" },
//           quantity: 1,
//           rate: 139,
//           custcol_agency_mf_flight_start_date: "2023-05-19",
//           custcol_agency_mf_flight_end_date: "2024-05-10",
//         },
//       ],
//     },
//   });
// }

// file: src/mappings/hubspot-netsuite.mapping.js

function hubspotDealToNetsuiteInvoiceMapping(hubspotDeal = {}) {
  // Use 'hubspotDeal' (the parameter), NOT 'myInvoice'
  // return {
  //   entity: {
  //     id: hubspotDeal.netsuite_customer_id || "9033",
  //   },
  //   department: {
  //     id: "4",
  //   },
  //   item: {
  //     items: [
  //       {
  //         item: { id: "182" },
  //         quantity: 1,
  //         rate: parseFloat(hubspotDeal.amount) || 139,
  //         // Ensure these property names match your HubSpot internal names
  //         custcol_agency_mf_flight_start_date:
  //           hubspotDeal.desired_booking_start_date_time,
  //         custcol_agency_mf_flight_end_date:
  //           hubspotDeal.desired_booking_end_date_time,
  //       },
  //     ],
  //   },
  // };

  // const payload = hubspotDealToNetsuiteInvoiceMapping();

  const payload = {
    entity: {
      id: "9033",
    },
    department: {
      id: "4",
    },
    item: {
      items: [
        {
          item: {
            id: "182",
          },
          quantity: 1,
          rate: 139,
          custcol_agency_mf_flight_start_date: "2026-03-06",
          custcol_agency_mf_flight_end_date: "2026-03-10",
        },
      ],
    },
  };
  return payload;
}
export { hubspotDealToNetsuiteInvoiceMapping };
