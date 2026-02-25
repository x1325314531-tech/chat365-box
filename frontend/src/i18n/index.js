import { createI18n } from 'vue-i18n'
import zh from './locales/zh.json'
import en from './locales/en.json'
import fr from './locales/fr.json'

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: localStorage.getItem('app-locale') || 'zh',
  fallbackLocale: 'zh',
  messages: { zh, en, fr }
})

export default i18n
