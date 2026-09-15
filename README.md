# SNES ROM Forge Web

Port client-side (sem backend) do [SNES ROM Forge](https://github.com/ramonxxl/SNES-ROM-Forge)
— ferramenta pra fazer merge de ROMs de Super Nintendo (LoROM/HiROM) numa única imagem
para gravação em memória flash. Roda inteiramente no navegador: nenhum arquivo sai do
seu computador, não há upload nem servidor por trás.

**Usar agora:** https://ramonxxl.github.io/SNES-ROM-Forge-Web/

## O que faz

- Detecta e remove header SMC de 512 bytes, quando presente.
- Detecta automaticamente o mapeamento (LoROM ou HiROM) de cada ROM.
- Corrige o checksum interno de cada ROM individualmente.
- Calcula o tamanho de slot de cada ROM pra bater com a placa PIC do usuário (2 linhas de
  endereço = até 4 posições possíveis): quando o número de jogos não preenche todas as
  posições, uma ROM se repete inteira pra evitar endereço "flutuando" (flash em branco).
- Preenche o restante da capacidade da flash selecionada com `0xFF`.
- Bloqueia merges inválidos: mapeamento misto, ROM não identificada, ROM maior que o slot
  calculado, ou soma dos slots maior que a capacidade da flash.
- Interface em cards, com arrastar-e-soltar para importar ROMs.
- Quando há internet, busca automaticamente a capa de cada jogo (via
  [libretro-thumbnails](https://github.com/libretro-thumbnails), sem necessidade de
  cadastro/API key) e guarda em cache no navegador (Cache Storage API); sem internet ou
  sem capa encontrada, mantém um banner colorido com o título do jogo.

## Como rodar localmente

Como a página usa ES modules, não dá pra abrir `index.html` direto (`file://`) — o
navegador bloqueia `import` nesse esquema. Sirva a pasta com qualquer servidor estático:

```
npx serve .
# ou
python -m http.server
```

Depois abra o endereço que o servidor mostrar (ex: `http://localhost:3000`).

## Como rodar os testes

```
npm test
```

(Sem dependências — usa o runner de testes nativo do Node, `node --test`.)

## Estrutura

Cada arquivo em `src/core/` e `src/devices/` é o port direto do módulo Python
equivalente no [SNES ROM Forge](https://github.com/ramonxxl/SNES-ROM-Forge)
(`core/*.py`, `devices/*.py`) — mesma lógica, mesmos offsets, mesmo algoritmo de slots.
`src/ui/` e `src/app.js` recriam a interface em cards do app desktop usando DOM puro.

## Fora do escopo desta versão

- Perfis de placa alternativos (só o modelo "PIC com 2 linhas de endereço" já
  implementado).
- PWA instalável / funcionamento 100% offline (o cache de capas já funciona offline
  depois da primeira busca, mas a página em si ainda depende de estar hospedada/servida).
