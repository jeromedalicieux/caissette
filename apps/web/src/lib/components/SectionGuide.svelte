<script lang="ts">
  let { title, description, tips = [] }: {
    title: string
    description: string
    tips?: string[]
  } = $props()

  let expanded = $state(false)
</script>

<button
  onclick={() => expanded = !expanded}
  class="inline-flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200
    {expanded
      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
      : 'bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600'}"
  aria-label="Aide : {title}"
  title="En savoir plus"
>
  <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
    <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd" />
  </svg>
</button>

{#if expanded}
  <div class="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm animate-in">
    <div class="flex items-start gap-3">
      <div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-100">
        <svg class="h-3.5 w-3.5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd" />
        </svg>
      </div>
      <div class="flex-1">
        <p class="font-medium text-gray-900">{title}</p>
        <p class="mt-1 text-gray-600 leading-relaxed">{description}</p>
        {#if tips.length > 0}
          <ul class="mt-2 space-y-1">
            {#each tips as tip}
              <li class="flex items-start gap-2 text-xs text-gray-500">
                <span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-400"></span>
                {tip}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <button onclick={() => expanded = false}
        class="shrink-0 text-gray-400 hover:text-gray-600">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
{/if}
