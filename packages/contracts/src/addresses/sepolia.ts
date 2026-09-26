import type { Address } from 'viem'

// Sepolia に配置済みのコントラクト。どれも Bizzet は配置せず、公式の配置をそのまま使う。
// 出典はそれぞれの公式の配置一覧。test/addresses.ts で、fork 上にバイトコードがあることを確かめる。
export const sepolia = {
  chainId: 11155111,

  // safe-deployments v1.4.1
  safe: {
    singletonL2: '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762',
    proxyFactory: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
    fallbackHandler: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
    multiSendCallOnly: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
  },

  // safe-modules-deployments safe-4337-module v0.3.0
  safe4337: {
    module: '0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226',
    moduleSetup: '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47',
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  },

  // safe-modules-deployments safe-passkey-module v0.2.1
  passkey: {
    signerFactory: '0x1d31F259eE307358a26dFb23EB365939E8641195',
    sharedSigner: '0x94a4F6affBd8975951142c3999aEAB7ecee555c2',
    // RIP-7212 / EIP-7951 のプリコンパイル。Fusaka（2025-10-14）で Sepolia に入った
    p256Precompile: '0x0000000000000000000000000000000000000100',
    // プリコンパイルが使えないときの代替
    p256Fallback: '0xc2b78104907F722DABAc4C69f826a522B2754De4',
  },

  // gnosisguild/zodiac。v2.1.0 は不具合ありとされているため v2.1.1 を使う
  roles: {
    mastercopy: '0xf2964ce6161ce0e75964fe7927ce114cb0b283d5',
    moduleProxyFactory: '0x000000000000aDdB49795b0f9bA5BC298cDda236',
  },

  tokens: {
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    jpyc: '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29',
  },
} as const satisfies {
  chainId: number
  [group: string]: number | Record<string, Address>
}
