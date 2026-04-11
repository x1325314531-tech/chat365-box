const constantRouterMap = [
  {
    path: '/login',
    name: 'LoginIndex',
    component: () => import('@/views/login/Index.vue')
  },
  {
    path: '/',
    redirect: { name: 'LoginIndex' } // 根路径重定向到 /login
  },
  {
    path: '/home',
    component: () => import('@/views/home/Index.vue'),
    children: [
      {
        path: '',
        name: 'HomeIndex',
        component: () => import('@/views/platform/HomePage.vue')
      },
      {
        path: 'whatsapp',
        name: 'WhatsApp',
        component: () => import('@/views/platform/WhatsApp.vue')
      },
        {
        path: 'facebook',
        name: 'faceBook',
        component: () => import('@/views/platform/FaceBook.vue')
      },
      {
        path: 'fans',
        name: 'FansList',
        component: () => import('@/views/platform/FansList.vue')
      },
        {
        path: 'dashboard',
        name: 'dashboardFans',
        component: () => import('@/views/dashboard/fans/index.vue')
      },
      {
        path: 'zalo',
        name: 'Zalo',
        component: () => import('@/views/platform/Zalo.vue')
      },
      {
        path: 'telegram',
        name: 'Telegram',
        component: () => import('@/views/platform/Telegram.vue')
      },
      {
        path: 'telegramK',
        name: 'TelegramK',
        component: () => import('@/views/platform/TelegramK.vue')
      },
      {
        path: 'settings',
        name: 'SettingsIndex',
        component: () => import('@/views/settings/TranslateSettings.vue')
      }
    ]
  }
];

export default constantRouterMap;
