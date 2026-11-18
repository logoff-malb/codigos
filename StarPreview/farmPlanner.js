/**
 * farmPlanner.js
 * Funcionalidade de planejamento da fazenda (Projetor de Layout)
 */
const FarmPlanner = {
    config: {
        largura: 60, // Padrão genérico
        altura: 60,
        tamanhoCelula: 48
    },

    mapaAtual: 'generico',

    // --- Definição dos Mapas Oficiais e do Genérico ---
   mapasConfig: {
        generico:     { nome: 'Grade Genérica (60x60)', largura: 60, altura: 60, imagem: null },
        padrao:       { nome: 'Fazenda Padrão',          imagem: 'recursos/fazenda1.png' },
        entrerios:    { nome: 'Fazenda Entre Rios',      imagem: 'recursos/fazenda2.png' },
        floresta:     { nome: 'Fazenda na Floresta',     imagem: 'recursos/fazenda3.png' },
        colina:       { nome: 'Fazenda na Colina',       imagem: 'recursos/fazenda4.png' },
        remota:       { nome: 'Fazenda Remota',          imagem: 'recursos/fazenda5.png' },
        quatroCantos: { nome: 'Quatro Cantos',           imagem: 'recursos/fazenda6.png' },
        praia:        { nome: 'Fazenda na Praia',        imagem: 'recursos/fazenda7.png' },
        pradaria:     { nome: 'Fazenda dos Prados (1.6)', imagem: 'recursos/fazenda8.png' }
    },
    
    selecionarMapa: function(idMapa) {
        const mapa = this.mapasConfig[idMapa];
        if (!mapa) return;

        this.mapaAtual = idMapa;
        
        // Se o mapa tiver tamanho próprio (ex: genérico 60), usa ele. Senão, assume 80x65
        this.config.largura = mapa.largura || 80;
        this.config.altura  = mapa.altura  || 65;

        // Limpa objetos fora dos limites
        this.estado.objetos = this.estado.objetos.filter(obj => {
            return obj.x < this.config.largura && obj.y < this.config.altura;
        });

        this.inicializarGrade();
    },

    celulasDOM: [], // Cache O(1) para acesso direto às células sem querySelector

    // --- Configurações de Cores do Canvas ---
    coresAlcance: {
        'Irrigação': 'rgba(0, 100, 255, 0.4)', // Azul Royal suave
        'Proteção':  'rgba(0, 230, 50, 0.35)', // Verde suave
        'cMel':      'rgba(255, 200, 50, 0.18)' // Vítreo dourado/mel translúcido
    },

    aplicarZoom: function(novoZoom) {
        const zoomClamped = Math.min(Math.max(novoZoom, 0.25), 2.0);
        this.estado.zoom = Math.round(zoomClamped * 100) / 100;

        const grid = document.getElementById('grid-fazenda');
        if (grid) {
            grid.style.transformOrigin = 'top left';
            grid.style.transform = `scale(${this.estado.zoom})`;
        }

        this.sincronizarScroll();
    },

    alterarZoom: function(delta) {
        this.aplicarZoom(this.estado.zoom + delta);
    },

    configurarAtalhosZoom: function() {
        const viewport = document.querySelector('.viewport-edicao');
        if (!viewport) return;

        // 1. Zoom via Scroll do Mouse (com Alt ou direto na viewport) e bloqueio da página
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault(); // Bloqueia a rolagem da página principal

            // Zoom suave com a rodinha do mouse
            const delta = e.deltaY < 0 ? 0.05 : -0.05;
            this.alterarZoom(delta);
        }, { passive: false });

        // 2. Atalhos de Teclado (Alt + "+", Alt + "-", Alt + "0")
        window.addEventListener('keydown', (e) => {
            const modal = document.getElementById('modalLayout');
            if (!modal || !modal.open) return;

            if (e.altKey) {
                if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    this.alterarZoom(0.1);
                } else if (e.key === '-' || e.key === '_') {
                    e.preventDefault();
                    this.alterarZoom(-0.1);
                } else if (e.key === '0') {
                    e.preventDefault();
                    this.aplicarZoom(1.0);
                }
            }
        });
    },

    // --- Configurações dos Objetos, Dimensões de Colisão e Alcances ---
    objetosConfig: (() => {
        const alcanceColmeia = (() => {
            const coords = [];
            for (let dy = -5; dy <= 5; dy++) {
                const maxDx = 5 - Math.abs(dy);
                for (let dx = -maxDx; dx <= maxDx; dx++) {
                    coords.push([dx, dy]);
                }
            }
            return coords;
        })();

        const config = {
            // Irrigação
            aspersorC: { 
                categoria: 'Irrigação',
                dimensao: [1, 1],
                alcance: [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]] 
            },
            aspersorQ: { 
                categoria: 'Irrigação', 
                dimensao: [1, 1],
                alcance: [
                    [0,0], [-1,-1], [0,-1], [1,-1], [-1,0], [1,0], [-1,1], [0,1], [1,1]
                ] 
            },
            aspersorI: { 
                categoria: 'Irrigação', 
                dimensao: [1, 1],
                alcance: [
                    [-2,-2], [-1,-2], [0,-2], [1,-2], [2,-2],
                    [-2,-1], [-1,-1], [0,-1], [1,-1], [2,-1],
                    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
                    [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
                    [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2]
                ] 
            },
            
            // Espantalho Clássico
            espantalho: { 
                categoria: 'Proteção', 
                dimensao: [1, 1],
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
            },

            // Colméia
            colmeia: {
                categoria: 'cMel',
                dimensao: [1, 1],
                alcance: alcanceColmeia
            },

            colmeiaVazia: {
                categoria: 'cMel',
                dimensao: [1, 1],
                alcance: alcanceColmeia 
            },

            // Mini-Obelisco
            miniObelisco: {
                categoria: 'construcao',
                dimensao: [1, 1],
                alcance: [],
                limiteMaximo: 2
            },

            // Obstáculos 2x2
            tocoGrande: {
                categoria: 'construcao',
                dimensao: [2, 2],
                alcance: [],
                nome: 'Toco grande'
            },
            troncoGrande: {
                categoria: 'construcao',
                dimensao: [2, 2],
                alcance: [],
                nome: 'tronco Grande'
            },
            pedraCinza: {
                categoria: 'construcao',
                dimensao: [2, 2],
                alcance: [],
                nome: 'Pedra Cinza'
            },
            pedraVermelha: {
                categoria: 'construcao',
                dimensao: [2, 2],
                alcance: [],
                nome: 'Grande pedra vermelha'
            },
            pedraMarrom: {
                categoria: 'construcao',
                dimensao: [2, 2],
                alcance: [],
                nome: 'Grande pedra marrom'
            },
            pedraAzul: {
                categoria: 'construcao',
                dimensao: [2, 2],
                alcance: [],
                nome: 'Grande pedra azul'
            },
            pedraAzul2: {
                categoria: 'construcao',
                dimensao: [2, 2],
                alcance: [],
                nome: 'Grande pedra azul'
            },
            obMeteorito: {
                categoria: 'construcao',
                dimensao: [2, 2],
                alcance: [],
                nome: 'Meteorito'
            }
        };

        // Raroespantalhos (1 a 8)
        for (let i = 1; i <= 8; i++) {
            config[`espantalhoR${i}`] = {
                categoria: 'Proteção',
                dimensao: [1, 1],
                alcance: config.espantalho.alcance
            };
        }

        // Espantalho de Luxo
        config.espantalhoLuxo = {
            categoria: 'Proteção',
            dimensao: [1, 1],
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

        // Flores
        const tiposFlores = ['florTulipa', 'florJasmim', 'florMicanga', 'florPapoula', 'florGirassol', 'florRosaFada'];
        tiposFlores.forEach(f => {
            config[f] = {
                categoria: 'flores',
                dimensao: [1, 1],
                alcance: []
            };
        });

        // Cadastro Dinâmico dos 13 Caminhos/Pisos
        for (let i = 1; i <= 13; i++) {
            config[`piso${i}`] = {
                categoria: 'piso',
                dimensao: [1, 1],
                alcance: [],
                isPiso: true,
                indexPiso: i - 1 // Mapeamento vertical no pisos.png
            };
        }
        // cadastro dinamico das cercas
            const materiaisCerca = ['cerca1', 'cerca2', 'cerca3', 'cerca4'];
            materiaisCerca.forEach(mat => {
                config[`${mat}_f`] = { categoria: 'Cercas', material: mat, subtipo: 'f', isCerca: true, dimensao: [1,1], alcance: [] };
                config[`${mat}_g`] = { categoria: 'Cercas', material: mat, subtipo: 'g', isCerca: true, dimensao: [1,1], alcance: [] };
            });

        return config;
    })(),

    // --- Estado da Aplicação ---
    estado: {
        objetos: [],
        visibilidade: { 
            'Irrigação': true,
            'Proteção': true,
            'cMel': true,
            'piso': true
        },
        zoom: 1,
        botaoPressionado: null,
        houveArrasto: false
    },

    ferramentaAtual: 'aspersorC',

     abrir: function() {
        const modal = document.getElementById('modalLayout');
        if (modal) {
            document.body.style.overflow = 'hidden'; // Impede o scroll da página de fundo
            modal.onclose = () => {
                document.body.style.overflow = ''; // Restaura ao fechar
            };
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
        // --- CANVAS DE FUNDO (Z-Index: 1) ---
        // Este canvas desenha as cores sólidas (preenchimento) atrás dos pisos
        const canvasFundo = document.createElement('canvas');
        canvasFundo.id = 'canvas-alcances-fundo';
        canvasFundo.style.position = 'absolute';
        canvasFundo.style.top = '0';
        canvasFundo.style.left = '0';
        canvasFundo.style.pointerEvents = 'none';
        canvasFundo.style.zIndex = '1'; // Atrás de tudo
        
        
        const larguraPx = this.config.largura * this.config.tamanhoCelula;
        const alturaPx = this.config.altura * this.config.tamanhoCelula;
        canvasFundo.width = larguraPx;
        canvasFundo.height = alturaPx;
        canvasFundo.style.width = larguraPx + 'px';
        canvasFundo.style.height = alturaPx + 'px';

        
        // --- CANVAS DE TOPO (Z-Index: 6) ---
        // Este canvas desenha as bordas e linhas pontilhadas na frente de tudo
        const canvasTopo = canvasFundo.cloneNode();
        canvasTopo.id = 'canvas-alcances-topo';
        canvasTopo.style.zIndex = '6'; // Acima dos objetos e pisos
        
        container.appendChild(canvasFundo);
        container.appendChild(canvasTopo);

        // Grid HTML
        this.celulasDOM = []; // Limpa o cache
        for (let i = 0; i < (this.config.largura * this.config.altura); i++) {
            const x = i % this.config.largura;
            const y = Math.floor(i / this.config.largura);

            const celula = document.createElement('div');
            celula.classList.add('celula-grade');
            celula.dataset.index = i;
            celula.dataset.x = x;
            celula.dataset.y = y;
            celula.style.position = 'relative';
            celula.style.zIndex = '4';
            
            // Previne o menu de contexto do Windows para o botão direito na grade
            celula.oncontextmenu = (e) => e.preventDefault();

           celula.onmousedown = (e) => {
                this.estado.botaoPressionado = (e.button === 2) ? 'direito' : 'esquerdo';
                this.estado.houveArrasto = false; // Reseta no início do clique

                // Se for botão direito (apagar) ou ferramenta de pintura contínua, aplica no ato
                const ehPintura = this.ferramentaAtual.startsWith('piso') || this.ferramentaAtual.startsWith('cerca');
                if (this.estado.botaoPressionado === 'direito' || ehPintura) {
                    this.gerenciarClique(celula, this.estado.botaoPressionado);
                }
            };

            celula.onmouseup = (e) => {
                // Só coloca o objeto se NÃO foi um arrasto de câmera
                if (!this.estado.houveArrasto && e.button === 0) {
                    const ehPintura = this.ferramentaAtual.startsWith('piso') || this.ferramentaAtual.startsWith('cerca');
                    if (!ehPintura) {
                        this.gerenciarClique(celula, 'esquerdo');
                    }
                }
                this.estado.botaoPressionado = null;
            };

            celula.onmouseenter = () => {
                // Modo Pintura Contínua: só executa se o mouse estiver pressionado em pisos, cercas ou apagando
                if (this.estado.botaoPressionado) {
                    const ehPintura = this.ferramentaAtual.startsWith('piso') || this.ferramentaAtual.startsWith('cerca');
                    if (this.estado.botaoPressionado === 'direito' || ehPintura) {
                        this.gerenciarClique(celula, this.estado.botaoPressionado);
                    }
                }
            };

            container.appendChild(celula);
            this.celulasDOM[i] = celula; // Guarda referência direta em O(1)
        }

        // Listener global para parar de pintar ao soltar o mouse fora das células
        if (!window.dragEventGuard) {
            window.addEventListener('mouseup', () => { this.estado.botaoPressionado = null; });
            window.dragEventGuard = true;
        }
        
        this.construirControles();
        this.gerarMenusFerramentas();
        this.renderizarObjetos();
        this.configurarAtalhosZoom();

        // --- ARRASTAR CÂMERA ---
        const viewport = document.querySelector('.viewport-edicao');
        let isDown = false;
        let startX, startY, scrollLeft, scrollTop;

        if (viewport) {
            viewport.addEventListener('mousedown', (e) => {
                // DESATIVA ARRASTO DA CÂMERA SE FOR PISO (para permitir pintura)
                if (this.ferramentaAtual.startsWith('piso')|| this.ferramentaAtual.startsWith('cerca')) return;

                if (e.button === 0) { // Só arrasta com o botão esquerdo
                    isDown = true;
                    this.estado.houveArrasto = false;
                    startX = e.pageX - viewport.offsetLeft;
                    startY = e.pageY - viewport.offsetTop;
                    scrollLeft = viewport.scrollLeft;
                    scrollTop = viewport.scrollTop;
                }
            });

            viewport.addEventListener('mouseleave', () => { isDown = false; this.estado.botaoPressionado = null;})
            viewport.addEventListener('mouseup', () => { isDown = false; viewport.style.cursor = 'grab'; });
            viewport.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                const x = e.pageX - viewport.offsetLeft;
                const y = e.pageY - viewport.offsetTop;
                const deltaX = Math.abs(x - startX);
                const deltaY = Math.abs(y - startY);
                
                if (deltaX > 4 || deltaY > 4) {
                    this.estado.houveArrasto = true;
                    viewport.style.cursor = 'grabbing';
                    viewport.scrollLeft = scrollLeft - (x - startX);
                    viewport.scrollTop = scrollTop - (y - startY);
                    this.sincronizarScroll();
                }
            });
        }
    },
    // --- Lógica de Conexão Inteligente de Cercas ---
   recalcularConexaoCerca: function(x, y, tipoCerca) {
    const configAlvo = this.objetosConfig[tipoCerca];
    if (!configAlvo || !configAlvo.material) return;
    const mat = configAlvo.material;

    const atualizar = (cx, cy) => {
        const alvo = this.estado.objetos.find(o => o.x === cx && o.y === cy && o.tipo.startsWith(mat));
        if (!alvo) return;

        const ehVizinho = (vx, vy) => {
            return this.estado.objetos.some(o => o.x === vx && o.y === vy && o.tipo.startsWith(mat));
        };

        const temN = ehVizinho(cx, cy - 1);
        const temS = ehVizinho(cx, cy + 1);
        const temL = ehVizinho(cx + 1, cy);
        const temO = ehVizinho(cx - 1, cy);

        // --- TRATAMENTO DE PORTÃO (_g) ---
        if (this.objetosConfig[alvo.tipo].subtipo === 'g') {
            const vizinhosTotais = (temN ? 1 : 0) + (temS ? 1 : 0) + (temL ? 1 : 0) + (temO ? 1 : 0);
            if (vizinhosTotais >= 3) {
                alvo.fmask = "portao-t"; // -32px -160px
            } else if (temN || temS) {
                alvo.fmask = "portao-v"; // -0px -160px
            } else {
                alvo.fmask = "portao-h"; // -0px -128px
            }
            return;
        }

        // --- TRATAMENTO DE CERCA NORMAL (_f) ---

        // 1. Linha Horizontal Inferior (Meio entre os cantos: tem vizinho Leste e Oeste)
        // Se ela tem Leste e Oeste, ela é o meio horizontal da base:
        if (temL && temO) {
            // Se estiver na linha de baixo (sem vizinho ao Sul, mas com vizinhos laterais):
            // Usa a haste horizontal de base (-16px -64px)
            alvo.fmask = "base-meio"; 
        }
        // 2. Cantos Inferiores (fazem a virada para cima)
        else if (temN && temL) {
            alvo.fmask = "cima-dir";     // -0px -64px (Canto inferior esquerdo)
        } 
        else if (temN && temO) {
            alvo.fmask = "cima-esq";     // -32px -64px (Canto inferior direito)
        } 
        // 3. Colunas Verticais
        else if (temN) {
            alvo.fmask = "cima";         // -0px -32px (Extensão para cima)
        } 
        // 4. Pontas Horizontais (fora de quina)
        else if (temL) {
            alvo.fmask = "dir";          // -0px -0px (Junção para Direita)
        } 
        else if (temO) {
            alvo.fmask = "esq";          // -32px -0px (Junção para Esquerda)
        } 
        // 5. Isolada
        else {
            alvo.fmask = "isolada";      // -32px -32px
        }
    };

    // Atualiza a célula clicada e todas as vizinhas ortogonais
    [ [x, y], [x, y - 1], [x, y + 1], [x + 1, y], [x - 1, y] ].forEach(([nx, ny]) => atualizar(nx, ny));
},

    // Lógica Matemática de Bitmasking para Caminhos
    recalcularBitmasksVizinhos: function(x, y, tipoPiso) {
    const direcoes = [
        { dx: 0, dy: -1, bit: 1 }, // Norte
        { dx: 1, dy: 0,  bit: 2 }, // Leste
        { dx: 0, dy: 1,  bit: 4 }, // Sul
        { dx: -1, dy: 0, bit: 8 }  // Oeste

        
    ];
    const mapaSV = {
        // SEÇÃO 1: ISOLADO
        0:  0,   // (0,0)

        // SEÇÃO 2: VERTICAL (Coluna 0 das linhas 1, 2 e 3)
        4:  4,   // (1,0) - Topo Vertical
        5:  8,   // (2,0) - Meio Vertical
        1:  12,  // (3,0) - Base Vertical

        // SEÇÃO 3: HORIZONTAL (Linha 3 das colunas 1, 2 e 3)
        2:  13,  // (3,1) - Esquerda Horizontal
        10: 14,  // (3,2) - Meio Horizontal
        8:  15,  // (3,3) - Direita Horizontal

        // SEÇÃO 4: QUADRADO 3x3
        // Linha 0 (Topo)
        6:  1,   // (0,1) - Quina TL (Vizinhos E+S)
        14: 2,   // (0,2) - Borda Topo (Vizinhos E+W+S)
        12: 3,   // (0,3) - Quina TR (Vizinhos W+S)
        // Linha 1 (Meio)
        7:  5,   // (1,1) - Borda Esquerda (Vizinhos N+S+E)
        15: 6,   // (1,2) - Centro (Vizinhos N+S+E+W)
        13: 7,   // (1,3) - Borda Direita (Vizinhos N+S+W)
        // Linha 2 (Base)
        3:  9,   // (2,1) - Quina BL (Vizinhos N+E)
        11: 10,  // (2,2) - Borda Baixo (Vizinhos N+E+W)
        9:  11   // (2,3) - Quina BR (Vizinhos N+W)
    };
    const atualizarPonto = (cx, cy) => {
            const alvo = this.estado.objetos.find(o => o.x === cx && o.y === cy && o.tipo === tipoPiso);
            if (!alvo) return;

            let somaBinaria = 0;
            direcoes.forEach(dir => {
                const possuiVizinho = this.estado.objetos.some(o => 
                    o.x === cx + dir.dx && 
                    o.y === cy + dir.dy && 
                    o.tipo === tipoPiso
                );
                if (possuiVizinho) somaBinaria += dir.bit;
            });

            // Aplica o remapeamento para os índices 0-15 da spritesheet
            alvo.mask = mapaSV[somaBinaria] ?? 0;
        };
        
        // Executa a atualização no ponto clicado e nos 4 vizinhos
        atualizarPonto(x, y);
        direcoes.forEach(dir => atualizarPonto(x + dir.dx, y + dir.dy));
},
colocarObjeto: function(x, y, tipo) {
    const config = this.objetosConfig[tipo];
    if (!config) return;

    const novoLarg = config.dimensao?.[0] || 1;
    const novoAlt = config.dimensao?.[1] || 1;

    if (config.limiteMaximo) {
        const quantidadeAtual = this.estado.objetos.filter(obj => obj.tipo === tipo).length;
        const jaExisteAqui = this.estado.objetos.some(obj => obj.x === x && obj.y === y && obj.tipo === tipo);
        if (quantidadeAtual >= config.limiteMaximo && !jaExisteAqui) return;
    }

    const removidos = [];
    this.estado.objetos = this.estado.objetos.filter(obj => {
        const objConfig = this.objetosConfig[obj.tipo];
        const objLarg = objConfig?.dimensao?.[0] || 1;
        const objAlt = objConfig?.dimensao?.[1] || 1;
        
        // Colisão AABB bidirecional (considera o tamanho do novo E do antigo)
        const colide = (x < obj.x + objLarg && x + novoLarg > obj.x && 
                        y < obj.y + objAlt && y + novoAlt > obj.y);
        if (colide) removidos.push(obj);
        return !colide;
    });

    const novoObjeto = { x, y, tipo };
    if (config.isCerca) novoObjeto.fmask = "isolada";
    this.estado.objetos.push(novoObjeto);

    if (config.isPiso) {
        this.recalcularBitmasksVizinhos(x, y, tipo);
    } else if (config.isCerca) {
        this.recalcularConexaoCerca(x, y, tipo);
    }

    removidos.forEach(r => {
        const confR = this.objetosConfig[r.tipo];
        if (confR?.isPiso) this.recalcularBitmasksVizinhos(r.x, r.y, r.tipo);
        if (confR?.isCerca) this.recalcularConexaoCerca(r.x, r.y, r.tipo);
    });

    // Atualiza granularmente todas as células do objeto e suas bordas imediatas
    for (let dy = -1; dy <= novoAlt; dy++) {
        for (let dx = -1; dx <= novoLarg; dx++) {
            this.renderizarCelula(x + dx, y + dy);
        }
    }

    // Canvas só redesenha se houver alcance ou flores envolvidas
    if (config.alcance?.length > 0 || config.categoria === 'flores' || removidos.some(r => this.objetosConfig[r.tipo]?.alcance?.length > 0)) {
        this.atualizarCanvasAlcances();
    }
},

// Acesso direto em O(1)
    obterCelulaDOM: function(x, y) {
        if (x < 0 || x >= this.config.largura || y < 0 || y >= this.config.altura) return null;
        return this.celulasDOM[y * this.config.largura + x] || null;
    },

    // RENDERIZAÇÃO GRANULAR: atualiza apenas a célula solicitada
    renderizarCelula: function(x, y) {
        const celulaDOM = this.obterCelulaDOM(x, y);
        if (!celulaDOM) return;

        const obj = this.estado.objetos.find(o => {
            const conf = this.objetosConfig[o.tipo];
            const larg = conf?.dimensao?.[0] || 1;
            const alt = conf?.dimensao?.[1] || 1;
            return x >= o.x && x < o.x + larg && y >= o.y && y < o.y + alt;
        });

        let divSprite = celulaDOM.querySelector('.objeto-sprite');

        if (!obj) {
            if (divSprite) divSprite.remove();
            return;
        }

        const config = this.objetosConfig[obj.tipo];
        if (!config) return;

        const dx = x - obj.x;
        const dy = y - obj.y;

        if (!divSprite) {
            divSprite = document.createElement('div');
            divSprite.style.position = 'absolute';
            divSprite.style.pointerEvents = 'none';
            celulaDOM.appendChild(divSprite);
        }

        divSprite.className = 'objeto-sprite';

        if (config.isCerca) {
            divSprite.classList.add(`tile-${obj.tipo}`, `fmask-${obj.fmask || 'isolada'}`);
            divSprite.style.zIndex = (config.subtipo === 'g') ? '3' : '4';
            divSprite.style.width = '';
            divSprite.style.height = '';
            divSprite.style.transform = '';
            divSprite.style.top = '';
            divSprite.style.left = '';
        } else if (config.isPiso) {
            divSprite.classList.add(`tile-${obj.tipo}`, `mask-${obj.mask || 0}`);
            divSprite.style.width = '32px';
            divSprite.style.height = '32px';
            divSprite.style.transform = 'scale(1.5)';
            divSprite.style.transformOrigin = 'top left';
            divSprite.style.zIndex = '2';
            divSprite.style.top = '0';
            divSprite.style.left = '0';
        } else {
            const larg = config.dimensao ? config.dimensao[0] : 1;
            const alt = config.dimensao ? config.dimensao[1] : 1;
            if (larg > 1 || alt > 1) {
                divSprite.classList.add(`tile-${obj.tipo}-${dx}-${dy}`);
            } else {
                divSprite.classList.add(`tile-${obj.tipo}`);
            }
            divSprite.style.zIndex = '5';
            divSprite.style.width = '100%';
            divSprite.style.height = '100%';
            divSprite.style.top = '0';
            divSprite.style.left = '0';
        }

        divSprite.querySelectorAll('.badge-flor-colmeia').forEach(b => b.remove());
        if (config.categoria === 'cMel' && dx === 0 && dy === 0) {
            const flor = this.obterFlorPrioritaria(obj.x, obj.y);
            if (flor) {
                const badge = document.createElement('div');
                badge.classList.add('badge-flor-colmeia', `tile-${flor.tipo}`);
                divSprite.appendChild(badge);
            }
        }
    },

    obterFlorPrioritaria: function(colmeiaX, colmeiaY) {
        const listaFlores = this.estado.objetos.filter(o => o.tipo && o.tipo.startsWith('flor'));
        let melhorFlor = null;
        let menorDistancia = Infinity;
        let menorX = Infinity;
        let menorY = Infinity;

        listaFlores.forEach(flor => {
            const dx = flor.x - colmeiaX;
            const dy = flor.y - colmeiaY;
            const dist = Math.abs(dx) + Math.abs(dy);

            // Alcance máximo do apiário: 5 casas em losango
            if (dist > 0 && dist <= 5) {
                // 1º Critério: Menor distância absoluta
                if (dist < menorDistancia) {
                    menorDistancia = dist;
                    menorX = flor.x;
                    menorY = flor.y;
                    melhorFlor = flor;
                } 
                // 2º Critério (Empate na distância): Prioridade para a flor mais à ESQUERDA (menor X)
                else if (dist === menorDistancia) {
                    if (flor.x < menorX) {
                        menorDistancia = dist;
                        menorX = flor.x;
                        menorY = flor.y;
                        melhorFlor = flor;
                    } 
                    // 3º Critério (Empate na distância e no X): Prioridade para a flor mais ACIMA (menor Y)
                    else if (flor.x === menorX && flor.y < menorY) {
                        menorDistancia = dist;
                        menorX = flor.x;
                        menorY = flor.y;
                        melhorFlor = flor;
                    }
                }
            }
        });

        return melhorFlor;
    },

    atualizarCanvasAlcances: function() {
        const canvasF = document.getElementById('canvas-alcances-fundo');
        const canvasT = document.getElementById('canvas-alcances-topo');
        if (!canvasF || !canvasT) return;

        const ctxF = canvasF.getContext('2d');
        const ctxT = canvasT.getContext('2d');
        ctxF.clearRect(0, 0, canvasF.width, canvasF.height);
        ctxT.clearRect(0, 0, canvasT.width, canvasT.height);

        const tamanho = this.config.tamanhoCelula;

        this.estado.objetos.forEach(obj => {
            const config = this.objetosConfig[obj.tipo];
            if (!config || !this.estado.visibilidade[config.categoria] || !config.alcance?.length) return;

            if (config.categoria === 'cMel') {
                const florVinculada = this.obterFlorPrioritaria(obj.x, obj.y);
                config.alcance.forEach(([dx, dy]) => {
                    if (dx === 0 && dy === 0) return;
                    const ax = obj.x + dx;
                    const ay = obj.y + dy;
                    if (ax >= 0 && ax < this.config.largura && ay >= 0 && ay < this.config.altura) {
                        const px = ax * tamanho;
                        const py = ay * tamanho;
                        const ehFlorAtiva = florVinculada && (ax === florVinculada.x && ay === florVinculada.y);

                        ctxF.fillStyle = 'rgba(255, 180, 0, 0.18)';
                        ctxF.fillRect(px, py, tamanho, tamanho);

                        if (ehFlorAtiva) {
                            ctxT.fillStyle = 'rgba(255, 215, 0, 0.35)';
                            ctxT.fillRect(px, py, tamanho, tamanho);
                            ctxT.strokeStyle = '#FFFFFF';
                            ctxT.lineWidth = 3;
                            ctxT.strokeRect(px + 2, py + 2, tamanho - 4, tamanho - 4);
                        }

                        ctxT.strokeStyle = '#FF2222';
                        ctxT.lineWidth = 2;
                        if (!config.alcance.some(([nx, ny]) => nx === dx && ny === dy - 1)) {
                            ctxT.beginPath(); ctxT.moveTo(px, py); ctxT.lineTo(px + tamanho, py); ctxT.stroke();
                        }
                        if (!config.alcance.some(([nx, ny]) => nx === dx && ny === dy + 1)) {
                            ctxT.beginPath(); ctxT.moveTo(px, py + tamanho); ctxT.lineTo(px + tamanho, py + tamanho); ctxT.stroke();
                        }
                        if (!config.alcance.some(([nx, ny]) => nx === dx - 1 && ny === dy)) {
                            ctxT.beginPath(); ctxT.moveTo(px, py); ctxT.lineTo(px, py + tamanho); ctxT.stroke();
                        }
                        if (!config.alcance.some(([nx, ny]) => nx === dx + 1 && ny === dy)) {
                            ctxT.beginPath(); ctxT.moveTo(px + tamanho, py); ctxT.lineTo(px + tamanho, py + tamanho); ctxT.stroke();
                        }
                    }
                });

                if (florVinculada) {
                    ctxT.beginPath();
                    ctxT.setLineDash([6, 6]);
                    ctxT.moveTo((obj.x + 0.5) * tamanho, (obj.y + 0.5) * tamanho);
                    ctxT.lineTo((florVinculada.x + 0.5) * tamanho, (florVinculada.y + 0.5) * tamanho);
                    ctxT.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                    ctxT.lineWidth = 2;
                    ctxT.stroke();
                    ctxT.setLineDash([]);
                }
            } else {
                const corOriginal = this.coresAlcance[config.categoria];
                if (corOriginal) {
                    ctxF.fillStyle = corOriginal;
                    config.alcance.forEach(([dx, dy]) => {
                        const ax = obj.x + dx;
                        const ay = obj.y + dy;
                        if (ax >= 0 && ax < this.config.largura && ay >= 0 && ay < this.config.altura) {
                            ctxF.fillRect(ax * tamanho, ay * tamanho, tamanho, tamanho);
                        }
                    });
                }
            }
        });
    },
renderizarObjetos: function() {
        for (let y = 0; y < this.config.altura; y++) {
            for (let x = 0; x < this.config.largura; x++) {
                this.renderizarCelula(x, y);
            }
        }
        this.atualizarCanvasAlcances();
    },

    construirControles: function() {
        const container = document.getElementById('controles-container');
        if (!container) return;

        container.innerHTML = ''; 
        const categories = [...new Set(
            Object.values(this.objetosConfig)
                .map(o => o.categoria)
                .filter(cat => cat && cat !== 'flores' && cat !== 'construcao')
        )];

        categories.forEach(cat => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" ${this.estado.visibilidade[cat] ? 'checked' : ''}> Ver ${cat}`;
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
        const subFlores = document.getElementById('submenu-flores');
        const subColmeias = document.getElementById('submenu-colmeias');
        const subPisos = document.getElementById('submenu-pisos');
        const subCercas = document.getElementById('submenu-cercas');

        if (subAspersores) subAspersores.innerHTML = '';
        if (subEspantalhos) subEspantalhos.innerHTML = '';
        if (subFlores) subFlores.innerHTML = '';
        if (subColmeias) subColmeias.innerHTML = '';
        if (subPisos) subPisos.innerHTML = '';
        if (subCercas) subCercas.innerHTML = '';

        const aspersores = [
            { id: 'aspersorC', nome: 'Aspersor Comum' },
            { id: 'aspersorQ', nome: 'Aspersor de Qualidade' },
            { id: 'aspersorI', nome: 'Aspersor de Irídio' }
        ];

        const espantalhos = [
            { id: 'espantalho', nome: 'Espantalho Clássico' },
            ...Array.from({ length: 8 }, (_, i) => ({ id: `espantalhoR${i + 1}`, nome: `Espantalho Raro ${i + 1}` })),
            { id: 'espantalhoLuxo', nome: 'Espantalho de Luxo' }
        ];

        const flores = [
            { id: 'florTulipa', nome: 'Tulipa' },
            { id: 'florJasmim', nome: 'Jasmim-azul' },
            { id: 'florMicanga', nome: 'Flor-Miçanga' },
            { id: 'florPapoula', nome: 'Papoula' },
            { id: 'florGirassol', nome: 'Girassol' },
            { id: 'florRosaFada', nome: 'Rosa-de-fada' }
        ];

        const colmeias = [
            { id: 'colmeia', nome: 'Colméia' },
            { id: 'colmeiaVazia', nome: 'Colméia Vazia' }
        ];

        const caminhos = [
            { id: 'piso1', nome: 'Piso de Madeira' },
            { id: 'piso2', nome: 'piso de Pedra' },
            { id: 'piso3', nome: 'piso desgastado' },
            { id: 'piso4', nome: 'piso de Cristal' },
            { id: 'piso5', nome: 'piso de palha' },
            { id: 'piso6', nome: 'caminho de cascalho' },
            { id: 'piso7', nome: 'caminho de Madeira' },
            { id: 'piso8', nome: 'caminho de cristal' },
            { id: 'piso9', nome: 'caminho arredondado de pedra' },
            { id: 'piso10', nome: 'caminho de pedras polidas' },
            { id: 'piso11', nome: 'caminho de Tijolos' },
            { id: 'piso12', nome: 'piso rústico de tábuas' },
            { id: 'piso13', nome: 'piso passarela de pedras' }
        ];
        const cercas = [
            { id: 'cerca1_f', nome: 'Cerca de Madeira' },
            { id: 'cerca1_g', nome: 'Portão de Madeira' },
            { id: 'cerca2_f', nome: 'Cerca de Madeira de Lei' },
            { id: 'cerca2_g', nome: 'Portão de Madeira de Lei' },
            { id: 'cerca3_f', nome: 'Cerca de pedra' },
            { id: 'cerca3_g', nome: 'Portão de pedra' },
            { id: 'cerca4_f', nome: 'Cerca de ferro' },
            { id: 'cerca4_g', nome: 'Portão de ferro' }
        ];

        const criarBotao = (tipo, container, isMaster = false) => {
            const btn = document.createElement('button');   
            const classeBase = isMaster ? 'botao-ferramenta' : 'botao-variante';
            btn.className = `${classeBase} tile-${tipo.id}`;
            btn.setAttribute('onclick', `FarmPlanner.selecionarFerramenta('${tipo.id}')`);
            btn.title = tipo.nome;
            btn.dataset.tipo = tipo.id; 

            container.appendChild(btn);
            return btn;
        };

        const obstaculos = [
            { id: 'tocoGrande', nome: 'Toco grande' },
            { id: 'troncoGrande', nome: 'tronco Grande' },
            { id: 'pedraCinza', nome: 'Pedra Cinza' },
            { id: 'pedraVermelha', nome: 'Grande pedra vermelha' },
            { id: 'pedraMarrom', nome: 'Grande pedra marrom' },
            { id: 'pedraAzul', nome: 'Grande pedra azul' },
            { id: 'pedraAzul2', nome: 'Grande pedra azul' },
            { id: 'obMeteorito', nome: 'Meteorito' }
        ];

        if (subAspersores) aspersores.forEach(asp => criarBotao(asp, subAspersores));
        if (subEspantalhos) espantalhos.forEach(esp => criarBotao(esp, subEspantalhos));
        if (subFlores) flores.forEach(flr => criarBotao(flr, subFlores));
        if (subColmeias) colmeias.forEach(col => criarBotao(col, subColmeias));
        if (subPisos) caminhos.forEach(piso => criarBotao(piso, subPisos));
        if (subCercas) cercas.forEach(c => criarBotao(c, subCercas)); // Nova linha

        const areaMaster_obstaculos = document.getElementById('btn-master-obstaculos-container');
        if (areaMaster_obstaculos) {
            areaMaster_obstaculos.innerHTML = '';
            const master = criarBotao({ id: 'tocoGrande', nome: 'Obstáculos' }, areaMaster_obstaculos, true);
            master.id = 'btn-master-obstaculos';
        }

        const sub_obstaculos = document.getElementById('submenu-obstaculos');
        if (sub_obstaculos) {
            sub_obstaculos.innerHTML = '';
            obstaculos.forEach(item => criarBotao(item, sub_obstaculos));
        }


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

        const areaMasterFlores = document.getElementById('btn-master-flores-container');
        if (areaMasterFlores) {
            areaMasterFlores.innerHTML = '';
            const masterFlr = criarBotao({ id: 'florTulipa', nome: 'Tulipa' }, areaMasterFlores, true);
            masterFlr.id = 'btn-master-flores';
        }

        const areaMasterColmeia = document.getElementById('btn-master-colmeias-container');
        if (areaMasterColmeia) {
            areaMasterColmeia.innerHTML = '';
            const masterCol = criarBotao({ id: 'colmeia', nome: 'Colméia' }, areaMasterColmeia, true);
            masterCol.id = 'btn-master-colmeias';
        }

        const areaMasterPisos = document.getElementById('btn-master-pisos-container');
        if (areaMasterPisos) {
            areaMasterPisos.innerHTML = '';
            const masterPiso = criarBotao({ id: 'piso1', nome: 'Caminhos' }, areaMasterPisos, true);
            masterPiso.id = 'btn-master-pisos';
        }

        const areaObelisco = document.getElementById('btn-obelisco-container');
        if (areaObelisco) {
            areaObelisco.innerHTML = '';
            const btnObelisco = criarBotao({ id: 'miniObelisco', nome: 'Mini-Obelisco' }, areaObelisco, true);
            btnObelisco.id = 'btn-obelisco';
        }
        const areaMasterCercas = document.getElementById('btn-master-cercas-container');
        if (areaMasterCercas) {
        areaMasterCercas.innerHTML = '';
        const masterCerca = criarBotao({ id: 'cerca1_f', nome: 'Cercas' }, areaMasterCercas, true);
        masterCerca.id = 'btn-master-cercas';
        }

        this.selecionarFerramenta('aspersorC');
    },

  gerenciarClique: function(celula, botao) {
        if (!celula) return;
        const x = parseInt(celula.dataset.x);
        const y = parseInt(celula.dataset.y);
        
        if (botao === 'direito') {
            const objRemovido = this.estado.objetos.find(obj => {
                const objConfig = this.objetosConfig[obj.tipo];
                const objLarg = (objConfig && objConfig.dimensao) ? objConfig.dimensao[0] : 1;
                const objAlt = (objConfig && objConfig.dimensao) ? objConfig.dimensao[1] : 1;
                return (x >= obj.x && x < obj.x + objLarg && y >= obj.y && y < obj.y + objAlt);
            });

            if (objRemovido) {
                const tipoAntigo = objRemovido.tipo;
                const xAntigo = objRemovido.x;
                const yAntigo = objRemovido.y;
                const configRemovido = this.objetosConfig[tipoAntigo];
                const remLarg = configRemovido?.dimensao?.[0] || 1;
                const remAlt = configRemovido?.dimensao?.[1] || 1;

                this.estado.objetos = this.estado.objetos.filter(obj => obj !== objRemovido);

                if (configRemovido?.isPiso) {
                    this.recalcularBitmasksVizinhos(xAntigo, yAntigo, tipoAntigo);
                } else if (configRemovido?.isCerca) {
                    this.recalcularConexaoCerca(xAntigo, yAntigo, tipoAntigo);
                }

                // Renderiza a área ocupada pelo objeto removido + 1 célula de borda
                for (let dy = -1; dy <= remAlt; dy++) {
                    for (let dx = -1; dx <= remLarg; dx++) {
                        this.renderizarCelula(xAntigo + dx, yAntigo + dy);
                    }
                }

                if (configRemovido?.alcance?.length > 0 || configRemovido?.categoria === 'flores') {
                    this.atualizarCanvasAlcances();
                }
            }
        } else {
            // SEGURANÇA CONTRA SPAM NO ARRASTO:
            // Só executa o "ColocarObjeto" se a célula não tiver esse objeto ou se for um piso diferente
            const objExistente = this.estado.objetos.find(o => o.x === x && o.y === y);
            if (objExistente && objExistente.tipo === this.ferramentaAtual) return;

            this.colocarObjeto(x, y, this.ferramentaAtual);
        }
    },

    selecionarFerramenta: function(tipo) {
        this.ferramentaAtual = tipo;
        
        document.querySelectorAll('.botao-ferramenta, .botao-variante').forEach(btn => {
            btn.classList.remove('ativa');
        });

        const botaoAlvo = document.querySelector(`.botao-variante[data-tipo="${tipo}"]`);
        if (botaoAlvo) {
            botaoAlvo.classList.add('ativa');
        }

        const sincronizarMaster = (idMasterBtn) => {
            const btnMaster = document.getElementById(idMasterBtn);
            if (!btnMaster) return;

            btnMaster.classList.add('ativa');
            btnMaster.setAttribute('onclick', `FarmPlanner.selecionarFerramenta('${tipo}')`);
            btnMaster.dataset.tipo = tipo;

            const classesLimpas = btnMaster.className.split(' ').filter(c => !c.startsWith('tile-'));
            btnMaster.className = classesLimpas.join(' ') + ` tile-${tipo}`;
        };

        if (tipo.startsWith('aspersor')) {
            sincronizarMaster('btn-master-aspersores');
        } else if (tipo.startsWith('espantalho')) {
            sincronizarMaster('btn-master-espantalhos');
        } else if (tipo.startsWith('flor')) {
            sincronizarMaster('btn-master-flores');
        } else if (tipo.startsWith('colmeia') || tipo === 'colmeiaVazia') {
            sincronizarMaster('btn-master-colmeias');
        } else if (tipo.startsWith('piso')) {
            sincronizarMaster('btn-master-pisos');
        } else if (tipo.startsWith('cerca')) { // <--- ADICIONE ESTE BLOCO
            sincronizarMaster('btn-master-cercas');
        } else {
            const submenuPai = botaoAlvo ? botaoAlvo.closest('.submenu-variacoes') : document.querySelector(`.submenu-variacoes [data-tipo="${tipo}"]`)?.closest('.submenu-variacoes');
            
            if (submenuPai) {
                const grupoId = submenuPai.id.replace('submenu-', '');
                sincronizarMaster(`btn-master-${grupoId}`);
            } else if (tipo === 'miniObelisco') {
                const master = document.getElementById('btn-obelisco') || document.querySelector('[data-tipo="miniObelisco"]');
                if (master) master.classList.add('ativa');
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