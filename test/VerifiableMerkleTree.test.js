const { expect } = require('chai');
const { deploy, deployBytes } = require('../scripts/hardhat.utils.js');
const { fullProve, verify } = require('snarkjs').groth16;
const { toFieldElement } = require('twister-ethers').zkUtils;
const calculateSubtrees = require('../scripts/calculateSubtrees');

const MerkleTreeWithHistory = require('../build/MerkleTreeWithHistory.json');
const updateVerifier = require('../circuits/out/update_verifier.json');
const massUpdateVerifier = require('../circuits/out/mass_update_verifier.json');

describe('[START] - VerifiableMerkleTree.test.js', function() {
    beforeEach(async () => {
        this.merkleTreeWithHistory = await deployBytes(
            'MerkleTreeWithHistory',
            [],
            MerkleTreeWithHistory.bytecode
        );
        this.incrementalTree = await deploy("MerkleTree", [], {
            MerkleTreeLib: this.merkleTreeWithHistory.address
        });

        this.verifiableTree = await deploy("VerifiableMerkleTree");

        this.getFilledSubtrees = async function(tree) {
            const filledSubtrees=[];
            for (let i = 0; i < 20; i++) {
                filledSubtrees.push(
                    (await tree.filledSubtrees(i)).toString()
                );
            }
            return filledSubtrees.map(toFieldElement);
        };

        this.commitments = [
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
        this.startSubtrees = calculateSubtrees(20, []);
        this.endSubtrees = calculateSubtrees(20, this.commitments);
        this.singleEndSubtrees = calculateSubtrees(20, [this.commitments[0]]);
    });

    it('should insert 1 leaf to the incremental merkle tree', async () => {
        const incrementalStartSubtrees = await this.getFilledSubtrees(this.incrementalTree);
        incrementalStartSubtrees.forEach((subtree, i) => {
            expect(subtree).to.be.equal(this.startSubtrees[i]);
        })

        await this.incrementalTree.insert(this.commitments[0]);

        incrementalEndSubtrees = await this.getFilledSubtrees(this.incrementalTree);
        incrementalEndSubtrees.forEach((subtree, i) => {
            expect(subtree).to.be.equal(this.singleEndSubtrees[i]);
        });
    });

    it('should generate a zero knowledge proof for a single deposit', async () => {
        console.time('update proof');
        const input = {
            index: toFieldElement(0),
            leaf: toFieldElement(this.commitments[0]),
            filledSubtrees: this.startSubtrees,
            newSubtrees: this.singleEndSubtrees
        };
        this.updateProof = await fullProve(
            input,
            "./circuits/out/update.wasm",
            "./circuits/out/update_final.zkey"
        );
        console.timeEnd('update proof');
        const result = await verify(
            updateVerifier,
            this.updateProof.publicSignals,
            this.updateProof.proof
        );
        expect(result).to.be.true;
    });

    it('should update the VerifiableMerkleTree for a single deposit', async () => {
        const { proof } = this.updateProof;
        const p = [
            proof.pi_a[0], proof.pi_a[1], proof.pi_b[0][1], proof.pi_b[0][0],
            proof.pi_b[1][1], proof.pi_b[1][0], proof.pi_c[0], proof.pi_c[1]
        ];

        const verifiableStartSubtrees = await this.getFilledSubtrees(this.verifiableTree);
        verifiableStartSubtrees.forEach((subtree, i) => {
            expect(subtree).to.be.equal(this.startSubtrees[i]);
        });

        await this.verifiableTree.update(
            p,
            this.commitments[0],
            this.singleEndSubtrees
        );

        verifiableSingleEndSubtrees = await this.getFilledSubtrees(this.verifiableTree);
        verifiableSingleEndSubtrees.forEach((subtree, i) => {
            expect(subtree).to.be.equal(this.singleEndSubtrees[i]);
        })

    });

    it('should insert 10 leaves to the incremental merkle tree', async () => {
        const incrementalStartSubtrees = await this.getFilledSubtrees(this.incrementalTree);
        incrementalStartSubtrees.forEach((subtree, i) => {
            expect(subtree).to.be.equal(this.startSubtrees[i]);
        })

        this.commitments.forEach(async commitment => {
            await this.incrementalTree.insert(commitment);
        });

        incrementalEndSubtrees = await this.getFilledSubtrees(this.incrementalTree);
        incrementalEndSubtrees.forEach((subtree, i) => {
            expect(subtree).to.be.equal(this.endSubtrees[i]);
        });
    });

    it('should generate a zero knowledge proof for 10 leaves', async() => {
        console.time('mass update proof');
        const input = {
            startIndex: toFieldElement(0),
            leaves: this.commitments.map(toFieldElement),
            startSubtrees: this.startSubtrees,
            endSubtrees: this.endSubtrees,
        };
        this.massUpdateProof = await fullProve(
            input,
            "./circuits/out/mass_update.wasm",
            "./circuits/out/mass_update_final.zkey"
        );
        console.timeEnd('mass update proof');
        const result = await verify(
            massUpdateVerifier,
            this.massUpdateProof.publicSignals,
            this.massUpdateProof.proof
        );
        expect(result).to.be.true;
    });

    it('should update the VerifiableMerkleTree for 10 deposits', async () => {
        const { proof } = this.massUpdateProof;
        const p = [
            proof.pi_a[0], proof.pi_a[1], proof.pi_b[0][1], proof.pi_b[0][0],
            proof.pi_b[1][1], proof.pi_b[1][0], proof.pi_c[0], proof.pi_c[1]
        ];

        const verifiableStartSubtrees = await this.getFilledSubtrees(this.verifiableTree);
        verifiableStartSubtrees.forEach((subtree, i) => {
            expect(subtree).to.be.equal(this.startSubtrees[i]);
        })

        await this.verifiableTree.massUpdate(
            p,
            this.commitments,
            this.endSubtrees
        );

        verifiableEndSubtrees = await this.getFilledSubtrees(this.verifiableTree);
        verifiableEndSubtrees.forEach((subtree, i) => {
            expect(subtree).to.be.equal(this.endSubtrees[i]);
        })

    });
});