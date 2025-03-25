"use client";

import { useToolboxStore, useViemChainStore, useWalletStore } from "../../utils/store";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../../components/button";
import { ResultField } from "../../../components/result-field";
import ValidatorManagerABI from "../../../../contracts/icm-contracts/compiled/ValidatorManager.json";
import { RequireChainL1 } from "../../ui/RequireChain";
import { Container } from "../../../components/container";
import { Input } from "../../../components";
import { TransactionReceipt } from "viem";
export default function TransferOwnership() {
    const { showBoundary } = useErrorBoundary();
    const { stakingManagerAddress, validatorManagerAddress, setStakingManagerAddress, setValidatorManagerAddress } = useToolboxStore();
    const { coreWalletClient, publicClient } = useWalletStore();
    const [isTransferring, setIsTransferring] = useState(false);
    const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
    const viemChain = useViemChainStore();

    async function handleDeploy() {
        setIsTransferring(true);
        try {
            const hash = await coreWalletClient.writeContract({
                to: validatorManagerAddress,
                abi: ValidatorManagerABI.abi,
                functionName: 'transferOwnership',
                args: [stakingManagerAddress],
                chain: viemChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (!receipt.status || receipt.status !== 'success') {
                throw new Error('Transfer failed');
            }

            setReceipt(receipt);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsTransferring(false);
        }
    }


    return (
        <RequireChainL1>
            <Container
                title="Transfer Validator Manager Ownership"
                description="This will transfer the ownership of the Validator Manager to the Staking Manager."
            >
                <div className="space-y-4"> 
                    <div className="mb-4">
                        <Input          
                            id="validatorManagerAddress"
                            type="text"
                            label="Validator Manager Address"
                            value={validatorManagerAddress}
                            onChange={(e) => setValidatorManagerAddress(e)}
                            className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                        />
                        <Input          
                            id="stakingManagerAddress"
                            type="text"
                            label="Staking Manager Address"
                            value={stakingManagerAddress}
                            onChange={(e) => setStakingManagerAddress(e)}
                            className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                        />
                    </div>
                    <Button
                        variant="primary"
                        onClick={handleDeploy}
                        loading={isTransferring}
                        disabled={isTransferring}
                    >
                        Transfer Ownership
                    </Button>
                </div>
                {receipt && (
                    <ResultField
                        label="Transaction Hash"
                        value={receipt.transactionHash}
                        showCheck={!!receipt.transactionHash}
                    />
                )}
            </Container>
        </RequireChainL1>
    );
};

