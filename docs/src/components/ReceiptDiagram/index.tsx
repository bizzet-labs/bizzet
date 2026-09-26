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

// 座標は、帯の見出しの列を除いた 760 × 436 の上の値
const boxes: Box[] = [
  {
    x: 20,
    y: 26,
    w: 250,
    h: 60,
    title: '決済ページ（bizzet）',
    lines: ['秘密を保存し、識別子と証明を作る'],
  },
  {
    x: 490,
    y: 26,
    w: 250,
    h: 60,
    title: '客のウォレット',
    lines: ['支払いの取引に署名する'],
  },
  {
    x: 280,
    y: 150,
    w: 200,
    h: 56,
    title: 'Checkout コントラクト',
    lines: ['決済と割引の判定'],
    strong: true,
  },
  {
    x: 40,
    y: 250,
    w: 260,
    h: 64,
    title: 'Semaphore v4',
    lines: ['商品ごとの集合', '証明の検証と使用済みの記録'],
  },
  {
    x: 280,
    y: 354,
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
  // 破線で、矢じりを付けない（流れではなく参照を表す線）
  dashed?: boolean
}

// ラベルの番号は、本文の「仕組み」の手順の番号に対応する
const edges: Edge[] = [
  {
    d: 'M270 56 H486',
    label: '支払いの中身（識別子か証明）',
    lx: 282,
    ly: 48,
  },
  {
    d: 'M615 86 V178 H484',
    label: '1 支払い＋識別子\n3 支払い＋証明',
    lx: 623,
    ly: 122,
  },
  {
    d: 'M330 206 V228 H170 V246',
    label: '2 登録 ／ 4 検証と記録',
    lx: 172,
    ly: 222,
    both: true,
  },
  {
    d: 'M100 250 V86',
    label: '集合の中身を読む（公開）',
    lx: 108,
    ly: 170,
    dashed: true,
  },
  { d: 'M380 206 V350', label: '割引後の金額で決済', lx: 388, ly: 290 },
]

const lanes = [
  { y: 4, h: 96, label: '客の端末' },
  { y: 108, h: 216, label: 'オンチェーン\n（Sepolia）' },
  { y: 332, h: 100, label: '店' },
]

export default function ReceiptDiagram(): ReactNode {
  return (
    <figure className={styles.figure} aria-label="Receipt の全体の構成">
      <div className={styles.scroll}>
        <svg className={styles.svg} viewBox="0 0 872 436" role="img">
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
