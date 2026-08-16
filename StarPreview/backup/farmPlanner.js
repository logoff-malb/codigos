/**
 * farmPlanner.js
 * Funcionalidade de planejamento da fazenda (Projetor de Layout)
 */
const FarmPlanner = {
    config: {
        largura: 60,
        altura: 60,
        tamanhoCelula: 48 // Tamanho fixo de cada célula do grid em px
    },
    
    matriz: [],

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

        viewport.addEventListener('wheel', (e) => {
            if (e.altKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.1 : -0.1;
                this.alterarZoom(delta);
            }
        }, { passive: false });

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
            const x = i % this.config.largura;
            const y = Math.floor(i / this.config.largura);

            const celula = document.createElement('div');
            celula.classList.add('celula-grade');
            celula.dataset.index = i;
            celula.dataset.x = x;
            celula.dataset.y = y;
            celula.style.position = 'relative';
            celula.style.zIndex = '2';
            
            // Previne o menu de contexto do Windows para o botão direito na grade
            celula.oncontextmenu = (e) => e.preventDefault();

            celula.onmousedown = (e) => {
                // Define se estamos agindo com o botão esquerdo (0) ou direito (2)
                this.estado.botaoPressionado = (e.button === 2) ? 'direito' : 'esquerdo';
                this.gerenciarClique(celula, this.estado.botaoPressionado);
            };

            celula.onmouseenter = () => {
                // Lógica de Pintura: Só pinta no arrasto se for Botão Direito (Borracha)
                // OU se for Botão Esquerdo COM ferramenta de PISO selecionada.
                if (this.estado.botaoPressionado) {
                    if (this.estado.botaoPressionado === 'direito' || this.ferramentaAtual.startsWith('piso')) {
                        this.gerenciarClique(celula, this.estado.botaoPressionado);
                    }
                }
            };

            container.appendChild(celula);
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
                if (this.ferramentaAtual.startsWith('piso')) return;

                if (e.button === 0) { // Só arrasta com o botão esquerdo
                    isDown = true;
                    viewport.style.cursor = 'grabbing';
                    startX = e.pageX - viewport.offsetLeft;
                    startY = e.pageY - viewport.offsetTop;
                    scrollLeft = viewport.scrollLeft;
                    scrollTop = viewport.scrollTop;
                }
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
        }
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
        0: 0,   // Isolado (Seção Vermelha)
        2: 1,   // Início Horizontal (Só E)
        10: 2,  // Meio Horizontal (E+W)
        8: 3,   // Fim Horizontal (Só W)
        4: 4,   // Topo Vertical (Só S)
        6: 5,   // Canto SE
        14: 6,  // T-Sul (E+S+W)
        12: 7,  // Canto SW
        5: 8,   // Meio Vertical (N+S)
        7: 9,   // T-Leste (N+S+E)
        15: 10, // Cruzamento Total
        13: 11, // T-Oeste (N+S+W)
        1: 12,  // Base Vertical (Só N)
        3: 13,  // Canto NE
        11: 14, // T-Norte (N+E+W)
        9: 15   // Canto NW
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

        const larg = config.dimensao ? config.dimensao[0] : 1;
        const alt = config.dimensao ? config.dimensao[1] : 1;

        if (x + larg > this.config.largura || y + alt > this.config.altura) return;

        // Lógica de colisão (AABB) - Se for piso, remove apenas pisos. Se for objeto, remove tudo.
        this.estado.objetos = this.estado.objetos.filter(obj => {
            const objConfig = this.objetosConfig[obj.tipo];
            const objLarg = (objConfig && objConfig.dimensao) ? objConfig.dimensao[0] : 1;
            const objAlt = (objConfig && objConfig.dimensao) ? objConfig.dimensao[1] : 1;

            const colide = (x < obj.x + objLarg && x + larg > obj.x && y < obj.y + objAlt && y + alt > obj.y);
            
            // Se estou colocando um piso, ele só substitui outro piso na mesma célula exata
            if (config.isPiso) {
                return !(x === obj.x && y === obj.y);
            }
            return !colide;
        });

        const novoObjeto = { x, y, tipo };
        this.estado.objetos.push(novoObjeto);

        // ATENÇÃO: Chamar recálculo aqui para os pisos atualizarem ao desenhar!
        if (config.isPiso) {
            this.recalcularBitmasksVizinhos(x, y, tipo);
        }

        this.renderizarObjetos();
    },

    renderizarObjetos: function() {
        // 1. Limpa os sprites do DOM
        document.querySelectorAll('.objeto-sprite').forEach(el => el.remove());

        // 2. Prepara o Canvas
        const canvas = document.getElementById('canvas-alcances');
        let ctx = null;
        if (canvas) {
            ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        const listaFlores = this.estado.objetos.filter(o => o.tipo && o.tipo.startsWith('flor'));

        const obterFlorPrioritaria = (colmeiaX, colmeiaY) => {
            let melhorFlor = null;
            let menorDistancia = Infinity;
            let menorAngulo = Infinity;

            listaFlores.forEach(flor => {
                const dx = flor.x - colmeiaX;
                const dy = flor.y - colmeiaY;
                const distManhattan = Math.abs(dx) + Math.abs(dy);

                if (distManhattan > 0 && distManhattan <= 5) {
                    let angulo = Math.atan2(dy, dx) * (180 / Math.PI);
                    let anguloAjustado = (angulo - 180 + 360) % 360;

                    if (distManhattan < menorDistancia) {
                        menorDistancia = distManhattan;
                        menorAngulo = anguloAjustado;
                        melhorFlor = flor;
                    } else if (distManhattan === menorDistancia && anguloAjustado < menorAngulo) {
                        menorAngulo = anguloAjustado;
                        melhorFlor = flor;
                    }
                }
            });

            return melhorFlor;
        };

        // Mapeamento matemático das 16 posições do bitmask dentro do bloco 4x4 do pisos.png
        const coordenadasMask = {
            0:  { col: 0, row: 0 },
            1:  { col: 0, row: 1 },
            2:  { col: 3, row: 0 },
            3:  { col: 3, row: 1 },
            4:  { col: 0, row: 3 },
            5:  { col: 0, row: 2 },
            6:  { col: 3, row: 3 },
            7:  { col: 3, row: 2 },
            8:  { col: 1, row: 0 },
            9:  { col: 1, row: 1 },
            10: { col: 2, row: 0 },
            11: { col: 2, row: 1 },
            12: { col: 1, row: 3 },
            13: { col: 1, row: 2 },
            14: { col: 2, row: 3 },
            15: { col: 2, row: 2 }
        };

        // 3. Renderização dos Objetos
        this.estado.objetos.forEach(obj => {
            const config = this.objetosConfig[obj.tipo];
            if (!config) return;

            const larg = config.dimensao ? config.dimensao[0] : 1;
            const alt = config.dimensao ? config.dimensao[1] : 1;

            const florVinculada = (config.categoria === 'cMel') 
                ? obterFlorPrioritaria(obj.x, obj.y) 
                : null;

            // RENDERIZAÇÃO DOS SPRITES NO GRID (MATRIZ POR CÉLULA)
            for (let dy = 0; dy < alt; dy++) {
                for (let dx = 0; dx < larg; dx++) {
                    const alvoX = obj.x + dx;
                    const alvoY = obj.y + dy;

                    const celulaDOM = document.querySelector(`.celula-grade[data-x="${alvoX}"][data-y="${alvoY}"]`);
                    if (!celulaDOM) continue;

                    celulaDOM.style.position = 'relative';

                    const divSprite = document.createElement('div');
                    
                    if (config.isPiso) {
                        // Usa as classes mask-0 até mask-15 que batem com o seu mapaSV
                        divSprite.className = `objeto-sprite tile-${obj.tipo} mask-${obj.mask || 0}`;
                        
                        // Mantém a proporção de 48px para o sprite de 32px
                        divSprite.style.width = '32px';
                        divSprite.style.height = '32px';
                        divSprite.style.transform = 'scale(1.5)';
                        divSprite.style.transformOrigin = 'top left';
                    } else {
                        // Lógica original para objetos normais e 2x2
                        if (larg > 1 || alt > 1) {
                            divSprite.classList.add('objeto-sprite', `tile-${obj.tipo}-${dx}-${dy}`);
                        } else {
                            divSprite.classList.add('objeto-sprite', `tile-${obj.tipo}`);
                        }
                    }

                    // Estilos do Tile no Grid
                    divSprite.style.position = 'absolute';
                    divSprite.style.top = '0';
                    divSprite.style.left = '0';
                    divSprite.style.width = '100%';
                    divSprite.style.height = '100%';
                    divSprite.style.margin = '0';
                    divSprite.style.pointerEvents = 'none';
                    divSprite.style.zIndex = config.isPiso ? '3' : '5';

                    // SÓ aplica 'none' se NÃO for piso e NÃO for 2x2 (pois o CSS cuida dos 2x2 e o JS dos pisos)
                    if (!config.isPiso && larg === 1 && alt === 1) {
                        divSprite.style.transform = 'none';
                    }

                    // Se for a origem [0, 0] de uma colmeia vinculada a uma flor, injeta o badge
                    if (dx === 0 && dy === 0 && florVinculada) {
                        const badgeFlor = document.createElement('div');
                        badgeFlor.classList.add('badge-flor-colmeia', `tile-${florVinculada.tipo}`);
                        divSprite.appendChild(badgeFlor);
                    }

                    celulaDOM.appendChild(divSprite);
                }
            }

            // 4. RENDERIZAÇÃO DE ALCANCES NO CANVAS
            if (this.estado.visibilidade[config.categoria] && config.alcance && config.alcance.length > 0 && ctx) {
                if (config.categoria === 'cMel') {
                    const tamanho = this.config.tamanhoCelula;

                    config.alcance.forEach(([dx, dy]) => {
                        if (dx === 0 && dy === 0) return;

                        const alvoX = obj.x + dx;
                        const alvoY = obj.y + dy;

                        if (alvoX >= 0 && alvoX < this.config.largura && alvoY >= 0 && alvoY < this.config.altura) {
                            const px = alvoX * tamanho;
                            const py = alvoY * tamanho;
                            const ehFlorAtiva = florVinculada && (alvoX === florVinculada.x && alvoY === florVinculada.y);

                            if (ehFlorAtiva) {
                                ctx.fillStyle = 'rgba(255, 215, 0, 0.65)';
                                ctx.fillRect(px, py, tamanho, tamanho);
                                ctx.strokeStyle = '#FFFFFF';
                                ctx.lineWidth = 2;
                                ctx.strokeRect(px + 1, py + 1, tamanho - 2, tamanho - 2);
                            } else {
                                ctx.fillStyle = 'rgba(255, 180, 0, 0.22)';
                                ctx.fillRect(px, py, tamanho, tamanho);

                                ctx.strokeStyle = 'rgba(255, 200, 100, 0.15)';
                                ctx.lineWidth = 1;
                                ctx.strokeRect(px, py, tamanho, tamanho);
                            }
                        }
                    });

                    ctx.strokeStyle = '#FF2222';
                    ctx.lineWidth = 2;

                    config.alcance.forEach(([dx, dy]) => {
                        if (dx === 0 && dy === 0) return;
                        const alvoX = obj.x + dx;
                        const alvoY = obj.y + dy;

                        if (alvoX >= 0 && alvoX < this.config.largura && alvoY >= 0 && alvoY < this.config.altura) {
                            const px = alvoX * tamanho;
                            const py = alvoY * tamanho;

                            if (!config.alcance.some(([nx, ny]) => nx === dx && ny === dy - 1)) {
                                ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + tamanho, py); ctx.stroke();
                            }
                            if (!config.alcance.some(([nx, ny]) => nx === dx && ny === dy + 1)) {
                                ctx.beginPath(); ctx.moveTo(px, py + tamanho); ctx.lineTo(px + tamanho, py + tamanho); ctx.stroke();
                            }
                            if (!config.alcance.some(([nx, ny]) => nx === dx - 1 && ny === dy)) {
                                ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + tamanho); ctx.stroke();
                            }
                            if (!config.alcance.some(([nx, ny]) => nx === dx + 1 && ny === dy)) {
                                ctx.beginPath(); ctx.moveTo(px + tamanho, py); ctx.lineTo(px + tamanho, py + tamanho); ctx.stroke();
                            }
                        }
                    });

                    if (florVinculada) {
                        const cX = (obj.x + 0.5) * tamanho;
                        const cY = (obj.y + 0.5) * tamanho;
                        const fX = (florVinculada.x + 0.5) * tamanho;
                        const fY = (florVinculada.y + 0.5) * tamanho;

                        ctx.beginPath();
                        ctx.moveTo(cX, cY);
                        ctx.lineTo(fX, fY);
                        ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([4, 4]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }

                } else {
                    const corOriginal = this.coresAlcance[config.categoria];
                    if (corOriginal) {
                        ctx.fillStyle = corOriginal;
                        config.alcance.forEach(([dx, dy]) => {
                            const alvoX = obj.x + dx;
                            const alvoY = obj.y + dy;
                            
                            if (alvoX >= 0 && alvoX < this.config.largura && alvoY >= 0 && alvoY < this.config.altura) {
                                ctx.fillRect(
                                    alvoX * this.config.tamanhoCelula, 
                                    alvoY * this.config.tamanhoCelula, 
                                    this.config.tamanhoCelula, 
                                    this.config.tamanhoCelula
                                );
                            }
                        });
                    }
                }
            }
        });
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

        if (subAspersores) subAspersores.innerHTML = '';
        if (subEspantalhos) subEspantalhos.innerHTML = '';
        if (subFlores) subFlores.innerHTML = '';
        if (subColmeias) subColmeias.innerHTML = '';
        if (subPisos) subPisos.innerHTML = '';

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
            { id: 'piso1', nome: 'Caminho de Madeira' },
            { id: 'piso2', nome: 'Caminho de Pedra' },
            { id: 'piso3', nome: 'Caminho de Palha' },
            { id: 'piso4', nome: 'Caminho de Cristal' },
            { id: 'piso5', nome: 'Caminho de Grama' },
            { id: 'piso6', nome: 'Caminho de Terra' },
            { id: 'piso7', nome: 'Caminho Placa de Madeira' },
            { id: 'piso8', nome: 'Caminho de Cascalho' },
            { id: 'piso9', nome: 'Caminho de Pedregulho' },
            { id: 'piso10', nome: 'Caminho de Lajota' },
            { id: 'piso11', nome: 'Caminho de Tijolo Vermelho' },
            { id: 'piso12', nome: 'Caminho de Tijolo Escuro' },
            { id: 'piso13', nome: 'Caminho de Tronco' }
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

        if (subAspersores) aspersores.forEach(asp => criarBotao(asp, subAspersores));
        if (subEspantalhos) espantalhos.forEach(esp => criarBotao(esp, subEspantalhos));
        if (subFlores) flores.forEach(flr => criarBotao(flr, subFlores));
        if (subColmeias) colmeias.forEach(col => criarBotao(col, subColmeias));
        if (subPisos) caminhos.forEach(piso => criarBotao(piso, subPisos));

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

        this.selecionarFerramenta('aspersorC');
    },

  gerenciarClique: function(celula, botao) {
        if (!celula) return;
        if (celula.classList.contains('objeto-sprite')) {
            celula = celula.parentElement;
        }

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

                this.estado.objetos = this.estado.objetos.filter(obj => obj !== objRemovido);

                // Recalcula vizinhos para fechar as bordas ao apagar um piso
                if (this.objetosConfig[tipoAntigo] && this.objetosConfig[tipoAntigo].isPiso) {
                    this.recalcularBitmasksVizinhos(xAntigo, yAntigo, tipoAntigo);
                }
                this.renderizarObjetos();
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