import * as Sentry from '@sentry/electron/renderer'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import './assets/main.css'

Sentry.init({
  dsn: 'https://28239780e3a5ede424bde1114849f448@o4509333304573952.ingest.us.sentry.io/4512192370769920'
})

dayjs.locale('zh-cn')

const app = createApp(App)
app.config.errorHandler = (error, _instance, info) => {
  Sentry.captureException(error, { extra: { info } })
  console.error(error)
}
app.use(createPinia()).use(Antd).mount('#app')
