// Ponto de entrada das ilhas React. O painel (JS puro) chama window.Ilhas.montar("nome", elemento, props).
// Cada ilha busca os próprios dados em /api/*; nada aqui fala com a internet.
import * as React from "react"
import { createRoot, type Root } from "react-dom/client"
import { MotionConfig } from "framer-motion"
import { CartaoEnvios } from "@/ilhas/cartao-envios"
import "@/estilo.css"

const ILHAS: Record<string, React.ComponentType<any>> = {
  "cartao-envios": CartaoEnvios,
}

const raizes = new WeakMap<Element, Root>()

// Conforto sensorial (docs/ACESSIBILIDADE.md): modo calmo ou "reduzir movimento" do sistema desligam toda animação das ilhas.
const calmo = () => document.documentElement.dataset.calmo === "1"

function montar(nome: string, el: Element, props: Record<string, unknown> = {}) {
  const Ilha = ILHAS[nome]
  if (!Ilha) throw new Error(`ilha desconhecida: ${nome}`)
  raizes.get(el)?.unmount()
  const raiz = createRoot(el)
  raizes.set(el, raiz)
  raiz.render(
    <MotionConfig reducedMotion={calmo() ? "always" : "user"}>
      <div className="ilha">
        <Ilha {...props} />
      </div>
    </MotionConfig>,
  )
}

;(window as any).Ilhas = { montar, disponiveis: Object.keys(ILHAS) }
