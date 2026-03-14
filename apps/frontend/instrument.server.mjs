import * as Sentry from "@sentry/tanstackstart-react";

Sentry.init({
  dsn: "https://9f38c35ec7dc4887f3425eb602d0eb75@o4511041204781056.ingest.us.sentry.io/4511041216643072",

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
