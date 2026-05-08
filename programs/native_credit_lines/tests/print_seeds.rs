// Print known Encrypt CPI authority seed for debugging.
//
// CPI_AUTHORITY_SEED was removed from the public encrypt_pinocchio crate in pre-alpha.
// The seed value is documented in the Encrypt SDK README as b"encrypt_cpi_authority".
fn main() {
    let seed: &[u8] = b"encrypt_cpi_authority";
    println!("Encrypt CPI seed: {:?}", std::str::from_utf8(seed).unwrap_or("not utf8"));
    println!("Seed bytes: {:?}", seed);
}
