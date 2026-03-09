import { createApp } from 'vue';
import App from './App.vue';
import './assets/global.less';
import './assets/font/iconfont.css';
import components from './components/global';
import Router from './router/index';
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import i18n from './i18n'
import { setupErrorHandler } from '@/utils/errorHandler';

const app = createApp(App)
setupErrorHandler(app);
app.config.productionTip = false
// components
for (const i in components) {
  app.component(i, components[i])
}
app.use(i18n)
app.use(ElementPlus, { locale: zhCn })
app.use(Router).mount('#app')
