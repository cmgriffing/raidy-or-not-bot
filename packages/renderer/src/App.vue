<script setup lang="ts">
import { onMounted, ref } from "vue";
import electron from "electron";
import ConnectedImage from "../../images/connected.png";
import DisconnectedImage from "../../images/disconnected.png";

const ipc = electron.ipcRenderer;

const channelName = ref("");
const apiKey = ref("");
const areValuesEdited = ref(false);
const connected = ref(false);

ipc.on("config", (event, args) => {
  apiKey.value = args[0].apiKey;
  channelName.value = args[0].channelName;
  areValuesEdited.value = false;
});

ipc.on("connectionStatus", (event, args) => {
  console.log("hmmmm", args[0]?.connected);
  connected.value = !!args[0]?.connected;
});

function handleConfigChange(event: any) {
  areValuesEdited.value = false;
  ipc.send("configChanged", [
    { channelName: channelName.value, apiKey: apiKey.value },
  ]);
}

onMounted(() => {
  ipc.send("configRequested");
});
</script>

<template>
  <div class="p-2 flex flex-col">
    <div class="flex flex-row items-center justify-center mb-8">
      <h3
        v-if="connected"
        class="text-xl font-bold text-[color:var(--primary-color-text)] flex flex-row items-center"
      >
        <img class="h-6 w-6 mr-1" :src="ConnectedImage" alt="Green circle" />
        <span>Connected</span>
      </h3>
      <h3
        v-if="!connected"
        class="text-xl font-bold text-[color:var(--primary-color-text)] flex flex-row items-center"
      >
        <img class="h-6 w-6 mr-1" :src="DisconnectedImage" alt="Red circle" />
        <span>Not Connected</span>
      </h3>
    </div>

    <span class="block p-float-label mb-8 w-full">
      <InputText
        id="channel-name"
        type="text"
        v-model="channelName"
        class="w-full"
        @input="() => (areValuesEdited = true)"
      />
      <label for="channel-name">Channel Name</label>
    </span>

    <span class="block p-float-label mb-8 w-full">
      <Password
        id="api-key"
        v-model="apiKey"
        class="w-full"
        input-class="w-full"
        :feedback="false"
        :toggleMask="true"
        @input="() => (areValuesEdited = true)"
      />
      <label for="api-key">API Key</label>
    </span>

    <Button
      class="text-center justify-center"
      @click="handleConfigChange"
      :disabled="!areValuesEdited"
    >
      Save
    </Button>
  </div>
</template>

<style></style>
