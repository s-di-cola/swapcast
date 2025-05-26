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
            class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
            <svg
                class="-ml-0.5 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
            >
                <path
                    fill-rule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clip-rule="evenodd"
                ></path>
            </svg>
            Create New Market
        </button>
    </div>
</header>
