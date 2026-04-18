<svelte:head>
  <title>Connexion — Rebond</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-gray-50">
  <div class="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
    <h1 class="mb-6 text-2xl font-bold text-gray-900">Connexion</h1>
    <form method="POST" class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
        <input type="email" id="email" name="email" required
          class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
      </div>
      <div>
        <label for="password" class="block text-sm font-medium text-gray-700">Mot de passe</label>
        <input type="password" id="password" name="password" required
          class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
      </div>
      <button type="submit"
        class="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        Se connecter
      </button>
    </form>
  </div>
</main>
