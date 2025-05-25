import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { format } from 'prettier'
import type { Abi } from 'abitype'

// Make format synchronous since we're in a script
const formatSync = (code: string, options: any) => {
  try {
    // format may return a Promise in newer versions of prettier
    const result = format(code, { ...options, parser: 'typescript' })
    if (result instanceof Promise) {
      // For async format, we'll just return the unformatted code
      console.warn('Prettier format returned a Promise, using unformatted code')
      return code
    }
    return result
  } catch (e) {
    console.error('Error formatting code:', e)
    return code
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const generatedDir = join(rootDir, 'src/generated')
const abisDir = join(rootDir, 'src/generated/abis')

// List of contracts to generate types for
const TARGET_CONTRACTS = [
  'PredictionManager',
  'SwapCastHook',
  'SwapCastNFT',
  'OracleResolver',
  'RewardDistributor',
  'Treasury',
  'MarketLogic'
]

// Ensure generated directory exists
if (!existsSync(generatedDir)) {
  mkdirSync(generatedDir, { recursive: true })
}

// Generate contract hooks and types for each target contract
TARGET_CONTRACTS.forEach(contractName => {
  const contractDir = join(abisDir, `${contractName}.sol`)
  
  if (!existsSync(contractDir)) {
    console.warn(`Skipping ${contractName}: Directory not found at ${contractDir}`)
    return
  }

  // Find the JSON file in the contract directory
  const files = readdirSync(contractDir)
  const jsonFile = files.find(f => f.endsWith('.abi.json'))
  
  if (!jsonFile) {
    console.warn(`Skipping ${contractName}: No ABI JSON file found in ${contractDir}`)
    return
  }

  const artifactPath = join(contractDir, jsonFile)
  const abi = JSON.parse(readFileSync(artifactPath, 'utf-8'))

  // Generate type-safe contract types and hooks
  const content = `// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, parseAbi, getContract, type Address } from 'viem'
import { type GetContractReturnType } from 'viem/contract'

// ABI with type inference when used with 'as const'
export const ${contractName}Abi = ${JSON.stringify(abi, null, 2)} as const

// Type for the contract instance
export type ${contractName}Contract = GetContractReturnType<typeof ${contractName}Abi>

// Function to get a typed contract instance
export function get${contractName}(address: Address, chainId: number = 1) {
  const client = createPublicClient({
    chain: { id: chainId },
    transport: http()
  })

  return getContract({
    address,
    abi: ${contractName}Abi,
    client,
  })
}

// Types for all events
export type ${contractName}Events = ${contractName}Contract['events']

// Types for all methods
export type ${contractName}Methods = ${contractName}Contract['methods']

// Types for all read functions
export type ${contractName}ReadFunctions = ${contractName}Contract['read']

// Types for all write functions
export type ${contractName}WriteFunctions = ${contractName}Contract['write']
`

  // Format with Prettier and write to file
  const formatted = formatSync(content, {
    singleQuote: true,
    trailingComma: 'es5',
    semi: true,
    printWidth: 100
  })

  const typesDir = join(generatedDir, 'types')
  const outputFile = join(typesDir, `${contractName}.ts`)
  
  if (!existsSync(typesDir)) {
    mkdirSync(typesDir, { recursive: true })
  }
  
  writeFileSync(outputFile, formatted, 'utf-8')
  
  console.log(`Generated types for ${contractName}`)
})

console.log('Contract type generation complete!')
