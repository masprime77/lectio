// Single shared storage instance for the app. Screens import `storage` from
// here so they all read/write the same on-device adapter.
import { createDeviceStorage } from './device-storage';

export const storage = createDeviceStorage();
export { ensureSeed } from './seed';
