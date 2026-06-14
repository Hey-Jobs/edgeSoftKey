<script setup lang="ts">
import { onMounted, ref } from "vue";
import { onQueryCards } from "./queryCards.telefunc";
import { onImportCards } from "./importCards.telefunc";
import { onCreateCard } from "./createCard.telefunc";
import { getProducts } from "../products/queryProducts.telefunc";

interface CardRecord {
  id: number;
  productId: number;
  productName: string;
  cardType: string;
  durationDays: number | null;
  status: string;
  batchNo: string | null;
  orderId: number | null;
  soldAt: string | null;
  createdAt: string;
  contentPreview: string;
  validity: { expireAt: string; boundAt: string } | null;
  binding: { id: number; hardwareHash: string; status: string; lastVerifiedAt: string | null; createdAt: string } | null;
}

interface PageResult {
  total: number;
  items: CardRecord[];
}

const cards = ref<CardRecord[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

// Filters
const productId = ref<number | undefined>();
const batchNo = ref("");
const status = ref("");
const startDate = ref("");
const endDate = ref("");

// Products for dropdown
const products = ref<{ id: number; name: string }[]>([]);

// Import modal
const showImportModal = ref(false);
const importProductId = ref<number | undefined>();
const importLines = ref("");
const importBatchNo = ref("");
const importLoading = ref(false);

// Generate modal
const showGenerateModal = ref(false);
const generateProductId = ref<number | undefined>();
const generateQuantity = ref(10);
const generateBatchNo = ref("");
const generateLoading = ref(false);

async function queryCards() {
  loading.value = true;
  try {
    const result: PageResult = await onQueryCards({
      productId: productId.value,
      batchNo: batchNo.value || undefined,
      status: status.value || undefined,
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    cards.value = result.items;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function loadProducts() {
  try {
    const result = await getProducts({ page: 1, pageSize: 1000 });
    products.value = result.items;
  } catch (e) {
    console.error("Failed to load products:", e);
  }
}

function goTo(p: number) {
  page.value = p;
}

function openImportModal(productId?: number) {
  showImportModal.value = true;
  importProductId.value = productId;
  importLines.value = "";
  importBatchNo.value = "";
}

async function handleImport() {
  if (!importProductId.value || !importLines.value.trim()) return;
  importLoading.value = true;
  try {
    await onImportCards({
      productId: importProductId.value,
      lines: importLines.value,
      batchNo: importBatchNo.value || undefined,
    });
    showImportModal.value = false;
    importLines.value = "";
    importBatchNo.value = "";
    await queryCards();
  } catch (e) {
    alert("导入失败: " + (e as Error).message);
  } finally {
    importLoading.value = false;
  }
}

function openGenerateModal(productId?: number) {
  showGenerateModal.value = true;
  generateProductId.value = productId;
  generateQuantity.value = 10;
  generateBatchNo.value = "";
}

async function handleGenerate() {
  if (!generateProductId.value) return;
  if (generateQuantity.value < 1 || generateQuantity.value > 10000) {
    alert("生成数量必须在 1-10000 之间");
    return;
  }
  generateLoading.value = true;
  try {
    const response = await fetch("/api/cards/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: generateProductId.value,
        quantity: generateQuantity.value,
        batchNo: generateBatchNo.value || undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "生成失败");
    showGenerateModal.value = false;
    generateBatchNo.value = "";
    await queryCards();
    alert(`成功生成 ${result.successCount} 张卡密`);
  } catch (e) {
    alert("生成失败: " + (e as Error).message);
  } finally {
    generateLoading.value = false;
  }
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function getStatusBadge(status: string): string {
  const map: Record<string, string> = {
    UNUSED: "badge-neutral",
    LOCKED: "badge-warning",
    SOLD: "badge-success",
    DISABLED: "badge-error",
  };
  return map[status] || "badge-ghost";
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    UNUSED: "未使用",
    LOCKED: "使用中",
    SOLD: "已售出",
    DISABLED: "已禁用",
  };
  return map[status] || status;
}

onMounted(async () => {
  await loadProducts();
  queryCards();
});
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">卡密管理</h1>
      <div class="flex gap-2">
        <button class="btn btn-primary btn-sm" @click="openImportModal()">导入卡密</button>
        <button class="btn btn-secondary btn-sm" @click="openGenerateModal()">生成卡密</button>
      </div>
      <div class="text-sm text-base-content/60">共 {{ total }} 条记录</div>
    </div>

    <!-- 导入卡密弹窗 -->
    <dialog v-if="showImportModal" class="modal" open>
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">导入卡密</h3>
        <div class="space-y-4">
          <div>
            <label class="label"><span class="label-text">选择商品</span></label>
            <select v-model="importProductId" class="select select-bordered w-full">
              <option :value="undefined">请选择商品</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label class="label"><span class="label-text">批次号（可选）</span></label>
            <input v-model="importBatchNo" type="text" class="input input-bordered w-full" placeholder="如：BATCH-20260101" />
          </div>
          <div>
            <label class="label"><span class="label-text">卡密内容（每行一个）</span></label>
            <textarea v-model="importLines" class="textarea textarea-bordered w-full h-48 font-mono text-xs" placeholder="CARD-001&#10;CARD-002&#10;CARD-003"></textarea>
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="showImportModal = false" :disabled="importLoading">取消</button>
            <button class="btn btn-primary" @click="handleImport" :disabled="importLoading || !importProductId || !importLines.trim()">
              {{ importLoading ? '导入中...' : '导入' }}
            </button>
          </div>
        </div>
      </div>
    </dialog>

    <!-- 生成卡密弹窗 -->
    <dialog v-if="showGenerateModal" class="modal" open>
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">生成卡密</h3>
        <div class="space-y-4">
          <div>
            <label class="label"><span class="label-text">选择商品</span></label>
            <select v-model="generateProductId" class="select select-bordered w-full">
              <option :value="undefined">请选择商品</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label class="label"><span class="label-text">批次号（可选）</span></label>
            <input v-model="generateBatchNo" type="text" class="input input-bordered w-full" placeholder="如：AUTO-20260101" />
          </div>
          <div>
            <label class="label"><span class="label-text">生成数量</span></label>
            <input v-model.number="generateQuantity" type="number" min="1" max="10000" class="input input-bordered w-full" />
            <p class="text-xs text-base-content/60 mt-1">范围：1-10000</p>
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="showGenerateModal = false" :disabled="generateLoading">取消</button>
            <button class="btn btn-secondary" @click="handleGenerate" :disabled="generateLoading || !generateProductId">
              {{ generateLoading ? '生成中...' : '生成' }}
            </button>
          </div>
        </div>
      </div>
    </dialog>

    <!-- 筛选条件 -->
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body py-3">
        <div class="grid gap-3 md:grid-cols-5">
          <input v-model="status" placeholder="状态筛选" class="input input-bordered input-sm" />
          <input v-model="batchNo" placeholder="批次号" class="input input-bordered input-sm" />
          <input v-model="startDate" type="date" class="input input-bordered input-sm" />
          <input v-model="endDate" type="date" class="input input-bordered input-sm" />
          <button class="btn btn-primary btn-sm" @click="queryCards">查询</button>
        </div>
      </div>
    </div>

    <!-- 卡密列表 -->
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>商品</th>
                <th>卡密</th>
                <th>状态</th>
                <th>批次</th>
                <th>有效期</th>
                <th>绑定状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="text-center py-8">加载中...</td>
              </tr>
              <tr v-else v-for="card in cards" :key="card.id">
                <td>{{ card.id }}</td>
                <td class="text-sm">{{ card.productName }}</td>
                <td class="font-mono text-xs">{{ card.contentPreview }}</td>
                <td>
                  <span :class="['badge', getStatusBadge(card.status)]" size="xs">
                    {{ getStatusText(card.status) }}
                  </span>
                </td>
                <td class="text-xs">{{ card.batchNo || "-" }}</td>
                <td class="text-xs">
                  <template v-if="card.validity">
                    {{ new Date(card.validity.expireAt).toLocaleDateString() }}
                  </template>
                  <template v-else>-</template>
                </td>
                <td class="text-xs">
                  <template v-if="card.binding">
                    <span :class="card.binding.status === 'ACTIVE' ? 'text-success' : 'text-error'">
                      {{ card.binding.status === 'ACTIVE' ? '已绑定' : '已过期' }}
                    </span>
                  </template>
                  <template v-else>-</template>
                </td>
                <td class="text-xs">{{ new Date(card.createdAt).toLocaleDateString() }}</td>
              </tr>
              <tr v-if="!loading && cards.length === 0">
                <td colspan="8" class="text-center py-8">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页 -->
        <div class="flex justify-center gap-2 py-4" v-if="total > pageSize">
          <button
            v-for="p in Math.ceil(total / pageSize)"
            :key="p"
            :class="p === page ? 'btn btn-primary btn-xs' : 'btn btn-ghost btn-xs'"
            @click="goTo(p)"
          >
            {{ p }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
