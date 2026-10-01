import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import './assets/main.css'

createApp(App).use(createPinia()).use(Antd).mount('#app')
