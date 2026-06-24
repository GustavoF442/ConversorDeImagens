# Conversor de Imagens para Calçados

Aplicativo desktop profissional para converter fotos de calçados em desenhos técnicos para catálogos, impressão térmica (Argox), etiquetas e documentação de desenvolvimento de produtos.

## Funcionalidades

### Processamento de Imagens
- **Line Art** — Contornos pretos limpos em fundo branco via detecção de bordas Sobel
- **Line Art + Solid** — Linhas com áreas escuras/texturizadas preenchidas de preto sólido
- **Technical Sheet** — Desenho estilo industrial com moldura de borda
- **Silhouette** — Forma pura preta em fundo branco

### Parâmetros Ajustáveis
- Espessura da Linha (1–10)
- Sensibilidade de Detecção (1–100)
- Intensidade de Preenchimento Preto (1–100)
- Contraste (50–200)
- Nitidez (0–100)

### Processamento em Lote
- Importe pastas inteiras ou vários arquivos
- Suporte a arrastar e soltar
- Processe centenas de imagens com workers Canvas paralelos
- Acompanhamento de progresso com ETA

### Formatos de Exportação
- **PNG** — Saída raster com compressão de tamanho opcional
- **SVG** — Saída vetorial via traçamento de bitmap run-length
- **PDF** — Imagem embutida em documento PDF padrão

### Otimização para Impressão Térmica Argox
- Apenas preto puro (#000000) e branco (#FFFFFF)
- Sem escala de cinza, sem anti-aliasing
- Otimizado para 203 DPI e 300 DPI
- Dimensões de etiqueta configuráveis (mm)
- Contraste máximo para impressão térmica

### Solidificação de Áreas Escuras
Detecta automaticamente regiões escuras pontilhadas/texturizadas e as converte em preenchimentos pretos sólidos — essencial para impressão limpa de etiquetas térmicas em impressoras Argox.

### Tamanhos de Saída Predefinidos
- 50×50mm, 60×40mm, 80×50mm, 100×60mm
- Dimensões personalizadas via configurações Argox
- Escala proporcional com centralização

### Controle de Tamanho de Arquivo
- Tamanho máximo configurável: 50KB, 100KB, 200KB, 500KB
- Redução automática de resolução para atingir metas
- Otimização de compressão PNG

### Integração com IA (Opcional)
- Campo de prompt personalizável para OpenAI / Claude / Gemini
- Prompt padrão otimizado para desenhos técnicos de calçados

## Início Rápido

### Versão para Navegador (Sem Instalação)
1. Abra `footwear-sketch-generator.html` em qualquer navegador moderno (Chrome, Edge, Firefox)
2. Clique em **Selecionar Pasta** ou **Selecionar Arquivos** para importar imagens de calçados
3. Escolha um modo de saída (Line Art, Line + Solid, Tech Sheet, Silhouette)
4. Ajuste as configurações no painel direito
5. Clique em **Processar Atual** para visualizar, ou **Processar Todos** para lote
6. Exporte como PNG, SVG ou PDF

### Aplicativo Desktop Electron (Requer Node.js)
```bash
npm install
npm run dev
```

### Gerar Executável para Windows

#### Versão em pasta (portátil, sem instalação)
```bash
npm run package:folder
```
Cria uma pasta completa dentro de `release/` que pode ser copiada para qualquer lugar — incluindo um pendrive — e aberta executando `Footwear Sketch Generator.exe`. Não requer privilégios de administrador e não modifica o sistema.

#### Arquivo ZIP para distribuição
```bash
npm run package:zip
```
Gera a mesma versão em pasta e a compacta em `release/Footwear Sketch Generator v1.0.0.zip`.

#### Instalador Windows (NSIS)
```bash
npm run package:win
```
Gera um instalador NSIS. Observação: requer privilégios de administrador na máquina de build porque baixa ferramentas de assinatura de código.

## Estrutura do Projeto

```
D:\editor\
├── footwear-sketch-generator.html  — Aplicativo standalone para navegador (tudo-em-um)
├── package.json                     — Configuração do projeto Electron
├── tsconfig.json                    — Config TypeScript (renderer)
├── tsconfig.main.json               — Config TypeScript (processo principal)
├── vite.config.ts                   — Config do bundler Vite
├── README.md
│
├── src/
│   ├── main/                        — Processo principal do Electron
│   │   ├── main.ts                  — Janela do app, handlers IPC
│   │   ├── preload.ts               — API da context bridge
│   │   ├── imageProcessor.ts        — Motor de processamento de imagens com Sharp
│   │   ├── batchProcessor.ts        — Processamento em lote paralelo com progresso
│   │   └── exportManager.ts         — Exportação PNG/SVG/PDF com traçamento
│   │
│   └── renderer/                    — Interface React
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx                  — Componente principal da aplicação
│       ├── types.ts                 — Interfaces TypeScript
│       ├── styles.css               — Estilos completos da aplicação
│       └── components/
│           ├── TitleBar.tsx
│           ├── Sidebar.tsx
│           ├── Viewer.tsx
│           ├── RightPanel.tsx
│           ├── BatchPanel.tsx
│           └── StatusBar.tsx
```

## Pipeline de Processamento

1. **Carregamento** — Lê arquivo de imagem via FileReader API (navegador) ou Sharp (Electron)
2. **Escala de Cinza** — Converte para luminância usando coeficientes ITU-R BT.601
3. **Contraste** — Aplica ajuste linear de contraste
4. **Detecção de Bordas** — Operador Sobel com stride configurável do kernel
5. **Limiarização** — Limiar binário baseado na configuração de sensibilidade
6. **Dilatação de Linhas** — Dilatação morfológica para controle de espessura
7. **Preenchimento Escuro** — Detecção e preenchimento sólido de áreas escuras (modo Line+Solid)
8. **Otimização Argox** — Limiar rígido, escala DPI e restrições de tamanho
9. **Redimensionamento de Saída** — Ajuste proporcional às dimensões alvo em mm
10. **Compressão** — Redução progressiva de qualidade para atingir tamanho alvo

## Tecnologia

| Componente | Versão Navegador | Versão Electron |
|-----------|-----------------|----------------|
| Processamento de Imagem | Canvas 2D API | Sharp (libvips) |
| Detecção de Bordas | Sobel (JavaScript) | Sobel + filtros Sharp |
| Vetorização | Traçamento SVG run-length | Potrace |
| Exportação PDF | Construtor manual de PDF | PDFKit |
| Framework UI | HTML/CSS/JS vanilla | React + TypeScript |
| Processamento em Lote | Batches Promise.all | Worker threads |

## Requisitos do Sistema

- **Versão navegador**: Qualquer navegador moderno (Chrome 90+, Edge 90+, Firefox 88+)
- **Versão Electron**: Node.js 18+, Windows 10/11
- **RAM**: 4GB mínimo, 8GB recomendado para processamento em lote
- **CPU**: Multi-core recomendado para operações em lote

## Licença

Proprietária — Todos os direitos reservados.
