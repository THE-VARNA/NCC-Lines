/**
 * POST /api/encrypt/create-input
 *
 * Calls Encrypt executor gRPC `CreateInput` server-side (Node.js only).
 * Body: { value: number, fheType?: number, authorized: string (hex 32-byte), networkKey: string (hex 32-byte) }
 * Returns: { ciphertextIdentifier: string (hex), ok: true }
 *
 * The executor handles creating and committing the ciphertext on-chain.
 * In pre-alpha, data is stored as plaintext — no real FHE yet.
 */

import * as grpc from "@grpc/grpc-js";
import { NextRequest, NextResponse } from "next/server";

const GRPC_URL = "pre-alpha-dev-1.encrypt.ika-network.net:443";

// ── Minimal proto encoder ────────────────────────────────────────────────────

function varint(n: number): Buffer {
  const b: number[] = [];
  while (n > 127) { b.push((n & 0x7f) | 0x80); n >>>= 7; }
  b.push(n);
  return Buffer.from(b);
}

function fieldBytes(fieldNum: number, data: Buffer): Buffer {
  const tag = varint((fieldNum << 3) | 2);
  return Buffer.concat([tag, varint(data.length), data]);
}

function fieldVarint(fieldNum: number, value: number): Buffer {
  return Buffer.concat([varint((fieldNum << 3) | 0), varint(value)]);
}

/**
 * Encode CreateInputRequest proto (matches encrypt_service.proto):
 *   1: chain (varint, SOLANA=0)
 *   2: inputs (repeated EncryptedInput):
 *      1: ciphertext_bytes (bytes, 16-byte LE value)
 *      2: fhe_type (varint, 4 = EUint64)
 *   3: proof (bytes, empty in dev mode)
 *   4: authorized (bytes, 32 — program/user that can use this ciphertext)
 *   5: network_encryption_public_key (bytes, 32)
 */
function encodeCreateInputRequest(
  value: bigint,
  fheType: number,
  authorized: Buffer,
  networkKey: Buffer
): Buffer {
  // 16-byte little-endian encoding of value
  const ctBytes = Buffer.alloc(16);
  let v = value;
  for (let i = 0; i < 16; i++) { ctBytes[i] = Number(v & 0xffn); v >>= 8n; }

  // EncryptedInput embedded message
  const inputMsg = Buffer.concat([
    fieldBytes(1, ctBytes),
    fieldVarint(2, fheType),
  ]);

  return Buffer.concat([
    fieldVarint(1, 0),               // chain = SOLANA (enum 0)
    fieldBytes(2, inputMsg),         // inputs[0]
    fieldBytes(3, Buffer.alloc(0)),  // proof = empty (dev mode skips validation)
    fieldBytes(4, authorized),       // authorized (32 bytes)
    fieldBytes(5, networkKey),       // network_encryption_public_key (32 bytes)
  ]);
}


/**
 * Decode CreateInputResponse proto:
 *   1: ciphertextIdentifiers (repeated bytes)
 * Returns first identifier as hex string.
 */
function decodeCreateInputResponse(buf: Buffer): string {
  let i = 0;
  while (i < buf.length) {
    const tagByte = buf[i++];
    const fieldNum = tagByte >> 3;
    const wireType = tagByte & 0x07;
    if (wireType === 2) {
      // Read varint length
      let len = 0, shift = 0;
      while (true) { const b = buf[i++]; len |= (b & 0x7f) << shift; if (!(b & 0x80)) break; shift += 7; }
      if (fieldNum === 1) return buf.slice(i, i + len).toString("hex");
      i += len;
    } else if (wireType === 0) {
      while (buf[i++] & 0x80) {}
    } else break;
  }
  throw new Error("No ciphertextIdentifier in response");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { value, fheType = 4, authorized, networkKey } = body;

    const authorizedBuf = Buffer.from(authorized, "hex");
    const networkKeyBuf = Buffer.from(networkKey, "hex");
    const valueBig = BigInt(Math.round(value));

    if (authorizedBuf.length !== 32) throw new Error("authorized must be 32 bytes hex");
    if (networkKeyBuf.length !== 32) throw new Error("networkKey must be 32 bytes hex");

    const requestBuf = encodeCreateInputRequest(valueBig, fheType, authorizedBuf, networkKeyBuf);

    const ciphertextIdentifier = await new Promise<string>((resolve, reject) => {
      const creds = grpc.credentials.createSsl();
      const client = new grpc.Client(GRPC_URL, creds);

      client.makeUnaryRequest(
        "/encrypt.v1.EncryptService/CreateInput",
        (x: Buffer) => x,
        (x: Buffer) => x,
        requestBuf,
        new grpc.Metadata(),
        { deadline: Date.now() + 15_000 },
        (err: grpc.ServiceError | null, resp?: Buffer) => {
          client.close();
          if (err) reject(new Error(`Encrypt gRPC error ${err.code}: ${err.details}`));
          else {
            try { resolve(decodeCreateInputResponse(resp!)); }
            catch { resolve(resp!.toString("hex").slice(0, 64)); }
          }
        }
      );
    });

    return NextResponse.json({ ok: true, ciphertextIdentifier });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
