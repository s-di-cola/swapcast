import { appKit } from '$lib/configs/wallet.config';
import { PUBLIC_ADMIN_ADDRESS } from '$env/static/public';

/**
 * Utility function to check if the current connected wallet is the admin
 * This can be called on-the-fly without needing a store
 */
export function isAdmin(): boolean {
  const address = appKit.getAccount()?.address;
  return address && PUBLIC_ADMIN_ADDRESS
    ? address.toLowerCase() === PUBLIC_ADMIN_ADDRESS.toLowerCase()
    : false;
}
