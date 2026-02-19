import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
    { path: '/', name: 'console', component: () => import('../pages/ConsolePage.vue') },
    { path: '/read', name: 'read', component: () => import('../pages/ReadPage.vue') },
    { path: '/write', name: 'write', component: () => import('../pages/WritePage.vue') },
    { path: '/dump', name: 'dump', component: () => import('../pages/DumpPage.vue') },
    { path: '/other', name: 'other', component: () => import('../pages/OtherPage.vue') },
];

export const router = createRouter({
    history: createWebHashHistory(),
    routes,
});
