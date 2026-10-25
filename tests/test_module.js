/**
 * Offline checks for apostrophecms-ai-chatbot. No Apostrophe and no network:
 * the module definition is run against a small fake `self`.
 *
 *   node tests/test_module.js
 */

const assert = require('assert');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const definition = require('../index.js');
const { resolveSettings, buildLoader, DEFAULT_SCRIPT_URL } = require('../lib/settings');

let passed = 0;
const queue = [];
function check(name, fn) {
  queue.push([name, fn]);
}
async function runAll() {
  for (const [name, fn] of queue) {
    await fn();
    passed += 1;
    console.log('ok - ' + name);
  }
  console.log('\n' + passed + ' checks passed');
}

/** Runs init + handlers + components the way Apostrophe would. */
function boot(options, env) {
  const warnings = [];
  const appended = [];
  const saved = process.env.ASYNTAI_WIDGET_ID;
  delete process.env.ASYNTAI_WIDGET_ID;
  if (env) Object.assign(process.env, env);
  const self = {
    options: Object.assign({}, definition.options, options),
    __meta: { name: 'apostrophecms-ai-chatbot' },
    apos: {
      util: { warn: (msg) => warnings.push(msg) },
      template: { append: (where, component) => appended.push([where, component]) },
    },
  };
  try {
    definition.init(self);
  } finally {
    delete process.env.ASYNTAI_WIDGET_ID;
    if (saved !== undefined) process.env.ASYNTAI_WIDGET_ID = saved;
  }
  const handlers = definition.handlers(self);
  handlers['apostrophe:modulesRegistered'].injectAsyntaiLoader();
  const components = definition.components(self);
  return { self, warnings, appended, components };
}

// --- module shape -----------------------------------------------------------

check('module exports only Apostrophe sections', () => {
  assert.deepStrictEqual(Object.keys(definition).sort(), ['components', 'handlers', 'init', 'options']);
});

check('the view template exists and only prints when there is code', () => {
  const view = fs.readFileSync(path.join(__dirname, '..', 'views', 'loader.html'), 'utf8');
  assert.ok(view.includes('{% if data.code %}'));
  assert.ok(view.includes('<script data-asyntai-loader>{{ data.code | safe }}</script>'));
});

check('package.json name has no reserved "apostrophe-" prefix', () => {
  const pkg = require('../package.json');
  assert.strictEqual(pkg.name, 'apostrophecms-ai-chatbot');
  assert.ok(!/^apostrophe-/.test(pkg.name));
  for (const f of ['index.js', 'lib', 'views']) assert.ok(pkg.files.includes(f), f);
});

// --- resolveSettings --------------------------------------------------------

check('a good widget ID is accepted and trimmed', () => {
  const r = resolveSettings({ widgetId: '  asyntai_abc123  ' }, {});
  assert.deepStrictEqual(r, { settings: { widgetId: 'asyntai_abc123', scriptUrl: DEFAULT_SCRIPT_URL } });
});

check('a missing widget ID gives an error, not a throw', () => {
  const r = resolveSettings({}, {});
  assert.ok(r.error.includes('no widget ID'));
  assert.ok(r.error.includes('ASYNTAI_WIDGET_ID'));
});

check('a malformed widget ID gives an error', () => {
  for (const bad of ['abc', 'asyntai_', 'asyntai_a-b', 'asyntai_a"b', '<script>']) {
    assert.ok(resolveSettings({ widgetId: bad }, {}).error, bad);
  }
});

check('the environment variable is used when the option is empty', () => {
  assert.strictEqual(resolveSettings({}, { ASYNTAI_WIDGET_ID: 'asyntai_env1' }).settings.widgetId, 'asyntai_env1');
  assert.strictEqual(resolveSettings({ widgetId: '  ' }, { ASYNTAI_WIDGET_ID: 'asyntai_env1' }).settings.widgetId, 'asyntai_env1');
});

check('the option wins over the environment variable', () => {
  assert.strictEqual(
    resolveSettings({ widgetId: 'asyntai_opt' }, { ASYNTAI_WIDGET_ID: 'asyntai_env' }).settings.widgetId,
    'asyntai_opt',
  );
});

check('enabled: false turns the module off without an error', () => {
  assert.deepStrictEqual(resolveSettings({ enabled: false, widgetId: 'asyntai_abc' }, {}), { settings: null });
  assert.deepStrictEqual(resolveSettings({ enabled: false }, {}), { settings: null });
});

check('a custom scriptUrl is used, an empty one falls back', () => {
  assert.strictEqual(resolveSettings({ widgetId: 'asyntai_a', scriptUrl: ' https://x.test/w.js ' }, {}).settings.scriptUrl, 'https://x.test/w.js');
  assert.strictEqual(resolveSettings({ widgetId: 'asyntai_a', scriptUrl: '' }, {}).settings.scriptUrl, DEFAULT_SCRIPT_URL);
});

// --- buildLoader ------------------------------------------------------------

check('the loader is valid JavaScript', () => {
  new vm.Script(buildLoader('asyntai_abc', DEFAULT_SCRIPT_URL));
});

check('the loader cannot close the script element', () => {
  const code = buildLoader('asyntai_abc', 'https://x.test/</script><b>');
  assert.ok(!code.toLowerCase().includes('</script'));
  new vm.Script(code);
});

check('U+2028 and U+2029 are escaped', () => {
  const code = buildLoader('asyntai_abc', 'https://x.test/' + String.fromCharCode(0x2028) + String.fromCharCode(0x2029));
  assert.ok(!code.includes(String.fromCharCode(0x2028)));
  assert.ok(!code.includes(String.fromCharCode(0x2029)));
  assert.ok(code.includes('\\u2028') && code.includes('\\u2029'));
});

check('the loader adds the widget once, after the load event', () => {
  const code = buildLoader('asyntai_abc', DEFAULT_SCRIPT_URL);
  const added = [];
  const listeners = {};
  const doc = {
    readyState: 'loading',
    querySelector: () => (added.length ? {} : null),
    createElement: () => ({ setAttribute(k, v) { this[k] = v; } }),
    head: { appendChild: (el) => added.push(el) },
  };
  const win = { addEventListener: (ev, fn) => { listeners[ev] = fn; } };
  vm.runInNewContext(code, { document: doc, window: win });
  assert.strictEqual(added.length, 0, 'nothing before load');
  listeners.load();
  listeners.load();
  assert.strictEqual(added.length, 1, 'exactly one widget script');
  assert.strictEqual(added[0].src, DEFAULT_SCRIPT_URL);
  assert.strictEqual(added[0]['data-asyntai-id'], 'asyntai_abc');
  assert.strictEqual(added[0].async, true);
});

check('the loader runs at once when the page has already loaded', () => {
  const added = [];
  const doc = {
    readyState: 'complete',
    querySelector: () => null,
    createElement: () => ({ setAttribute() {} }),
    head: { appendChild: (el) => added.push(el) },
  };
  vm.runInNewContext(buildLoader('asyntai_abc', DEFAULT_SCRIPT_URL), { document: doc, window: {} });
  assert.strictEqual(added.length, 1);
});

check('the loader skips a page that already has an Asyntai snippet', () => {
  const added = [];
  const doc = {
    readyState: 'complete',
    querySelector: () => ({}),
    createElement: () => ({ setAttribute() {} }),
    head: { appendChild: (el) => added.push(el) },
  };
  vm.runInNewContext(buildLoader('asyntai_abc', DEFAULT_SCRIPT_URL), { document: doc, window: {} });
  assert.strictEqual(added.length, 0);
});

// --- the module, booted against a fake Apostrophe ----------------------------

check('a good widget ID registers the component at the end of body', () => {
  const { warnings, appended } = boot({ widgetId: 'asyntai_abc' });
  assert.deepStrictEqual(warnings, []);
  assert.deepStrictEqual(appended, [['body', 'apostrophecms-ai-chatbot:loader']]);
});

check('the component returns the loader code', async () => {
  const { components } = boot({ widgetId: 'asyntai_abc' });
  return components.loader({}, {}).then((data) => {
    assert.ok(data.code.includes('"asyntai_abc"'));
  });
});

check('a missing widget ID warns and registers nothing', () => {
  const { warnings, appended } = boot({});
  assert.strictEqual(warnings.length, 1);
  assert.deepStrictEqual(appended, []);
});

check('a bad widget ID warns and registers nothing', () => {
  const { warnings, appended } = boot({ widgetId: 'nope' });
  assert.strictEqual(warnings.length, 1);
  assert.deepStrictEqual(appended, []);
});

check('enabled: false registers nothing and does not warn', () => {
  const { warnings, appended } = boot({ enabled: false });
  assert.deepStrictEqual(warnings, []);
  assert.deepStrictEqual(appended, []);
});

check('the environment variable is read at boot', () => {
  const { appended, self } = boot({}, { ASYNTAI_WIDGET_ID: 'asyntai_fromenv' });
  assert.strictEqual(appended.length, 1);
  assert.ok(self.asyntaiLoader.includes('"asyntai_fromenv"'));
});

check('a project-level module name is used for the component', () => {
  const warnings = [];
  const appended = [];
  const self = {
    options: { widgetId: 'asyntai_abc' },
    __meta: { name: 'my-chat' },
    apos: { util: { warn: (m) => warnings.push(m) }, template: { append: (w, c) => appended.push(c) } },
  };
  definition.init(self);
  definition.handlers(self)['apostrophe:modulesRegistered'].injectAsyntaiLoader();
  assert.deepStrictEqual(appended, ['my-chat:loader']);
});

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
