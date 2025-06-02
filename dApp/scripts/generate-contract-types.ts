import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
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

/**
 * Generate TypeScript contract interface file
 */
function generateContractTypes(contractName: string, abi: any): string {
  return `// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const ${contractName}Abi = ${JSON.stringify(abi, null, 2)} as const;

/**
 * Function to get a typed contract instance
 */
export function get${contractName}({
  address,
  chain,
  transport,
}: {
  address: Address;
  chain: any; // Use viem's Chain type if available
  transport?: ReturnType<typeof http>;
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

// Type for the contract instance
export type ${contractName}Instance = ReturnType<typeof get${contractName}>;

// Types for all read functions - using optional chaining for safety
export type ${contractName}ReadFunctions = ${contractName}Instance extends { read: infer R } ? R : never;

// Types for all write functions - using optional chaining for safety
export type ${contractName}WriteFunctions = ${contractName}Instance extends { write: infer W } ? W : never;
`;

}

/**
 * Main execution function
 */
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
      const content = generateContractTypes(contractName, abi);
      
      // Format the generated code - prettier.format is async
      try {
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
      } catch (formatError) {
        // If formatting fails, write the unformatted content
        console.warn(`Formatting failed for ${contractName}, writing unformatted code:`, formatError);
        const outputFile = join(typesDir, `${contractName}.ts`);
        writeFileSync(outputFile, content, 'utf-8');
        console.log(`Generated unformatted types for ${contractName}`);
      }
    } catch (e) {
      console.error(`Error generating types for ${contractName}:`, e);
    }
  }
  
  console.log('Contract type generation complete!');
})();
