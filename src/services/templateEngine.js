const Handlebars = require("handlebars");

// A few convenience helpers for common newsletter formatting needs
Handlebars.registerHelper("currency", (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
});

Handlebars.registerHelper("uppercase", (value) => (value || "").toString().toUpperCase());

/**
 * Renders an HTML template string with the given data context.
 * Context typically includes: listing fields, contact fields (first_name etc),
 * and system fields (unsubscribe_url, company_name, company_address).
 */
function render(htmlTemplate, context) {
  const compiled = Handlebars.compile(htmlTemplate, { noEscape: true });
  return compiled(context);
}

module.exports = { render };
