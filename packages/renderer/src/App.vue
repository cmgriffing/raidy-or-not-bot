<script setup lang="ts">
import { onMounted, ref } from "vue";
import electron from "electron";
import ConnectedImage from "../../images/connected.png";
import DisconnectedImage from "../../images/disconnected.png";
import jwt_decode from "jwt-decode";
import { BOT_VERSION } from "./version";

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
function handleKeyChange(event: Event) {
  try {
    const decoded: {
      sub: {
        channelName: string;
      };
    } = jwt_decode((event?.currentTarget as any)?.value || "");
    channelName.value = decoded.sub.channelName;
    areValuesEdited.value = true;
  } catch (e: unknown) {
    console.log(
      "Caught error trying to decode token: ",
      (event?.currentTarget as any)?.value || ""
    );
    channelName.value = "";
  }
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
    <!--
    <span class="block p-float-label mb-8 w-full">
      <InputText
        id="channel-name"
        type="text"
        v-model="channelName"
        class="w-full"
        @input="() => (areValuesEdited = true)"
      />
      <label for="channel-name">Channel Name</label>
    </span> -->

    <span class="block p-float-label w-full">
      <Password
        id="api-key"
        v-model="apiKey"
        class="w-full"
        input-class="w-full"
        :feedback="false"
        :toggleMask="true"
        @input="handleKeyChange"
      />
      <label for="api-key">API Key</label>
    </span>

    <div
      v-if="apiKey && channelName"
      class="channel-name-section text-white mb-8 p-float-label"
    >
      <label class="channel-name-label text-xs">Channel Name: </label>
      <div class="channel-name-value text-center mt-12">{{ channelName }}</div>
    </div>

    <div v-if="apiKey && !channelName" class="text-white text-center p-4">
      <h4>Enter a valid API Key</h4>
    </div>

    <div v-if="!apiKey" class="text-white text-center p-4">
      <h4>Enter an API Key</h4>
    </div>

    <Button
      class="text-center justify-center"
      @click="handleConfigChange"
      :disabled="!areValuesEdited"
    >
      Save
    </Button>

    <div class="text-center text-gray-400 mt-16 text-sm">
      v{{ BOT_VERSION }}
    </div>
  </div>
</template>

<style></style>
