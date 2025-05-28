<script lang="ts">
	interface Props {
		onCreateMarketClick: () => void;
	}

	let { onCreateMarketClick }: Props = $props();

	const HEADER_CONFIG = {
		title: 'SwapCast Admin',
		description: 'Overview of platform activity and market management tools.',
		buttonText: 'Create New Market'
	} as const;
</script>

<header class="mb-10 flex items-center justify-between border-b border-gray-200 pb-6">
	<div>
		<h1 class="text-4xl font-bold text-gray-800">{HEADER_CONFIG.title}</h1>
		<p class="text-md mt-2 text-gray-600">{HEADER_CONFIG.description}</p>
	</div>

	<div>
		<button
			type="button"
			onclick={onCreateMarketClick}
			class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
		>
			<svg
				class="mr-2 -ml-0.5 h-4 w-4"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
					clip-rule="evenodd"
				/>
			</svg>
			{HEADER_CONFIG.buttonText}
		</button>
	</div>
</header>
