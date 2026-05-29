import React from "react";

interface LogoAxisProps {
  className?: string;
  size?: number;
}

/**
 * LogoAxis — Reprodução fiel da marca Agência Axis.
 * Letra "A" com traçados de circuito integrado, nós terminais,
 * sobre fundo circular branco com gradientes elétricos cobalto e ciano de altíssima fidelidade.
 */
export default function LogoAxis({ className = "", size = 130 }: LogoAxisProps) {
  const uid = React.useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 220 220"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        {/* Gradiente elétrico principal para os traços do A */}
        <linearGradient id={`ag-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" /> {/* Ciano brilhante */}
          <stop offset="45%" stopColor="#0284c7" /> {/* Sky Blue */}
          <stop offset="100%" stopColor="#1d4ed8" /> {/* Azul Cobalto */}
        </linearGradient>

        {/* Gradiente elétrico para os nós de circuito */}
        <linearGradient id={`nd-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Gradiente metálico brilhante para a borda circular */}
        <linearGradient id={`bd-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="40%" stopColor="#22d3ee" /> {/* Toque ciano na borda */}
          <stop offset="60%" stopColor="#3b82f6" /> {/* Toque azul na borda */}
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Filtro de brilho neon suave */}
        <filter id={`gl-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Sombra de profundidade para o círculo branco */}
        <filter id={`sh-${uid}`} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="5" stdDeviation="9" floodColor="rgba(6, 182, 212, 0.15)" />
          <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="rgba(0, 0, 0, 0.1)" />
        </filter>

        {/* Gradiente de fundo do círculo - Branco com brilho glacial */}
        <radialGradient id={`cg-${uid}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f0fdfa" /> {/* Brilho glacial suave */}
          <stop offset="100%" stopColor="#e0f2fe" /> {/* Degradê para azul claro */}
        </radialGradient>
      </defs>

      {/* ── Círculo de fundo premium ── */}
      <circle
        cx="110"
        cy="110"
        r="98"
        fill={`url(#cg-${uid})`}
        stroke={`url(#bd-${uid})`}
        strokeWidth="2.5"
        filter={`url(#sh-${uid})`}
      />

      {/* ════════════════════════════════════
          Estrutura principal do "A" (Circuito Elétrico)
          ════════════════════════════════════ */}
      <g stroke={`url(#ag-${uid})`} strokeLinecap="round" strokeLinejoin="round" fill="none" filter={`url(#gl-${uid})`}>
        {/* Perna esquerda do A */}
        <path d="M 52 182 L 108 42" strokeWidth="12" />

        {/* Perna direita do A */}
        <path d="M 168 182 L 112 42" strokeWidth="12" />

        {/* Travessa horizontal central */}
        <path d="M 75 130 L 145 130" strokeWidth="9.5" />

        {/* ── Traçados internos de circuito (o "X" interno) ── */}
        <path d="M 80 128 L 128 72" strokeWidth="5.5" />
        <path d="M 140 128 L 92 72" strokeWidth="5.5" />

        {/* Extensão de circuito esquerda — sai da perna pra fora */}
        <path d="M 65 158 L 37 158" strokeWidth="5.5" />

        {/* Extensão de circuito direita — sai da perna pra fora */}
        <path d="M 155 158 L 183 158" strokeWidth="5.5" />

        {/* Ramal vertical curto no topo (antena) */}
        <path d="M 110 42 L 110 26" strokeWidth="5.5" />
      </g>

      {/* ════════════════════════════════════
          Nós terminais — LEDs brilhantes com núcleo branco
          ════════════════════════════════════ */}

      {/* Topo do A */}
      <circle cx="110" cy="42" r="7.5" fill={`url(#nd-${uid})`} />
      <circle cx="110" cy="42" r="3" fill="#ffffff" />

      {/* Ponto da antena */}
      <circle cx="110" cy="26" r="6" fill={`url(#nd-${uid})`} />
      <circle cx="110" cy="26" r="2.2" fill="#ffffff" />

      {/* Base esquerda */}
      <circle cx="52" cy="182" r="7.5" fill={`url(#nd-${uid})`} />
      <circle cx="52" cy="182" r="3" fill="#ffffff" />

      {/* Base direita */}
      <circle cx="168" cy="182" r="7.5" fill={`url(#nd-${uid})`} />
      <circle cx="168" cy="182" r="3" fill="#ffffff" />

      {/* Junção travessa-esquerda */}
      <circle cx="75" cy="130" r="6.5" fill={`url(#nd-${uid})`} />
      <circle cx="75" cy="130" r="2.5" fill="#ffffff" />

      {/* Junção travessa-direita */}
      <circle cx="145" cy="130" r="6.5" fill={`url(#nd-${uid})`} />
      <circle cx="145" cy="130" r="2.5" fill="#ffffff" />

      {/* Nós das diagonais internas superiores */}
      <circle cx="92" cy="72" r="6" fill={`url(#nd-${uid})`} />
      <circle cx="92" cy="72" r="2.2" fill="#ffffff" />

      <circle cx="128" cy="72" r="6" fill={`url(#nd-${uid})`} />
      <circle cx="128" cy="72" r="2.2" fill="#ffffff" />

      {/* Nó de cruzamento central do X */}
      <circle cx="110" cy="100" r="7" fill={`url(#ag-${uid})`} />
      <circle cx="110" cy="100" r="2.8" fill="#ffffff" />

      {/* Terminais dos ramais laterais */}
      <circle cx="37" cy="158" r="6" fill={`url(#nd-${uid})`} />
      <circle cx="37" cy="158" r="2.2" fill="#ffffff" />

      <circle cx="183" cy="158" r="6" fill={`url(#nd-${uid})`} />
      <circle cx="183" cy="158" r="2.2" fill="#ffffff" />
    </svg>
  );
}
