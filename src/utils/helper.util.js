import { logger } from "../index.js";

function dealProperties(record) {
  return [
    "dealname",
    "dealstage",
    "dealvalue",
    "pipeline",
    "n3rd_party_tags_assets",
    "account_director",
    "hs_actual_duration",
    "amount",
    "amount_in_home_currency",
    "amount_in_deal_currency",
    "amount_paid",
    "hs_acv",
    "hs_arr",
    "are_customizations_required_to_product_",
    "bill_to_client",
    "billing_contact",
  ];
}

function companyProperties() {
  return [
    "name",
    "domain",
    "about_us",
    "account",
    "account_director",
    "additional_links",
    "agency",
    "annualrevenue",
    "associated_contests",
    "balance",
    "billing_address",
    "city",
    "state",
    "country",
  ];
}
export { dealProperties, companyProperties };
