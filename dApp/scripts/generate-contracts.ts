import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { format } from 'prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const generatedDir = join(rootDir, 'src/generated');
const abisDir = join(rootDir, 'src/generated/abis');

// List of contracts to generate types for
const TARGET_CONTRACTS = [
	'PredictionManager',
	'SwapCastHook',
	'SwapCastNFT',
	'OracleResolver',
	'RewardDistributor',
	'Treasury',
	'MarketLogic',
	'PoolManager'
];

if (!existsSync(generatedDir)) {
	mkdirSync(generatedDir, { recursive: true });
}

(async () => {
	const typesDir = join(generatedDir, 'types');
	if (!existsSync(typesDir)) {
		mkdirSync(typesDir, { recursive: true });
	}
	for (const contractName of TARGET_CONTRACTS) {
		try {
			const artifactPath = join(abisDir, `${contractName}.sol`, `${contractName}.abi.json`);
			if (!existsSync(artifactPath)) {
				console.warn(`Skipping ${contractName}: No ABI JSON file found at ${artifactPath}`);
				continue;
			}
			const abi = JSON.parse(readFileSync(artifactPath, 'utf-8'));
			// Generate type-safe contract types and hooks
			const content = `// Auto-generated file - DO NOT EDIT!\nimport { createPublicClient, http, parseAbi, getContract, type Address } from 'viem'\nimport { type GetContractReturnType } from 'viem'\n\n// ABI with type inference when used with 'as const'\nexport const ${contractName}Abi = ${JSON.stringify(abi, null, 2)} as const\n\n// Type for the contract instance\nexport type ${contractName}Contract = GetContractReturnType<typeof ${contractName}Abi>\n\n// Function to get a typed contract instance
export function get${contractName}({
  address,
  chain,
  transport,
}: {
  address: Address,
  chain: any, // Use viem's Chain type if available
  transport?: ReturnType<typeof http>
}) {
  const client = createPublicClient({
    chain,
    transport: transport || http(),
  });
  return getContract({
    address,
    abi: ${contractName}Abi,
    client,
  });
}
\n// Types for all events\nexport type ${contractName}Events = ${contractName}Contract['events']\n\n// Types for all methods\nexport type ${contractName}Methods = ${contractName}Contract['methods']\n\n// Types for all read functions\nexport type ${contractName}ReadFunctions = ${contractName}Contract['read']\n\n// Types for all write functions\nexport type ${contractName}WriteFunctions = ${contractName}Contract['write']\n`;
			const formatted = await format(content, {
				singleQuote: true,
				trailingComma: 'es5',
				semi: true,
				printWidth: 100,
				parser: 'typescript'
			});
			const outputFile = join(typesDir, `${contractName}.ts`);
			writeFileSync(outputFile, formatted, 'utf-8');
			console.log(`Generated types for ${contractName}`);
		} catch (e) {
			console.error(`Error generating types for ${contractName}:`, e);
		}
	}
	console.log('Contract type generation complete!');
})();
