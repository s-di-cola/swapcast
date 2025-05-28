<script lang="ts">
	interface FooterLink {
		text: string;
		href: string;
		external?: boolean;
	}

	interface FooterSection {
		title: string;
		links: FooterLink[];
	}

	const footerSections: FooterSection[] = [
		{
			title: 'Product',
			links: [
				{ text: 'Features', href: '#features' },
				{ text: 'How it Works', href: '#how-it-works' },
				{ text: 'Dashboard', href: '/app' },
				{ text: 'Documentation', href: '/docs' }
			]
		},
		{
			title: 'Technology',
			links: [
				{ text: 'Uniswap', href: 'https://uniswap.org', external: true },
				{ text: 'Chainlink', href: 'https://chain.link', external: true },
				{ text: 'Ethereum', href: 'https://ethereum.org', external: true },
				{
					text: 'Uniswap v4 Hooks',
					href: 'https://docs.uniswap.org/contracts/v4/overview',
					external: true
				}
			]
		},
		{
			title: 'Resources',
			links: [
				{ text: 'FAQ', href: '#top' },
				{ text: 'Support', href: '#top' },
				{ text: 'GitHub', href: '#top' },
				{ text: 'Status', href: '#top' }
			]
		},
		{
			title: 'Legal',
			links: [
				{ text: 'Privacy Policy', href: '#top' },
				{ text: 'Terms of Service', href: '#top' },
				{ text: 'Cookie Policy', href: '#top' }
			]
		}
	] as const;

	const currentYear = new Date().getFullYear();
</script>

<footer class="border-t border-gray-200 bg-white">
	<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
		<div class="grid grid-cols-2 gap-8 md:grid-cols-4">
			{#each footerSections as section}
				<div>
					<h3 class="text-sm font-semibold tracking-wider text-gray-400 uppercase">
						{section.title}
					</h3>
					<ul class="mt-4 space-y-4">
						{#each section.links as link}
							<li>
								<a
									href={link.href}
									{...link.external ? { target: '_blank', rel: 'noopener' } : {}}
									class="text-base text-gray-500 hover:text-gray-900"
								>
									{link.text}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		<div class="mt-12 border-t border-gray-200 pt-8">
			<p class="text-center text-base text-gray-400">
				&copy; {currentYear} SwapCast. All rights reserved.
			</p>
		</div>
	</div>
</footer>
