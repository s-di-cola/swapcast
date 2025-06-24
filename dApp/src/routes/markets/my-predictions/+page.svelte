<script lang="ts">
	import { appKit } from '$lib/configs/wallet.config';
	import {
		claimReward,
		estimateUSDValue,
		fetchUserPredictions,
		fetchUserPredictionStats,
		formatAmount,
		formatDate,
		getMarketDisplayName,
		getMarketInitial,
		getOutcomeLabel,
		getStatusColor,
		getStatusText,
		isChunkLoadError,
		setupChunkErrorHandling
	} from '$lib/services/prediction';
	import UserPredictionChart from '$lib/components/app/my-predictions/UserPredictionChart.svelte';
	import type { PredictionStats, UserPrediction } from '$lib/services/prediction/types';
	import { toastStore } from '$lib/stores/toastStore';
	import { onMount } from 'svelte';

	import ClaimableRewardsBanner from '$lib/components/app/my-predictions/ClaimableRewardsBanner.svelte';

	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let positions = $state<UserPrediction[]>([]);
	let stats = $state<PredictionStats>({
		totalPredictions: 0,
		totalWon: 0,
		totalClaimed: '0',
		claimableAmount: '0'
	});

	let currentPage = $state(1);
	const itemsPerPage = 10;
	let isConnected = $state(false);
	let userAddress = $state('');
	let claimingTokenIds = $state(new Set<string>());

	const totalPages = $derived(Math.ceil(positions.length / itemsPerPage));
	const paginatedPositions = $derived(() => {
		const start = (currentPage - 1) * itemsPerPage;
		return positions.slice(start, start + itemsPerPage);
	});
	const totalMarkets = $derived(stats.totalPredictions);
	const winRate = $derived(
		stats.totalPredictions > 0 ? Math.round((stats.totalWon / stats.totalPredictions) * 100) : 0
	);
	const claimableAmount = $derived(parseFloat(stats.claimableAmount));

	let retryCount = 0;
	const maxRetries = 3;

	function updateConnectionStatus() {
		const account = appKit?.getAccount();
		isConnected = !!account?.address;
		userAddress = account?.address || '';
	}

	onMount(async () => {
		setupChunkErrorHandling(toastStore);

		updateConnectionStatus();

		if (appKit) {
			appKit.subscribeAccount((account) => {
				const wasConnected = isConnected;
				updateConnectionStatus();

				if (isConnected && (!wasConnected || userAddress !== account?.address)) {
					loadDataWithRetry();
				}
			});
		}

		if (isConnected) {
			await loadDataWithRetry();
		}
	});

	async function loadDataWithRetry() {
		try {
			await loadData();
		} catch (err) {
			if (isChunkLoadError(err) && retryCount < maxRetries) {
				retryCount++;
				console.log(`Chunk load failed, retrying... (${retryCount}/${maxRetries})`);
				await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));

				if ('webpackChunkName' in window) {
					delete (window as any).webpackChunkName;
				}
				await loadDataWithRetry();
			} else {
				throw err;
			}
		}
	}

	async function loadData() {
		if (!isConnected || !userAddress) {
			toastStore.error('Please connect your wallet first');
			isLoading = false;
			return;
		}

		try {
			isLoading = true;
			error = null;

			const timeout = new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Request timeout')), 30000)
			);

			const [predictions, predictionStats] = (await Promise.race([
				Promise.all([fetchUserPredictions(userAddress), fetchUserPredictionStats(userAddress)]),
				timeout
			])) as [UserPrediction[], PredictionStats];

			positions = predictions || [];
			stats = predictionStats || {
				totalPredictions: 0,
				totalWon: 0,
				totalClaimed: '0',
				claimableAmount: '0'
			};

			console.log('Loaded data:', { positions, stats });
		} catch (err) {
			console.error('Failed to load data:', err);

			if (isChunkLoadError(err)) {
				error = 'Failed to load required resources. Please refresh the page.';
				toastStore.error('Page resources failed to load. Please refresh and try again.');
			} else {
				error = err instanceof Error ? err.message : 'Failed to load data';
				toastStore.error(error);
			}
		} finally {
			isLoading = false;
		}
	}

	async function handleClaimReward(tokenId: string) {
		if (!tokenId || claimingTokenIds.has(tokenId)) {
			toastStore.error('Invalid token ID or already claiming');
			return;
		}

		try {
			claimingTokenIds.add(tokenId);
			toastStore.info('Processing claim transaction...');

			const result = await claimReward(tokenId);

			if (result.success) {
				toastStore.success(`Claim successful: ${result.hash?.slice(0, 10)}...`);
				positions = positions.map((p) => (p.tokenId === tokenId ? { ...p, claimed: true } : p));
				setTimeout(loadDataWithRetry, 2000);
			} else {
				toastStore.error(result.error || 'Failed to claim reward');
			}
		} catch (err) {
			console.error('Failed to claim reward:', err);
			const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
			toastStore.error(`Failed to claim reward: ${errorMessage}`);
		} finally {
			claimingTokenIds.delete(tokenId);
		}
	}

	async function claimAllRewards() {
		const claimablePositions = positions.filter((p) => p.isWinning && !p.claimed && p.tokenId);

		if (claimablePositions.length === 0) {
			toastStore.warning('No rewards to claim');
			return;
		}

		toastStore.info(`Claiming ${claimablePositions.length} rewards...`);

		for (const position of claimablePositions) {
			if (position.tokenId) {
				await handleClaimReward(position.tokenId);
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	}

	function isMarketResolved(prediction: UserPrediction): boolean {
		return prediction.marketIsResolved;
	}

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage++;
		}
	}

	function prevPage() {
		if (currentPage > 1) {
			currentPage--;
		}
	}

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}

	function handleChunkError() {
		window.location.reload();
	}
</script>
<div class="mx-auto min-h-screen max-w-7xl bg-gray-50 p-6 pt-16 md:p-10 md:pt-20">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900">My Prediction Portfolio</h1>
		<p class="mt-2 text-gray-600">Track your active positions and claim your rewards</p>
	</div>

	{#if !isConnected}
		<div class="mb-6 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-4">
			<div class="flex">
				<div class="ml-3">
					<p class="text-sm text-yellow-700">
						Please connect your wallet to view your prediction history and claim rewards.
					</p>
				</div>
			</div>
		</div>
	{:else if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
		</div>
	{:else if error}
		<div class="mb-6 rounded-lg border-l-4 border-red-400 bg-red-50 p-4">
			<div class="flex">
				<div class="ml-3">
					<p class="text-sm text-red-700">{error}</p>
					<div class="mt-2 flex gap-2">
						<button onclick={loadDataWithRetry} class="text-sm text-red-800 underline hover:text-red-900">
							Try again
						</button>
						{#if error.includes('resources') || error.includes('chunk')}
							<button onclick={handleChunkError} class="text-sm text-red-800 underline hover:text-red-900">
								Refresh page
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
			<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
				<h3 class="text-sm font-medium text-gray-500">Markets Predicted</h3>
				<p class="text-2xl font-bold text-gray-900">{totalMarkets}</p>
			</div>
			<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
				<h3 class="text-sm font-medium text-gray-500">Win Rate</h3>
				<p class="text-2xl font-bold text-gray-900">{winRate}%</p>
			</div>
			<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
				<h3 class="text-sm font-medium text-gray-500">Rewards Waiting</h3>
				<p class="text-2xl font-bold text-gray-900">{formatAmount(stats.claimableAmount)} ETH</p>
			</div>
		</div>

		<ClaimableRewardsBanner {claimableAmount} onClaimAll={claimAllRewards} />
		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm mb-6">
			<div class="border-b border-gray-200 px-6 py-4">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-gray-900">Your Prediction Activity</h2>
						<p class="text-sm text-gray-500">
							Performance of your predictions compared to win rate
						</p>
					</div>				
				</div>
			</div>
			<UserPredictionChart userId={userAddress} />
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
			<div class="border-b border-gray-200 px-6 py-4">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-gray-900">Your Prediction History</h2>
						<p class="text-sm text-gray-500">
							Markets you've predicted on and their current status
						</p>
					</div>					<div class="text-sm text-gray-500">
						Showing {(currentPage - 1) * itemsPerPage + 1}
						-{Math.min(currentPage * itemsPerPage, positions.length)} of {positions.length} positions
					</div>
				</div>
			</div>

			{#if positions.length === 0}
				<div class="flex flex-col items-center justify-center space-y-4 p-12 text-center">
					<h3 class="text-lg font-medium text-gray-900">No active predictions</h3>
					<p class="max-w-md text-sm text-gray-500">
						Make your first prediction on a market to see your positions here. Predict the market and earn rewards!
					</p>
					<div class="mt-4">
						<a href="/app" class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
							View Markets
						</a>
					</div>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<div class="inline-block min-w-full align-middle">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Market</th>
									<th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Prediction</th>
									<th scope="col" class="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
									<th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
									<th scope="col" class="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
									<th scope="col" class="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 bg-white">
								{#each paginatedPositions() as position (position.id)}
									<tr class="hover:bg-gray-50">
										<td class="px-6 py-4">
											<div class="flex items-center">
												<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100">
													<span class="font-medium text-indigo-600">
														{getMarketInitial(position)}
													</span>
												</div>
												<div class="ml-4 min-w-0 flex-1">
													<div class="text-sm font-medium text-gray-900 truncate">
														{getMarketDisplayName(position)}
													</div>
													<div class="text-sm text-gray-500 truncate">ID: {position.marketId}</div>
												</div>
											</div>
										</td>
										<td class="px-6 py-4">
											<div class="flex items-center">
												<div class="h-2.5 w-2.5 rounded-full {position.outcome === 'above'
													? 'bg-green-500'
													: position.outcome === 'below'
														? 'bg-red-500'
														: 'bg-gray-500'} mr-2 flex-shrink-0"></div>
												<span class="text-sm font-medium text-gray-900 whitespace-nowrap">
													{getOutcomeLabel(position.outcome)}
												</span>
											</div>
										</td>
										<td class="px-6 py-4 text-right">
											<div class="text-sm font-medium text-gray-900 whitespace-nowrap">
												{formatAmount(position.amount)} ETH
											</div>
											<div class="text-sm text-gray-500 whitespace-nowrap">
												${estimateUSDValue(position.amount)} USD
											</div>
										</td>
										<td class="px-6 py-4">
											<div class="text-sm text-gray-500 whitespace-nowrap">
												{formatDate(position.timestamp)}
											</div>
										</td>
										<td class="px-6 py-4 text-center">
											<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {getStatusColor(position)} whitespace-nowrap">
												{getStatusText(position)}
											</span>
										</td>
										<td class="px-6 py-4 text-center">
											<div class="flex justify-center">
												{#if !isMarketResolved(position)}
													<span class="inline-flex items-center text-amber-600 text-sm whitespace-nowrap">
														Awaiting market resolution
													</span>
												{:else if position.isWinning && !position.claimed && position.tokenId}
													<button
														onclick={() => handleClaimReward(position.tokenId!)}
														disabled={claimingTokenIds.has(position.tokenId!)}
														class="inline-flex items-center justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
													>
														{#if claimingTokenIds.has(position.tokenId!)}
															Claiming...
														{:else}
															Claim Prize!
														{/if}
													</button>
												{:else if position.isWinning && position.claimed}
													<span class="inline-flex items-center text-green-600 text-sm whitespace-nowrap">
														Prize Claimed
													</span>
												{:else}
													<span class="inline-flex items-center text-gray-500 text-sm whitespace-nowrap">
														No reward
													</span>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				{#if totalPages > 1}
					<div class="border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
						<div class="flex items-center justify-between">
							<div class="flex flex-1 justify-between sm:hidden">
								<button
									onclick={prevPage}
									disabled={currentPage === 1}
									class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Previous
								</button>
								<button
									onclick={nextPage}
									disabled={currentPage === totalPages}
									class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
								>
									Next
								</button>
							</div>
							<div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
								<div>
									<p class="text-sm text-gray-700">
										Showing <span class="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
										to
										<span class="font-medium">{Math.min(currentPage * itemsPerPage, positions.length)}</span>
										of
										<span class="font-medium">{positions.length}</span> results
									</p>
								</div>
								<div>
									<nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
										<button
											onclick={prevPage}
											disabled={currentPage === 1}
											class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
										>
											<span class="sr-only">Previous</span>
										</button>
										{#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
											{#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
												<button
													onclick={() => goToPage(page)}
													class="relative inline-flex items-center px-4 py-2 text-sm font-semibold {page === currentPage
														? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
														: 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'}"
												>
													{page}
												</button>
											{:else if page === currentPage - 2 || page === currentPage + 2}
												<span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">...</span>
											{/if}
										{/each}
										<button
											onclick={nextPage}
											disabled={currentPage === totalPages}
											class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
										>
											<span class="sr-only">Next</span>
										</button>
									</nav>
								</div>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>