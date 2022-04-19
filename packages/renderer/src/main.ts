import { createApp } from "vue";
import App from "./App.vue";
import "./samples/node-api";
import PrimeVue from "primevue/config";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Password from "primevue/password";

import "./index.css";
import "primevue/resources/themes/vela-purple/theme.css";
import "primevue/resources/primevue.min.css";
import "primeicons/primeicons.css ";

const app = createApp(App);

app.use(PrimeVue);
app.component("Button", Button);
app.component("InputText", InputText);
app.component("Password", Password);

app.mount("#app").$nextTick(window.removeLoading);
