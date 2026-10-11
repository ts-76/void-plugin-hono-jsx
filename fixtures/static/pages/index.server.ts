import { defineHandler } from 'void';
export const loader = defineHandler(() => ({ label: 'Static index', initialCount: 5, message: '</script><script>window.staticInjected=true</script>&\u2028\u2029' }));
