import { createApp } from 'vue'
import { createPinia } from 'pinia'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import './assets/main.css'

dayjs.locale('zh-cn')

createApp(App).use(createPinia()).use(Antd).mount('#app')
