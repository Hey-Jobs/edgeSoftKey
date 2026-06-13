<script setup lang="ts">
import { onMounted, ref } from "vue";
import { onQueryCards } from "./queryCards.telefunc";

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

function goTo(p: number) {
  page.value = p;
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

onMounted(() => {
  queryCards();
});
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">卡密管理</h1>
      <div class="text-sm text-base-content/60">共 {{ total }} 条记录</div>
    </div>

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
                  <span class="badge :class="getStatusBadge(card.status)" size="xs">
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
            class="btn :class="p === page ? 'btn-primary' : 'btn-ghost' btn-xs"
            @click="goTo(p)"
          >
            {{ p }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
