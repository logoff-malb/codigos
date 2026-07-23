/**
 * farmPlanner.js
 * Funcionalidade de planejamento da fazenda (Projetor de Layout)
 */
const FarmPlanner = {
    config: {
        largura: 60,
        altura: 60,
        tamanhoCelula: 48 // Tamanho fixo de cada célula do seu grid
    },
    
    matriz: [],

    // --- Configurações de Cores do Canvas (Fácil de adicionar novas categorias aqui) ---
    coresAlcance: {
        'Irrigação': 'rgba(0, 100, 255, 0.6)',  // Azul Royal Neon suave
        'Proteção':  'rgba(0, 230, 50, 0.55)'   // Verde Elétrico suave
    },

    // --- Configurações dos Objetos e Seus Alcances Matemáticos ---
    objetosConfig: {
        // Irrigação (Comportamentos Diferentes)
        aspersorC: { 
            categoria: 'Irrigação', 
            alcance: [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]] 
        },
        aspersorQ: { 
            categoria: 'Irrigação', 
            alcance: [
                [0,0], [-1,-1], [0,-1], [1,-1], [-1,0], [1,0], [-1,1], [0,1], [1,1] // Área quadrada 3x3
            ] 
        },
        aspersorI: { 
            categoria: 'Irrigação', 
            alcance: [
                [-2,-2], [-1,-2], [0,-2], [1,-2], [2,-2],
                [-2,-1], [-1,-1], [0,-1], [1,-1], [2,-1],
                [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
                [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
                [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2]  // Área quadrada 5x5
            ] 
        },
// ============================== CONFIGURAÇÃO DE PROTEÇÃO (ESPANTALHOS) ==============================
        
        // Espantalho Comum (Alcance circular real - Raio de 8 células)
        espantalho: { 
            categoria: 'Proteção', 
            alcance: (() => {
                const coords = [];
                for (let dy = -8; dy <= 8; dy++) {
                    let limiteX = 8; // Da linha 1 a 4 do eixo, são 8 para cada lado
                    const absY = Math.abs(dy);
                    
                    if (absY === 5) limiteX = 7;      // Na 5ª célula do eixo são 7 de cada lado
                    else if (absY === 6) limiteX = 6; // Na 6ª célula do eixo são 6 de cada lado
                    else if (absY === 7) limiteX = 5; // Na 7ª célula do eixo são 5 de cada lado
                    else if (absY === 8) limiteX = 4; // Na 8ª célula do eixo são 4 de cada lado
                    
                    for (let dx = -limiteX; dx <= limiteX; dx++) {
                        coords.push([dx, dy]);
                    }
                }
                return coords;
            })()
        },

        // Raroespantalhos (1 a 8) herdam exatamente o mesmo alcance do espantalho clássico
        espantalhoR1: { categoria: 'Proteção', alcance: null }, // Será preenchido logo abaixo para não duplicar código
        espantalhoR2: { categoria: 'Proteção', alcance: null },
        espantalhoR3: { categoria: 'Proteção', alcance: null },
        espantalhoR4: { categoria: 'Proteção', alcance: null },
        espantalhoR5: { categoria: 'Proteção', alcance: null },
        espantalhoR6: { categoria: 'Proteção', alcance: null },
        espantalhoR7: { categoria: 'Proteção', alcance: null },
        espantalhoR8: { categoria: 'Proteção', alcance: null },

        // Espantalho de Luxo (Dobro do alcance clássico - Diâmetro de 33, Raio de 16 células)
        espantalhoLuxo: {
            categoria: 'Proteção',
            alcance: (() => {
                const coords = [];
                // Dobramos todas as proporções matemáticas do raio clássico (8 * 2 = 16)
                for (let dy = -16; dy <= 16; dy++) {
                    let limiteX = 16; // Da linha 1 a 8 do eixo, são 16 para cada lado
                    const absY = Math.abs(dy);
                    
                    if (absY === 9 || absY === 10) limiteX = 14;     // Escala proporcional ao dobro
                    else if (absY === 11 || absY === 12) limiteX = 12;
                    else if (absY === 13 || absY === 14) limiteX = 10;
                    else if (absY === 15 || absY === 16) limiteX = 8;
                    
                    for (let dx = -limiteX; dx <= limiteX; dx++) {
                        coords.push([dx, dy]);
                    }
                }
                return coords;
            })()
        }},
    // --- Estado da Aplicação ---
    estado: {
        objetos: [], // Guarda: {x, y, tipo}
        visibilidade: { 
            'Irrigação': true,
            'Proteção': true 
        } 
    },

    ferramentaAtual: 'aspersorC', // Ferramenta que o usuário está usando

    abrir: function() {
        const modal = document.getElementById('modalLayout');
        if (modal) {
            this.inicializarGrade();
            modal.showModal();
        }
    },

    inicializarGrade: function() {
        const container = document.getElementById('grid-fazenda');
        if (!container) return;

        // Limpa o grid
        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.config.largura}, 1fr)`;
        
        // 1. Cria e adiciona o Canvas de forma dinâmica antes das células
        const canvas = document.createElement('canvas');
        canvas.id = 'canvas-alcances';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none'; // Cliques passam direto pelo canvas para as células
        canvas.style.zIndex = '1';
        
       // Define o tamanho de resolução interna do Canvas
        canvas.width = this.config.largura * this.config.tamanhoCelula;
        canvas.height = this.config.altura * this.config.tamanhoCelula;

        // NOVO: Define o tamanho físico real no layout para travar o alinhamento 1:1
        canvas.style.width = (this.config.largura * this.config.tamanhoCelula) + 'px';
        canvas.style.height = (this.config.altura * this.config.tamanhoCelula) + 'px';
        
        container.appendChild(canvas);

        // 2. Cria as células do Grid HTML
        for (let i = 0; i < (this.config.largura * this.config.altura); i++) {
            const celula = document.createElement('div');
            celula.classList.add('celula-grade');
            celula.dataset.index = i;
            celula.style.zIndex = '2'; // Células ficam acima do Canvas para receber os cliques
            
            celula.onclick = (e) => this.gerenciarClique(e.target);
            
            // Clique do botão direito
            celula.oncontextmenu = (e) => { 
                e.preventDefault(); // Impede o menu padrão
                this.gerenciarClique(e.target, 'direito');
            };
            container.appendChild(celula);
        }
        
        // --- Configuração dos Controles e Renderização Inicial ---
        this.construirControles();
        this.renderizarObjetos();

        // Lógica de arrastar (Drag-to-Scroll)
        const viewport = document.querySelector('.viewport-edicao');
        let isDown = false;
        let startX, startY, scrollLeft, scrollTop;

        viewport.addEventListener('mousedown', (e) => {
            isDown = true;
            viewport.style.cursor = 'grabbing';
            startX = e.pageX - viewport.offsetLeft;
            startY = e.pageY - viewport.offsetTop;
            scrollLeft = viewport.scrollLeft;
            scrollTop = viewport.scrollTop;
        });

        viewport.addEventListener('mouseleave', () => { isDown = false; });
        viewport.addEventListener('mouseup', () => { isDown = false; viewport.style.cursor = 'grab'; });

        viewport.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const x = e.pageX - viewport.offsetLeft;
            const y = e.pageY - viewport.offsetTop;
            viewport.scrollLeft = scrollLeft - (x - startX);
            viewport.scrollTop = scrollTop - (y - startY);
            this.sincronizarScroll();
        });
    },

    // --- Funções de Lógica e Renderização ---

    renderizarObjetos: function() {
        // 1. Limpa todas as marcações de alcance antigas nas células HTML e remove os sprites
        document.querySelectorAll('.celula-grade').forEach(c => {
            c.className = 'celula-grade'; 
            const spriteAntigo = c.querySelector('.objeto-sprite');
            if (spriteAntigo) spriteAntigo.remove();
        });

        // 2. Limpa o Canvas de alcances para o redesenho completo
        const canvas = document.getElementById('canvas-alcances');
        let ctx = null;
        if (canvas) {
            ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // O SEGREDO: 'screen' faz o Canvas misturar as cores somando luz nativamente!
            ctx.globalCompositeOperation = 'screen';
        }

        // 3. Desenha objetos, seus alcances e preenche o Canvas
        this.estado.objetos.forEach(obj => {
            let config = this.objetosConfig[obj.tipo];
            if (!config) return;

            // Regra especial: Se for um espantalho raro, ele usa a matriz de alcance do espantalho comum
            let matrizAlcance = config.alcance;
            if (obj.tipo.startsWith('espantalho') && matrizAlcance.length === 0) {
                matrizAlcance = this.objetosConfig['espantalho'].alcance;
            }

            // --- DESENHA O SPRITE DO OBJETO NO HTML ---
            const indiceCentro = (obj.y * this.config.largura) + obj.x;
            const celulaCentro = document.querySelector(`[data-index="${indiceCentro}"]`);
            if (celulaCentro) {
                const divSprite = document.createElement('div');
                divSprite.classList.add('objeto-sprite', `tile-${obj.tipo}`);
                celulaCentro.appendChild(divSprite);
            }

            // --- PROCESSA O ALCANCE SE A CATEGORIA ESTIVER VISÍVEL ---
            if (this.estado.visibilidade[config.categoria]) {
                matrizAlcance.forEach(([dx, dy]) => {
                    const alvoX = obj.x + dx;
                    const alvoY = obj.y + dy;
                    
                    if (alvoX >= 0 && alvoX < this.config.largura && alvoY >= 0 && alvoY < this.config.altura) {
                        const indice = (alvoY * this.config.largura) + alvoX;
                        const celula = document.querySelector(`[data-index="${indice}"]`);
                        
                        // 3a. Injeta a classe na célula HTML (Apenas para o OUTLINE pontilhado funcionar)
                        if (celula) {
                            celula.classList.add(config.categoria);
                        }

                        // 3b. Desenha a cor no Canvas (Preenchimento misturado nativamente)
                        if (ctx) {
                            const corOriginal = this.coresAlcance[config.categoria];
                            if (corOriginal) {
                                ctx.fillStyle = corOriginal;
                                ctx.fillRect(
                                    alvoX * this.config.tamanhoCelula, 
                                    alvoY * this.config.tamanhoCelula, 
                                    this.config.tamanhoCelula, 
                                    this.config.tamanhoCelula
                                );
                            }
                        }
                    }
                });
            }
        });
    },

    colocarObjeto: function(x, y, tipo) {
        // Limpa o objeto anterior da mesma coordenada antes de colocar o novo
        this.estado.objetos = this.estado.objetos.filter(obj => !(obj.x === x && obj.y === y));
        
        this.estado.objetos.push({ x, y, tipo });
        this.renderizarObjetos();
    },

    construirControles: function() {
        const container = document.getElementById('controles-container');
        if (!container) return;

        container.innerHTML = ''; 
        const categories = [...new Set(Object.values(this.objetosConfig).map(o => o.categoria))];

        categories.forEach(cat => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" checked> Ver ${cat}`;
            label.querySelector('input').addEventListener('change', (e) => {
                this.estado.visibilidade[cat] = e.target.checked;
                this.renderizarObjetos();
            });
            container.appendChild(label);
        });
    },

    gerenciarClique: function(celula, botao) {
        // Se clicou no sprite filho, redireciona o alvo para a célula pai
        if (celula.classList.contains('objeto-sprite')) {
            celula = celula.parentElement;
        }

        const indice = parseInt(celula.dataset.index);
        const x = indice % this.config.largura;
        const y = Math.floor(indice / this.config.largura);
        
        if (botao === 'direito') {
            // Remove qualquer objeto que esteja nesta exata coordenada
            this.estado.objetos = this.estado.objetos.filter(obj => !(obj.x === x && obj.y === y));
            this.renderizarObjetos();
        } else {
            // Comportamento padrão: coloca o item selecionado
            this.colocarObjeto(x, y, this.ferramentaAtual);
        }
    },

    selecionarFerramenta: function(tipo) {
        this.ferramentaAtual = tipo;
        
        document.querySelectorAll('.botao-ferramenta, .botao-variante').forEach(btn => {
            btn.classList.remove('ativa');
        });

        const botaoAlvo = document.querySelector(`[onclick*="'${tipo}'"]`);
        if (botaoAlvo) botaoAlvo.classList.add('ativa');

        const containerPai = botaoAlvo?.closest('.botao-container-expansivel');
        if (containerPai) {
            const botaoPrincipal = containerPai.querySelector('.botao-ferramenta');
            if (botaoPrincipal) botaoPrincipal.classList.add('ativa');
        }
    },

    sincronizarScroll: function() {
        const viewport = document.querySelector('.viewport-edicao');
        const janela = document.getElementById('janela-destaque');
        
        if (!viewport || !janela) return;

        const proporcao = 4; 
        janela.style.left = (viewport.scrollLeft / proporcao) + 'px';
        janela.style.top = (viewport.scrollTop / proporcao) + 'px';
    }
};

window.abrirModalLayout = () => FarmPlanner.abrir();