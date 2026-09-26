import type {ReactNode} from 'react';
import styles from './styles.module.css';

type Level = 'Owner' | 'Approver' | 'Viewer';

type Member = {
  role: string;
  level: Level;
  scope: '全店' | '自店';
};

type Unit = {
  name: string;
  kind: 'shop' | 'headquarters';
  members: Member[];
};

const shopMembers: Member[] = [
  {role: '店長', level: 'Viewer', scope: '自店'},
  {role: 'スタッフ', level: 'Viewer', scope: '自店'},
];

const shops: Unit[] = [
  {name: '店舗A', kind: 'shop', members: shopMembers},
  {name: '店舗B', kind: 'shop', members: shopMembers},
];

const headquarters: Unit = {
  name: '本部',
  kind: 'headquarters',
  members: [
    {role: '経営', level: 'Owner', scope: '全店'},
    {role: '会計部', level: 'Approver', scope: '全店'},
  ],
};

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

const PersonIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" />
  </Icon>
);

const ShopIcon = () => (
  <Icon>
    <path d="M3.5 9 5 4h14l1.5 5" />
    <path d="M3.5 9h17a2.8 2.8 0 0 1-5.6 0 2.8 2.8 0 0 1-5.8 0 2.8 2.8 0 0 1-5.6 0" />
    <path d="M5 12v8h14v-8" />
    <path d="M10 20v-4.5h4V20" />
  </Icon>
);

const BuildingIcon = () => (
  <Icon>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15" />
    <path d="M10.5 21v-2.5h3V21" />
  </Icon>
);

const WalletIcon = () => (
  <Icon>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18" />
    <path d="M16 14.5h2" />
  </Icon>
);

function Arrow({label, tall}: {label: string; tall?: boolean}): ReactNode {
  return (
    <div className={tall ? styles.arrowTall : styles.arrow}>
      <span className={styles.arrowLine} aria-hidden="true" />
      <span className={styles.arrowLabel}>{label}</span>
    </div>
  );
}

function UnitCard({unit}: {unit: Unit}): ReactNode {
  const isHeadquarters = unit.kind === 'headquarters';
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>
          {isHeadquarters ? <BuildingIcon /> : <ShopIcon />}
        </span>
        <span className={styles.cardName}>{unit.name}</span>
      </div>
      <div className={styles.wallet}>
        <WalletIcon />
        <span>{unit.name}のウォレット</span>
      </div>
      <ul className={styles.members}>
        {unit.members.map((member) => (
          <li key={member.role} className={styles.member}>
            <span className={styles.avatar}>
              <PersonIcon />
            </span>
            <span className={styles.role}>{member.role}</span>
            <span className={`${styles.level} ${styles[`level${member.level}`]}`}>
              {member.level}
            </span>
            <span className={styles.scope}>{member.scope}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FlowDiagram(): ReactNode {
  return (
    <figure className={styles.figure} aria-label="Bizzet の全体像">
      <div className={styles.customers}>
        {shops.map((shop) => (
          <div key={shop.name} className={styles.customer}>
            <span className={styles.customerAvatar}>
              <PersonIcon />
            </span>
            <span className={styles.customerName}>客</span>
            <Arrow label="支払う" tall />
          </div>
        ))}
      </div>
      <section className={styles.bizzet}>
        <span className={styles.bizzetLabel}>Bizzet</span>
        <div className={styles.grid}>
          {shops.map((shop) => (
            <UnitCard key={shop.name} unit={shop} />
          ))}
        </div>
        <div className={styles.merge} aria-hidden="true" />
        <Arrow label="本部へ集約" />
        <div className={styles.headquarters}>
          <UnitCard unit={headquarters} />
        </div>
      </section>
    </figure>
  );
}
