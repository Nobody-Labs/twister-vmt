const { fullProve, verify } = require('snarkjs').groth16;
const { toFieldElement } = require('twister-ethers').zkUtils;
const calculateSubtrees = require('./calculateSubtrees');
const massUpdateVerifier = require('../circuits/out/mass_update_verifier.json');

async function main() {
    const leaves = [
        "0x198622acbd783d1b0d9064105b1fc8e4d8889de95c4c519b3f635809fe6afc05",
        "0x29d7ed391256ccc3ea596c86e933b89ff339d25ea8ddced975ae2fe30b5296d4",
        "0x19be59f2f0413ce78c0c3703a3a5451b1d7f39629fa33abd11548a76065b2967",
        "0x1ff3f61797e538b70e619310d33f2a063e7eb59104e112e95738da1254dc3453",
        "0x10c16ae9959cf8358980d9dd9616e48228737310a10e2b6b731c1a548f036c48",
        "0x0ba433a63174a90ac20992e75e3095496812b652685b5e1a2eae0b1bf4e8fcd1",
        "0x019ddb9df2bc98d987d0dfeca9d2b643deafab8f7036562e627c3667266a044c",
        "0x2d3c88b23175c5a5565db928414c66d1912b11acf974b2e644caaac04739ce99",
        "0x2eab55f6ae4e66e32c5189eed5c470840863445760f5ed7e7b69b2a62600f354",
        "0x002df37a2642621802383cf952bf4dd1f32e05433beeb1fd41031fb7eace979d"
    ];
    const startSubtrees = calculateSubtrees(20, []);
    const endSubtrees = calculateSubtrees(20, leaves);
    const input = {
        startIndex: toFieldElement(0),
        leaves: leaves.map(toFieldElement),
        startSubtrees: startSubtrees,
        endSubtrees: endSubtrees,
    };
    const massUpdateProof = await fullProve(
        input,
        "./circuits/out/mass_update.wasm",
        "./circuits/out/mass_update_final.zkey"
    );
    const result = await verify(
        massUpdateVerifier,
        massUpdateProof.publicSignals,
        massUpdateProof.proof
    );
    console.log(result);
}

main().then(() => process.exit())