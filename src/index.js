import util, { warn } from './util'
import extend from './extend'


/**
 * plugin
 *
 * @param {Object} Vue
 * @param {Object} opts
 */

function plugin (Vue, opts = { lang: 'en', locales: {} }) {
  if (plugin.installed) {
    warn('already installed.')
      return
  }

  defineConfig(Vue.config, opts.lang)
  extend(Vue, opts.locales)
}


/**
 * defineConfig
 *
 * This function define `lang` property to `Vue.config`.
 *
 * @param {Object} config
 * @param {String} lang
 * @private
 */

function defineConfig (config, lang) {
  Object.defineProperty(config, 'lang', {
    get: () => { return lang },
    set: (val) => { lang = val }
  })
}

plugin.version = '2.4.1'

export default plugin