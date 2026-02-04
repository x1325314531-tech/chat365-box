import { createApp } from 'vue';
import App from './App.vue';
import './assets/global.less';
import './assets/font/iconfont.css';
import components from './components/global';
import Router from './router/index';
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app = createApp(App)
app.config.productionTip = false
// components
for (const i in components) {
  app.component(i, components[i])
}
app.use(ElementPlus)
app.use(Router).mount('#app')
