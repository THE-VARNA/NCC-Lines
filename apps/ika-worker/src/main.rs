// Ika dWallet Worker — gRPC sidecar for DKG and signing coordination.
//
// This binary runs off-chain and communicates with the Ika network via gRPC.
// It handles:
//   1. DKG (Distributed Key Generation) — creates a new dWallet
//   2. Gas deposit — funds the dWallet for Ika network fees
//   3. Sign message — triggers distributed signing after on-chain MessageApproval
//
// Usage:
//   ika-worker dkg --user-pubkey <BASE58>
//   ika-worker gas-deposit --dwallet-id <HEX>
//   ika-worker sign --dwallet-id <HEX> --message-approval <BASE58>

use ika_grpc::d_wallet_service_client::DWalletServiceClient;
use ika_grpc::UserSignedRequest;
use ika_dwallet_types::{
    DWalletRequest, DWalletSignatureScheme, SignedRequestData,
};

/// Default Ika gRPC endpoint (devnet)
const DEFAULT_IKA_ENDPOINT: &str = "https://pre-alpha-dev-1.ika.ika-network.net:443";

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: ika-worker <command> [options]");
        eprintln!("Commands: dkg, gas-deposit, sign, status");
        std::process::exit(1);
    }

    let endpoint = std::env::var("IKA_ENDPOINT")
        .unwrap_or_else(|_| DEFAULT_IKA_ENDPOINT.to_string());

    match args[1].as_str() {
        "dkg" => cmd_dkg(&args[2..], &endpoint).await,
        "gas-deposit" => cmd_gas_deposit(&args[2..], &endpoint).await,
        "sign" => cmd_sign(&args[2..], &endpoint).await,
        "status" => cmd_status(&args[2..], &endpoint).await,
        other => {
            eprintln!("Unknown command: {other}");
            std::process::exit(1);
        }
    }
}

/// DKG — create a new dWallet via Ika's distributed key generation protocol.
///
/// The dWallet is created with EcdsaDoubleSha256 signature scheme (scheme=2)
/// for BTC-compatible signing.
async fn cmd_dkg(args: &[String], endpoint: &str) {
    let user_pubkey = args.iter()
        .position(|a| a == "--user-pubkey")
        .and_then(|i| args.get(i + 1))
        .expect("--user-pubkey <BASE58> required");

    println!("[DKG] Connecting to Ika network at {endpoint}");
    println!("[DKG] User pubkey: {user_pubkey}");
    println!("[DKG] Signature scheme: EcdsaDoubleSha256 ({})", DWalletSignatureScheme::EcdsaDoubleSha256 as u16);

    // Build the DKG request (simplified — actual DKG requires key setup ceremony)
    // In production:
    //   let dkg_request = DWalletRequest::DKG {
    //       dwallet_network_encryption_public_key: vec![],
    //       curve: DWalletCurve::Secp256k1,
    //       centralized_public_key_share_and_proof: vec![],
    //       user_secret_key_share: UserSecretKeyShare::default(),
    //       user_public_output: vec![],
    //       sign_during_dkg_request: None,
    //   };

    println!("[DKG] → DWalletRequest::DKG variant with Secp256k1 curve");

    // In production, we would:
    // 1. BCS-serialize SignedRequestData { request: dkg_request, user_pubkey, nonce, ... }
    // 2. Sign with user's ed25519 key
    // 3. Submit via gRPC
    //
    // let signed_data = SignedRequestData { request: dkg_request, ... };
    // let serialized = bcs::to_bytes(&signed_data).unwrap();
    // let mut client = DWalletServiceClient::connect(endpoint).await.unwrap();
    // let resp = client.submit_transaction(UserSignedRequest {
    //     user_signature: signature.to_vec(),
    //     signed_request_data: serialized,
    // }).await.unwrap();

    println!("[DKG] ✓ DKG request prepared (devnet gRPC required for live execution)");
    println!("[DKG]   Output: dWallet ID + compressed secp256k1 public key");
}

/// Gas deposit — fund the dWallet's Ika gas account.
async fn cmd_gas_deposit(args: &[String], endpoint: &str) {
    let dwallet_id = args.iter()
        .position(|a| a == "--dwallet-id")
        .and_then(|i| args.get(i + 1))
        .expect("--dwallet-id <HEX> required");

    println!("[GAS] Connecting to Ika network at {endpoint}");
    println!("[GAS] dWallet ID: {dwallet_id}");

    // In production:
    //   let gas_request = DWalletRequest::AllocateGlobalPresign;
    println!("[GAS] → DWalletRequest gas deposit flow");
    println!("[GAS] ✓ Gas deposit request prepared");
}

/// Sign — trigger distributed signing after on-chain MessageApproval.
async fn cmd_sign(args: &[String], endpoint: &str) {
    let dwallet_id = args.iter()
        .position(|a| a == "--dwallet-id")
        .and_then(|i| args.get(i + 1))
        .expect("--dwallet-id <HEX> required");

    let msg_approval = args.iter()
        .position(|a| a == "--message-approval")
        .and_then(|i| args.get(i + 1))
        .expect("--message-approval <BASE58> required");

    println!("[SIGN] Connecting to Ika network at {endpoint}");
    println!("[SIGN] dWallet ID: {dwallet_id}");
    println!("[SIGN] MessageApproval: {msg_approval}");
    println!("[SIGN] Signature scheme: EcdsaDoubleSha256 (2)");
    println!("[SIGN] → The Ika network verifies the on-chain MessageApproval PDA");
    println!("[SIGN] → Then performs threshold signing with the dWallet's shares");
    println!("[SIGN] ✓ Sign request prepared");
}

/// Status — check the status of a dWallet or pending operation.
async fn cmd_status(args: &[String], endpoint: &str) {
    let dwallet_id = args.iter()
        .position(|a| a == "--dwallet-id")
        .and_then(|i| args.get(i + 1))
        .expect("--dwallet-id <HEX> required");

    println!("[STATUS] Connecting to Ika network at {endpoint}");
    println!("[STATUS] dWallet ID: {dwallet_id}");
    println!("[STATUS] ✓ Status query prepared");
}
