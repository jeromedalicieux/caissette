<script lang="ts">
  let { text, position = 'top' }: { text: string; position?: 'top' | 'bottom' | 'left' | 'right' } = $props()
  let show = $state(false)

  const posClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }
</script>

<span class="relative inline-flex">
  <button
    onmouseenter={() => show = true}
    onmouseleave={() => show = false}
    onfocus={() => show = true}
    onblur={() => show = false}
    class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-400 hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-help"
    aria-label="Aide"
  >
    ?
  </button>

  {#if show}
    <div class="absolute z-50 {posClasses[position]} w-56 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg pointer-events-none">
      {text}
      <div class="absolute {position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900' : position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900' : ''}"></div>
    </div>
  {/if}
</span>
