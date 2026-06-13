<template>
  <div class="dropdown w-full" :class="{ 'dropdown-open': isOpen }">
    <div class="relative">
      <input
        v-model="searchQuery"
        type="text"
        class="input input-bordered w-full pr-10"
        :placeholder="placeholder"
        :disabled="disabled"
        @focus="handleFocus"
        @input="handleSearch"
        @keydown.escape="closeDropdown"
        @keydown.enter.prevent="handleEnter"
      />
      <button
        v-if="searchQuery && clearable"
        class="absolute right-8 top-1/2 -translate-y-1/2 btn btn-xs btn-ghost btn-circle"
        @click.stop="handleClear"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <span class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg v-if="loading" class="animate-spin h-5 w-5 text-base-content/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
    
    <ul
      v-show="isOpen && filteredItems.length > 0"
      class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full max-h-60 overflow-y-auto border border-base-300 mt-1"
    >
      <li v-if="loading && !filteredItems.length" class="disabled">
        <a class="text-base-content/50">加载中...</a>
      </li>
      <template v-else>
        <li
          v-for="item in filteredItems"
          :key="item[valueKey]"
          :class="{ 'bg-primary/10': isSelected(item) }"
        >
          <a @mousedown.prevent="handleSelect(item)" class="flex items-center gap-2">
            <input
              v-if="multiple"
              type="checkbox"
              :checked="isSelected(item)"
              class="checkbox checkbox-sm checkbox-primary pointer-events-none"
            />
            <span class="flex-1 truncate">{{ item[labelKey] }}</span>
            <svg v-if="!multiple && isSelected(item)" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </a>
        </li>
      </template>
    </ul>
    
    <ul
      v-show="isOpen && filteredItems.length === 0 && !loading"
      class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full border border-base-300 mt-1"
    >
      <li class="disabled">
        <a class="text-base-content/50">{{ emptyText }}</a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

export interface SelectItem {
  [key: string]: any;
}

const props = withDefaults(defineProps<{
  modelValue?: any | any[];
  items?: SelectItem[];
  labelKey?: string;
  valueKey?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  clearable?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  remoteSearch?: boolean;
  emptyText?: string;
}>(), {
  items: () => [],
  labelKey: "label",
  valueKey: "value",
  placeholder: "请选择...",
  disabled: false,
  loading: false,
  clearable: true,
  multiple: false,
  searchable: true,
  remoteSearch: false,
  emptyText: "暂无数据",
});

const emit = defineEmits<{
  "update:modelValue": [value: any | any[]];
  search: [query: string];
  focus: [];
  change: [value: any | any[]];
}>();

const isOpen = ref(false);
const searchQuery = ref("");

const filteredItems = computed(() => {
  if (!props.searchable || props.remoteSearch || !searchQuery.value) {
    return props.items;
  }
  const query = searchQuery.value.toLowerCase();
  return props.items.filter(item => 
    String(item[props.labelKey]).toLowerCase().includes(query)
  );
});

const selectedLabel = computed(() => {
  if (props.multiple) {
    if (!Array.isArray(props.modelValue) || props.modelValue.length === 0) return "";
    return props.modelValue
      .map(val => props.items.find(item => item[props.valueKey] === val)?.[props.labelKey])
      .filter(Boolean)
      .join(", ");
  }
  const selected = props.items.find(item => item[props.valueKey] === props.modelValue);
  return selected ? selected[props.labelKey] : "";
});

watch(selectedLabel, (val) => {
  if (!props.multiple) {
    searchQuery.value = val;
  }
});

watch(() => props.modelValue, (val) => {
  if (props.multiple && Array.isArray(val)) {
    // 多选模式下，更新显示
  }
}, { immediate: true });

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function handleFocus() {
  isOpen.value = true;
  emit("focus");
  if (props.multiple) {
    searchQuery.value = "";
  }
}

function handleSearch() {
  if (props.remoteSearch) {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      emit("search", searchQuery.value);
    }, 300);
  }
}

function handleSelect(item: SelectItem) {
  const value = item[props.valueKey];
  
  if (props.multiple) {
    const currentValue = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
    const index = currentValue.indexOf(value);
    if (index > -1) {
      currentValue.splice(index, 1);
    } else {
      currentValue.push(value);
    }
    emit("update:modelValue", currentValue);
    emit("change", currentValue);
  } else {
    emit("update:modelValue", value);
    emit("change", value);
    isOpen.value = false;
    searchQuery.value = String(item[props.labelKey]);
  }
}

function handleEnter() {
  if (filteredItems.value.length === 1) {
    handleSelect(filteredItems.value[0]);
  }
}

function handleClear() {
  searchQuery.value = "";
  if (props.multiple) {
    emit("update:modelValue", []);
    emit("change", []);
  } else {
    emit("update:modelValue", null);
    emit("change", null);
  }
  if (props.remoteSearch) {
    emit("search", "");
  }
}

function isSelected(item: SelectItem): boolean {
  const value = item[props.valueKey];
  if (props.multiple) {
    return Array.isArray(props.modelValue) && props.modelValue.includes(value);
  }
  return props.modelValue === value;
}

function closeDropdown() {
  isOpen.value = false;
  if (!props.multiple) {
    searchQuery.value = selectedLabel.value;
  }
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest(".dropdown")) {
    isOpen.value = false;
    if (!props.multiple) {
      searchQuery.value = selectedLabel.value;
    }
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  if (!props.multiple) {
    searchQuery.value = selectedLabel.value;
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  if (searchTimeout) clearTimeout(searchTimeout);
});
</script>
