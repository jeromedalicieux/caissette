import { shops } from '$lib/api/client'
import type { ShopSettings, ShopDisplay } from '@caissette/types'
import { DEFAULT_SHOP_SETTINGS, DEFAULT_SHOP_DISPLAY } from '@caissette/types'

function createShopStore() {
  let settings = $state<ShopSettings>({
    ...DEFAULT_SHOP_SETTINGS,
    features: { ...DEFAULT_SHOP_SETTINGS.features },
    display: { ...DEFAULT_SHOP_DISPLAY },
  })
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
    get display(): ShopDisplay {
      return settings.display ?? DEFAULT_SHOP_DISPLAY
    },

    async init() {
      try {
        const shop = await shops.getCurrent()
        if (shop.settings) {
          settings = {
            ...DEFAULT_SHOP_SETTINGS,
            ...shop.settings,
            features: { ...DEFAULT_SHOP_SETTINGS.features, ...(shop.settings.features ?? {}) },
            display: { ...DEFAULT_SHOP_DISPLAY, ...(shop.settings.display ?? {}) },
          }
          // Cache for offline use
          localStorage.setItem('caissette_shop_settings', JSON.stringify(settings))
        }
      } catch {
        // Offline — try cached settings
        try {
          const cached = localStorage.getItem('caissette_shop_settings')
          if (cached) {
            const parsed = JSON.parse(cached)
            settings = {
              ...DEFAULT_SHOP_SETTINGS,
              ...parsed,
              features: { ...DEFAULT_SHOP_SETTINGS.features, ...(parsed.features ?? {}) },
              display: { ...DEFAULT_SHOP_DISPLAY, ...(parsed.display ?? {}) },
            }
          }
        } catch {
          /* keep defaults */
        }
      }
      loading = false
    },

    async updateSettings(partial: Partial<ShopSettings>) {
      try {
        await shops.updateCurrent({ settings: partial })
        settings = {
          ...settings,
          ...partial,
          features: { ...settings.features, ...(partial.features ?? {}) },
          display: { ...settings.display, ...(partial.display ?? {}) },
        }
      } catch (e) {
        throw e
      }
    },
  }
}

export const shopStore = createShopStore()
