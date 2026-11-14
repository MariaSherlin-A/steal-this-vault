/**
 * A local EVM with QoreChain's two post-quantum precompiles.
 *
 * Hardhat and Foundry cannot run those precompiles, so projects usually test
 * against a mock that answers "valid" on request. Here the precompile at
 * 0x...0A01 runs the real ML-DSA-87 verification (the same library the
 * QoreChain SDK signs with) and the one at 0x...0A02 serves a key registry, so
 * a test signature is accepted or rejected for the same reason it would be on
 * chain. Either precompile can be switched off to model a network where it is
 * not active.
 *
 * Built on @ethereumjs/vm: pure JavaScript, no native binaries.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBlock } from "@ethereumjs/block";
import { Hardfork, Mainnet, createCustomCommon } from "@ethereumjs/common";
import { EVMError, type ExecResult, type PrecompileInput } from "@ethereumjs/evm";
import { createFeeMarket1559Tx } from "@ethereumjs/tx";
import { createAccount, createAddressFromString, hexToBytes as ejsHexToBytes } from "@ethereumjs/util";
import { createVM, runTx, type VM } from "@ethereumjs/vm";
import { mldsa87 } from "@qorechain/pqc";
import {
  bytesToHex,
  decodeAbiParameters,
  decodeErrorResult,
  decodeEventLog,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeDeployData,
  encodeFunctionData,
  getAddress,
  hexToBytes,
  toFunctionSelector,
  type Abi,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type ContractFunctionReturnType,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = dirname(fileURLToPath(import.meta.url));

export const PQC_VERIFY = "0x0000000000000000000000000000000000000a01";
export const PQC_KEY_STATUS = "0x0000000000000000000000000000000000000a02";

/** Gas schedule of the chain's precompiles, from the QoreChain docs. */
const VERIFY_BASE_GAS = 25_000n;
const VERIFY_GAS_PER_BYTE = 8n;
const KEY_STATUS_GAS = 2_500n;

const VERIFY_SELECTOR = toFunctionSelector("pqcVerify(bytes,bytes,bytes)");
const KEY_STATUS_SELECTOR = toFunctionSelector("pqcKeyStatus(address)");

export interface Artifact {
  contractName: string;
  abi: Abi;
  bytecode: Hex;
}

export function artifact(name: string): Artifact {
  return JSON.parse(readFileSync(join(here, "../../artifacts", `${name}.json`), "utf8")) as Artifact;
}

/** The compiled bytecode of `name`, paired with its typed ABI from the shared library. */
export function typedArtifact<const TAbi extends Abi>(name: string, abi: TAbi): { abi: TAbi; bytecode: Hex } {
  return { abi, bytecode: artifact(name).bytecode };
}

export interface TestAccount {
  privateKey: Hex;
  address: Address;
}

export interface KeyRecord {
  registered: boolean;
  algorithmId: number;
  publicKey: Uint8Array;
  possessionProven: boolean;
}

export interface DecodedLog {
  address: Address;
  eventName: string;
  args: Record<string, unknown>;
}

export interface TxResult {
  status: "success" | "reverted";
  gasUsed: bigint;
  returnData: Hex;
  logs: DecodedLog[];
  /** Decoded custom error or revert reason, when the transaction reverted. */
  error?: { name: string; args: readonly unknown[] };
  createdAddress?: Address;
}

export interface SendOptions {
  from: TestAccount;
  to?: Address;
  data?: Hex;
  value?: bigint;
  gasLimit?: bigint;
}

const outOfGas = (gasLimit: bigint): ExecResult => ({
  returnValue: new Uint8Array(0),
  executionGasUsed: gasLimit,
  exceptionError: new EVMError(EVMError.errorMessages.OUT_OF_GAS),
});

/** What a call to an address with no code returns: success and no data. */
const noCode = (): ExecResult => ({ returnValue: new Uint8Array(0), executionGasUsed: 0n });

export class LocalChain {
  readonly chainId: number;
  /** Which precompiles are active. Switch one off to model a network without it. */
  readonly precompiles = { verify: true, keyStatus: true };
  /** Number of signatures the verify precompile has checked. */
  verifyCalls = 0;

  private vm!: VM;
  private readonly keys = new Map<string, KeyRecord>();
  private readonly abis: Abi[] = [];
  private blockNumber = 1n;
  private timestamp = 1_800_000_000n;
  private accountCounter = 0;

  private constructor(chainId: number) {
    this.chainId = chainId;
  }

  static async create(options: { chainId?: number } = {}): Promise<LocalChain> {
    const chain = new LocalChain(options.chainId ?? 9800);
    const common = createCustomCommon({ chainId: chain.chainId }, Mainnet, { hardfork: Hardfork.Cancun });
    chain.vm = await createVM({
      common,
      evmOpts: {
        customPrecompiles: [
          { address: createAddressFromString(PQC_VERIFY), function: (input) => chain.runVerify(input) },
          { address: createAddressFromString(PQC_KEY_STATUS), function: (input) => chain.runKeyStatus(input) },
        ],
      },
    });
    return chain;
  }

  // ------------------------------------------------------------ precompiles

  private runVerify(input: PrecompileInput): ExecResult {
    if (!this.precompiles.verify) return noCode();
    const gas = VERIFY_BASE_GAS + VERIFY_GAS_PER_BYTE * BigInt(input.data.length);
    if (input.gasLimit < gas) return outOfGas(input.gasLimit);

    let valid = false;
    const data = bytesToHex(input.data);
    if (data.startsWith(VERIFY_SELECTOR)) {
      try {
        const [publicKey, signature, message] = decodeAbiParameters(
          [{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }],
          `0x${data.slice(10)}`,
        );
        this.verifyCalls += 1;
        // Returns false, never throws, for a wrong-length key or signature.
        valid = mldsa87.verify(hexToBytes(publicKey), hexToBytes(message), hexToBytes(signature));
      } catch {
        valid = false;
      }
    }
    return {
      executionGasUsed: gas,
      returnValue: hexToBytes(encodeAbiParameters([{ type: "bool" }], [valid])),
    };
  }

  private runKeyStatus(input: PrecompileInput): ExecResult {
    if (!this.precompiles.keyStatus) return noCode();
    if (input.gasLimit < KEY_STATUS_GAS) return outOfGas(input.gasLimit);

    const data = bytesToHex(input.data);
    let record: KeyRecord | undefined;
    if (data.startsWith(KEY_STATUS_SELECTOR)) {
      try {
        const [account] = decodeAbiParameters([{ type: "address" }], `0x${data.slice(10)}`);
        record = this.keys.get(account.toLowerCase());
      } catch {
        record = undefined;
      }
    }
    return {
      executionGasUsed: KEY_STATUS_GAS,
      returnValue: hexToBytes(
        encodeAbiParameters(
          [{ type: "bool" }, { type: "uint8" }, { type: "bytes" }, { type: "bool" }],
          [
            record?.registered ?? false,
            record?.algorithmId ?? 0,
            bytesToHex(record?.publicKey ?? new Uint8Array(0)),
            record?.possessionProven ?? false,
          ],
        ),
      ),
    };
  }

  /** Put a post-quantum key on record for an account, as native-lane registration does. */
  registerKey(account: Address, publicKey: Uint8Array, overrides: Partial<KeyRecord> = {}): void {
    this.keys.set(account.toLowerCase(), {
      registered: true,
      algorithmId: 1,
      possessionProven: true,
      publicKey,
      ...overrides,
    });
  }

  /** Remove an account's key from the registry. */
  unregisterKey(account: Address): void {
    this.keys.delete(account.toLowerCase());
  }

  // ---------------------------------------------------------------- accounts

  /** A fresh funded account with a deterministic key. */
  async account(balance: bigint = 10n ** 21n): Promise<TestAccount> {
    this.accountCounter += 1;
    const privateKey = `0x${this.accountCounter.toString(16).padStart(64, "0")}` as Hex;
    const address = privateKeyToAccount(privateKey).address;
    await this.setBalance(address, balance);
    return { privateKey, address };
  }

  async setBalance(address: Address, balance: bigint): Promise<void> {
    const addr = createAddressFromString(address);
    const existing = await this.vm.stateManager.getAccount(addr);
    if (existing) {
      existing.balance = balance;
      await this.vm.stateManager.putAccount(addr, existing);
    } else {
      await this.vm.stateManager.putAccount(addr, createAccount({ balance }));
    }
  }

  async balance(address: Address): Promise<bigint> {
    return (await this.vm.stateManager.getAccount(createAddressFromString(address)))?.balance ?? 0n;
  }

  private async nonceOf(address: Address): Promise<bigint> {
    return (await this.vm.stateManager.getAccount(createAddressFromString(address)))?.nonce ?? 0n;
  }

  // -------------------------------------------------------------------- time

  now(): bigint {
    return this.timestamp;
  }

  /** Move block time forward. */
  warp(seconds: bigint | number): void {
    this.timestamp += BigInt(seconds);
  }

  currentBlock(): bigint {
    return this.blockNumber;
  }

  private block() {
    return createBlock(
      {
        header: {
          number: this.blockNumber,
          timestamp: this.timestamp,
          gasLimit: 60_000_000n,
          baseFeePerGas: 7n,
        },
      },
      { common: this.vm.common, skipConsensusFormatValidation: true },
    );
  }

  // ------------------------------------------------------------ transactions

  /** Remember an ABI so logs and custom errors from its contracts can be decoded. */
  register(abi: Abi): void {
    if (!this.abis.includes(abi)) this.abis.push(abi);
  }

  /** Sign and run a transaction in its own block. */
  async send(options: SendOptions): Promise<TxResult> {
    const tx = createFeeMarket1559Tx(
      {
        chainId: BigInt(this.chainId),
        nonce: await this.nonceOf(options.from.address),
        gasLimit: options.gasLimit ?? 5_000_000n,
        maxFeePerGas: 10n,
        maxPriorityFeePerGas: 1n,
        to: options.to ? createAddressFromString(options.to) : undefined,
        value: options.value ?? 0n,
        data: ejsHexToBytes(options.data ?? "0x"),
      },
      { common: this.vm.common },
    ).sign(ejsHexToBytes(options.from.privateKey));

    const result = await runTx(this.vm, { tx, block: this.block(), skipBlockGasLimitValidation: true });
    this.blockNumber += 1n;
    this.timestamp += 2n;

    const returnData = bytesToHex(result.execResult.returnValue);
    const reverted = result.execResult.exceptionError !== undefined;
    return {
      status: reverted ? "reverted" : "success",
      gasUsed: result.totalGasSpent,
      returnData,
      logs: reverted ? [] : this.decodeLogs(result.receipt.logs),
      error: reverted ? this.decodeError(returnData, result.execResult.exceptionError?.error) : undefined,
      createdAddress: result.createdAddress ? getAddress(result.createdAddress.toString()) : undefined,
    };
  }

  /** Run a call against current state and throw the changes away. */
  async call(options: { from?: Address; to: Address; data: Hex; value?: bigint }): Promise<TxResult> {
    await this.vm.evm.journal.checkpoint();
    try {
      const result = await this.vm.evm.runCall({
        caller: createAddressFromString(options.from ?? "0x000000000000000000000000000000000000c0de"),
        to: createAddressFromString(options.to),
        data: ejsHexToBytes(options.data),
        value: options.value ?? 0n,
        gasLimit: 30_000_000n,
        block: this.block(),
        skipBalance: true,
      });
      const returnData = bytesToHex(result.execResult.returnValue);
      const reverted = result.execResult.exceptionError !== undefined;
      return {
        status: reverted ? "reverted" : "success",
        gasUsed: result.execResult.executionGasUsed,
        returnData,
        logs: [],
        error: reverted ? this.decodeError(returnData, result.execResult.exceptionError?.error) : undefined,
      };
    } finally {
      await this.vm.evm.journal.revert();
    }
  }

  async deploy<const TAbi extends Abi>(
    art: { abi: TAbi; bytecode: Hex },
    args: readonly unknown[],
    from: TestAccount,
    value = 0n,
  ): Promise<Contract<TAbi>> {
    this.register(art.abi);
    const data = encodeDeployData({ abi: art.abi as Abi, bytecode: art.bytecode, args });
    const result = await this.send({ from, data, value, gasLimit: 8_000_000n });
    if (result.status !== "success" || !result.createdAddress) {
      throw new Error(`deployment failed: ${JSON.stringify(result.error)}`);
    }
    return new Contract(this, art.abi, result.createdAddress);
  }

  at<const TAbi extends Abi>(abi: TAbi, address: Address): Contract<TAbi> {
    this.register(abi);
    return new Contract(this, abi, address);
  }

  private decodeLogs(logs: [Uint8Array, Uint8Array[], Uint8Array][]): DecodedLog[] {
    return logs.map(([address, topics, data]) => {
      const hexTopics = topics.map((t) => bytesToHex(t)) as [Hex, ...Hex[]];
      for (const abi of this.abis) {
        try {
          const decoded = decodeEventLog({ abi, topics: hexTopics, data: bytesToHex(data) });
          return {
            address: getAddress(bytesToHex(address)),
            eventName: String(decoded.eventName),
            args: (decoded.args ?? {}) as unknown as Record<string, unknown>,
          };
        } catch {
          // try the next ABI
        }
      }
      return { address: getAddress(bytesToHex(address)), eventName: "(unknown)", args: {} };
    });
  }

  private decodeError(data: Hex, fallback?: string): { name: string; args: readonly unknown[] } {
    if (data.length >= 10) {
      // Error(string) and Panic(uint256) are known to every ABI decoder.
      for (const abi of [...this.abis, [] as Abi]) {
        try {
          const decoded = decodeErrorResult({ abi, data });
          return { name: decoded.errorName, args: (decoded.args ?? []) as readonly unknown[] };
        } catch {
          // try the next ABI
        }
      }
    }
    return { name: fallback ?? "revert", args: [data] };
  }
}

/** A deployed contract with typed reads and writes. */
export class Contract<const TAbi extends Abi> {
  constructor(
    readonly chain: LocalChain,
    readonly abi: TAbi,
    readonly address: Address,
  ) {}

  /** Call data for a function. */
  encode<TName extends ContractFunctionName<TAbi>>(
    functionName: TName,
    args: ContractFunctionArgs<TAbi, "nonpayable" | "payable" | "pure" | "view", TName>,
  ): Hex {
    return encodeFunctionData({ abi: this.abi as Abi, functionName: functionName as string, args: args as unknown[] });
  }

  /** Read a view function, or simulate a state-changing one, as `from`. */
  async read<TName extends ContractFunctionName<TAbi>>(
    functionName: TName,
    args: ContractFunctionArgs<TAbi, "nonpayable" | "payable" | "pure" | "view", TName>,
    from?: Address,
  ): Promise<ContractFunctionReturnType<TAbi, "nonpayable" | "payable" | "pure" | "view", TName>> {
    const result = await this.chain.call({ from, to: this.address, data: this.encode(functionName, args) });
    if (result.status !== "success") {
      throw new Error(`${String(functionName)} reverted: ${result.error?.name} ${JSON.stringify(result.error?.args)}`);
    }
    return decodeFunctionResult({
      abi: this.abi as Abi,
      functionName: functionName as string,
      data: result.returnData,
    }) as ContractFunctionReturnType<TAbi, "nonpayable" | "payable" | "pure" | "view", TName>;
  }

  /** Send a transaction. Does not throw on revert: inspect `status` and `error`. */
  async write<TName extends ContractFunctionName<TAbi, "nonpayable" | "payable">>(
    functionName: TName,
    args: ContractFunctionArgs<TAbi, "nonpayable" | "payable", TName>,
    from: TestAccount,
    options: { value?: bigint; gasLimit?: bigint } = {},
  ): Promise<TxResult & { result?: ContractFunctionReturnType<TAbi, "nonpayable" | "payable", TName> }> {
    const data = encodeFunctionData({ abi: this.abi as Abi, functionName: functionName as string, args: args as unknown[] });
    const tx = await this.chain.send({ from, to: this.address, data, ...options });
    if (tx.status !== "success" || tx.returnData === "0x") return tx;
    return {
      ...tx,
      result: decodeFunctionResult({
        abi: this.abi as Abi,
        functionName: functionName as string,
        data: tx.returnData,
      }) as ContractFunctionReturnType<TAbi, "nonpayable" | "payable", TName>,
    };
  }
}
