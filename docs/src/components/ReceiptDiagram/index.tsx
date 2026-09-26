import type { ReactNode } from 'react'
import styles from './styles.module.css'

type Box = {
  x: number
  y: number
  w: number
  h: number
  title: string
  lines?: string[]
  strong?: boolean
}

// 座標は、帯の見出しの列を除いた 760 × 466 の上の値
const boxes: Box[] = [
  {
    x: 20,
    y: 26,
    w: 210,
    h: 56,
    title: '支払ったアドレス',
    lines: ['秘密から識別子を作る'],
  },
  {
    x: 530,
    y: 26,
    w: 210,
    h: 56,
    title: '証明を出すアドレス',
    lines: ['秘密から証明を作る'],
  },
  {
    x: 280,
    y: 140,
    w: 200,
    h: 56,
    title: 'Checkout コントラクト',
    lines: ['決済と割引の判定'],
    strong: true,
  },
  {
    x: 20,
    y: 270,
    w: 210,
    h: 64,
    title: 'Semaphore のグループ',
    lines: ['店と商品ごとの識別子の集合'],
  },
  {
    x: 530,
    y: 270,
    w: 210,
    h: 64,
    title: '検証コントラクト',
    lines: ['集合の根と照合して証明を検証', '特典ごとの使用済み（nullifier）'],
  },
  {
    x: 280,
    y: 388,
    w: 200,
    h: 60,
    title: '店',
    lines: ['真偽だけが分かる', '購買履歴を持たない'],
  },
]

type Edge = {
  d: string
  label?: string
  lx?: number
  ly?: number
  both?: boolean
  // 破線で、矢じりを付けない（流れではなく関係を表す線）
  dashed?: boolean
}

// ラベルの番号は、本文の「仕組み」の手順の番号に対応する
const edges: Edge[] = [
  {
    d: 'M230 54 H530',
    label: '同じ秘密から作る（別のアドレスでよい）',
    lx: 262,
    ly: 46,
    dashed: true,
  },
  { d: 'M125 82 V168 H276', label: '1 支払い＋識別子', lx: 133, ly: 130 },
  { d: 'M330 196 V236 H125 V266', label: '2 識別子を登録', lx: 140, ly: 229 },
  { d: 'M635 82 V168 H484', label: '3 支払い＋証明', lx: 643, ly: 130 },
  {
    d: 'M430 196 V236 H635 V266',
    label: '4 条件・範囲・証明 ／ 真偽',
    lx: 448,
    ly: 229,
    both: true,
  },
  { d: 'M380 196 V384', label: '割引後の金額で決済', lx: 388, ly: 330 },
]

const lanes = [
  { y: 4, h: 96, label: '客の\nウォレット' },
  { y: 108, h: 250, label: 'オンチェーン\n（Sepolia）' },
  { y: 366, h: 96, label: '店' },
]

export default function ReceiptDiagram(): ReactNode {
  return (
    <figure className={styles.figure} aria-label="Receipt の全体の構成">
      <div className={styles.scroll}>
        <svg className={styles.svg} viewBox="0 0 872 466" role="img">
          <title>Receipt の全体の構成</title>
          <defs>
            <marker
              id="receipt-arrow"
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
                  className={edge.dashed ? styles.edgeDashed : styles.edge}
                  markerEnd={edge.dashed ? undefined : 'url(#receipt-arrow)'}
                  markerStart={edge.both ? 'url(#receipt-arrow)' : undefined}
                />
                {edge.label && (
                  <text x={edge.lx} y={edge.ly} className={styles.edgeLabel}>
                    {edge.label}
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
