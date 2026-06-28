<template>
  <div v-if="toasts.length > 0" class="toast toast-top toast-end z-50">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="getAlertClass(toast.type)"
      class="alert mb-2"
    >
      <span>{{ toast.message }}</span>
      <button
        v-if="toast.action"
        class="btn btn-sm btn-ghost font-semibold"
        data-testid="toast-action-button"
        @click="handleAction(toast)"
      >
        {{ toast.action.label }}
      </button>
      <button
        class="btn btn-sm btn-circle btn-ghost"
        @click="handleRemove(toast.id)"
      >
        <fa icon="xmark" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Toast, type ToastType, useToast } from '../composables/useToast';

const { toasts, removeToast } = useToast();

const getAlertClass = (type: ToastType) => {
  switch (type) {
    case 'error':
      return 'alert-error';
    case 'success':
      return 'alert-success';
    case 'warning':
      return 'alert-warning';
    case 'info':
      return 'alert-info';
    default:
      return 'alert-info';
  }
};

const handleRemove = (id: string) => {
  removeToast(id);
};

const handleAction = async (toast: Toast) => {
  if (toast.action) {
    await toast.action.handler();
  }
  removeToast(toast.id);
};
</script>

