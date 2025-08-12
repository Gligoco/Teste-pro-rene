# Capacidades de Óleo — Web App (PWA)

Aplicativo estático e offline para consulta rápida de capacidades e especificações de óleo (motor, câmbio, diferencial) por modelo de veículo. Funciona 100% no GitHub Pages, sem backend.

## O que faz
- Busca instantânea com tolerância a erros (Fuse.js)
- Entrada por voz (pt-BR), quando suportado
- Funciona offline após o primeiro carregamento (PWA + Service Worker)
- Atalhos: links diretos por `#/id` e geração de QR Code
- Lista de recentes (últimos 5)

## Estrutura
- `index.html`: página única (SPA)
- `styles.css`: estilos
- `app.js`: lógica da aplicação (busca, voz, deep-link, QR, recentes)
- `data.json`: base de dados (ver esquema abaixo)
- `manifest.webmanifest`: manifest do PWA
- `sw.js`: service worker (cache de assets e dados)
- `icons/icon-192.png`, `icons/icon-512.png`: ícones do app (PWA)

## Como editar `data.json`
- Formato: array de objetos conforme o esquema abaixo
- Unidades: litros (L)
- Campos opcionais podem ser `null`

Esquema (exemplo simplificado):
```json
{
  "id": "chevrolet-onix-10-3c-2020plus",
  "aliases": ["Onix", "Ônix", "Onix 1.0"],
  "marca": "Chevrolet",
  "modelo": "Onix",
  "motor": "1.0 3C",
  "anos": "2020+",
  "oleo_motor": {
    "viscosidade": "5W-30",
    "especificacao": ["API SP"],
    "capacidade_sem_filtro_l": 2.7,
    "capacidade_com_filtro_l": 2.9,
    "obs": "Usar óleo sintético."
  },
  "oleo_cambio": null,
  "diferencial": null,
  "notas": []
}
```

## Executar localmente
- Basta abrir `index.html` em um navegador moderno
- Para testar o PWA/Service Worker localmente, sirva com um HTTP server simples (opcional):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Publicar no GitHub Pages
1. Crie um repositório e envie todos os arquivos da pasta do projeto
2. Acesse a aba "Settings" → "Pages"
3. Em "Source", selecione `main` e a pasta `/ (root)`
4. Aguarde a publicação e acesse a URL gerada

Dica: use caminhos relativos (`./`) já configurados no projeto para funcionar em qualquer subpasta.

## Ícones e Manifest
- Ícones obrigatórios: `icons/icon-192.png` e `icons/icon-512.png`
- Para substituir pelos seus, gere PNGs com fundo sólido e (opcional) máscara
- Atualize `manifest.webmanifest` se alterar caminhos

## Limitações conhecidas
- Reconhecimento de voz pode não funcionar no iOS/Safari
- Dados são ilustrativos; verifique sempre a especificação do fabricante

## Acessibilidade
- Labels, `aria-*`, e contraste elevados
- Navegação por teclado suportada

## Licença
- Sem rastreamento/analytics. Use e adapte livremente.