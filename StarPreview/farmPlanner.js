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
       
      const viewport = document.querySelector('.viewport-edicao');
    let isDown = false;
    let startX;
    let startY;
    let scrollLeft;
    let scrollTop;

    viewport.addEventListener('mousedown', (e) => {
        isDown = true;
        e.preventDefault();
        viewport.style.cursor = 'grabbing';
        startX = e.pageX - viewport.offsetLeft;
        startY = e.pageY - viewport.offsetTop;
        scrollLeft = viewport.scrollLeft;
        scrollTop = viewport.scrollTop;
    });

    viewport.addEventListener('mouseleave', () => { isDown = false; });
    
    viewport.addEventListener('mouseup', () => {
        isDown = false;
        viewport.style.cursor = 'grab';
    });

    viewport.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - viewport.offsetLeft;
        const y = e.pageY - viewport.offsetTop;
        const walkX = (x - startX);
        const walkY = (y - startY);
        viewport.scrollLeft = scrollLeft - walkX;
        viewport.scrollTop = scrollTop - walkY;
        
        // Chamamos a sincronização do minimapa enquanto move
        this.sincronizarScroll();
    });  
    },

    gerenciarClique: function(celula) {
        console.log("Célula clicada:", celula.dataset.index);
    },

    // A função agora está DENTRO do objeto e separada por vírgula
    sincronizarScroll: function() {
        const viewport = document.querySelector('.viewport-edicao');
        const janela = document.getElementById('janela-destaque');
        
        if (!viewport || !janela) return;

        const proporcao = 4; 
        
        janela.style.left = (viewport.scrollLeft / proporcao) + 'px';
        janela.style.top = (viewport.scrollTop / proporcao) + 'px'; // Adicionado o + 'px' que faltava
    }
}; // Fim do objeto

window.abrirModalLayout = () => FarmPlanner.abrir();