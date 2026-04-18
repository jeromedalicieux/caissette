import { describe, expect, it, vi } from 'vitest'
import { createEventBus } from '../index.js'
import type { ShopId, UserId, DepositorId } from '@rebond/types'

describe('createEventBus', () => {
  it('emits events to registered handlers', async () => {
    const bus = createEventBus()
    const handler = vi.fn()

    bus.on('depositor.created', handler)
    await bus.emit('depositor.created', {
      depositorId: 'dep-1' as DepositorId,
      shopId: 'shop-1' as ShopId,
      createdBy: 'user-1' as UserId,
    })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({
      depositorId: 'dep-1',
      shopId: 'shop-1',
      createdBy: 'user-1',
    })
  })

  it('supports multiple handlers', async () => {
    const bus = createEventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()

    bus.on('depositor.created', h1)
    bus.on('depositor.created', h2)
    await bus.emit('depositor.created', {
      depositorId: 'dep-1' as DepositorId,
      shopId: 'shop-1' as ShopId,
      createdBy: 'user-1' as UserId,
    })

    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('does not call unregistered handlers', async () => {
    const bus = createEventBus()
    const handler = vi.fn()

    bus.on('depositor.created', handler)
    bus.off('depositor.created', handler)
    await bus.emit('depositor.created', {
      depositorId: 'dep-1' as DepositorId,
      shopId: 'shop-1' as ShopId,
      createdBy: 'user-1' as UserId,
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('does not throw when emitting with no handlers', async () => {
    const bus = createEventBus()
    await expect(
      bus.emit('depositor.created', {
        depositorId: 'dep-1' as DepositorId,
        shopId: 'shop-1' as ShopId,
        createdBy: 'user-1' as UserId,
      }),
    ).resolves.toBeUndefined()
  })

  it('handles async handlers sequentially', async () => {
    const bus = createEventBus()
    const order: number[] = []

    bus.on('depositor.created', async () => {
      await new Promise((r) => setTimeout(r, 10))
      order.push(1)
    })
    bus.on('depositor.created', async () => {
      order.push(2)
    })

    await bus.emit('depositor.created', {
      depositorId: 'dep-1' as DepositorId,
      shopId: 'shop-1' as ShopId,
      createdBy: 'user-1' as UserId,
    })

    expect(order).toEqual([1, 2])
  })
})
