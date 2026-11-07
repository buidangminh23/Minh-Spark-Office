use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
use std::{env, fs};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 5 {
        return Err("Expected artifact, signature, public key and version".into());
    }
    let artifact = fs::read(&args[1])?;
    let encoded_signature = fs::read_to_string(&args[2])?;
    let signature_text = String::from_utf8(STANDARD.decode(encoded_signature.trim())?)?;
    let public_key_text = String::from_utf8(STANDARD.decode(args[3].trim())?)?;
    let public_key = PublicKey::decode(&public_key_text)?;
    let signature = Signature::decode(&signature_text)?;
    public_key.verify(&artifact, &signature, true)?;
    let signed_version = signature
        .trusted_comment()
        .split('\t')
        .find_map(|field| field.strip_prefix("version:"));
    if signed_version != Some(args[4].as_str()) {
        return Err("Updater signature does not bind the expected version".into());
    }
    println!("Updater signature verified");
    Ok(())
}
