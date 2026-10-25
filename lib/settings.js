/**
 * Pure helpers for apostrophecms-ai-chatbot. No Apostrophe import, so the tests
 * can run them without a CMS.
 */

const DEFAULT_SCRIPT_URL = 'https://widget.asyntai.com/static/js/chat-widget.js';
const WIDGET_ID_PATTERN = /^asyntai_[A-Za-z0-9]+$/;
const NAME = 'apostrophecms-ai-chatbot';

// U+2028 and U+2029 end a line inside a <script>, so they are escaped too.
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');

/**
 * Returns { settings } when the options are usable, or { error } with a
 * message that says how to fix them. A CMS site must still start with a bad
 * option, so the module warns and injects nothing instead of throwing.
 * `enabled: false` returns { settings: null } and no error.
 */
function resolveSettings(options, env) {
  const opts = options || {};
  const environment = env || {};

  if (opts.enabled === false) {
    return { settings: null };
  }

  const raw =
    typeof opts.widgetId === 'string' && opts.widgetId.trim()
      ? opts.widgetId
      : environment.ASYNTAI_WIDGET_ID;
  const widgetId = typeof raw === 'string' ? raw.trim() : '';

  if (!widgetId) {
    return {
      error:
        NAME +
        ': no widget ID, so the chat widget is not added. Set the "widgetId" ' +
        'option or the ASYNTAI_WIDGET_ID environment variable. Copy the ID ' +
        'from the Install page of your Asyntai dashboard, for example ' +
        'asyntai_1a2b3c4d5e6f.',
    };
  }
  if (!WIDGET_ID_PATTERN.test(widgetId)) {
    return {
      error:
        NAME +
        ': "' +
        widgetId +
        '" does not look like a widget ID, so the chat widget is not added. ' +
        'It starts with asyntai_, for example asyntai_1a2b3c4d5e6f.',
    };
  }

  const scriptUrl =
    typeof opts.scriptUrl === 'string' && opts.scriptUrl.trim()
      ? opts.scriptUrl.trim()
      : DEFAULT_SCRIPT_URL;

  return { settings: { widgetId, scriptUrl } };
}

/** JSON.stringify, safe inside an HTML <script> element. */
function jsString(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029');
}

/**
 * The loader waits for the page's load event before it fetches the widget.
 * An ordinary `<script async src>` holds the load event open until its own
 * fetch finishes, so an unreachable server would delay the host page. This
 * pattern cannot. It also skips a page that already has an Asyntai snippet.
 */
function buildLoader(widgetId, scriptUrl) {
  return (
    '(function(){var l=function(){' +
    'if(document.querySelector("script[data-asyntai-id]"))return;' +
    'var s=document.createElement("script");' +
    's.src=' +
    jsString(scriptUrl) +
    ';s.async=true;' +
    's.setAttribute("data-asyntai-id",' +
    jsString(widgetId) +
    ');' +
    'document.head.appendChild(s)};' +
    'if(document.readyState==="complete"){l()}' +
    'else{window.addEventListener("load",l)}})();'
  );
}

module.exports = { resolveSettings, buildLoader, DEFAULT_SCRIPT_URL };
