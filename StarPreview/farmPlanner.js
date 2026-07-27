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
        'Irrigação': 'rgba(0, 100, 255, 0.4)', // Azul Royal suave
        'Proteção':  'rgba(0, 230, 50, 0.35)', // Verde suave
        'cMel':      'rgba(255, 200, 50, 0.18)' // Vítreo dourado/mel translúcido
    },

    aplicarZoom: function(novoZoom) {
        // Limita o zoom entre 25% (0.25) e 200% (2.0)
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

        // 1. Zoom via Alt + Scroll do Mouse
        viewport.addEventListener('wheel', (e) => {
            if (e.altKey) {
                e.preventDefault(); // Impede a rolagem da página/viewport
                const delta = e.deltaY < 0 ? 0.1 : -0.1;
                this.alterarZoom(delta);
            }
        }, { passive: false });

        // 2. Zoom via Alt + (+) / Alt + (-) / Alt + 0
        window.addEventListener('keydown', (e) => {
            // Aplica o atalho apenas se o modal do planner estiver aberto
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
                    this.aplicarZoom(1.0); // Reseta para 100%
                }
            }
        });
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
            },

            // Colméia (Raio em losango de 5 tiles - Manhattan distance <= 5)
            colmeia: {
                categoria: 'cMel',
                alcance: (() => {
                    const coords = [];
                    for (let dy = -5; dy <= 5; dy++) {
                        const maxDx = 5 - Math.abs(dy);
                        for (let dx = -maxDx; dx <= maxDx; dx++) {
                            coords.push([dx, dy]);
                        }
                    }
                    return coords;
                })()
            },

            // Mini-Obelisco (Construção)
            miniObelisco: {
                categoria: 'construcao',
                alcance: [],         // Sem raio de ação visual
                limiteMaximo: 2     // Trava silenciosa de no máximo 2 unidades
            },

            // Regra base genérica para Flores
            flor: {
                categoria: 'flores',
                alcance: []
            }
        };

        // Raroespantalhos (1 a 8) herdam o alcance padrão
        for (let i = 1; i <= 8; i++) {
            config[`espantalhoR${i}`] = {
                categoria: 'Proteção',
                alcance: config.espantalho.alcance
            };
        }

        // Espantalho de Luxo
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
        objetos: [],
        visibilidade: { 
            'Irrigação': true,
            'Proteção': true,
            'cMel': true
        },
        zoom: 1 // Escala padrão (100%)
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
        this.configurarAtalhosZoom();

        // Arrastar câmera (Drag-to-Scroll)
        const viewport = document.querySelector('.viewport-edicao');
        let isDown = false;
        let startX, startY, scrollLeft, scrollTop;

        if (viewport) {
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
        }
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

        // Mapeia flores existentes para checagem rápida no alcance da Colméia
        const floresSet = new Set(
            this.estado.objetos
                .filter(o => o.tipo.startsWith('flor'))
                .map(o => `${o.x},${o.y}`)
        );

        // 3. Processa e desenha cada objeto
        this.estado.objetos.forEach(obj => {
            // Mapeia flores genéricas para a config 'flor'
            const chaveConfig = obj.tipo.startsWith('flor') ? 'flor' : obj.tipo;
            let config = this.objetosConfig[chaveConfig];
            if (!config) return;

            // Inserção do Sprite no DOM
            const indiceCentro = (obj.y * this.config.largura) + obj.x;
            const celulaCentro = document.querySelector(`[data-index="${indiceCentro}"]`);
            if (celulaCentro) {
                const divSprite = document.createElement('div');
                divSprite.classList.add('objeto-sprite', `tile-${obj.tipo}`);
                celulaCentro.appendChild(divSprite);
            }

            // Exibição dos alcances exclusivamente no Canvas
            if (this.estado.visibilidade[config.categoria] && config.alcance && config.alcance.length > 0 && ctx) {
                
                // RENDERIZAÇÃO ESPECIAL DA COLMÉIA (cMel)
                if (config.categoria === 'cMel') {
                    const tamanho = this.config.tamanhoCelula;

                    // 1. Preenchimento Âmbar/Vítreo
                    config.alcance.forEach(([dx, dy]) => {
                        if (dx === 0 && dy === 0) return;

                        const alvoX = obj.x + dx;
                        const alvoY = obj.y + dy;

                        if (alvoX >= 0 && alvoX < this.config.largura && alvoY >= 0 && alvoY < this.config.altura) {
                            const px = alvoX * tamanho;
                            const py = alvoY * tamanho;
                            const ehFlor = floresSet.has(`${alvoX},${alvoY}`);

                            if (ehFlor) {
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

                    // 2. Linha Vermelha de Contorno Externo
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
                } 
                // RENDERIZAÇÃO PADRÃO (Irrigação / Proteção)
                else {
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

    colocarObjeto: function(x, y, tipo) {
        const config = this.objetosConfig[tipo];

        // --- VALIDAÇÃO SILENCIOSA DE LIMITE MÁXIMO ---
        if (config && config.limiteMaximo) {
            const quantidadeAtual = this.estado.objetos.filter(obj => obj.tipo === tipo).length;
            const celulaJaOcupadaPorEle = this.estado.objetos.some(obj => obj.x === x && obj.y === y && obj.tipo === tipo);

            if (quantidadeAtual >= config.limiteMaximo && !celulaJaOcupadaPorEle) {
                return; // Cancela silenciosamente a colocação do 3º item
            }
        }

        // Substitui objeto existente na célula
        this.estado.objetos = this.estado.objetos.filter(obj => !(obj.x === x && obj.y === y));
        this.estado.objetos.push({ x, y, tipo });
        this.renderizarObjetos();
    },

    construirControles: function() {
        const container = document.getElementById('controles-container');
        if (!container) return;

        container.innerHTML = ''; 
        // Filtra categorias ativas excluindo 'flores' e 'construcao' (pois não possuem raio no canvas)
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

        if (subAspersores) subAspersores.innerHTML = '';
        if (subEspantalhos) subEspantalhos.innerHTML = '';
        if (subFlores) subFlores.innerHTML = '';

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

        const criarBotao = (tipo, container, isMaster = false) => {
            const btn = document.createElement('button');   
            btn.className = isMaster ? 'botao-ferramenta' : 'botao-variante';
            btn.setAttribute('onclick', `FarmPlanner.selecionarFerramenta('${tipo.id}')`);
            btn.title = tipo.nome;
            btn.dataset.tipo = tipo.id; 

            container.appendChild(btn);
            return btn;
        };

        // 1. Preenche Submenus caso os containers existam
        if (subAspersores) aspersores.forEach(asp => criarBotao(asp, subAspersores));
        if (subEspantalhos) espantalhos.forEach(esp => criarBotao(esp, subEspantalhos));
        if (subFlores) flores.forEach(flr => criarBotao(flr, subFlores));

        // 2. Preenche Botões Mestres se os containers existirem
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

        const areaColmeia = document.getElementById('btn-colmeia-container');
        if (areaColmeia) {
            areaColmeia.innerHTML = '';
            const btnColmeia = criarBotao({ id: 'colmeia', nome: 'Colméia' }, areaColmeia, true);
            btnColmeia.id = 'btn-colmeia';
        }

        const areaObelisco = document.getElementById('btn-obelisco-container');
        if (areaObelisco) {
            areaObelisco.innerHTML = '';
            const btnObelisco = criarBotao({ id: 'miniObelisco', nome: 'Mini-Obelisco' }, areaObelisco, true);
            btnObelisco.id = 'btn-obelisco';
        }

        // Seleção inicial
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
        
        // 1. Limpa seleção anterior
        document.querySelectorAll('.botao-ferramenta, .botao-variante').forEach(btn => {
            btn.classList.remove('ativa');
        });

        // 2. Destaca o item no submenu se existir
        const botaoAlvo = document.querySelector(`.botao-variante[data-tipo="${tipo}"]`);
        if (botaoAlvo) {
            botaoAlvo.classList.add('ativa');
        }

        // 3. Atualiza Destaques dos Botões Mestres
        if (tipo.startsWith('aspersor')) {
            const master = document.getElementById('btn-master-aspersores');
            if (master) {
                master.classList.add('ativa');
                master.setAttribute('onclick', `FarmPlanner.selecionarFerramenta('${tipo}')`);
            }
        } else if (tipo.startsWith('espantalho')) {
            const master = document.getElementById('btn-master-espantalhos');
            if (master) {
                master.classList.add('ativa');
                master.setAttribute('onclick', `FarmPlanner.selecionarFerramenta('${tipo}')`);
            }
        } else if (tipo.startsWith('flor')) {
            const master = document.getElementById('btn-master-flores');
            if (master) {
                master.classList.add('ativa');
                master.setAttribute('onclick', `FarmPlanner.selecionarFerramenta('${tipo}')`);
            }
        } else if (tipo === 'colmeia') {
            const master = document.getElementById('btn-colmeia');
            if (master) master.classList.add('ativa');
        } else if (tipo === 'miniObelisco') {
            // Procura tanto pelo botão dinâmico quanto pelo elemento fixo no HTML
            const master = document.getElementById('btn-obelisco') || document.getElementById('botao-miniObelisco');
            if (master) master.classList.add('ativa');
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