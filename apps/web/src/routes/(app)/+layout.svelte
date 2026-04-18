<script>
  let { children } = $props()
</script>

<div class="flex min-h-screen">
  <nav class="w-56 border-r bg-gray-900 p-4 text-white">
    <div class="mb-8 text-xl font-bold">Rebond</div>
    <ul class="space-y-2">
      <li><a href="/caisse" class="block rounded px-3 py-2 hover:bg-gray-800">Caisse</a></li>
      <li><a href="/depots" class="block rounded px-3 py-2 hover:bg-gray-800">Dépôts</a></li>
      <li><a href="/articles" class="block rounded px-3 py-2 hover:bg-gray-800">Articles</a></li>
      <li><a href="/ventes" class="block rounded px-3 py-2 hover:bg-gray-800">Ventes</a></li>
      <li><a href="/livre-police" class="block rounded px-3 py-2 hover:bg-gray-800">Livre de police</a></li>
      <li><a href="/parametres" class="block rounded px-3 py-2 hover:bg-gray-800">Paramètres</a></li>
    </ul>
  </nav>
  <main class="flex-1 bg-gray-50 p-6">
    {@render children()}
  </main>
</div>
