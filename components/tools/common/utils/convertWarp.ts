// FIXME: this is a quick hack solution untill AvalancheJS supports this
// Please don't copy this code to other projects!
import { sha256 } from '@noble/hashes/sha256';
import { cb58ToBytes } from "../../common/utils/cb58";
import { bytesToHex, hexToBytes } from 'viem';

export interface PackL1ConversionMessageArgs {
    subnetId: string;
    managerChainID: string;
    managerAddress: `0x${string}`;
    validators: SubnetToL1ConversionValidatorData[];
}

interface SubnetToL1ConversionValidatorData {
    nodeID: string;
    nodePOP: {
        publicKey: `0x${string}`;
        proofOfPossession: `0x${string}`;
    };
}

const BootstrapValidatorWeight = 100n;
const codecVersion = 0;

const encodeUint16 = (num: number): Uint8Array => encodeNumber(num, 2);
const encodeUint32 = (num: number): Uint8Array => encodeNumber(num, 4);
const encodeUint64 = (num: bigint): Uint8Array => encodeNumber(num, 8);


function encodeNumber(num: number | bigint, numberBytes: number): Uint8Array {
    const arr = new Uint8Array(numberBytes);
    const isBigInt = typeof num === 'bigint';
    let value = isBigInt ? num : BigInt(num);

    for (let i = numberBytes - 1; i >= 0; i--) {
        arr[i] = Number(value & 0xffn);
        value = value >> 8n;
    }
    return arr;
}

function encodeVarBytes(bytes: Uint8Array): Uint8Array {
    const lengthBytes = encodeUint32(bytes.length);
    const result = new Uint8Array(lengthBytes.length + bytes.length);
    result.set(lengthBytes);
    result.set(bytes, lengthBytes.length);
    return result;
}

function concatenateUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

export function marshalSubnetToL1ConversionData(args: PackL1ConversionMessageArgs): Uint8Array {
    const parts: Uint8Array[] = [];

    parts.push(encodeUint16(codecVersion));
    parts.push(cb58ToBytes(args.subnetId));
    parts.push(cb58ToBytes(args.managerChainID));
    parts.push(encodeVarBytes(hexToBytes(args.managerAddress)));
    parts.push(encodeUint32(args.validators.length));

    for (const validator of args.validators) {
        if (!validator.nodeID || !validator.nodePOP) {
            throw new Error(`Invalid validator data: ${JSON.stringify(validator)}`);
        }
        parts.push(encodeVarBytes(cb58ToBytes(validator.nodeID.split("-")[1])));
        parts.push(hexToBytes(validator.nodePOP.publicKey));
        parts.push(encodeUint64(BootstrapValidatorWeight));
    }

    const result = concatenateUint8Arrays(...parts);
    return result;
}

export function subnetToL1ConversionID(args: PackL1ConversionMessageArgs): Uint8Array {
    const data = marshalSubnetToL1ConversionData(args);
    return sha256(data);
}

export function newAddressedCall(sourceAddress: Uint8Array, payload: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];

    parts.push(encodeUint16(codecVersion));
    parts.push(encodeUint32(1));//FIXME: I have zero idea what this is, but every time it is "00000001"
    parts.push(encodeVarBytes(sourceAddress));
    parts.push(encodeVarBytes(payload));

    return concatenateUint8Arrays(...parts);
}

export function newSubnetToL1Conversion(subnetConversionID: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];

    // Add codec version (uint16)
    parts.push(encodeUint16(codecVersion));

    // Add empty source address length (uint32)
    parts.push(encodeUint32(0));

    // Add subnetConversionID
    parts.push(subnetConversionID);

    return concatenateUint8Arrays(...parts);
}

export function newUnsignedMessage(networkID: number, sourceChainID: string, message: Uint8Array): Uint8Array {
    const parts: Uint8Array[] = [];

    // Add codec version (uint16)
    parts.push(encodeUint16(codecVersion));

    // Add networkID (uint32)
    parts.push(encodeUint32(networkID));

    // Add sourceChainID
    parts.push(cb58ToBytes(sourceChainID));

    // Add message length and message
    parts.push(encodeUint32(message.length));
    parts.push(message);

    return concatenateUint8Arrays(...parts);
}

export function packL1ConversionMessage(args: PackL1ConversionMessageArgs, networkID: number, sourceChainID: string): [Uint8Array, Uint8Array] {
    const subnetConversionID = subnetToL1ConversionID(args);

    const addressedCallPayload = newSubnetToL1Conversion(subnetConversionID)

    const subnetConversionAddressedCall = newAddressedCall(new Uint8Array([]), addressedCallPayload)

    const unsignedMessage = newUnsignedMessage(networkID, sourceChainID, subnetConversionAddressedCall);
    return [unsignedMessage, cb58ToBytes(args.subnetId)];
}
