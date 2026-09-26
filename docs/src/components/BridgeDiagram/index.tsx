import type {ReactNode} from 'react';
import styles from './styles.module.css';

type Chain = {
  name: string;
  arrival: string;
  home?: boolean;
};

const chains: Chain[] = [
  {name: 'ホームチェーン', arrival: '決済時に交換済み', home: true},
  {name: 'チェーンB', arrival: 'USDC で着金'},
  {name: 'チェーンC', arrival: 'USDC で着金'},
];

const steps = ['ホームチェーンへ移す', 'JPYC で受け取るなら替える'];

function Icon({children}: {children: ReactNode}): ReactNode {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      {children}
    </svg>
  );
}

const ChainIcon = () => (
  <Icon>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);

const WalletIcon = () => (
  <Icon>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18" />
    <path d="M16 14.5h2" />
  </Icon>
);

const LockIcon = () => (
  <Icon>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

function Arrow({label}: {label?: string}): ReactNode {
  return (
    <div className={styles.arrow}>
      <span className={styles.arrowLine} aria-hidden="true" />
      {label && <span className={styles.arrowLabel}>{label}</span>}
    </div>
  );
}

export default function BridgeDiagram(): ReactNode {
  return (
    <figure className={styles.figure} aria-label="自動ブリッジの流れ">
      <div className={styles.grid}>
        {chains.map((chain) => (
          <div
            key={chain.name}
            className={chain.home ? styles.chainHome : styles.chain}>
            <div className={styles.chainHeader}>
              <span className={styles.chainIcon}>
                <ChainIcon />
              </span>
              <span className={styles.chainName}>{chain.name}</span>
            </div>
            <span className={styles.arrival}>{chain.arrival}</span>
          </div>
        ))}

        <div className={styles.direct}>
          <span className={styles.directLine} aria-hidden="true" />
          <span className={styles.directLabel}>そのまま入る</span>
        </div>

        <div className={styles.bridge}>
          <div className={styles.merge} aria-hidden="true" />
          <Arrow label="閾値か1日1回" />
          {steps.map((step, i) => (
            <div key={step} className={styles.stepGroup}>
              {i > 0 && <Arrow />}
              <div className={styles.step}>{step}</div>
            </div>
          ))}
          <Arrow />
        </div>

        <div className={styles.wallet}>
          <div className={styles.walletName}>
            <WalletIcon />
            <span>本部のウォレット（ホームチェーン）</span>
          </div>
          <div className={styles.walletNote}>
            <LockIcon />
            <span>送り先はこのウォレットに固定</span>
          </div>
        </div>
      </div>
    </figure>
  );
}
