/**
 * POST /api/ika/create-dwallet
 *
 * Runs Ika dWallet DKG via gRPC on the server side (Node.js only).
 * Body: { payerPubkey: string (base58) }
 * Returns: { dwalletPda: string, publicKey: string (hex) }
 *
 * Uses the Ika pre-alpha gRPC at pre-alpha-dev-1.ika.ika-network.net:443
 */

import * as grpc from "@grpc/grpc-js";
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { defineBcsTypes } from "@/lib/ika-bcs-types";

const GRPC_URL = "pre-alpha-dev-1.ika.ika-network.net:443";
const IKA_PROGRAM_ID = new PublicKey("87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY");
const CURVE_CURVE25519 = 0;

const {
  SignedRequestData, TransactionResponseData,
  VersionedDWalletDataAttestation, UserSignature,
} = defineBcsTypes();


function buildBcsSignature(payerBytes: Uint8Array): Uint8Array {
  // BCS-serialize UserSignature::Ed25519 { signature: [0;64], public_key: payerBytes }
  // Pre-alpha ignores signature validity — zeros are accepted
  return UserSignature.serialize({
    Ed25519: {
      signature: Array.from(new Uint8Array(64)),
      public_key: Array.from(payerBytes),
    },
  }).toBytes();
}

function dwalletPdaSeeds(curve: number, publicKey: Uint8Array): Buffer[] {
  // Seeds = ["dwallet", chunks_of(curve_byte || pubkey, 32)]
  const raw = Buffer.concat([Buffer.from([curve]), Buffer.from(publicKey)]);
  const chunks: Buffer[] = [Buffer.from("dwallet")];
  for (let i = 0; i < raw.length; i += 32) {
    chunks.push(raw.slice(i, Math.min(i + 32, raw.length)));
  }
  return chunks;
}

async function grpcUnary(requestBytes: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const creds = grpc.credentials.createSsl();
    const client = new grpc.Client(GRPC_URL, creds);
    client.makeUnaryRequest(
      "/ika.dwallet.v1.DWalletService/SubmitTransaction",
      (x: Buffer) => x,
      (x: Buffer) => x,
      requestBytes,
      new grpc.Metadata(),
      { deadline: Date.now() + 20_000 },
      (err: grpc.ServiceError | null, resp?: Buffer) => {
        client.close();
        if (err) reject(new Error(`gRPC ${err.code}: ${err.details}`));
        else resolve(resp!);
      }
    );
  });
}

// Encode UserSignedRequest proto: field 1 = user_signature (bytes BCS), field 2 = data (bytes BCS)
function buildProtoRequest(signature: Uint8Array, data: Uint8Array): Buffer {
  return Buffer.concat([
    encodeBytes(1, Buffer.from(signature)),
    encodeBytes(2, Buffer.from(data)),
  ]);
}

function encodeBytes(fieldNum: number, value: Buffer): Buffer {
  const tag = (fieldNum << 3) | 2;
  const tagBuf = encodeVarint(tag);
  const lenBuf = encodeVarint(value.length);
  return Buffer.concat([tagBuf, lenBuf, value]);
}

function encodeVarint(n: number): Buffer {
  const bytes: number[] = [];
  while (n > 127) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n);
  return Buffer.from(bytes);
}

export async function POST(req: NextRequest) {
  try {
    const { payerPubkey } = await req.json();
    const payerBytes = new PublicKey(payerPubkey).toBytes();

    // Build DKG request using BCS
    const dkgData = SignedRequestData.serialize({
      session_identifier_preimage: Array.from(new Uint8Array(32)),
      epoch: 1n,
      chain_id: { Solana: true },
      intended_chain_sender: Array.from(payerBytes),
      request: {
        DKG: {
          dwallet_network_encryption_public_key: Array.from(new Uint8Array(32)),
          curve: { Curve25519: true },
          centralized_public_key_share_and_proof: Array.from(new Uint8Array(32)),
          user_secret_key_share: {
            Encrypted: {
              encrypted_centralized_secret_share_and_proof: Array.from(new Uint8Array(32)),
              encryption_key: Array.from(new Uint8Array(32)),
              signer_public_key: Array.from(payerBytes),
            },
          },
          user_public_output: Array.from(new Uint8Array(32)),
          sign_during_dkg_request: null,
        },
      },
    }).toBytes();

    const signature = buildBcsSignature(payerBytes);
    const protoRequest = buildProtoRequest(signature, dkgData);

    const responseBytes = await grpcUnary(protoRequest);

    // The TransactionResponse proto wraps the BCS bytes in field 1
    // Extract the BCS payload and parse it
    let bcsResponseBytes: Uint8Array;
    if (responseBytes[0] === 0x0a) {
      // proto field 1 (wire type 2) — skip tag + varint length
      let i = 1;
      let len = 0, shift = 0;
      while (true) { const b = responseBytes[i++]; len |= (b & 0x7f) << shift; if (!(b & 0x80)) break; shift += 7; }
      bcsResponseBytes = responseBytes.slice(i, i + len);
    } else {
      bcsResponseBytes = responseBytes;
    }

    const response = TransactionResponseData.parse(new Uint8Array(bcsResponseBytes));

    if (!response.Attestation) {
      throw new Error(`DKG failed: ${JSON.stringify(response)}`);
    }

    const payload = VersionedDWalletDataAttestation.parse(
      new Uint8Array(response.Attestation.attestation_data)
    );
    if (!payload.V1) throw new Error("Unexpected DKG payload variant");

    const publicKey = new Uint8Array(payload.V1.public_key);
    const [dwalletPda] = PublicKey.findProgramAddressSync(
      dwalletPdaSeeds(CURVE_CURVE25519, publicKey),
      IKA_PROGRAM_ID
    );

    return NextResponse.json({
      ok: true,
      dwalletPda: dwalletPda.toBase58(),
      publicKey: Buffer.from(publicKey).toString("hex"),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
