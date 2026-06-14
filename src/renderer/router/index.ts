import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import MainView from '../views/MainView.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'login', component: LoginView },
    { path: '/main', name: 'main', component: MainView }
  ]
})

// 导航守卫：App.vue 已完成初始化并确认路由，此处作为二次保险
router.beforeEach(async (to) => {
  if (to.name === 'login') return true
  try {
    if (!window.electronAPI?.checkAutoLogin) return { name: 'login' }
    const result = await window.electronAPI.checkAutoLogin()
    if (!result?.hasCredentials) return { name: 'login' }
  } catch {
    return { name: 'login' }
  }
  return true
})

export default router