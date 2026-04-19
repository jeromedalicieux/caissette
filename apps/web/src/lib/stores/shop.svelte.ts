import { shops } from '$lib/api/client'
import type { ShopSettings } from '@rebond/types'
import { DEFAULT_SHOP_SETTINGS } from '@rebond/types'

function createShopStore() {
  let settings = $state<ShopSettings>({ ...DEFAULT_SHOP_SETTINGS, features: { ...DEFAULT_SHOP_SETTINGS.features } })
  let loading = $state(true)

  return {
    get settings() {
      return settings
    },
    get loading() {
      return loading
    },
    get hasDepositSale() {
      return settings.features.depositSale
    },

    async init() {
      try {
        const shop = await shops.getCurrent()
        if (shop.settings) {
          settings = shop.settings
        }
      } catch {
        // keep defaults
      }
      loading = false
    },

    async updateSettings(partial: Partial<ShopSettings>) {
      try {
        await shops.updateCurrent({ settings: partial })
        // Merge locally
        settings = {
          ...settings,
          ...partial,
          features: { ...settings.features, ...(partial.features ?? {}) },
        }
      } catch (e) {
        throw e
      }
    },
  }
}

export const shopStore = createShopStore()
