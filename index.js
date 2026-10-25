/**
 * Asyntai AI chatbot for ApostropheCMS 3 and 4.
 *
 * Adds the Asyntai chat widget to every page of the site. The module registers
 * an async component at the end of <body> (the same place Apostrophe puts its
 * own scripts), so no template has to change.
 *
 * Configure it in app.js:
 *
 *   modules: {
 *     'apostrophecms-ai-chatbot': {
 *       options: { widgetId: 'asyntai_1a2b3c4d5e6f' }
 *     }
 *   }
 *
 * or set the ASYNTAI_WIDGET_ID environment variable.
 */

const { resolveSettings, buildLoader } = require('./lib/settings');

module.exports = {
  options: {
    alias: 'asyntaiChatbot',
  },

  init(self) {
    const { settings, error } = resolveSettings(self.options, process.env);
    if (error) {
      self.apos.util.warn(error);
    }
    self.asyntaiLoader = settings
      ? buildLoader(settings.widgetId, settings.scriptUrl)
      : '';
  },

  handlers(self) {
    return {
      'apostrophe:modulesRegistered': {
        injectAsyntaiLoader() {
          if (self.asyntaiLoader) {
            self.apos.template.append('body', self.__meta.name + ':loader');
          }
        },
      },
    };
  },

  components(self) {
    return {
      async loader(req, data) {
        return { code: self.asyntaiLoader };
      },
    };
  },
};
