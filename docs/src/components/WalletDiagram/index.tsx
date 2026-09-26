import type { ReactNode } from 'react'
import styles from './styles.module.css'

function Icon({ children }: { children: ReactNode }): ReactNode {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const WalletIcon = () => (
  <Icon>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18" />
    <path d="M16 14.5h2" />
  </Icon>
)

const KeyIcon = () => (
  <Icon>
    <circle cx="8" cy="15" r="4" />
    <path d="M10.8 12.2 20 3" />
    <path d="M17 6l3 3" />
  </Icon>
)

const UserIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
)

function Arrow({
  label,
  head = true,
}: {
  label?: string
  head?: boolean
}): ReactNode {
  return (
    <div className={styles.arrow}>
      <span
        className={head ? styles.arrowLine : styles.line}
        aria-hidden="true"
      />
      {label && <span className={styles.arrowLabel}>{label}</span>}
    </div>
  )
}

type Owner = { title: string; role: string }

const owners: Owner[] = [
  { title: '経営', role: 'Owner' },
  { title: '会計部', role: 'Approver' },
]

const stores = [
  { id: 'store-a', name: '店舗の Safe' },
  { id: 'store-b', name: '店舗の Safe' },
]

export function DeploymentDiagram(): ReactNode {
  return (
    <figure className={styles.figure} aria-label="Safe の上下関係">
      <div className={styles.stack}>
        <div className={styles.row}>
          {owners.map((owner) => (
            <div key={owner.title} className={styles.member}>
              <span className={styles.memberIcon}>
                <UserIcon />
              </span>
              <span className={styles.memberTitle}>{owner.title}</span>
              <span className={styles.chip}>{owner.role}</span>
              <span className={styles.signer}>
                <KeyIcon />
                パスキー署名者
              </span>
            </div>
          ))}
        </div>

        <div className={styles.merge} aria-hidden="true" />
        <Arrow label="オーナーになる" />

        <div className={styles.safeHq}>
          <span className={styles.safeName}>
            <WalletIcon />
            本部の Safe
          </span>
          <span className={styles.threshold}>しきい値 2</span>
        </div>

        <Arrow label="オーナーになる" head={false} />
        <div className={styles.split} aria-hidden="true" />

        <div className={styles.row}>
          {stores.map((store) => (
            <div key={store.id} className={styles.safe}>
              <span className={styles.safeName}>
                <WalletIcon />
                {store.name}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.viewer}>
          <UserIcon />
          <span>店長・スタッフ（Viewer）はオンチェーンに何も持たない</span>
        </div>
      </div>
    </figure>
  )
}

type Box = {
  x: number
  y: number
  w: number
  h: number
  title: string
  lines?: string[]
  strong?: boolean
}

// 座標は、帯の見出しの列を除いた 760 × 500 の上の値
const boxes: Box[] = [
  {
    x: 230,
    y: 24,
    w: 180,
    h: 52,
    title: 'ウォレットアプリ',
    lines: ['パスキーで署名'],
  },
  {
    x: 35,
    y: 152,
    w: 180,
    h: 52,
    title: 'Gelato（キーパー）',
    lines: ['閾値か1日1回で起動'],
  },
  {
    x: 255,
    y: 152,
    w: 130,
    h: 52,
    title: 'バンドラー',
    lines: ['取引をまとめて送る'],
  },
  {
    x: 440,
    y: 152,
    w: 130,
    h: 52,
    title: 'Paymaster',
    lines: ['ガス代を肩代わり'],
  },
  {
    x: 590,
    y: 128,
    w: 160,
    h: 104,
    title: 'Bizzet のバックエンド',
    lines: [
      'パスキーの対応表',
      '2人承認の途中の署名',
      '閲覧権限・招待',
      'Paymaster の API キー',
    ],
    strong: true,
  },
  {
    x: 40,
    y: 300,
    w: 170,
    h: 56,
    title: 'Zodiac Roles v2',
    lines: ['Sweep だけを許可'],
  },
  {
    x: 250,
    y: 300,
    w: 140,
    h: 56,
    title: 'EntryPoint v0.7',
    lines: ['取引の入り口'],
  },
  {
    x: 420,
    y: 300,
    w: 150,
    h: 56,
    title: 'Safe4337Module',
    lines: ['Safe へ取り次ぐ'],
  },
  {
    x: 600,
    y: 300,
    w: 140,
    h: 56,
    title: '本部・店舗の Safe',
    lines: ['資金の保管'],
    strong: true,
  },
  {
    x: 420,
    y: 400,
    w: 150,
    h: 56,
    title: 'パスキー署名者',
    lines: ['署名を確かめる'],
  },
]

type Edge = {
  d: string
  label?: string
  lx?: number
  ly?: number
  both?: boolean
}

const edges: Edge[] = [
  {
    d: 'M410 50 H670 V124',
    label: '対応表の照会\n署名の保管',
    lx: 580,
    ly: 68,
    both: true,
  },
  { d: 'M320 76 V148', label: '署名した取引', lx: 328, ly: 116 },
  { d: 'M385 178 H436', label: 'ガス代', lx: 394, ly: 170, both: true },
  { d: 'M320 204 V296', label: '取引を送る', lx: 328, ly: 262 },
  { d: 'M125 204 V296', label: 'Sweep を起動', lx: 133, ly: 262 },
  { d: 'M390 328 H416' },
  { d: 'M570 328 H596' },
  { d: 'M670 356 V428 H574', label: '署名の検証', lx: 590, ly: 420 },
  {
    d: 'M125 356 V476 H710 V360',
    label: '宛先を本部の Safe に固定した送金',
    lx: 290,
    ly: 468,
  },
]

const lanes = [
  { y: 4, h: 88, label: 'メンバーの\n端末' },
  { y: 100, h: 144, label: 'オフチェーン' },
  { y: 252, h: 240, label: 'オンチェーン\n（Sepolia）' },
]

export function ArchitectureDiagram(): ReactNode {
  return (
    <figure className={styles.figure} aria-label="ウォレットの全体の構成">
      <div className={styles.scroll}>
        <svg className={styles.svg} viewBox="0 0 872 500" role="img">
          <title>ウォレットの全体の構成</title>
          <defs>
            <marker
              id="wallet-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" className={styles.arrowHead} />
            </marker>
          </defs>

          {lanes.map((lane) => (
            <g key={lane.label}>
              <rect
                x="2"
                y={lane.y}
                width="868"
                height={lane.h}
                rx="12"
                className={styles.lane}
              />
              <text x="16" y={lane.y + 24} className={styles.laneLabel}>
                {lane.label.split('\n').map((line, i) => (
                  <tspan key={line} x="16" dy={i === 0 ? 0 : 16}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          ))}

          {/* 左の 112 は帯の見出しの列 */}
          <g transform="translate(112 0)">
            {edges.map((edge) => (
              <g key={edge.d}>
                <path
                  d={edge.d}
                  className={styles.edge}
                  markerEnd="url(#wallet-arrow)"
                  markerStart={edge.both ? 'url(#wallet-arrow)' : undefined}
                />
                {edge.label && (
                  <text x={edge.lx} y={edge.ly} className={styles.edgeLabel}>
                    {edge.label.split('\n').map((line, i) => (
                      <tspan key={line} x={edge.lx} dy={i === 0 ? 0 : 14}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
              </g>
            ))}

            {boxes.map((box) => (
              <g key={box.title}>
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.w}
                  height={box.h}
                  rx="10"
                  className={box.strong ? styles.boxStrong : styles.box}
                />
                <text
                  x={box.x + box.w / 2}
                  y={box.y + 22}
                  className={
                    box.strong ? styles.boxTitleStrong : styles.boxTitle
                  }
                >
                  {box.title}
                </text>
                {box.lines?.map((line, i) => (
                  <text
                    key={line}
                    x={box.x + box.w / 2}
                    y={box.y + 40 + i * 16}
                    className={styles.boxLine}
                  >
                    {line}
                  </text>
                ))}
              </g>
            ))}
          </g>
        </svg>
      </div>
    </figure>
  )
}
