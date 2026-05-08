use encrypt_pinocchio;
fn main() {
    println!("Encrypt CPI seed: {:?}", std::str::from_utf8(encrypt_pinocchio::CPI_AUTHORITY_SEED).unwrap_or("not utf8"));
}
