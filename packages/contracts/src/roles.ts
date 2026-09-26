import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getContractAddress,
  type Hex,
  keccak256,
  parseAbi,
  stringToHex,
  toFunctionSelector,
} from 'viem'
import { sepolia } from './addresses/sepolia.ts'
import { encodeMultiSend, type MultiSendTransaction } from './safe.ts'

// Zodiac Roles v2.1.1 の ABI のうち、bizzet が使う関数だけ。
// 引数の型は Sepolia の mastercopy の検証済みソース（Blockscout、2026年9月27日確認）に合わせている
export const rolesAbi = parseAbi([
  'struct ConditionFlat { uint8 parent; uint8 paramType; uint8 operator; bytes compValue; }',
  'function setUp(bytes initParams)',
  'function owner() view returns (address)',
  'function avatar() view returns (address)',
  'function target() view returns (address)',
  'function assignRoles(address module, bytes32[] roleKeys, bool[] memberOf)',
  'function scopeTarget(bytes32 roleKey, address targetAddress)',
  'function scopeFunction(bytes32 roleKey, address targetAddress, bytes4 selector, ConditionFlat[] conditions, uint8 options)',
  'function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, bytes32 roleKey, bool shouldRevert) returns (bool success)',
])

export const moduleProxyFactoryAbi = parseAbi([
  'function deployModule(address masterCopy, bytes initializer, uint256 saltNonce) returns (address proxy)',
])

const safeModuleAbi = parseAbi([
  'function enableModule(address module)',
  'function isModuleEnabled(address module) view returns (bool)',
])

// Roles v2 の enum の値（contracts/Types.sol の並び）
const ParameterType = { Static: 1, Calldata: 5 } as const
const Operator = { Pass: 0, Matches: 5, EqualTo: 16 } as const
const ExecutionOptions = { None: 0 } as const

// キーパーに与えるロールのキー。Roles v2 のロールは bytes32 の任意の値で区別する
export const SWEEP_ROLE_KEY: Hex = stringToHex('bizzet-sweep', { size: 32 })

const TRANSFER_SELECTOR = toFunctionSelector(
  'function transfer(address to, uint256 amount)',
)

// Roles の proxy のソルト。店舗の Safe のアドレスをそのまま使い、Safe のアドレスだけから
// Roles のアドレスが決まるようにする（DB に Roles のアドレスを別に持たずに済む）
function rolesSaltNonce(safe: Address) {
  return BigInt(safe)
}

// Roles の setUp の引数。owner・avatar・target をすべて店舗の Safe にし、
// 権限の変更は店舗の Safe の取引（本部の2人承認）でしか行えないようにする
function encodeRolesInitializer(safe: Address) {
  return encodeFunctionData({
    abi: rolesAbi,
    functionName: 'setUp',
    args: [
      encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
        [safe, safe, safe],
      ),
    ],
  })
}

// ModuleProxyFactory の deployModule と同じ CREATE2 の計算で、配置前の Roles のアドレスを求める。
// 同じ取引の中で、配置した Roles に続けて権限を設定するため、先にアドレスが要る
export function predictRolesAddress(safe: Address) {
  return getContractAddress({
    opcode: 'CREATE2',
    from: sepolia.roles.moduleProxyFactory,
    salt: keccak256(
      encodePacked(
        ['bytes32', 'uint256'],
        [keccak256(encodeRolesInitializer(safe)), rolesSaltNonce(safe)],
      ),
    ),
    bytecode: encodePacked(
      ['bytes', 'address', 'bytes'],
      [
        '0x602d8060093d393df3363d3d373d3d3d363d73',
        sepolia.roles.mastercopy,
        '0x5af43d82803e903d91602b57fd5bf3',
      ],
    ),
  })
}

// transfer(to, amount) のうち、to が本部の Safe のものだけを通す条件。
// 木を幅優先で平らにした並びで、先頭が calldata 全体、続く2つが第1・第2引数
function transferToConditions(recipient: Address) {
  return [
    {
      parent: 0,
      paramType: ParameterType.Calldata,
      operator: Operator.Matches,
      compValue: '0x',
    },
    {
      parent: 0,
      paramType: ParameterType.Static,
      operator: Operator.EqualTo,
      compValue: encodeAbiParameters([{ type: 'address' }], [recipient]),
    },
    {
      parent: 0,
      paramType: ParameterType.Static,
      operator: Operator.Pass,
      compValue: '0x',
    },
  ] as const
}

export type RolesSetup = {
  // Roles を入れる店舗の Safe
  safe: Address
  // ロールを与えるキーパーの送信元アドレス
  keeper: Address
  // 送金の宛先として許す、本部の Safe
  recipient: Address
  // 送金を許す通貨のコントラクト
  tokens: readonly Address[]
}

// 店舗の Safe の最初の取引の中身。Roles の配置・権限の設定・モジュールとしての有効化を
// MultiSendCallOnly にまとめ、Safe から delegatecall で呼ぶ。MultiSendCallOnly の中の呼び出しは
// すべて Safe からの call になるため、Roles の owner（Safe）だけが呼べる設定と、
// Safe 自身だけが呼べる enableModule を1つの取引で行える
export function encodeRolesSetup({
  safe,
  keeper,
  recipient,
  tokens,
}: RolesSetup) {
  const roles = predictRolesAddress(safe)
  const call = (to: Address, data: Hex): MultiSendTransaction => ({
    operation: 0,
    to,
    value: 0n,
    data,
  })
  const transactions: MultiSendTransaction[] = [
    call(
      sepolia.roles.moduleProxyFactory,
      encodeFunctionData({
        abi: moduleProxyFactoryAbi,
        functionName: 'deployModule',
        args: [
          sepolia.roles.mastercopy,
          encodeRolesInitializer(safe),
          rolesSaltNonce(safe),
        ],
      }),
    ),
    call(
      roles,
      encodeFunctionData({
        abi: rolesAbi,
        functionName: 'assignRoles',
        args: [keeper, [SWEEP_ROLE_KEY], [true]],
      }),
    ),
    ...tokens.flatMap((token) => [
      call(
        roles,
        encodeFunctionData({
          abi: rolesAbi,
          functionName: 'scopeTarget',
          args: [SWEEP_ROLE_KEY, token],
        }),
      ),
      call(
        roles,
        encodeFunctionData({
          abi: rolesAbi,
          functionName: 'scopeFunction',
          args: [
            SWEEP_ROLE_KEY,
            token,
            TRANSFER_SELECTOR,
            transferToConditions(recipient),
            // ETH の送付も delegatecall も許さない
            ExecutionOptions.None,
          ],
        }),
      ),
    ]),
    call(
      safe,
      encodeFunctionData({
        abi: safeModuleAbi,
        functionName: 'enableModule',
        args: [roles],
      }),
    ),
  ]
  return {
    roles,
    // Safe の execTransaction に渡す中身
    to: sepolia.safe.multiSendCallOnly as Address,
    value: 0n,
    data: encodeMultiSend(transactions),
    operation: 1 as const,
  }
}

export { safeModuleAbi }
