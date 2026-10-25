# apostrophecms-ai-chatbot

Add the [Asyntai](https://asyntai.com) AI chat assistant to your ApostropheCMS
site. It answers visitor questions from your own content, in more than 80
languages, and collects leads when a visitor wants to be contacted.

Works with ApostropheCMS 3 and 4. No template changes are needed.

## Install

```bash
npm install apostrophecms-ai-chatbot
```

Then enable the module in `app.js`:

```js
require('apostrophe')({
  shortName: 'my-site',
  modules: {
    // ...your other modules
    'apostrophecms-ai-chatbot': {
      options: {
        widgetId: 'asyntai_1a2b3c4d5e6f'
      }
    }
  }
});
```

Restart the site. The chat bubble is on every page.

## Where the widget ID comes from

Open the Install page in your [Asyntai dashboard](https://asyntai.com/dashboard).
The widget ID is the value of `data-asyntai-id` in the snippet shown there. It
starts with `asyntai_`.

Creating an account is free, and the Free plan is enough to try the widget.

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `widgetId` | string | `ASYNTAI_WIDGET_ID` env variable | Your Asyntai widget ID |
| `enabled` | boolean | `true` | Set to `false` to turn the widget off, for example on a staging server |
| `scriptUrl` | string | the Asyntai CDN | Advanced. Load the widget from another URL |

You can leave `widgetId` out of `app.js` and set the `ASYNTAI_WIDGET_ID`
environment variable on the server instead. The `widgetId` option wins when
both are set.

A missing or malformed widget ID does not stop your site. Apostrophe logs a
warning that says how to fix it, and the page is served without the widget.

## What the module does

- It adds a small loader script at the end of `<body>` on every page, next to
  Apostrophe's own scripts. Your templates stay as they are.
- The loader waits for the page's `load` event, so your own content always
  renders first.
- API responses and in-context editing refreshes get no script.
- A page that already has the Asyntai snippet keeps it and gets no second one.

## Answering from your content

Asyntai reads your published pages. Add your site URL in the dashboard, and the
assistant answers from the same pages the widget sits on. You can also add
extra documents and question and answer pairs.

## Removing it

Delete the `apostrophecms-ai-chatbot` entry from `app.js`, uninstall the
package and restart the site. The widget is gone.

## Support

Email [hello@asyntai.com](mailto:hello@asyntai.com), or read the
[ApostropheCMS guide](https://asyntai.com/documentation/integrations/apostrophecms/).

## Licence

MIT. See [LICENSE](LICENSE).
