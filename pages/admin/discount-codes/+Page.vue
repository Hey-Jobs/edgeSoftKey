<template>
  <ConfirmDialog ref="confirmRef" />
  
  <section class="card bg-base-100 shadow-sm">
    <div class="card-body space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">折扣码管理</h1>
        <AppButton size="sm" variant="primary" @click="showCreateModal = true">新建折扣码</AppButton>
      </div>

      <DataTable
        :columns="columns"
        :rows="discountCodePage.items"
        :total="discountCodePage.total"
        :page="currentPage"
        :page-size="PAGE_SIZE"
        @update:page="fetchPage"
      >
        <template #type="{ value }">{{ value === 'FIXED' ? '固定金额' : '百分比' }}</template>
        <template #value="{ row }">{{ row.type === 'FIXED' ? formatCents(row.value) : `${row.value}%` }}</template>
        <template #minAmount="{ value }">{{ value ? formatCents(value) : '无限制' }}</template>
        <template #maxUses="{ value }">{{ value || '无限制' }}</template>
        <template #usedCount="{ value }">{{ value }}</template>
        <template #productIds="{ row }">{{ getProductNames(row.productIds) }}</template>
        <template #expiresAt="{ value }">{{ value ? new Date(value).toLocaleString() : '永不过期' }}</template>
        <template #isActive="{ row }">
          <StatusTag :type="row.isActive ? 'success' : 'danger'">{{ row.isActive ? '启用' : '禁用' }}</StatusTag>
        </template>
        <template #actions="{ row }">
          <div class="flex gap-2">
            <AppButton size="xs" variant="outline" @click="handleEdit(row)">编辑</AppButton>
            <AppButton size="xs" variant="danger" @click="handleDelete(row)">删除</AppButton>
          </div>
        </template>
      </DataTable>
    </div>
  </section>

  <!-- 创建/编辑折扣码弹窗 -->
  <dialog :class="{ 'modal modal-open': showCreateModal || showEditModal }">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{{ showEditModal ? '编辑折扣码' : '新建折扣码' }}</h3>
      <form @submit.prevent="handleSubmit" class="space-y-4 mt-4">
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">折扣码</span>
          <input v-model="form.code" type="text" class="input input-bordered w-full" placeholder="输入折扣码（大写字母和数字）" required />
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">折扣类型</span>
          <select v-model="form.type" class="select select-bordered w-full" required>
            <option value="FIXED">固定金额（分）</option>
            <option value="PERCENT">百分比</option>
          </select>
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ form.type === 'FIXED' ? '折扣金额（分）' : '折扣百分比（1-100）' }}</span>
          <input v-model.number="form.value" type="number" class="input input-bordered w-full" :min="1" :max="form.type === 'PERCENT' ? 100 : undefined" required />
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">最低消费金额（分，可选）</span>
          <input v-model.number="form.minAmount" type="number" class="input input-bordered w-full" min="0" placeholder="0 表示无限制" />
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">最大使用次数（可选）</span>
          <input v-model.number="form.maxUses" type="number" class="input input-bordered w-full" min="0" placeholder="0 表示无限制" />
        </label>

        <div class="flex flex-col gap-1.5">
          <span class="label-text font-medium">限制商品（可选，不选表示所有商品可用）</span>
          <RemoteSelect
            v-model="selectedProductIds"
            :items="products"
            label-key="name"
            value-key="id"
            placeholder="搜索或选择商品..."
            :multiple="true"
            :searchable="true"
            empty-text="未找到商品"
          />
          <div v-if="selectedProductIds.length > 0" class="flex flex-wrap gap-1">
            <span 
              v-for="id in selectedProductIds" 
              :key="id"
              class="badge badge-primary badge-outline gap-1"
            >
              {{ products.find(p => p.id === id)?.name }}
              <button 
                class="btn btn-xs btn-ghost btn-circle -mr-1"
                @click="selectedProductIds = selectedProductIds.filter(i => i !== id)"
              >×</button>
            </span>
          </div>
          <p v-else class="text-xs text-base-content/60">不选择表示所有商品可用</p>
        </div>

        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">过期时间（可选）</span>
          <input v-model="form.expiresAt" type="datetime-local" class="input input-bordered w-full" />
        </label>

        <div v-if="showEditModal" class="form-control">
          <label class="label cursor-pointer">
            <span class="label-text">启用</span>
            <input v-model="form.isActive" type="checkbox" class="toggle toggle-primary" />
          </label>
        </div>

        <div class="modal-action">
          <AppButton type="button" variant="ghost" @click="closeModal">取消</AppButton>
          <AppButton type="submit" variant="primary" :loading="submitting">{{ showEditModal ? '保存' : '创建' }}</AppButton>
        </div>
      </form>
      <p v-if="formError" class="text-sm text-error mt-2">{{ formError }}</p>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="closeModal">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { reactive, ref, useTemplateRef } from "vue";
import AppButton from "../../../components/AppButton.vue";
import DataTable from "../../../components/DataTable.vue";
import ConfirmDialog from "../../../components/ConfirmDialog.vue";
import StatusTag from "../../../components/StatusTag.vue";
import RemoteSelect from "../../../components/RemoteSelect.vue";
import { useData } from "vike-vue/useData";
import { formatCents } from "../../../lib/utils/money";
import { onQueryDiscountCodes, onCreateDiscountCode, onUpdateDiscountCode, onDeleteDiscountCode } from "./discountCodes.telefunc";
import type { Data } from "./+data";

const { discountCodes: initialDiscountCodes, products } = useData<Data>();

const PAGE_SIZE = 20;
const currentPage = ref(1);
const discountCodePage = ref(initialDiscountCodes);

const showCreateModal = ref(false);
const showEditModal = ref(false);
const submitting = ref(false);
const formError = ref("");
const editingId = ref<number | null>(null);
const selectedProductIds = ref<number[]>([]);
const confirmRef = useTemplateRef<InstanceType<typeof ConfirmDialog>>("confirmRef");

const form = reactive({
  code: "",
  type: "FIXED" as "FIXED" | "PERCENT",
  value: 0,
  minAmount: 0,
  maxUses: 0,
  expiresAt: "",
  isActive: true,
});

const columns = [
  { key: "code", label: "折扣码" },
  { key: "type", label: "类型" },
  { key: "value", label: "折扣值" },
  { key: "minAmount", label: "最低消费" },
  { key: "maxUses", label: "最大次数" },
  { key: "usedCount", label: "已使用" },
  { key: "productIds", label: "限制商品" },
  { key: "expiresAt", label: "过期时间" },
  { key: "isActive", label: "状态" },
  { key: "actions", label: "操作" },
];

async function fetchPage(page: number) {
  const result = await onQueryDiscountCodes({
    page,
    pageSize: PAGE_SIZE,
  });
  discountCodePage.value = result;
  currentPage.value = page;
}

function getProductNames(productIds: string | null) {
  if (!productIds) return "所有商品";
  const ids = productIds.split(",").map(Number);
  const names = ids.map(id => products.find(p => p.id === id)?.name).filter(Boolean);
  return names.length > 0 ? names.join(", ") : productIds;
}

function handleEdit(row: any) {
  editingId.value = row.id;
  form.code = row.code;
  form.type = row.type;
  form.value = row.value;
  form.minAmount = row.minAmount || 0;
  form.maxUses = row.maxUses || 0;
  form.expiresAt = row.expiresAt ? new Date(row.expiresAt).toISOString().slice(0, 16) : "";
  form.isActive = row.isActive;
  selectedProductIds.value = row.productIds ? row.productIds.split(",").map(Number) : [];
  showEditModal.value = true;
}

async function handleDelete(row: any) {
  const ok = await confirmRef.value?.confirm({
    title: "删除折扣码",
    message: `确定要删除折扣码 ${row.code} 吗？此操作不可撤销。`,
    confirmText: "删除",
    danger: true,
  });
  if (!ok) return;

  try {
    await onDeleteDiscountCode(row.id);
    await fetchPage(currentPage.value);
  } catch (error: any) {
    await confirmRef.value?.alert({ title: "删除失败", message: error.message || "删除失败" });
  }
}

async function handleSubmit() {
  submitting.value = true;
  formError.value = "";

  const productIdsStr = selectedProductIds.value.length > 0 ? selectedProductIds.value.join(",") : undefined;

  try {
    if (showEditModal.value && editingId.value) {
      await onUpdateDiscountCode(editingId.value, {
        code: form.code,
        type: form.type,
        value: form.value,
        minAmount: form.minAmount || null,
        maxUses: form.maxUses || null,
        productIds: productIdsStr || null,
        expiresAt: form.expiresAt || null,
        isActive: form.isActive,
      });
    } else {
      await onCreateDiscountCode({
        code: form.code,
        type: form.type,
        value: form.value,
        minAmount: form.minAmount || undefined,
        maxUses: form.maxUses || undefined,
        productIds: productIdsStr,
        expiresAt: form.expiresAt || undefined,
      });
    }

    await fetchPage(currentPage.value);
    closeModal();
  } catch (error: any) {
    formError.value = error.message || "操作失败";
  } finally {
    submitting.value = false;
  }
}

function closeModal() {
  showCreateModal.value = false;
  showEditModal.value = false;
  editingId.value = null;
  form.code = "";
  form.type = "FIXED";
  form.value = 0;
  form.minAmount = 0;
  form.maxUses = 0;
  form.expiresAt = "";
  form.isActive = true;
  selectedProductIds.value = [];
  formError.value = "";
}
</script>
