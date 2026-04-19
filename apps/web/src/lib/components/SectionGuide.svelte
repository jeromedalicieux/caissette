<script lang="ts">
  import { onMount } from 'svelte'

  let { title, description, tips = [] }: {
    title: string
    description: string
    tips?: string[]
  } = $props()

  let open = $state(false)
  let triggerEl = $state<HTMLButtonElement | null>(null)
  let cardEl = $state<HTMLDivElement | null>(null)
  let parentSection = $state<HTMLElement | null>(null)
  let pulse = $state(false)
  let cardStyle = $state('')

  onMount(() => {
    // Find the closest meaningful parent section to elevate
    if (triggerEl) {
      parentSection = triggerEl.closest('section, [data-section], .mb-6, .mb-8') as HTMLElement | null
      if (!parentSection) {
        parentSection = triggerEl.parentElement?.parentElement ?? null
      }
    }

    // Pulse on first visit (per page, per title)
    const key = `guide-seen:${title}`
    if (!sessionStorage.getItem(key)) {
      pulse = true
      sessionStorage.setItem(key, '1')
      const timer = setTimeout(() => { pulse = false }, 4000)
      return () => clearTimeout(timer)
    }
  })

  function toggle() {
    open = !open
    if (open) {
      // Elevate parent section
      if (parentSection) {
        parentSection.style.position = 'relative'
        parentSection.style.zIndex = '50'
        parentSection.classList.add(
          'ring-2', 'ring-blue-400/60', 'shadow-lg', 'shadow-blue-500/10',
          'rounded-xl', 'transition-all', 'duration-300'
        )
      }
      // Position card below button
      requestAnimationFrame(() => positionCard())
    } else {
      dismiss()
    }
  }

  function dismiss() {
    open = false
    if (parentSection) {
      parentSection.style.position = ''
      parentSection.style.zIndex = ''
      parentSection.classList.remove(
        'ring-2', 'ring-blue-400/60', 'shadow-lg', 'shadow-blue-500/10',
        'rounded-xl', 'transition-all', 'duration-300'
      )
    }
  }

  function positionCard() {
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - 360))
    cardStyle = `top: ${rect.bottom + 12}px; left: ${left}px;`
  }
</script>

<!-- Trigger button -->
<button
  bind:this={triggerEl}
  onclick={toggle}
  class="relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 py-1
    border transition-all duration-200
    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
    {open
      ? 'border-blue-400 bg-blue-600 text-white shadow-md'
      : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 hover:shadow-sm'}"
  class:animate-guide-pulse={pulse}
  aria-label="Aide : {title}"
>
  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
    <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd" />
  </svg>
  <span class="text-xs font-semibold leading-none">Aide</span>
</button>

<!-- Spotlight overlay + floating card -->
{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-40 bg-black/40 animate-guide-fade-in"
    onclick={dismiss}
    onkeydown={(e) => { if (e.key === 'Escape') dismiss() }}
  ></div>

  <!-- Floating card -->
  <div
    bind:this={cardEl}
    class="fixed z-50 w-80 animate-guide-slide-in"
    style={cardStyle}
    role="dialog"
    aria-label={title}
  >
    <!-- Arrow pointer -->
    <div class="ml-4 -mb-px h-3 w-3 rotate-45 rounded-sm border-l border-t border-blue-200 bg-white"></div>

    <!-- Card content -->
    <div class="rounded-xl border border-blue-200 bg-white shadow-xl shadow-blue-500/10 p-4">
      <!-- Header -->
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <svg class="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <button
          onclick={dismiss}
          class="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label="Fermer l'aide"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Description -->
      <p class="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>

      <!-- Tips -->
      {#if tips.length > 0}
        <ul class="mt-3 space-y-2">
          {#each tips as tip}
            <li class="flex items-start gap-2 text-sm text-gray-600">
              <svg class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
              </svg>
              <span>{tip}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes guide-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
    50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
  }

  @keyframes guide-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes guide-slide-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .animate-guide-pulse {
    animation: guide-pulse 2s ease-in-out 3;
  }

  :global(.animate-guide-fade-in) {
    animation: guide-fade-in 200ms ease-out both;
  }

  :global(.animate-guide-slide-in) {
    animation: guide-slide-in 250ms ease-out both;
  }
</style>
