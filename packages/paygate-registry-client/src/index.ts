import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





export interface Config {
  admin: string;
  fee_bps: u32;
  gateway: string;
  token: string;
}

export type DataKey = {tag: "Config", values: void} | {tag: "ToolSeq", values: void} | {tag: "CallSeq", values: void} | {tag: "Tool", values: readonly [u32]} | {tag: "Call", values: readonly [u32]} | {tag: "ProviderStats", values: readonly [string]} | {tag: "DisputeReason", values: readonly [u32]};


export interface CallRecord {
  amount: i128;
  id: u32;
  payer: string;
  payment_tx_hash: string;
  request_hash: string;
  response_hash: string;
  status: CallStatus;
  tool_id: u32;
}

export type CallStatus = {tag: "Paid", values: void} | {tag: "Disputed", values: void} | {tag: "Resolved", values: void};


export interface ToolRecord {
  active: boolean;
  bond_amount: i128;
  category: string;
  id: u32;
  metadata_hash: string;
  name: string;
  price: i128;
  provider: string;
}

export const PayGateError = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"InvalidAmount"},
  5: {message:"InvalidFee"},
  6: {message:"MissingTool"},
  7: {message:"InactiveTool"},
  8: {message:"MissingCall"},
  9: {message:"InvalidStatus"}
}


export interface ProviderStats {
  bonded: i128;
  calls: u32;
  tools: u32;
  volume: i128;
}







export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init: ({admin, token, gateway, fee_bps}: {admin: string, token: string, gateway: string, fee_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_call transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_call: ({call_id}: {call_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<CallRecord>>>

  /**
   * Construct and simulate a get_tool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_tool: ({tool_id}: {tool_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<ToolRecord>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Config>>>

  /**
   * Construct and simulate a record_call transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  record_call: ({gateway, tool_id, payer, amount, payment_tx_hash, request_hash, response_hash}: {gateway: string, tool_id: u32, payer: string, amount: i128, payment_tx_hash: string, request_hash: string, response_hash: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a open_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  open_dispute: ({payer, call_id, reason_hash}: {payer: string, call_id: u32, reason_hash: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a register_tool transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_tool: ({provider, name, category, price, metadata_hash, bond_amount}: {provider: string, name: string, category: string, price: i128, metadata_hash: string, bond_amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a provider_stats transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  provider_stats: ({provider}: {provider: string}, options?: MethodOptions) => Promise<AssembledTransaction<ProviderStats>>

  /**
   * Construct and simulate a resolve_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resolve_dispute: ({admin, call_id, refund_amount}: {admin: string, call_id: u32, refund_amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_tool_active transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_tool_active: ({provider, tool_id, active}: {provider: string, tool_id: u32, active: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABkNvbmZpZwAAAAAABAAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAB2dhdGV3YXkAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAAT",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAAAAAAAAAAAHVG9vbFNlcQAAAAAAAAAAAAAAAAdDYWxsU2VxAAAAAAEAAAAAAAAABFRvb2wAAAABAAAABAAAAAEAAAAAAAAABENhbGwAAAABAAAABAAAAAEAAAAAAAAADVByb3ZpZGVyU3RhdHMAAAAAAAABAAAAEwAAAAEAAAAAAAAADURpc3B1dGVSZWFzb24AAAAAAAABAAAABA==",
        "AAAAAQAAAAAAAAAAAAAACkNhbGxSZWNvcmQAAAAAAAgAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAACaWQAAAAAAAQAAAAAAAAABXBheWVyAAAAAAAAEwAAAAAAAAAPcGF5bWVudF90eF9oYXNoAAAAABAAAAAAAAAADHJlcXVlc3RfaGFzaAAAABAAAAAAAAAADXJlc3BvbnNlX2hhc2gAAAAAAAAQAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAKQ2FsbFN0YXR1cwAAAAAAAAAAAAd0b29sX2lkAAAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAACkNhbGxTdGF0dXMAAAAAAAMAAAAAAAAAAAAAAARQYWlkAAAAAAAAAAAAAAAIRGlzcHV0ZWQAAAAAAAAAAAAAAAhSZXNvbHZlZA==",
        "AAAAAQAAAAAAAAAAAAAAClRvb2xSZWNvcmQAAAAAAAgAAAAAAAAABmFjdGl2ZQAAAAAAAQAAAAAAAAALYm9uZF9hbW91bnQAAAAACwAAAAAAAAAIY2F0ZWdvcnkAAAAQAAAAAAAAAAJpZAAAAAAABAAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAABAAAAAAAAAABG5hbWUAAAAQAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAACHByb3ZpZGVyAAAAEw==",
        "AAAABAAAAAAAAAAAAAAADFBheUdhdGVFcnJvcgAAAAkAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAIAAAAAAAAADFVuYXV0aG9yaXplZAAAAAMAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAAEAAAAAAAAAApJbnZhbGlkRmVlAAAAAAAFAAAAAAAAAAtNaXNzaW5nVG9vbAAAAAAGAAAAAAAAAAxJbmFjdGl2ZVRvb2wAAAAHAAAAAAAAAAtNaXNzaW5nQ2FsbAAAAAAIAAAAAAAAAA1JbnZhbGlkU3RhdHVzAAAAAAAACQ==",
        "AAAAAAAAAAAAAAAEaW5pdAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAdnYXRld2F5AAAAABMAAAAAAAAAB2ZlZV9icHMAAAAABAAAAAEAAAPpAAAAAgAAB9AAAAAMUGF5R2F0ZUVycm9y",
        "AAAAAQAAAAAAAAAAAAAADVByb3ZpZGVyU3RhdHMAAAAAAAAEAAAAAAAAAAZib25kZWQAAAAAAAsAAAAAAAAABWNhbGxzAAAAAAAABAAAAAAAAAAFdG9vbHMAAAAAAAAEAAAAAAAAAAZ2b2x1bWUAAAAAAAs=",
        "AAAABQAAAAAAAAAAAAAADVBhaWRDYWxsRXZlbnQAAAAAAAABAAAABHBhaWQAAAAEAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAAAAAAAAdjYWxsX2lkAAAAAAQAAAAAAAAAAAAAAAd0b29sX2lkAAAAAAQAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAD1Rvb2xBY3RpdmVFdmVudAAAAAABAAAABmFjdGl2ZQAAAAAAAwAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAAAAAAAAAAAHdG9vbF9pZAAAAAAEAAAAAAAAAAAAAAAGYWN0aXZlAAAAAAABAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAIZ2V0X2NhbGwAAAABAAAAAAAAAAdjYWxsX2lkAAAAAAQAAAABAAAD6QAAB9AAAAAKQ2FsbFJlY29yZAAAAAAH0AAAAAxQYXlHYXRlRXJyb3I=",
        "AAAAAAAAAAAAAAAIZ2V0X3Rvb2wAAAABAAAAAAAAAAd0b29sX2lkAAAAAAQAAAABAAAD6QAAB9AAAAAKVG9vbFJlY29yZAAAAAAH0AAAAAxQYXlHYXRlRXJyb3I=",
        "AAAABQAAAAAAAAAAAAAAEEluaXRpYWxpemVkRXZlbnQAAAABAAAABGluaXQAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAAAAAAAdnYXRld2F5AAAAABMAAAAAAAAAAAAAAAdmZWVfYnBzAAAAAAQAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAH0AAAAAZDb25maWcAAAAAB9AAAAAMUGF5R2F0ZUVycm9y",
        "AAAABQAAAAAAAAAAAAAAEkRpc3B1dGVPcGVuZWRFdmVudAAAAAAAAQAAAAdkaXNwdXRlAAAAAAIAAAAAAAAABXBheWVyAAAAAAAAEwAAAAAAAAAAAAAAB2NhbGxfaWQAAAAABAAAAAAAAAAC",
        "AAAAAAAAAAAAAAALcmVjb3JkX2NhbGwAAAAABwAAAAAAAAAHZ2F0ZXdheQAAAAATAAAAAAAAAAd0b29sX2lkAAAAAAQAAAAAAAAABXBheWVyAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAA9wYXltZW50X3R4X2hhc2gAAAAAEAAAAAAAAAAMcmVxdWVzdF9oYXNoAAAAEAAAAAAAAAANcmVzcG9uc2VfaGFzaAAAAAAAABAAAAABAAAD6QAAAAQAAAfQAAAADFBheUdhdGVFcnJvcg==",
        "AAAABQAAAAAAAAAAAAAAE1Rvb2xSZWdpc3RlcmVkRXZlbnQAAAAAAQAAAAR0b29sAAAAAwAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAAAAAAAAAAAHdG9vbF9pZAAAAAAEAAAAAAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAMb3Blbl9kaXNwdXRlAAAAAwAAAAAAAAAFcGF5ZXIAAAAAAAATAAAAAAAAAAdjYWxsX2lkAAAAAAQAAAAAAAAAC3JlYXNvbl9oYXNoAAAAABAAAAABAAAD6QAAAAIAAAfQAAAADFBheUdhdGVFcnJvcg==",
        "AAAABQAAAAAAAAAAAAAAFERpc3B1dGVSZXNvbHZlZEV2ZW50AAAAAQAAAAdyZXNvbHZlAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAAAAAAB2NhbGxfaWQAAAAABAAAAAAAAAAAAAAADXJlZnVuZF9hbW91bnQAAAAAAAALAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAANcmVnaXN0ZXJfdG9vbAAAAAAAAAYAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAAAAAAEbmFtZQAAABAAAAAAAAAACGNhdGVnb3J5AAAAEAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAAEAAAAAAAAAALYm9uZF9hbW91bnQAAAAACwAAAAEAAAPpAAAABAAAB9AAAAAMUGF5R2F0ZUVycm9y",
        "AAAAAAAAAAAAAAAOcHJvdmlkZXJfc3RhdHMAAAAAAAEAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAEAAAfQAAAADVByb3ZpZGVyU3RhdHMAAAA=",
        "AAAAAAAAAAAAAAAPcmVzb2x2ZV9kaXNwdXRlAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAHY2FsbF9pZAAAAAAEAAAAAAAAAA1yZWZ1bmRfYW1vdW50AAAAAAAACwAAAAEAAAPpAAAAAgAAB9AAAAAMUGF5R2F0ZUVycm9y",
        "AAAAAAAAAAAAAAAPc2V0X3Rvb2xfYWN0aXZlAAAAAAMAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAAAAAAHdG9vbF9pZAAAAAAEAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAABAAAD6QAAAAIAAAfQAAAADFBheUdhdGVFcnJvcg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<Result<void>>,
        get_call: this.txFromJSON<Result<CallRecord>>,
        get_tool: this.txFromJSON<Result<ToolRecord>>,
        get_config: this.txFromJSON<Result<Config>>,
        record_call: this.txFromJSON<Result<u32>>,
        open_dispute: this.txFromJSON<Result<void>>,
        register_tool: this.txFromJSON<Result<u32>>,
        provider_stats: this.txFromJSON<ProviderStats>,
        resolve_dispute: this.txFromJSON<Result<void>>,
        set_tool_active: this.txFromJSON<Result<void>>
  }
}