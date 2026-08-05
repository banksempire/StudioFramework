import { createApp } from 'vue';
import Framework from './Framework.vue';
import WelcomeContent from './components/WelcomeContent.vue';
import { registerTabContent } from './registry';

// The demo layout's welcome tab is rendered through the content registry.
registerTabContent('welcome', WelcomeContent);

createApp(Framework).mount('#framework');
