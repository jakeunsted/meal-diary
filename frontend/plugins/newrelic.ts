import { NewRelicCapacitorPlugin, NREnums, type AgentConfiguration } from '@newrelic/newrelic-capacitor-plugin';
import { Capacitor } from '@capacitor/core';

const config = useRuntimeConfig()

export default defineNuxtPlugin(() => {
  var appToken: string = '';
  if (Capacitor.getPlatform() === 'ios') {
    appToken = config.public.newRelicIosAppToken as string;
  } else {
    appToken = config.public.newRelicAndroidAppToken as string;
  }

  let agentConfig : AgentConfiguration = {
    // Android specific option
    // Optional: Enable or disable collection of event data.
    analyticsEventEnabled: true,

    // iOS specific option
    // Optional: Enable/Disable automatic instrumentation of WebViews.
    webViewInstrumentation: true,

    // Optional: Enable or disable crash reporting.
    crashReportingEnabled: true,

    // Optional: Enable or disable interaction tracing. Trace instrumentation still occurs, but no traces are harvested. This will disable default and custom interactions.
    interactionTracingEnabled: true,

    // Optional: Enable or disable reporting successful HTTP requests to the MobileRequest event type.
    networkRequestEnabled: true,

    // Optional: Enable or disable reporting network and HTTP request errors to the MobileRequestError event type.
    networkErrorRequestEnabled: true,

    // Optional: Enable or disable capture of HTTP response bodies for HTTP error traces, and MobileRequestError events.
    httpResponseBodyCaptureEnabled: true,

    // Optional: Enable or disable agent logging.
    loggingEnabled: true,

    // Optional: Specifies the log level. Omit this field for the default log level.
    // Options include: ERROR (least verbose), WARNING, INFO, VERBOSE, AUDIT (most verbose).
    logLevel: NREnums.LogLevel.INFO,

    // Optional: Enable or disable sending JS console logs to New Relic.
    sendConsoleEvents: true
  }

  NewRelicCapacitorPlugin.start({appKey:appToken, agentConfiguration:agentConfig})
})
