/**
 * farmPlanner.js
 * Funcionalidade de planejamento da fazenda (Projetor de Layout)
 */
const FarmPlanner = {
    config: {
        largura: 60,
        altura: 60
    },
    
    matriz: [],

    // --- Configurações dos Objetos ---
    objetosConfig: {
        aspersorC: { 
            categoria: 'Irrigação', 
            alcance: [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]] 
        }
        // Adicione outros aqui no futuro seguindo o mesmo padrão
    },

    // --- Estado da Aplicação ---
    estado: {
        objetos: [], // Guarda: {x, y, tipo}
        visibilidade: { 'Irrigação': true } // Controle de exibição por categoria
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

        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.config.largura}, 1fr)`;
        
        for (let i = 0; i < (this.config.largura * this.config.altura); i++) {
            const celula = document.createElement('div');
            celula.classList.add('celula-grade');
            celula.dataset.index = i;
            celula.onclick = (e) => this.gerenciarClique(e.target);
            container.appendChild(celula);
        }
        
        // --- Configuração dos Controles e Renderização Inicial ---
        this.construirControles();
        this.renderizarObjetos();

        // Lógica de arrastar (mantida do seu código original)
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

    // --- Funções de Lógica ---

    renderizarObjetos: function() {
        // 1. Limpa todas as marcações de alcance e remove imagens de elementos antigos
        document.querySelectorAll('.celula-grade').forEach(c => {
            c.className = 'celula-grade'; // Reseta classes de alcance/hover
            
            // Remove a div filha do sprite se ela existir
            const spriteAntigo = c.querySelector('.objeto-sprite');
            if (spriteAntigo) spriteAntigo.remove();
        });

        // 2. Desenha objetos e seus alcances
        this.estado.objetos.forEach(obj => {
            const config = this.objetosConfig[obj.tipo];
            if (!config) return;

            // --- DESENHA O SPRITE DO OBJETO (32px centralizado via CSS) ---
            const indiceCentro = (obj.y * this.config.largura) + obj.x;
            const celulaCentro = document.querySelector(`[data-index="${indiceCentro}"]`);
            if (celulaCentro) {
                const divSprite = document.createElement('div');
                divSprite.classList.add('objeto-sprite', `obj-${obj.tipo}`);
                celulaCentro.appendChild(divSprite);
            }

            // --- DESENHA O ALCANCE SE A CATEGORIA ESTIVER VISÍVEL ---
            if (this.estado.visibilidade[config.categoria]) {
                config.alcance.forEach(([dx, dy]) => {
                    const alvoX = obj.x + dx;
                    const alvoY = obj.y + dy;
                    
                    // Validação simples de borda para não quebrar as linhas do grid 60x60
                    if (alvoX >= 0 && alvoX < this.config.largura && alvoY >= 0 && alvoY < this.config.altura) {
                        const indice = (alvoY * this.config.largura) + alvoX;
                        const celula = document.querySelector(`[data-index="${indice}"]`);
                        if (celula) celula.classList.add(`range-${obj.tipo}`);
                    }
                });
            }
        });
    },

    colocarObjeto: function(x, y, tipo) {
        this.estado.objetos.push({ x, y, tipo });
        this.renderizarObjetos();
    },

    construirControles: function() {
        const container = document.getElementById('controles-container');
        if (!container) return;

        container.innerHTML = ''; // Limpa antes de reconstruir
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

    gerenciarClique: function(celula) {
        // Ignora cliques caso o usuário clique diretamente em cima do sprite já renderizado
        if (celula.classList.contains('objeto-sprite')) {
            celula = celula.parentElement;
        }

        const indice = parseInt(celula.dataset.index);
        const x = indice % this.config.largura;
        const y = Math.floor(indice / this.config.largura);
        
        this.colocarObjeto(x, y, this.ferramentaAtual);
    },

    // Altera a ferramenta ativa e atualiza o estado visual do menu lateral
    selecionarFerramenta: function(tipo) {
        this.ferramentaAtual = tipo;
        
        const botoes = document.querySelectorAll('.botao-ferramenta');
        botoes.forEach(btn => {
            btn.classList.remove('ativa');
        });

        // Adiciona a classe ativa no botão que possui o evento para este item
        const botaoAtivo = document.querySelector(`.botao-ferramenta[onclick*="${tipo}"]`);
        if (botaoAtivo) botaoAtivo.classList.add('ativa');
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