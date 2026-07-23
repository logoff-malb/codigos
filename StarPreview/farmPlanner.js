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

    // --- Configurações de Cores do Canvas ---
    coresAlcance: {
        'Irrigação': 'rgba(0, 100, 255, 0.6)',  // Azul Royal Neon suave
        'Proteção':  'rgba(0, 230, 50, 0.55)'   // Verde Elétrico suave
    },

    // --- Configurações dos Objetos e Seus Alcances Matemáticos ---
    objetosConfig: (() => {
        const config = {
            // Irrigação
            aspersorC: { 
                categoria: 'Irrigação', 
                alcance: [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]] 
            },
            aspersorQ: { 
                categoria: 'Irrigação', 
                alcance: [
                    [0,0], [-1,-1], [0,-1], [1,-1], [-1,0], [1,0], [-1,1], [0,1], [1,1]
                ] 
            },
            aspersorI: { 
                categoria: 'Irrigação', 
                alcance: [
                    [-2,-2], [-1,-2], [0,-2], [1,-2], [2,-2],
                    [-2,-1], [-1,-1], [0,-1], [1,-1], [2,-1],
                    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
                    [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
                    [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2]
                ] 
            },
            
            // Espantalho Clássico (Alcance real de 8 células de raio)
            espantalho: { 
                categoria: 'Proteção', 
                alcance: (() => {
                    const coords = [];
                    for (let dy = -8; dy <= 8; dy++) {
                        let limiteX = 8;
                        const absY = Math.abs(dy);
                        
                        if (absY === 5) limiteX = 7;
                        else if (absY === 6) limiteX = 6;
                        else if (absY === 7) limiteX = 5;
                        else if (absY === 8) limiteX = 4;
                        
                        for (let dx = -limiteX; dx <= limiteX; dx++) {
                            coords.push([dx, dy]);
                        }
                    }
                    return coords;
                })()
            }
        };

        // Raroespantalhos (1 a 8) herdam o alcance padrão
        for (let i = 1; i <= 8; i++) {
            config[`espantalhoR${i}`] = {
                categoria: 'Proteção',
                alcance: config.espantalho.alcance
            };
        }

        // Espantalho de Luxo (Dobro do alcance clássico)
        config.espantalhoLuxo = {
            categoria: 'Proteção',
            alcance: (() => {
                const coords = [];
                for (let dy = -16; dy <= 16; dy++) {
                    let limiteX = 16;
                    const absY = Math.abs(dy);
                    
                    if (absY === 9 || absY === 10) limiteX = 14;
                    else if (absY === 11 || absY === 12) limiteX = 12;
                    else if (absY === 13 || absY === 14) limiteX = 10;
                    else if (absY === 15 || absY === 16) limiteX = 8;
                    
                    for (let dx = -limiteX; dx <= limiteX; dx++) {
                        coords.push([dx, dy]);
                    }
                }
                return coords;
            })()
        };

        return config;
    })(),

    // --- Estado da Aplicação ---
    estado: {
        objetos: [], // [{x, y, tipo}]
        visibilidade: { 
            'Irrigação': true,
            'Proteção': true 
        } 
    },

    ferramentaAtual: 'aspersorC',

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

        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.config.largura}, 1fr)`;
        
        // Canvas de alcances
        const canvas = document.createElement('canvas');
        canvas.id = 'canvas-alcances';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '1';
        
        canvas.width = this.config.largura * this.config.tamanhoCelula;
        canvas.height = this.config.altura * this.config.tamanhoCelula;
        canvas.style.width = (this.config.largura * this.config.tamanhoCelula) + 'px';
        canvas.style.height = (this.config.altura * this.config.tamanhoCelula) + 'px';
        
        container.appendChild(canvas);

        // Grid HTML
        for (let i = 0; i < (this.config.largura * this.config.altura); i++) {
            const celula = document.createElement('div');
            celula.classList.add('celula-grade');
            celula.dataset.index = i;
            celula.style.zIndex = '2';
            
            celula.onclick = (e) => this.gerenciarClique(e.target);
            celula.oncontextmenu = (e) => { 
                e.preventDefault();
                this.gerenciarClique(e.target, 'direito');
            };
            container.appendChild(celula);
        }
        
        this.construirControles();
        this.gerarMenusFerramentas();
        this.renderizarObjetos();

        // Arrastar câmera (Drag-to-Scroll)
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

    renderizarObjetos: function() {
        // Limpa as classes do grid de forma limpa, mantendo a padrão
        document.querySelectorAll('.celula-grade').forEach(c => {
            c.className = 'celula-grade'; 
            const spriteAntigo = c.querySelector('.objeto-sprite');
            if (spriteAntigo) spriteAntigo.remove();
        });

        const canvas = document.getElementById('canvas-alcances');
        let ctx = null;
        if (canvas) {
            ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'screen';
        }

        this.estado.objetos.forEach(obj => {
            let config = this.objetosConfig[obj.tipo];
            if (!config) return;

            let matrizAlcance = config.alcance;

            // Inserção do Sprite na Célula (Buscando o tile- exato do seu CSS!)
            const indiceCentro = (obj.y * this.config.largura) + obj.x;
            const celulaCentro = document.querySelector(`[data-index="${indiceCentro}"]`);
            if (celulaCentro) {
                const divSprite = document.createElement('div');
                divSprite.classList.add('objeto-sprite', `tile-${obj.tipo}`);
                celulaCentro.appendChild(divSprite);
            }

            // Exibição dos alcances se a categoria estiver ativa
            if (this.estado.visibilidade[config.categoria] && matrizAlcance) {
                matrizAlcance.forEach(([dx, dy]) => {
                    const alvoX = obj.x + dx;
                    const alvoY = obj.y + dy;
                    
                    if (alvoX >= 0 && alvoX < this.config.largura && alvoY >= 0 && alvoY < this.config.altura) {
                        const indice = (alvoY * this.config.largura) + alvoX;
                        const celula = document.querySelector(`[data-index="${indice}"]`);
                        
                        if (celula) {
                            celula.classList.add(config.categoria);
                        }

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

    gerarMenusFerramentas: function() {
        const subAspersores = document.getElementById('submenu-aspersores');
        const subEspantalhos = document.getElementById('submenu-espantalhos');
        
        if (!subAspersores || !subEspantalhos) return;

        subAspersores.innerHTML = '';
        subEspantalhos.innerHTML = '';

        const aspersores = [
            { id: 'aspersorC', nome: 'Aspersor Comum' },
            { id: 'aspersorQ', nome: 'Aspersor de Qualidade' },
            { id: 'aspersorI', nome: 'Aspersor de Irídio' }
        ];

        const espantalhos = [
            { id: 'espantalho', nome: 'Espantalho Clássico' },
            ...Array.from({ length: 8 }, (_, i) => ({ id: `espantalhoR${i + 1}`, nome: `Raroespantalho ${i + 1}` })),
            { id: 'espantalhoLuxo', nome: 'Espantalho de Luxo' }
        ];

        const criarBotao = (tipo, container, isMaster = false) => {
            const btn = document.createElement('button');   
            
            // Define a classe correta de acordo com as regras de estilo
            btn.className = isMaster ? 'botao-ferramenta' : 'botao-variante';
            
            // O TRUQUE DE MESTRE: Injeta fisicamente a string onclick no HTML para o CSS capturar o seletor de atributo!
            btn.setAttribute('onclick', `FarmPlanner.selecionarFerramenta('${tipo.id}')`);
            
            btn.title = tipo.nome;
            btn.dataset.tipo = tipo.id; 
            
            // Mantém a escuta JS ativa para gerenciar o clique e evitar problemas de escopo
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selecionarFerramenta(tipo.id);
            });

            container.appendChild(btn);
            return btn;
        };

        // Cria as variantes de dentro do submenu flutuante
        aspersores.forEach(asp => criarBotao(asp, subAspersores));
        espantalhos.forEach(esp => criarBotao(esp, subEspantalhos));

        // Substitui os botões mestres estáticos do seu container principal
        const areaMasterAsp = document.getElementById('btn-master-aspersores-container');
        if (areaMasterAsp) {
            areaMasterAsp.innerHTML = '';
            const masterAsp = criarBotao({ id: 'aspersorC', nome: 'Aspersor Comum' }, areaMasterAsp, true);
            masterAsp.id = 'btn-master-aspersores';
        }

        const areaMasterEsp = document.getElementById('btn-master-espantalhos-container');
        if (areaMasterEsp) {
            areaMasterEsp.innerHTML = '';
            const masterEsp = criarBotao({ id: 'espantalho', nome: 'Espantalho Clássico' }, areaMasterEsp, true);
            masterEsp.id = 'btn-master-espantalhos';
        }

        // Inicia com o primeiro selecionado
        this.selecionarFerramenta('aspersorC');
    },

    gerenciarClique: function(celula, botao) {
        if (celula.classList.contains('objeto-sprite')) {
            celula = celula.parentElement;
        }

        const indice = parseInt(celula.dataset.index);
        const x = indice % this.config.largura;
        const y = Math.floor(indice / this.config.largura);
        
        if (botao === 'direito') {
            this.estado.objetos = this.estado.objetos.filter(obj => !(obj.x === x && obj.y === y));
            this.renderizarObjetos();
        } else {
            this.colocarObjeto(x, y, this.ferramentaAtual);
        }
    },

    selecionarFerramenta: function(tipo) {
    this.ferramentaAtual = tipo;
    
    // 1. Remove estado ativo de todos os botões
    document.querySelectorAll('.botao-ferramenta, .botao-variante').forEach(btn => {
        btn.classList.remove('ativa');
    });

    // 2. Destaca o item específico que foi clicado no submenu
    const botaoAlvo = document.querySelector(`.botao-variante[data-tipo="${tipo}"]`);
    if (botaoAlvo) {
        botaoAlvo.classList.add('ativa');
    }

    // 3. Atualiza o Botão Mestre correspondente com o Sprite e Ação do item selecionado
    if (tipo.startsWith('aspersor')) {
        const master = document.getElementById('btn-master-aspersores');
        if (master) {
            master.classList.add('ativa');
            // Formata exatamente com aspas simples internas -> onclick="FarmPlanner.selecionarFerramenta('tipo')"
            master.setAttribute('onclick', `FarmPlanner.selecionarFerramenta('${tipo}')`);
        }
    } else if (tipo.startsWith('espantalho')) {
        const master = document.getElementById('btn-master-espantalhos');
        if (master) {
            master.classList.add('ativa');
            // Formata exatamente com aspas simples internas para o CSS reconhecer espantalhoR1, espantalhoR2, etc.
            master.setAttribute('onclick', `FarmPlanner.selecionarFerramenta('${tipo}')`);
        }
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