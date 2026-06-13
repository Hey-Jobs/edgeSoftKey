# 公共组件文档

## AppButton

统一按钮组件，替代项目中散落的原生 `<button class="btn ...">`，解决尺寸混乱、loading 状态不一致、缺少 `type` 属性等问题。支持 `href` prop 渲染为 `<a>` 标签。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `variant` | `"primary" \| "success" \| "danger" \| "warning" \| "ghost" \| "outline" \| "default"` | `"default"` | 颜色风格 |
| `size` | `"xs" \| "sm" \| "md" \| "lg"` | `"sm"` | 尺寸，**通过此 prop 控制大小，不要用 class** |
| `loading` | `boolean` | `false` | 显示左侧旋转 SVG，同时自动禁用按钮 |
| `disabled` | `boolean` | `false` | 禁用按钮 |
| `type` | `"button" \| "submit" \| "reset"` | `"button"` | 原生 type，默认 `button` 防止误触发表单提交 |
| `block` | `boolean` | `false` | 宽度撑满父容器 |
| `href` | `string` | — | 有值时渲染为 `<a>` 标签，用于页面跳转 |

### 尺寸规范

| size | 高度 | 适用场景 |
|------|------|----------|
| `xs` | 1.5rem | 表格行内操作（编辑、删除） |
| `sm` | 2.25rem | **默认**，工具栏、表单、弹窗操作 |
| `md` | 2.5rem | 较大的表单提交按钮 |
| `lg` | 3rem | 页面主 CTA |

### 颜色规范

| variant | 颜色 | 适用场景 |
|---------|------|----------|
| `primary` | 蓝色 | 主要操作、保存、提交 |
| `success` | 绿色 | 成功、激活 |
| `danger` | 红色 | 删除、危险操作 |
| `warning` | 橙色 | 警告操作 |
| `outline` | 蓝色边框 | 次要操作、编辑 |
| `ghost` | 透明 | 取消、重置 |
| `default` | 灰色边框 | 中性操作 |

### 基本用法

```components/AppButton.vue#L1-3
<AppButton variant="primary" @click="handleSave">保存</AppButton>
<AppButton variant="danger" size="xs" @click="handleDelete">删除</AppButton>
<AppButton variant="ghost" @click="handleCancel">取消</AppButton>
```

### 链接按钮（href）

```components/AppButton.vue#L1-3
<AppButton href="/admin/products/new" variant="primary">新建商品</AppButton>
<AppButton :href="`/admin/orders/${id}`" variant="outline" size="xs">详情</AppButton>
```

### loading 状态

```components/AppButton.vue#L1-3
<AppButton variant="primary" :loading="saving" @click="handleSave">保存配置</AppButton>
```

loading 为 `true` 时，按钮左侧显示旋转圆圈动画，按钮自动进入禁用状态，无需额外绑定 `:disabled="saving"`。

### 表单提交

```components/AppButton.vue#L1-3
<AppButton type="submit" variant="primary" :loading="loading" block>登录后台</AppButton>
```



## ConfirmDialog

全局确认/提示弹窗组件，替代原生 `confirm()` 和 `alert()`，基于 daisyUI `<dialog>`。

### 暴露方法

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `confirm(options)` | 见下表 | `Promise<boolean>` | 确认弹窗，有确认+取消按钮 |
| `alert(options)` | `title`, `message`, `confirmText?` | `Promise<void>` | 提示弹窗，只有"知道了"按钮 |

#### confirm options

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `title` | `string` | — | 弹窗标题 |
| `message` | `string` | — | 弹窗内容 |
| `confirmText` | `string` | `"确认"` | 确认按钮文字 |
| `cancelText` | `string` | `"取消"` | 取消按钮文字 |
| `danger` | `boolean` | `false` | 确认按钮显示为红色（危险操作） |

### 基本用法

```components/ConfirmDialog.vue#L1-5
<ConfirmDialog ref="confirmRef" />
```

```components/ConfirmDialog.vue#L1-10
const confirmRef = useTemplateRef<InstanceType<typeof ConfirmDialog>>("confirmRef");

// 确认弹窗（危险操作）
const ok = await confirmRef.value?.confirm({
  title: "删除",
  message: "确认删除？此操作不可撤销。",
  confirmText: "删除",
  danger: true,
});
if (!ok) return;

// 提示弹窗
await confirmRef.value?.alert({ title: "提示", message: "请先选择商品" });
```


## StatusTag

状态标签组件，用于展示订单状态、支付状态、发货状态等。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `"primary" \| "success" \| "danger" \| "warning" \| "default"` | `"default"` | 颜色类型 |
| `size` | `"sm" \| "md" \| "lg"` | `"sm"` | 大小 |
| `variant` | `"solid" \| "outline" \| "pill"` | `"solid"` | 样式风格 |

### 颜色对应

| type | 颜色 | 适用场景 |
|------|------|----------|
| `primary` | 蓝色 | 主要操作、信息 |
| `success` | 绿色 | 已完成、已支付、已发货 |
| `danger` | 红色 | 失败、错误 |
| `warning` | 橙色 | 待处理、未支付、未发货 |
| `default` | 灰色 | 已关闭、中性状态 |

### 基本用法

```components/StatusTag.vue#L1-3
<StatusTag type="success">已支付</StatusTag>
<StatusTag type="warning">待处理</StatusTag>
<StatusTag type="danger">发货失败</StatusTag>
```

### 配合 order-status 工具函数

`lib/utils/order-status.ts` 提供了对应的 type 辅助函数：

- `getOrderStatusType(status)` — 订单状态 → type
- `getPaymentStatusType(status)` — 支付状态 → type
- `getDeliveryStatusType(status)` — 发货状态 → type

```components/StatusTag.vue#L1-5
<StatusTag :type="getOrderStatusType(order.status)">
  {{ getOrderStatusLabel(order.status) }}
</StatusTag>
```


## RemoteSelect

远程搜索下拉框组件，支持本地搜索和远程搜索，可单选或多选。基于 daisyUI 样式实现。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `any \| any[]` | — | 选中的值（v-model） |
| `items` | `SelectItem[]` | `[]` | 选项列表 |
| `labelKey` | `string` | `"label"` | 显示文本的字段名 |
| `valueKey` | `string` | `"value"` | 值的字段名 |
| `placeholder` | `string` | `"请选择..."` | 占位文本 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `loading` | `boolean` | `false` | 是否显示加载状态 |
| `clearable` | `boolean` | `true` | 是否可清空 |
| `multiple` | `boolean` | `false` | 是否多选 |
| `searchable` | `boolean` | `true` | 是否可搜索 |
| `remoteSearch` | `boolean` | `false` | 是否远程搜索（触发 search 事件） |
| `emptyText` | `string` | `"暂无数据"` | 无数据时显示的文本 |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `value: any \| any[]` | 选中值变化时触发 |
| `search` | `query: string` | 远程搜索时触发（带 300ms 防抖） |
| `focus` | — | 输入框获得焦点时触发 |
| `change` | `value: any \| any[]` | 选中值变化时触发（同 update:modelValue） |

### SelectItem 类型

```typescript
interface SelectItem {
  [key: string]: any;  // 至少包含 labelKey 和 valueKey 指定的字段
}
```

### 基本用法（单选）

```vue
<script setup lang="ts">
import { ref } from "vue";
import RemoteSelect from "../../../components/RemoteSelect.vue";

const selected = ref(null);
const items = [
  { value: 1, label: "选项一" },
  { value: 2, label: "选项二" },
  { value: 3, label: "选项三" },
];
</script>

<template>
  <RemoteSelect
    v-model="selected"
    :items="items"
    placeholder="请选择..."
  />
</template>
```

### 多选模式

```vue
<script setup lang="ts">
import { ref } from "vue";
import RemoteSelect from "../../../components/RemoteSelect.vue";

const selectedIds = ref<number[]>([]);
const products = [
  { id: 1, name: "商品A" },
  { id: 2, name: "商品B" },
  { id: 3, name: "商品C" },
];
</script>

<template>
  <RemoteSelect
    v-model="selectedIds"
    :items="products"
    label-key="name"
    value-key="id"
    :multiple="true"
    placeholder="搜索或选择商品..."
  />
  <p>已选择 {{ selectedIds.length }} 个商品</p>
</template>
```

### 远程搜索

```vue
<script setup lang="ts">
import { ref } from "vue";
import RemoteSelect from "../../../components/RemoteSelect.vue";

const selected = ref(null);
const items = ref([]);
const loading = ref(false);

async function handleSearch(query: string) {
  if (!query) {
    items.value = [];
    return;
  }
  loading.value = true;
  try {
    const result = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    items.value = await result.json();
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <RemoteSelect
    v-model="selected"
    :items="items"
    :loading="loading"
    :remote-search="true"
    placeholder="输入关键词搜索..."
    @search="handleSearch"
  />
</template>
```

### 自定义字段名

```vue
<script setup lang="ts">
import { ref } from "vue";
import RemoteSelect from "../../../components/RemoteSelect.vue";

const selected = ref(null);
const users = [
  { userId: 1, userName: "张三", email: "zhang@example.com" },
  { userId: 2, userName: "李四", email: "li@example.com" },
];
</script>

<template>
  <RemoteSelect
    v-model="selected"
    :items="users"
    label-key="userName"
    value-key="userId"
    placeholder="选择用户..."
  />
</template>
```

### 禁用和只读

```vue
<template>
  <!-- 禁用状态 -->
  <RemoteSelect
    v-model="selected"
    :items="items"
    :disabled="true"
  />
</template>
```

### 使用场景

| 场景 | 推荐配置 |
|------|----------|
| 商品选择 | `:multiple="true"`, `:searchable="true"` |
| 用户选择 | `:remote-search="true"`, `@search="fetchUsers"` |
| 分类选择 | `:searchable="true"`, `:clearable="true"` |
| 支付方式 | `:searchable="false"` |

### 样式说明

- 基于 daisyUI `input` 和 `dropdown` 样式
- 下拉框最大高度 `max-h-60`（15rem），超出可滚动
- 多选模式显示复选框
- 选中项高亮显示（`bg-primary/10`）
- 支持加载状态动画


## SecretInput

带显示/隐藏切换的密钥输入框，用于密码、API Secret 等敏感字段。

### Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `modelValue` | `string` | 输入值（v-model） |

支持透传所有原生 `input` 属性（如 `placeholder`、`disabled` 等）。

### 基本用法

```components/SecretInput.vue#L1-3
<SecretInput v-model="form.appSecret" placeholder="请输入 App Secret" />
```


## DataTable

通用带翻页的表格组件，基于 daisyUI `table` 样式。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `columns` | `{ key: string; label: string }[]` | — | 列定义 |
| `rows` | `T[]` | — | 当前页数据 |
| `total` | `number` | — | 总条数 |
| `page` | `number` | — | 当前页码（从 1 开始） |
| `pageSize` | `number` | `20` | 每页条数 |
| `emptyText` | `string` | `"暂无数据"` | 空状态文案 |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `update:page` | `page: number` | 用户切换页码时触发 |

### Slots

每一列都有一个以 `col.key` 命名的具名插槽，用于自定义单元格渲染。

插槽 props：

| 名称 | 类型 | 说明 |
|------|------|------|
| `row` | `T` | 当前行完整数据 |
| `value` | `any` | 当前列的值，等同于 `row[col.key]` |

不提供插槽时，默认渲染 `value`，值为 `null`/`undefined` 时显示 `-`。

### 基本用法

```components/DataTable.vue#L1-5
<DataTable
  :columns="columns"
  :rows="pageData.items"
  :total="pageData.total"
  :page="currentPage"
  :page-size="20"
  @update:page="handlePageChange"
/>
```

### 自定义列渲染

```components/DataTable.vue#L1-10
<DataTable :columns="columns" :rows="rows" :total="total" :page="page" @update:page="p => page = p">
  <!-- 自定义状态列 -->
  <template #status="{ value }">
    <span class="badge badge-success">{{ value }}</span>
  </template>
  <!-- 自定义时间列 -->
  <template #createdAt="{ value }">
    {{ new Date(value).toLocaleString() }}
  </template>
</DataTable>
```

### 完整示例

```pages/admin/cards/+Page.vue#L1-30
<script setup lang="ts">
import { ref, reactive } from "vue";
import DataTable from "../../../components/DataTable.vue";
import { onQueryCards } from "./queryCards.telefunc";

const PAGE_SIZE = 20;
const currentPage = ref(1);
const cardPage = ref({ items: [], total: 0 });

const columns = [
  { key: "id", label: "ID" },
  { key: "productName", label: "商品" },
  { key: "status", label: "状态" },
  { key: "createdAt", label: "创建时间" },
];

async function fetchPage(page: number) {
  cardPage.value = await onQueryCards({ page, pageSize: PAGE_SIZE });
  currentPage.value = page;
}
</script>

<template>
  <DataTable
    :columns="columns"
    :rows="cardPage.items"
    :total="cardPage.total"
    :page="currentPage"
    :page-size="PAGE_SIZE"
    @update:page="fetchPage"
  />
</template>
```

### 分页说明

- 总条数 `total <= pageSize` 时，分页控件自动隐藏
- 页码按钮最多显示 5 个，以当前页为中心滑动


## FilePickerModal

文件选择器模态框组件，用于从媒体库中选择文件。支持搜索、类型筛选和分页功能，可选择图片、视频、音频、PDF 等文件类型。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `show` | `boolean` | — | 控制模态框显示/隐藏 |
| `typeFilter` | `string` | — | 预设的类型筛选，如 `'image/'`、`'video/'`、`'audio/'`、`'application/pdf'` |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `close` | — | 关闭模态框时触发 |
| `select` | `url: string` | 选择文件时触发，参数为文件的 URL |

### 功能特性

- **搜索功能**：支持按文件名关键词搜索
- **类型筛选**：可预设或手动切换文件类型（图片、视频、音频、PDF）
- **分页显示**：支持分页浏览大量文件
- **缩略图预览**：图片和视频显示缩略图，其他文件显示类型图标
- **响应式网格**：自适应不同屏幕尺寸显示文件网格

### 基本用法

```components/FilePickerModal.vue#L1-5
<FilePickerModal
  :show="showFilePicker"
  @close="showFilePicker = false"
  @select="handleFileSelect"
/>
```

### 带类型预筛选

```components/FilePickerModal.vue#L1-5
<!-- 只显示图片文件 -->
<FilePickerModal
  :show="showImagePicker"
  type-filter="image/"
  @close="showImagePicker = false"
  @select="handleImageSelect"
/>

<!-- 只显示 PDF 文件 -->
<FilePickerModal
  :show="showPdfPicker"
  type-filter="application/pdf"
  @close="showPdfPicker = false"
  @select="handlePdfSelect"
/>
```

### 与表单集成示例

```pages/admin/products/ProductForm.vue#L100-120
<script setup lang="ts">
import { ref } from "vue";
import FilePickerModal from "../../../components/FilePickerModal.vue";
import AppButton from "../../../components/AppButton.vue";

const showFilePicker = ref(false);
const selectedImageUrl = ref("");

function handleFileSelect(url: string) {
  selectedImageUrl.value = url;
  showFilePicker.value = false;
}
</script>

<template>
  <div class="form-control">
    <label class="label">
      <span class="label-text">商品图片</span>
    </label>
    
    <div class="flex gap-2">
      <input
        v-model="selectedImageUrl"
        type="text"
        placeholder="请选择图片"
        class="input input-bordered flex-1"
        readonly
      />
      <AppButton
        variant="outline"
        @click="showFilePicker = true"
      >
        选择图片
      </AppButton>
    </div>
    
    <!-- 预览 -->
    <div v-if="selectedImageUrl" class="mt-2">
      <img
        :src="selectedImageUrl"
        alt="预览"
        class="max-w-xs max-h-32 object-contain border rounded"
      />
    </div>
  </div>
  
  <!-- 文件选择弹窗 -->
  <FilePickerModal
    :show="showFilePicker"
    type-filter="image/"
    @close="showFilePicker = false"
    @select="handleFileSelect"
  />
</template>
```

### 富文本编辑器中插入图片

```pages/admin/products/RichTextEditor.vue#L230-250
<script setup lang="ts">
import { ref } from "vue";
import FilePickerModal from "../../../components/FilePickerModal.vue";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import Image from "@tiptap/extension-image";

const showFilePicker = ref(false);
const editor = useEditor({
  extensions: [Image],
  // ... 其他配置
});

function handleImageSelect(url: string) {
  if (editor.value) {
    editor.value.chain().focus().setImage({ src: url }).run();
  }
  showFilePicker.value = false;
}
</script>

<template>
  <div>
    <!-- 编辑器工具栏 -->
    <div class="toolbar">
      <button
        @click="showFilePicker = true"
        class="btn btn-sm btn-ghost"
        title="插入图片"
      >
        🖼️
      </button>
    </div>
    
    <!-- 编辑器内容 -->
    <EditorContent :editor="editor" />
    
    <!-- 文件选择弹窗 -->
    <FilePickerModal
      v-if="showFilePicker"
      :show="showFilePicker"
      type-filter="image/"
      @close="showFilePicker = false"
      @select="handleImageSelect"
    />
  </div>
</template>
```

### 动态类型筛选

```pages/admin/settings/+Page.vue#L70-90
<script setup lang="ts">
import { ref } from "vue";
import FilePickerModal from "../../../components/FilePickerModal.vue";

const showFilePicker = ref(false);
const filePickerTypeFilter = ref(""); // 动态类型筛选

// 根据不同场景设置不同的类型筛选
function openImagePicker() {
  filePickerTypeFilter.value = "image/";
  showFilePicker.value = true;
}

function openVideoPicker() {
  filePickerTypeFilter.value = "video/";
  showFilePicker.value = true;
}

function openPdfPicker() {
  filePickerTypeFilter.value = "application/pdf";
  showFilePicker.value = true;
}

function handleFileSelect(url: string) {
  console.log("选中的文件：", url);
  showFilePicker.value = false;
}
</script>

<template>
  <div class="flex gap-2">
    <button @click="openImagePicker" class="btn btn-outline">
      选择图片
    </button>
    <button @click="openVideoPicker" class="btn btn-outline">
      选择视频
    </button>
    <button @click="openPdfPicker" class="btn btn-outline">
      选择 PDF
    </button>
  </div>
  
  <!-- 文件选择弹窗 -->
  <FilePickerModal
    :show="showFilePicker"
    :type-filter="filePickerTypeFilter"
    @close="showFilePicker = false"
    @select="handleFileSelect"
  />
</template>
```

### MediaItem 类型

组件内部使用 `MediaItem` 类型表示文件信息，定义在 `modules/media/types.ts`：

```modules/media/types.ts#L28-38
export interface MediaItem {
  id: number;
  originalName: string;    // 原始文件名
  storedName: string;      // 存储文件名
  mimeType: string;        // MIME 类型，如 'image/jpeg'
  fileSize: number;        // 文件大小（字节）
  fileKey: string;         // 存储键
  url: string;             // 文件访问 URL
  thumbnailUrl: string | null; // 缩略图 URL（图片/视频）
  path: string | null;     // 存储路径
  metadata: string | null; // 元数据 JSON 字符串
  uploadedBy: number;      // 上传者用户 ID
  uploadedAt: string;      // 上传时间 ISO 字符串
}
```

### 使用建议

1. **配合 v-if 使用**：建议使用 `v-if` 控制组件实例化，这样每次打开都会重新加载文件列表：
   ```vue
   <FilePickerModal v-if="showFilePicker" :show="showFilePicker" ... />
   ```

2. **仅使用 :show**：如果不用 `v-if`，组件会在 `show` 变为 `true` 时自动加载文件：
   ```vue
   <FilePickerModal :show="showFilePicker" ... />
   ```

3. **预设类型筛选**：使用 `type-filter` prop 可以预设文件类型，适合只需要特定类型文件的场景。

4. **动态类型筛选**：可以绑定动态的 `type-filter` 值，根据应用状态切换筛选类型。

### 样式说明

- 模态框宽度为 `11/12`，最大宽度 `5xl`（48rem）
- 最大高度为 `80vh`，内容区域可滚动
- 文件网格响应式布局：手机 2 列，平板 3 列，桌面 4 列，大屏 6 列
- 文件卡片悬停显示文件名、大小和选择按钮
- 支持文件类型图标：图片、视频、PDF、通用文件