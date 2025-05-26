<script lang="ts">
    // Component for the admin page header with create market button
    export let onCreateMarketClick: () => void;
</script>

<header class="mb-10 flex items-center justify-between border-b border-gray-200 pb-6">
    <div>
        <h1 class="text-4xl font-bold text-gray-800">SwapCast Admin</h1>
        <p class="text-md mt-2 text-gray-600">
            Overview of platform activity and market management tools.
        </p>
    </div>
    <div>
        <button
            type="button"
            on:click={onCreateMarketClick}
            class="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
            <svg
                class="-ml-1 mr-2 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
            >
                <path
                    fill-rule="evenodd"
                    d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                    clip-rule="evenodd"
                ></path>
            </svg>
            Create New Market
        </button>
    </div>
</header>
