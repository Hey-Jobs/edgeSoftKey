/**
 * 后台菜单和路由配置
 * 集中管理页面路径、菜单显示、面包屑导航
 */

export interface MenuItem {
  name: string
  href: string
}

export interface MenuGroup {
  icon: string // SVG path
  name: string
  items: MenuItem[]
}

export interface Crumb {
  name: string
  href?: string
}

// 菜单组配置
export const menuGroups: MenuGroup[] = [
  {
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    name: "商品与订单",
    items: [
      { name: "分类管理", href: "/admin/categories" },
      { name: "商品管理", href: "/admin/products" },
      { name: "卡密管理", href: "/admin/cards" },
      { name: "订单管理", href: "/admin/orders" },
      { name: "折扣码管理", href: "/admin/discount-codes" },
    ],
  },
  {
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
    name: "系统配置",
    items: [
      { name: "支付配置", href: "/admin/payments" },
      { name: "邮件管理", href: "/admin/email" },
      { name: "站点设置", href: "/admin/settings" },
      { name: "安全设置", href: "/admin/security" },
    ],
  },
  {
    icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
    name: "内容管理",
    items: [
      { name: "文件管理", href: "/admin/media" },
    ],
  },
  {
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    name: "账户",
    items: [
      { name: "个人资料", href: "/admin/profile" },
    ],
  },
]

// 面包屑配置（特殊路由）
export const breadcrumbRoutes: { pattern: string; crumbs: Crumb[] }[] = [
  { pattern: "/admin/products/new",      crumbs: [{ name: "商品与订单", href: "/admin/products" }, { name: "新建商品" }] },
  { pattern: "/admin/products/:id/edit", crumbs: [{ name: "商品与订单", href: "/admin/products" }, { name: "编辑商品" }] },
  { pattern: "/admin/orders/:id",        crumbs: [{ name: "商品与订单", href: "/admin/orders" }, { name: "订单详情" }] },
]

// 根据路径获取面包屑
export function getBreadcrumbs(path: string): Crumb[] {
  // 先匹配特殊路由
  for (const route of breadcrumbRoutes) {
    if (matchRoute(route.pattern, path)) {
      return route.crumbs
    }
  }

  // 再匹配菜单项
  for (const group of menuGroups) {
    for (const item of group.items) {
      if (path === item.href || path.startsWith(item.href + "/")) {
        return [{ name: group.name }, { name: item.name }]
      }
    }
  }

  return []
}

// 判断菜单组是否应该展开
export function isGroupOpen(group: MenuGroup, currentPath: string): boolean {
  return group.items.some(item =>
    currentPath === item.href || currentPath.startsWith(item.href + "/")
  )
}

// 判断菜单项是否激活
export function isItemActive(item: MenuItem, currentPath: string): boolean {
  return currentPath === item.href || currentPath.startsWith(item.href + "/")
}

function matchRoute(pattern: string, path: string): boolean {
  const re = new RegExp("^" + pattern.replace(/:[^/]+/g, "[^/]+") + "(/.*)?$")
  return re.test(path)
}
